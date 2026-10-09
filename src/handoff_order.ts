const endpoint = process.env.MARKETPLACE_URL ?? "http://localhost:3000/orders/handoff";

async function main(): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderId: "order-1042",
      productName: "Trail mug",
      locale: "en-US",
      sellerAssets: [
        {
          assetId: "copy-standard",
          sellerId: "seller-north",
          capability: "listing-copy",
          locale: "en-US",
          enabled: true,
          priority: 20
        },
        {
          assetId: "copy-priority",
          sellerId: "seller-west",
          capability: "listing-copy",
          locale: "en-US",
          enabled: true,
          priority: 10
        }
      ],
      buyerUpdates: [
        { updateId: "update-7", instruction: "Mention that the lid is dishwasher safe." }
      ]
    })
  });

  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
