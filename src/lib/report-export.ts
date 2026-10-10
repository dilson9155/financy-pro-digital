import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { ReportDocument } from "./report-documents";

/** Cor institucional (azul-marinho da marca). */
const BRAND: [number, number, number] = [0, 16, 64];
const MARGIN_X = 40;
const HEADER_TOP = 42;
const LINE_GRAY: [number, number, number] = [222, 226, 235];

interface WithAutoTable {
  lastAutoTable?: { finalY?: number };
}

function tableEndY(pdf: jsPDF): number {
  return (pdf as unknown as WithAutoTable).lastAutoTable?.finalY ?? HEADER_TOP;
}

export interface ExportCompanyInfo {
  name?: string;
  legalName?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}

export interface ExportPdfOptions {
  company?: ExportCompanyInfo;
  /** Nome da empresa (compatibilidade). Usado quando `company` nao e informado. */
  companyName?: string;
  fileName?: string;
}

function defaultFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "relatorio"}.pdf`;
}

/** Formato de imagem do jsPDF a partir do data URL. */
function imageFormat(dataUrl: string): "PNG" | "JPEG" | null {
  if (/^data:image\/png/i.test(dataUrl)) return "PNG";
  if (/^data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
  return null;
}

function loadImageMeta(
  dataUrl: string,
): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const img = new Image();
    img.onload = () =>
      resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function metaLine(company: ExportCompanyInfo): string {
  const parts = [company.document, company.email, company.phone].filter(
    (v): v is string => Boolean(v && String(v).trim()),
  );
  return parts.join("  •  ");
}

/**
 * Gera e baixa um PDF A4 a partir de um documento de relatorio
 * (cabecalho institucional + destaques + tabelas). Funciona no navegador.
 */
export async function exportReportPdf(
  doc: ReportDocument,
  options: ExportPdfOptions = {},
): Promise<void> {
  const company: ExportCompanyInfo = options.company ?? {
    name: options.companyName,
  };
  const companyName = company.name?.trim() || "Financy Pro Digital";

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentRight = pageWidth - MARGIN_X;

  // ---- Cabecalho institucional ----
  let textX = MARGIN_X;
  const logo = company.logoUrl;
  const format = logo ? imageFormat(logo) : null;

  if (logo && format) {
    const meta = await loadImageMeta(logo);
    const box = 44;
    let w = box;
    let h = box;
    if (meta) {
      const scale = Math.min(box / meta.w, box / meta.h);
      w = Math.max(1, meta.w * scale);
      h = Math.max(1, meta.h * scale);
    }
    try {
      pdf.addImage(logo, format, MARGIN_X, HEADER_TOP - 6, w, h, undefined, "FAST");
      textX = MARGIN_X + box + 12;
    } catch {
      textX = MARGIN_X;
    }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  pdf.text(companyName, textX, HEADER_TOP + 6);

  const meta = metaLine(company);
  if (meta) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(110);
    pdf.text(meta, textX, HEADER_TOP + 20);
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(130);
  pdf.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    contentRight,
    HEADER_TOP + 6,
    { align: "right" },
  );

  // Linha separadora.
  const ruleY = HEADER_TOP + 34;
  pdf.setDrawColor(LINE_GRAY[0], LINE_GRAY[1], LINE_GRAY[2]);
  pdf.setLineWidth(0.8);
  pdf.line(MARGIN_X, ruleY, contentRight, ruleY);

  // ---- Titulo do relatorio ----
  let cursorY = ruleY + 24;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  pdf.text(doc.title, MARGIN_X, cursorY);

  if (doc.subtitle) {
    cursorY += 15;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text(doc.subtitle, MARGIN_X, cursorY);
  }
  cursorY += 16;

  // ---- Destaques ----
  if (doc.summary && doc.summary.length > 0) {
    autoTable(pdf, {
      startY: cursorY,
      body: [doc.summary.map((s) => `${s.label}\n${s.value}`)],
      theme: "grid",
      styles: {
        fontSize: 8.5,
        cellPadding: 6,
        halign: "center",
        textColor: 40,
        lineColor: LINE_GRAY,
        lineWidth: 0.5,
      },
      margin: { left: MARGIN_X, right: MARGIN_X },
    });
    cursorY = tableEndY(pdf) + 18;
  }

  // ---- Tabelas ----
  for (const section of doc.sections) {
    if (cursorY > pageHeight - 90) {
      pdf.addPage();
      cursorY = HEADER_TOP + 12;
    }
    if (section.heading) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.text(section.heading, MARGIN_X, cursorY);
      cursorY += 6;
    }

    const columnStyles: Record<number, { halign: "left" | "right" | "center" }> =
      {};
    for (const [key, value] of Object.entries(section.align ?? {})) {
      columnStyles[Number(key)] = { halign: value };
    }

    autoTable(pdf, {
      startY: cursorY,
      head: [section.columns],
      body: section.rows,
      theme: "striped",
      headStyles: {
        fillColor: BRAND,
        textColor: 255,
        fontSize: 8.5,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 4,
        textColor: 40,
        lineColor: LINE_GRAY,
        lineWidth: 0.5,
      },
      alternateRowStyles: { fillColor: [246, 248, 252] },
      columnStyles,
      margin: { left: MARGIN_X, right: MARGIN_X, bottom: 56 },
    });
    cursorY = tableEndY(pdf) + 18;
  }

  if (doc.sections.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(130);
    pdf.text("Nenhum dado para os filtros selecionados.", MARGIN_X, cursorY + 6);
  }

  // ---- Rodape com numeracao ----
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    pdf.setPage(i);
    pdf.setDrawColor(LINE_GRAY[0], LINE_GRAY[1], LINE_GRAY[2]);
    pdf.setLineWidth(0.6);
    pdf.line(MARGIN_X, pageHeight - 38, contentRight, pageHeight - 38);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(companyName, MARGIN_X, pageHeight - 24);
    pdf.text(`Página ${i} de ${total}`, contentRight, pageHeight - 24, {
      align: "right",
    });
  }

  pdf.save(options.fileName ?? defaultFileName(doc.title));
}
