/** Provider-neutral contracts. The current Gmail transport and review service
 * live in gmail.ts and reviews.ts; these interfaces describe future adapters. */
import type { ApplicationInput } from "../domain";
export type EmailMessage = {
  providerMessageId: string;
  threadId: string;
  subject: string;
  receivedAt: string;
  sourceUrl: string;
  text: string;
  language: "en" | "fr" | "unknown";
};
export type EmailSuggestion = {
  id: string;
  providerMessageId: string;
  kind: "confirmation" | "assessment" | "interview" | "offer" | "rejection";
  applicationId?: string;
  proposedFields: Partial<ApplicationInput>;
  evidence: { field: keyof ApplicationInput; quote: string }[];
  sourceUrl: string;
  reviewState: "pending" | "accepted" | "dismissed";
};
export interface ReadOnlyEmailProvider {
  searchApplicationMessages(
    cursor?: string,
  ): Promise<{ messages: EmailMessage[]; nextCursor?: string }>;
}
export interface EmailSuggestionParser {
  suggest(message: EmailMessage): Promise<EmailSuggestion[]>;
}
// Review services must validate accepted fields with applicationSchema,
// and use applications.ts for audited writes. Parsing alone must never write records.
