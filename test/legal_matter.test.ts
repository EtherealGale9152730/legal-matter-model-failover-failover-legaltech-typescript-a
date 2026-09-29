import { describe, expect, it } from "vitest";
import { deadlinePriority, matterIntakeSchema } from "../src/legal_matter.js";

describe("legal matter decisions", () => {
  it("escalates a deadline within seven days", () => {
    const intake = matterIntakeSchema.parse({
      matterId: "matter-1042",
      clientName: "Jordan Lee",
      matterType: "contract",
      facts: "The counterparty returned the signed services agreement for final review.",
      signedDocument: {
        filename: "services-agreement-signed.pdf",
        recipientEmail: "legal-ops@example.com",
      },
      deadline: "2026-10-02",
    });

    expect(deadlinePriority(intake.deadline, new Date("2026-09-27T12:00:00Z"))).toBe("urgent");
  });

  it("rejects an intake without a valid delivery address", () => {
    expect(() => matterIntakeSchema.parse({
      matterId: "matter-1043",
      clientName: "Jordan Lee",
      matterType: "employment",
      facts: "Counsel needs a review of the signed employment agreement before filing.",
      signedDocument: { filename: "agreement.pdf", recipientEmail: "invalid" },
      deadline: "2026-10-20",
    })).toThrow();
  });
});
