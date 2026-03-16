import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/auth";
import { getSession } from "@/lib/session";

const ALLOWED_FORMATS = ["excel", "doc"] as const;
const ALLOWED_SCOPES  = ["all", "folder", "highlight"] as const;
import ExcelJS from "exceljs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
} from "docx";

interface ExportRow {
  id: string;
  text: string;
  source: string;
  url: string | null;
  note: string | null;
  topic: string;
  savedAt: string;
  isAI: boolean;
}

async function fetchExportData(token: string, scope: string, folderId?: string, highlightId?: string): Promise<ExportRow[]> {
  const params = new URLSearchParams({ scope });
  if (folderId) params.set("folderId", folderId);
  if (highlightId) params.set("highlightId", highlightId);

  const res = await fetch(`${API_BASE}/api/v1/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Export data fetch failed: ${res.status}`);
  return res.json() as Promise<ExportRow[]>;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  const token = session.user?.token;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawFormat = searchParams.get("format") ?? "excel";
  const rawScope  = searchParams.get("scope") ?? "all";

  const format = ALLOWED_FORMATS.includes(rawFormat as typeof ALLOWED_FORMATS[number])
    ? rawFormat
    : "excel";
  const scope = ALLOWED_SCOPES.includes(rawScope as typeof ALLOWED_SCOPES[number])
    ? rawScope
    : "all";

  // Only allow alphanumeric IDs (UUIDs or timestamp-based IDs)
  const folderIdRaw    = searchParams.get("folderId") ?? "";
  const highlightIdRaw = searchParams.get("highlightId") ?? "";
  const folderId    = /^[a-zA-Z0-9_-]{1,64}$/.test(folderIdRaw)    ? folderIdRaw    : undefined;
  const highlightId = /^[a-zA-Z0-9_-]{1,64}$/.test(highlightIdRaw) ? highlightIdRaw : undefined;

  const rows = await fetchExportData(token, scope, folderId, highlightId);

  if (format === "doc") {
    return generateWordDoc(rows);
  }
  return generateExcel(rows);
}

/** POST /api/export — accepts inline highlight data for single-highlight export */
export async function POST(request: NextRequest) {
  const session = await getSession();
  const token = session.user?.token;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { format: string; highlight: ExportRow };
  try {
    body = await request.json() as { format: string; highlight: ExportRow };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { format, highlight } = body;
  const rows: ExportRow[] = [highlight];

  if (format === "doc") {
    return generateWordDoc(rows);
  }
  return generateExcel(rows);
}

// ── Excel Generation ─────────────────────────────────────────────────────────

async function generateExcel(rows: ExportRow[]): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cortex";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Highlights");

  sheet.columns = [
    { header: "Highlight No", key: "no",      width: 14 },
    { header: "Highlight Text", key: "text",   width: 60 },
    { header: "Source Link", key: "url",       width: 40 },
    { header: "Comments", key: "note",         width: 40 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type:    "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1A1A2E" },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

  rows.forEach((row, idx) => {
    const isPrivate = !row.url || row.url === "Private AI Chat";
    const addedRow = sheet.addRow({
      no:   idx + 1,
      text: row.text,
      url:  isPrivate ? "Private AI Chat" : row.url,
      note: row.note ?? "",
    });

    // Make the source link a real clickable hyperlink in Excel
    if (!isPrivate && row.url) {
      const urlCell = addedRow.getCell("url");
      urlCell.value = { text: row.url, hyperlink: row.url };
      urlCell.font  = { color: { argb: "FF0563C1" }, underline: true };
    }
  });

  // Auto-fit some styling
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { wrapText: true, vertical: "top" };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="cortex_export.xlsx"',
    },
  });
}

// ── Word Document Generation ─────────────────────────────────────────────────

async function generateWordDoc(rows: ExportRow[]): Promise<NextResponse> {
  const children: Paragraph[] = [
    new Paragraph({
      text:    "Cortex Export",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text:   `Exported on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
          italics: true,
          color:  "888888",
          size:   20,
        }),
      ],
      spacing: { after: 400 },
    }),
  ];

  rows.forEach((row, idx) => {
    // Heading
    children.push(
      new Paragraph({
        text:    `Highlight #${idx + 1}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }),
    );

    // Text
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Text: ", bold: true, size: 22 }),
          new TextRun({ text: row.text, size: 22 }),
        ],
        spacing: { after: 80 },
      }),
    );

    // Comments
    if (row.note) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Comments: ", bold: true, size: 22 }),
            new TextRun({ text: row.note, size: 22, italics: true }),
          ],
          spacing: { after: 80 },
        }),
      );
    }

    // Source URL
    if (row.url && row.url !== "Private AI Chat") {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Source: ", bold: true, size: 22 }),
            new ExternalHyperlink({
              children: [
                new TextRun({
                  text:  row.url,
                  style: "Hyperlink",
                  size:  22,
                }),
              ],
              link: row.url,
            }),
          ],
          spacing: { after: 200 },
        }),
      );
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Source: ", bold: true, size: 22 }),
            new TextRun({ text: "Private AI Chat", size: 22, color: "999999" }),
          ],
          spacing: { after: 200 },
        }),
      );
    }
  });

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="cortex_export.docx"',
    },
  });
}
