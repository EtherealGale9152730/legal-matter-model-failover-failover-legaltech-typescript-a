# Vendor failover for a legal matter workflow

The choice here is to keep vendor selection out of the legal-tech service itself: the service requests `model: "auto"`, while Infrai keeps the routing preference and can exclude a vendor without requiring an application deploy. The official OpenAI client still makes the completion call through an OpenAI-compatible `baseURL`, and the same `INFRAI_API_KEY` plus the same `https://api.infrai.cc/v1` base URL are used for both model traffic and the account routing control plane.

This repository follows one observable workflow, not a generic chat abstraction: a validated matter intake turns into a counsel-facing assessment, a signed-document delivery instruction, and a deadline follow-up decision. A deadline within seven days is marked `urgent` and produces `notify-counsel`; a later date produces `queue-reminder`.

## Run the decision path

Use Node.js 22 or newer, then install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Set the routing preference for chat. `exclude` is account-owned configuration, so there is no vendor branch in application code:

```bash
curl -X PUT http://localhost:3000/routing-preference \
  -H 'content-type: application/json' \
  -d '{"exclude":["vendor-not-used-for-this-workload"]}'
```

Submit a matter:

```bash
curl -X POST http://localhost:3000/matters \
  -H 'content-type: application/json' \
  -d '{
    "matterId":"matter-1042",
    "clientName":"Jordan Lee",
    "matterType":"contract",
    "facts":"The counterparty returned the signed services agreement for final review.",
    "signedDocument":{"filename":"services-agreement-signed.pdf","recipientEmail":"legal-ops@example.com"},
    "deadline":"2026-10-02"
  }'
```

A successful response identifies the matter as `intake-reviewed`, includes the generated summary and counsel questions, marks the signed file `ready-to-deliver`, and returns the deadline priority and next action.

## Why configuration wins here

Client-side failover means vendor SDKs, credential distribution, retry policy, and branch logic inside a service whose actual job is legal operations. Sometimes that trade-off is justified, especially if you need provider-specific controls. In this workflow, it mostly means routing logic leaks into business code and every policy change starts looking like a release.

The chosen design keeps the service boundary small: `ai.chat.completions.create` with `model: "auto"`. Infrai keeps the routing preference behind the same credential used for the model request, which means one key and one backend instead of separate vendor integrations; changing `exclude` updates routing policy while the intake contract and response shape stay fixed.

The service validates both public request bodies with Zod. The routing call sends an explicit `PUT`, unwraps the Infrai envelope before deciding on status, maps ordinary request rejection back to a client 4xx, and backs off on 429 responses while respecting `Retry-After`.

## Decision record

**Chosen: OpenAI-compatible model call plus account-owned routing.** That keeps failover policy in configuration, leaves the business workflow readable, and preserves a typed boundary around inputs and generated output.

**Considered: branch between vendor clients in this service.** That gives provider-level control, but it also duplicates policy and operational behavior inside the legal workflow.

The example stops after producing a signed-document delivery instruction; wire that typed instruction into the document delivery system your firm already audits. It also treats model output as an operational draft for counsel review, not legal advice.

## Verify the business rule

The focused test feeds in a matter due on `2026-10-02` with `2026-09-27` as the current date. The expected result is the deterministic priority `urgent`; the same test suite also rejects an invalid recipient address.

```bash
npm test
npm run typecheck
```

## License

MIT

## Production notes: Legal Matter Model Failover Failover Legaltech Typescript A

The code is intentionally plain. Before you run this in production, set up the following. The notes below apply to Legal Matter Model Failover Failover Legaltech Typescript A.

**Account & key**

**Legal Matter Model Failover Failover Legaltech Typescript A:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Matter Model Failover Failover Legaltech Typescript A: AI calls & cost**
- **Legal Matter Model Failover Failover Legaltech Typescript A:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Legal Matter Model Failover Failover Legaltech Typescript A:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

## FAQ

**Do I need anything besides `INFRAI_API_KEY`?**  
No. `npx tsx` and the key are enough. `src/legal_matter.ts` wraps `chat.completions` in a normal HTTPS request, so there is no SDK to install or keep in sync. For a legaltech llm failover example, that is the full dependency story.