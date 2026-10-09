import assert from "node:assert/strict";
import test from "node:test";
import { decideHandoff, orderHandoffSchema } from "../src/order_router.js";

test("hands an order to the highest-priority eligible seller asset", () => {
  const order = orderHandoffSchema.parse({
    orderId: "order-1042",
    productName: "Trail mug",
    locale: "en-US",
    sellerAssets: [
      {
        assetId: "disabled-first",
        sellerId: "seller-a",
        capability: "listing-copy",
        locale: "en-US",
        enabled: false,
        priority: 1
      },
      {
        assetId: "french-copy",
        sellerId: "seller-b",
        capability: "listing-copy",
        locale: "fr-FR",
        enabled: true,
        priority: 2
      },
      {
        assetId: "eligible-copy",
        sellerId: "seller-c",
        capability: "listing-copy",
        locale: "en-US",
        enabled: true,
        priority: 3
      }
    ],
    buyerUpdates: [
      { updateId: "update-7", instruction: "Mention that the lid is dishwasher safe." }
    ]
  });

  const decision = decideHandoff(order);

  assert.equal(decision.assetId, "eligible-copy");
  assert.equal(decision.sellerId, "seller-c");
  assert.match(decision.prompt, /lid is dishwasher safe/);
});
