import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PdfOpts {
  title: string;
  subtitle?: string;
  filename: string;
  head: string[];
  rows: (string | number)[][];
  foot?: string[][];
}

/**
 * Generic PDF table generator used across the app for exports.
 * Header includes IPEST branding line, generated-on date, title and subtitle.
 */
export function generateTablePdf(opts: PdfOpts) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header band
  doc.setFillColor(37, 99, 235); // primary blue
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("IPEST — Foyer", 14, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Gestion des surveillants", 14, 16);
  doc.text(
    `Généré le ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr })}`,
    196,
    16,
    { align: "right" }
  );

  // Title
  doc.setTextColor(20);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, 14, 32);
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(opts.subtitle, 14, 38);
  }

  autoTable(doc, {
    startY: opts.subtitle ? 44 : 40,
    head: [opts.head],
    body: opts.rows.length ? opts.rows.map((r) => r.map((c) => String(c ?? ""))) : [["—", ...opts.head.slice(1).map(() => "")]],
    foot: opts.foot,
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
  });

  // Footer page numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Page ${i} / ${pageCount}`,
      196,
      290,
      { align: "right" }
    );
  }

  doc.save(opts.filename);
}
