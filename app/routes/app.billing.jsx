import { authenticate } from "../shopify.server";
import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  // Vérifie si le marchand a déjà un abonnement actif
  const { hasActivePayment } = await billing.check({
    plans: ["Plan Pro"],
    isTest: true,
  });

  // Si pas d'abonnement, on lui demande de payer
  if (!hasActivePayment) {
    await billing.request({
      plan: "Plan Pro",
      isTest: true,
      returnUrl: `https://admin.shopify.com/store/${shop.split('.')[0]}/apps/bundlekit/app`,
    });
  }

  // Si abonnement actif, on redirige vers la page d'accueil de l'app
  return redirect("/app");
};

export default function Billing() {
  return <p>Vérification de l'abonnement...</p>;
}