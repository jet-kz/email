import { Contact } from "@/types";

/**
 * Replaces tags like {{first_name}}, {{last_name}}, and {{company}} in a string
 * with values from a Contact record.
 */
export function interpolate(template: string | null, contact: Partial<Contact>): string {
  if (!template) return "";

  return template
    .replace(/\{\{\s*first_name\s*\}\}/gi, contact.first_name?.trim() || "there")
    .replace(/\{\{\s*last_name\s*\}\}/gi, contact.last_name?.trim() || "")
    .replace(/\{\{\s*company\s*\}\}/gi, contact.company?.trim() || "your company");
}
