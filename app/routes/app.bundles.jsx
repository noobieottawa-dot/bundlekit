import { useState } from "react";
import { useFetcher } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { billing, session } = await authenticate.admin(request);

  // Vérifie si le marchand a un abonnement actif
  const { hasActivePayment } = await billing.check({
    plans: ["Plan Pro"],
    isTest: true,
  });

  // Si pas d'abonnement, on le redirige vers la page de facturation
  if (!hasActivePayment) {
    const shop = session.shop;
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://admin.shopify.com/store/${shop.split('.')[0]}/apps/bundlekit/app/billing`,
      },
    });
  }

  return null;
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();

  const title = String(form.get("title") || "").trim();
  const percentage = Number(form.get("percentage"));
  let products = [];
  try {
    products = JSON.parse(String(form.get("products") || "[]"));
  } catch {
    products = [];
  }

  if (!title) return { error: "Donnez un nom au pack." };
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 90)
    return { error: "La remise doit être entre 1 et 90 %." };
  if (products.length < 2 || products.length > 4)
    return { error: "Choisissez entre 2 et 4 produits." };

  const productIds = products.map((p) => p.id);
  const handles = products.map((p) => p.handle);

  // 1. Créer la remise automatique
  const discountRes = await admin.graphql(
    `#graphql
    mutation CreateBundleDiscount($d: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $d) {
        automaticAppDiscount { discountId }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        d: {
          title,
          functionHandle: "bundle-discount",
          startsAt: new Date().toISOString(),
          discountClasses: ["PRODUCT"],
          combinesWith: {
            orderDiscounts: true,
            productDiscounts: false,
            shippingDiscounts: true,
          },
          metafields: [
            {
              namespace: "$app:bundle",
              key: "config",
              type: "json",
              value: JSON.stringify({ productIds, percentage }),
            },
          ],
        },
      },
    },
  );
  
  const discountJson = await discountRes.json();
  const discountErrors = discountJson.data?.discountAutomaticAppCreate?.userErrors ?? [];
  
  if (discountErrors.length || discountJson.errors) {
    return {
      error: discountErrors.map((e) => e.message).join(" ") || "Impossible de créer la remise.",
    };
  }

  // 2. Écrire la metafield sur chaque produit via l'API REST/GraphQL directe
  for (const productId of productIds) {
    const metaRes = await admin.graphql(
      `#graphql
      mutation SetProductMetafield($input: ProductInput!) {
        productUpdate(input: $input) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            id: productId,
            metafields: [
              {
                namespace: "bundlekit",
                key: "config",
                type: "json",
                value: JSON.stringify({ percentage, handles }),
              }
            ]
          }
        },
      }
    );
    const metaJson = await metaRes.json();
    const metaErrors = metaJson.data?.productUpdate?.userErrors ?? [];
    if (metaErrors.length) {
      console.error("Erreur metafield:", metaErrors);
      return { error: "Erreur lors de l'enregistrement sur le produit : " + metaErrors.map((e) => e.message).join(" ") };
    }
  }

  return { success: true };
};

export default function Bundles() {
  const fetcher = useFetcher();
  const [products, setProducts] = useState([]);
  const busy = fetcher.state !== "idle";

  async function pickProducts() {
    if (window.shopify && window.shopify.resourcePicker) {
      const selected = await window.shopify.resourcePicker({
        type: "product",
        multiple: 4,
        action: "select",
      });
      if (selected) {
        setProducts(
          selected.map((p) => ({ id: p.id, title: p.title, handle: p.handle })),
        );
      }
    } else {
      alert("L'outil de sélection de produits n'est pas encore chargé. Attendez 2 secondes et réessayez.");
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "24px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Créer un pack</h1>
      <fetcher.Form method="post">
        <label>
          Nom du pack
          <input name="title" required style={{ display: "block", width: "100%", margin: "4px 0 16px" }} />
        </label>
        <label>
          Remise (%)
          <input name="percentage" type="number" min="1" max="90" defaultValue="10" required style={{ display: "block", width: "100%", margin: "4px 0 16px" }} />
        </label>
        <button type="button" onClick={pickProducts}>
          Choisir les produits (2 à 4)
        </button>
        <ul>
          {products.map((p) => (
            <li key={p.id}>{p.title}</li>
          ))}
        </ul>
        <input type="hidden" name="products" value={JSON.stringify(products)} />
        <button type="submit" disabled={busy || products.length < 2}>
          {busy ? "Création..." : "Créer le pack"}
        </button>
      </fetcher.Form>
      {fetcher.data?.error && <p style={{ color: "#b42318" }}>{fetcher.data.error}</p>}
      {fetcher.data?.success && (
        <p style={{ color: "#1a7f37" }}>
          Pack créé. Ajoutez le bloc « Bundle » dans l'éditeur de thème (page produit).
        </p>
      )}
    </div>
  );
}