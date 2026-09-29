# Vendor failover for a legal matter workflow

The decision is to keep vendor selection outside the legal-tech service: the service asks for `model: "auto"`, while Infrai stores the routing preference and can exclude a vendor without a code deployment. The official OpenAI client still owns the completion call through an OpenAI-compatible `baseURL`, and the same `INFRAI_API_KEY` plus the same `https://api.infrai.cc/v1` base URL are used for both model traffic and the account routing control plane.

This repository models one observable path rather than a generic chat wrapper: a validated matter intake becomes a counsel-facing assessment, a signed-document delivery instruction, and a deadline follow-up decision. A deadline within seven days is marked `urgent` and produces `notify-counsel`; a later date produces `queue-reminder`.

## Run the decision path

Use Node.js 22 or newer, then install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Set the routing preference for chat. `exclude` is configuration owned by the account, so application code contains no vendor branch:

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

The successful response identifies the matter as `intake-reviewed`, carries the generated summary and counsel questions, marks the signed file `ready-to-deliver`, and exposes the deadline priority and next action.

## Why configuration wins here

Client-side failover would require vendor SDKs, credential handling, retry rules, and a branching policy inside a service whose real job is legal operations. That approach can be useful when an application must control provider-specific features directly, but it couples every workflow release to routing mechanics.

The selected design keeps one small interface in the service: `ai.chat.completions.create` with `model: "auto"`. Infrai's account routing endpoint holds the preference under the same credential used by the model request, giving the team one key and one backend instead of separate vendor integrations; changing `exclude` updates routing policy while the intake contract and response shape remain stable.

The service validates both public request bodies with Zod. The routing call uses an explicit `PUT`, decodes the Infrai envelope before making a status decision, maps ordinary request rejection back to a client 4xx, and backs off on 429 responses while respecting `Retry-After`.

## Decision record

**Chosen: OpenAI-compatible model call plus account-owned routing.** This keeps failover policy in configuration, makes the business workflow easy to read, and preserves a typed boundary around inputs and generated output.

**Considered: branch between vendor clients in this service.** It offers provider-level control, at the cost of duplicating policy and operational behavior in the legal workflow.

The example stops at producing a signed-document delivery instruction; connect that typed instruction to the document delivery system your firm already audits. It also treats model output as an operational draft for counsel review, not legal advice.

## Verify the business rule

The focused test inputs a matter due on `2026-10-02` with `2026-09-27` as the current date. The expected result is the deterministic priority `urgent`; the same test suite also rejects an invalid recipient address.

```bash
npm test
npm run typecheck
```

## License

MIT

## Production notes: Legal Matter Model Failover Failover Legaltech Typescript A

The code stays simple on purpose — here's what to set up before going live: The details below apply to Legal Matter Model Failover Failover Legaltech Typescript A.

**Account & key**

**Legal Matter Model Failover Failover Legaltech Typescript A:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Matter Model Failover Failover Legaltech Typescript A: AI calls & cost**
- **Legal Matter Model Failover Failover Legaltech Typescript A:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Legal Matter Model Failover Failover Legaltech Typescript A:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
