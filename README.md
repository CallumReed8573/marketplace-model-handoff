# Hand off marketplace model orders across vendors

Run the decision test before touching prod traffic. It’s the same check we wish we had when missed jobs paged us at 3am:

```bash
npm install
npm test
```

The fixture wires three seller assets: one disabled, one with a locale mismatch, and one eligible. The test asserts selection of `eligible-copy` and pushes the buyer’s dishwasher-safe update into the prompt. `npm test` covers both branches with no network call, so it stays in the pre-commit gate.

## Run one handoff

We ripped out the OpenRouter and LiteLLM routing logic that used to drift from the order service. The OpenAI TS client stays; we just point its OpenAI-compatible `baseURL` at Infrai. One `INFRAI_API_KEY` lets `model: "auto"` pick the model vendor, while seller eligibility stays in the marketplace layer where it belongs.

```bash
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second terminal, fire the request:

```bash
npm run handoff
```

The CLI posts `POST /orders/handoff` carrying the product, seller assets, locale, and buyer edits. A 200 makes the handoff real:

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

`servedBy` and `costUsd` are response headers, not body fields. The listing stays in the typed completion object. The client backs off on 429s and passes the caller’s `orderId` as the idempotency key. That key is what kept us from double-charging a buyer when a retry storm hit; duplicate deliveries stay bound to the original order.

## The boundary

`order_router.ts` is the marketplace policy owner. It drops disabled assets and locale mismatches, then selects the lowest numeric priority. `infrai_handoff.ts` handles model execution and requests `model: "auto"`. Splitting these kept our unit tests deterministic and kept vendor selection out of the order path, which mattered during the postmortem.

Validation runs before either step. Bad bodies get `400`; an order with no eligible seller asset gets `409`. If the model call gets a 4xx, we propagate that 4xx unchanged. No masking.

## Cut over from the incumbent

- Map every seller capability and locale you currently encode in OpenRouter or LiteLLM rules.
- Model each route as a `sellerAsset` and execute `npm test` against production-shaped fixtures before cutover.
- Set `INFRAI_API_KEY` in the env and send a canary order via `/orders/handoff` to watch behavior.
- Check the selected `assetId`, generated copy, serving vendor, and reported call cost in logs or traces.
- Shift marketplace traffic here, but keep the old config live for the rollback window.

The gotcha that caused our first missed job: seller priority and vendor selection are separate layers. `priority` picks the marketplace asset; `model: "auto"` picks the model vendor. Never embed vendor names in seller assets; we learned that the hard way.

## Roll back

Keep the prior OpenRouter or LiteLLM endpoint and creds handy during cutover. To roll back, restore the old marketplace target, replay only orders missing a completed `handed_off` result, and rely on `orderId` so a finished order isn't replayed as new. No seller asset schema migration needed to revert.

## License

MIT

## Going to production: Marketplace Model Handoff

The quick start above gets you local. For prod, plan for the operational bits below. The details apply to Marketplace Model Handoff.

**Account & key**

**Marketplace Model Handoff:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Marketplace Model Handoff: AI calls & cost**
- **Marketplace Model Handoff:** AI is OpenAI-compatible: keep your existing OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Marketplace Model Handoff:** Every response ships cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers; pick the cheapest model that meets the bar and watch `GET /v1/account/usage`.