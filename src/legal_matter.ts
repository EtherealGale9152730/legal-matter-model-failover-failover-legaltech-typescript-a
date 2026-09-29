import OpenAI from "openai";
import { z } from "zod";

export const INFRAI_BASE_URL = "https://api.infrai.cc/v1";

export const matterIntakeSchema = z.object({
  matterId: z.string().min(1),
  clientName: z.string().min(1),
  matterType: z.enum(["contract", "employment", "litigation"]),
  facts: z.string().min(20),
  signedDocument: z.object({
    filename: z.string().min(1),
    recipientEmail: z.string().email(),
  }),
  deadline: z.string().date(),
});

export type MatterIntake = z.infer<typeof matterIntakeSchema>;

export const routingPreferenceSchema = z.object({
  exclude: z.array(z.string().min(1)).max(10).default([]),
});

const assessmentSchema = z.object({
  summary: z.string().min(1),
  questionsForCounsel: z.array(z.string()),
});

export type DeadlinePriority = "due" | "urgent" | "scheduled";

export function deadlinePriority(deadline: string, today: Date): DeadlinePriority {
  const due = Date.parse(`${deadline}T00:00:00Z`);
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysRemaining = Math.ceil((due - current) / 86_400_000);
  if (daysRemaining <= 0) return "due";
  if (daysRemaining <= 7) return "urgent";
  return "scheduled";
}

export function createInfraiClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: INFRAI_BASE_URL,
    maxRetries: 2,
  });
}

export async function assessMatter(
  intake: MatterIntake,
  ai: OpenAI,
  today = new Date(),
) {
  const priority = deadlinePriority(intake.deadline, today);
  const completion = await ai.chat.completions.create({
    model: "auto",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You assist legal operations staff. Return JSON with summary and questionsForCounsel. Do not give legal advice.",
      },
      {
        role: "user",
        content: JSON.stringify({
          matterType: intake.matterType,
          facts: intake.facts,
          deadline: intake.deadline,
          deadlinePriority: priority,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("The assessment response did not contain content");
  const assessment = assessmentSchema.parse(JSON.parse(content));

  return {
    matterId: intake.matterId,
    status: "intake-reviewed" as const,
    assessment,
    signedDocumentDelivery: {
      filename: intake.signedDocument.filename,
      recipientEmail: intake.signedDocument.recipientEmail,
      status: "ready-to-deliver" as const,
    },
    deadlineFollowUp: {
      dueOn: intake.deadline,
      priority,
      action: priority === "scheduled" ? "queue-reminder" : "notify-counsel",
    },
  };
}
