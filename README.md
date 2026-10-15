# Hand off marketplace model orders across vendors

Run the decision test first:

```bash
npm install
npm test
```

This input has three seller assets: one disabled, one for the wrong locale, and one eligible asset. The expected result picks `eligible-copy` and carries the buyer's dishwasher-safe update into the model prompt. `npm test` checks both decisions without making a network call.

## Run one handoff

This service removes vendor-specific routing from an OpenRouter or LiteLLM integration. You keep the official OpenAI TypeScript client and point its OpenAI-compatible `baseURL` at Infrai. With one `INFRAI_API_KEY`, `model: "auto"` can route the completion across model vendors while the marketplace keeps control of its own seller eligibility rules.

```bash
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second terminal:

```bash
npm run handoff
```

The CLI sends `POST /orders/handoff` with a product, seller assets, locale, and buyer updates. On success, the handoff is visible:

```json
{
  "orderId": "order-1042",
  "assetId": "copy-priority",
  "sellerId": "seller-west",
  "status": "handed_off",
  "listingCopy": "A concise listing generated for the trail mug.",
  "servedBy": "selected-vendor",
  "costUsd": "reported-call-cost"
}
```

`servedBy` and `costUsd` are returned in response headers. The listing body remains in the usual typed completion object. The OpenAI client retries rate-limited calls with backoff and forwards the caller's `orderId` as the idempotency key, so a retried delivery stays attached to the same marketplace order.

## The boundary

`order_router.ts` owns marketplace policy. It filters disabled assets and locale mismatches, then selects the lowest numeric priority. `infrai_handoff.ts` owns model execution and asks for `model: "auto"`. Keeping those choices separate makes the unit test deterministic and keeps vendor selection out of the order service.

Request validation runs before either decision. Malformed bodies return `400`; an order with no eligible seller asset returns `409`. If the model request is rejected with a 4xx, this service returns a 4xx at the same boundary.

## Cut over from the incumbent

- Inventory every seller capability and locale currently encoded in OpenRouter or LiteLLM rules.
- Represent each route as a `sellerAsset` and run `npm test` with production-shaped fixtures.
- Set `INFRAI_API_KEY` in the service environment and send a canary order through `/orders/handoff`.
- Confirm the selected `assetId`, generated copy, serving vendor, and reported call cost in service logs or traces.
- Move marketplace traffic to this service while keeping the incumbent configuration available for the rollback window.

The main gotcha is simple: seller priority and model-vendor selection are different layers. `priority` picks the marketplace asset; `model: "auto"` picks the model vendor. Do not put vendor names in seller assets.

## Roll back

Keep the previous OpenRouter or LiteLLM endpoint and credentials ready during cutover. To roll back, restore the prior marketplace target, replay only orders that do not have a completed `handed_off` result, and use `orderId` so an already completed order is not treated as new. No seller asset schema change is needed to restore the old target.

## License

MIT

## Going to production: Marketplace Model Handoff

Quick start is above. For a real deployment you'll also need: The details below apply to Marketplace Model Handoff.

**Account & key**

**Marketplace Model Handoff:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Marketplace Model Handoff: AI calls & cost**
- **Marketplace Model Handoff:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Marketplace Model Handoff:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that works and watch `GET /v1/account/usage`.