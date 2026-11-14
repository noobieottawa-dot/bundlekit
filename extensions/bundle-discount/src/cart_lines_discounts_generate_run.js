/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

const NO_DISCOUNT = { operations: [] };

/**
 * Applique X % de remise sur les produits d'un bundle,
 * uniquement si TOUS les produits du bundle sont dans le panier.
 * Config lue dans la metafield de la remise : {"productIds": [...], "percentage": 10}
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const raw = input.discount?.metafield?.value;
  if (!raw) return NO_DISCOUNT;

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    return NO_DISCOUNT;
  }

  const { productIds, percentage } = config;
  const valid =
    Array.isArray(productIds) &&
    productIds.length >= 2 &&
    typeof percentage === "number" &&
    percentage > 0 &&
    percentage <= 100;
  if (!valid) return NO_DISCOUNT;

  const targets = [];
  const found = new Set();

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;
    const productId = line.merchandise.product.id;
    if (productIds.includes(productId)) {
      found.add(productId);
      targets.push({ cartLine: { id: line.id } });
    }
  }

  // Bundle incomplet : aucune remise
  if (found.size !== productIds.length) return NO_DISCOUNT;

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `Pack -${percentage}%`,
              targets,
              value: { percentage: { value: percentage } },
            },
          ],
          selectionStrategy: "FIRST",
        },
      },
    ],
  };
}