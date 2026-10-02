// Text of a chat message (architecture §5.15), shared by the form (counter) and the service.

/** Line ends normalized to `\n`, spaces trimmed at both ends; the inner line breaks are kept. */
export function normalizeMessageBody(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").trim();
}

/** Length in Unicode code points, like PostgreSQL's `char_length`: a simple emoji counts for 1. */
export function messageLength(text: string): number {
  return [...text].length;
}
