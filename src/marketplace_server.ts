import { createServer } from "node:http";
import { ZodError } from "zod";
import { createInfraiCompletion, executeHandoff } from "./infrai_handoff.js";
import { decideHandoff, NoEligibleSellerAsset, orderHandoffSchema } from "./order_router.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) {
  throw new Error("INFRAI_API_KEY is required");
}

const completion = createInfraiCompletion(apiKey);
const port = Number(process.env.PORT ?? "3000");

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/orders/handoff") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const order = orderHandoffSchema.parse(body);
    const result = await executeHandoff(decideHandoff(order), completion);
    sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof ZodError) {
      sendJson(response, 400, { error: "Invalid handoff request", details: error.issues });
      return;
    }
    if (error instanceof NoEligibleSellerAsset) {
      sendJson(response, 409, { error: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be JSON" });
      return;
    }
    if (hasClientStatus(error)) {
      sendJson(response, error.status, { error: "Model request was rejected" });
      return;
    }
    console.error(error);
    sendJson(response, 502, { error: "Model handoff did not complete" });
  }
});

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function hasClientStatus(error: unknown): error is { status: number } {
  if (typeof error !== "object" || error === null || !("status" in error)) return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500;
}

server.listen(port, () => {
  console.log(`marketplace handoff listening on http://localhost:${port}`);
});
