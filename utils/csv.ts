export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Double quote inside quotes means a single literal quote
          currentValue += '"';
          i++; // skip next char
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(currentValue.trim());
        currentValue = "";
      } else if (char === "\r" || char === "\n") {
        row.push(currentValue.trim());
        currentValue = "";
        
        // Add row if not completely empty
        if (row.some(val => val !== "")) {
          lines.push(row);
        }
        row = [];
        
        // Skip next char if Windows style line ending (\r\n)
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
      } else {
        currentValue += char;
      }
    }
  }

  // Push final value and row if exists
  if (currentValue !== "" || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some(val => val !== "")) {
      lines.push(row);
    }
  }

  return lines;
}

export function exportToCSV(contacts: any[]): string {
  const headers = ["First Name", "Last Name", "Email", "Company", "Phone", "Notes", "Tags"];
  const rows = contacts.map(c => [
    c.first_name || "",
    c.last_name || "",
    c.email || "",
    c.company || "",
    c.phone || "",
    c.notes || "",
    (c.tags || []).map((t: any) => t.name).join("; ")
  ]);

  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
    ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  return csvContent;
}
