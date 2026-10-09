import { z } from "zod";

export const sellerAssetSchema = z.object({
  assetId: z.string().min(1),
  sellerId: z.string().min(1),
  capability: z.literal("listing-copy"),
  locale: z.string().min(2),
  enabled: z.boolean(),
  priority: z.number().int().nonnegative()
});

export const buyerUpdateSchema = z.object({
  updateId: z.string().min(1),
  instruction: z.string().min(1).max(2000)
});

export const orderHandoffSchema = z.object({
  orderId: z.string().min(1),
  productName: z.string().min(1).max(200),
  locale: z.string().min(2),
  sellerAssets: z.array(sellerAssetSchema).min(1),
  buyerUpdates: z.array(buyerUpdateSchema).max(20).default([])
});

export type OrderHandoff = z.infer<typeof orderHandoffSchema>;
export type SellerAsset = z.infer<typeof sellerAssetSchema>;

export interface HandoffDecision {
  orderId: string;
  assetId: string;
  sellerId: string;
  prompt: string;
}

export class NoEligibleSellerAsset extends Error {
  constructor(locale: string) {
    super(`No enabled listing-copy asset accepts locale ${locale}`);
    this.name = "NoEligibleSellerAsset";
  }
}

export function decideHandoff(order: OrderHandoff): HandoffDecision {
  const asset = order.sellerAssets
    .filter((candidate) => candidate.enabled && candidate.locale === order.locale)
    .sort((left, right) => left.priority - right.priority || left.assetId.localeCompare(right.assetId))[0];

  if (!asset) {
    throw new NoEligibleSellerAsset(order.locale);
  }

  const updates = order.buyerUpdates.map((update) => update.instruction).join("\n");
  const prompt = [
    `Write marketplace listing copy for ${order.productName}.`,
    `Locale: ${order.locale}.`,
    updates ? `Buyer updates:\n${updates}` : "Buyer updates: none."
  ].join("\n");

  return {
    orderId: order.orderId,
    assetId: asset.assetId,
    sellerId: asset.sellerId,
    prompt
  };
}
