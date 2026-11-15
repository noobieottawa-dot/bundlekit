import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const { billing, apiKey } = await authenticate.admin(request);

  // Vérifie l'abonnement
  const { hasActivePayment } = await billing.check({
    plans: ["Plan Pro"],
    isTest: true,
  });

  // Si pas d'abonnement, on redirige vers la facturation
  if (!hasActivePayment) {
    const confirmationUrl = await billing.request({
      plan: "Plan Pro",
      isTest: true,
      returnUrl: `https://bundlekit.onrender.com/app`,
    });
    return redirect(confirmationUrl, { target: "_top" });
  }

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/additional">Additional page</s-link>
        <s-link href="/app/bundles">Packs</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};