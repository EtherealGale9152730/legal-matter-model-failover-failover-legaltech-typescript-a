import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import {
  assessMatter,
  createInfraiClient,
  INFRAI_BASE_URL,
  matterIntakeSchema,
  routingPreferenceSchema,
} from "./legal_matter.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const ai = createInfraiClient(apiKey);

type InfraiEnvelope<T> =
  | { ok: true; data: T; error?: never; metadata?: unknown }
  | { ok: false; data?: never; error: { code?: string; message?: string }; metadata?: unknown };

class InfraiRequestError extends Error {
  readonly status: number;
  readonly detail: { code?: string; message?: string };

  constructor(
    status: number,
    detail: { code?: string; message?: string },
  ) {
    super(detail.message ?? "Infrai rejected the request");
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function setRoutingPreference(exclude: string[]): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${INFRAI_BASE_URL}/account/routing/set`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ capability: "ai.chat", exclude }),
    });

    const envelope = (await response.json()) as InfraiEnvelope<unknown>;
    if (response.status === 429 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) throw new InfraiRequestError(response.status, envelope.error);
    if (response.status >= 500) throw new Error(`Infrai request ended with HTTP ${response.status}`);
    return envelope.data;
  }
  throw new Error("Routing preference retry budget exhausted");
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/matters") {
      const intake = matterIntakeSchema.parse(await readJson(request));
      send(response, 201, await assessMatter(intake, ai));
      return;
    }
    if (request.method === "PUT" && request.url === "/routing-preference") {
      const preference = routingPreferenceSchema.parse(await readJson(request));
      send(response, 200, { status: "routing-preference-saved", data: await setRoutingPreference(preference.exclude) });
      return;
    }
    send(response, 404, { error: "route-not-found" });
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "invalid-request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiRequestError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.detail.code ?? "routing-request-rejected",
        message: error.message,
      });
      return;
    }
    send(response, 502, { error: "upstream-request-failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Legal matter service listening on http://localhost:${port}`));
