import * as XLSX from "xlsx";
import { extractLinkedinProfileUrls } from "./linkedinUrls";

/**
 * Pull LinkedIn /in/ URLs from a CSV/TSV/TXT file or the first sheet(s) of an Excel workbook.
 */
export async function extractUrlsFromSpreadsheetFile(file: File): Promise<string[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (["csv", "tsv", "txt"].includes(ext)) {
    const text = await file.text();
    return extractLinkedinProfileUrls(text);
  }

  if (["xlsx", "xls"].includes(ext)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const chunks: string[] = [];
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      if (sheet) chunks.push(XLSX.utils.sheet_to_csv(sheet));
    }
    return extractLinkedinProfileUrls(chunks.join("\n"));
  }

  const text = await file.text();
  return extractLinkedinProfileUrls(text);
}
