export type InboundMessage = {
  id: string;
  channel: "Email" | "Text";
  /** As the sender wrote it: a From header or a phone number. */
  from: string;
  /** Lower-case email address, or E.164 phone number. */
  address: string;
  subject?: string;
  at: string;
  text: string;
  threadId?: string;
};
