import * as XLSX from "xlsx";

const HEADER_FILL = { fgColor: { rgb: "064E3B" } };
const SECTION_FILL = { fgColor: { rgb: "111827" } };
const AMBER_FILL = { fgColor: { rgb: "FEF3C7" } };
const BLUE_FILL = { fgColor: { rgb: "DBEAFE" } };
const GREEN_FILL = { fgColor: { rgb: "DCFCE7" } };

const WHITE_BOLD = { bold: true, color: { rgb: "FFFFFF" }, sz: 12 };
const BOLD = { bold: true, sz: 11 };

function setCell(ws, addr, value, opts = {}) {
  ws[addr] = { v: value, t: typeof value === "number" ? "n" : "s" };
  if (opts.style) ws[addr].s = opts.style;
  if (opts.fmt) ws[addr].z = opts.fmt;
}

function num(v) { return Number.isFinite(+v) ? +v : 0; }

function avg(arr, k) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + num(x[k]), 0) / arr.length;
}
function sum(arr, k) {
  return arr.reduce((s, x) => s + num(x[k]), 0);
}

function buildContainerSheet(purchase, container) {
  const logs = container.measurements || [];
  const data = [];

  data.push(["Bill of Lading", purchase.bl_number, "", "Container No", container.container_number]);
  data.push(["Supplier", purchase.supplier_name, "", "Country", purchase.country]);
  data.push(["Date", purchase.bl_date, "", "Sr No", `#${container.sr_no}`]);
  data.push([]);
  data.push(["Log #", "LE1 (cm)", "L (cm)", "G1 (cm)", "G2 (cm)", "CBM1", "CFT1", "CBM2", "CFT2", "Warn"]);

  logs.forEach((lg, i) => {
    const warn = lg.g1 < 35 || lg.g2 < 35 ? "⚠" : "";
    data.push([
      lg.log_number ?? i + 1,
      num(lg.le1), num(lg.l), num(lg.g1), num(lg.g2),
      +num(lg.cbm1).toFixed(4),
      +num(lg.cft1).toFixed(4),
      +num(lg.cbm2).toFixed(4),
      +num(lg.cft2).toFixed(4),
      warn,
    ]);
  });

  data.push([]);
  data.push(["TOTAL PIECES", logs.length, "", "TOTAL CBM1", +sum(logs, "cbm1").toFixed(4), "TOTAL CFT1", +sum(logs, "cft1").toFixed(4)]);
  data.push(["AVG CBM1", +avg(logs, "cbm1").toFixed(4), "", "AVG G1", +avg(logs, "g1").toFixed(2), "AVG LE1", +avg(logs, "le1").toFixed(2)]);
  data.push(["TOTAL CBM2", +sum(logs, "cbm2").toFixed(4), "", "TOTAL CFT2", +sum(logs, "cft2").toFixed(4)]);
  data.push(["AVG CBM2", +avg(logs, "cbm2").toFixed(4), "", "AVG G2", +avg(logs, "g2").toFixed(2), "AVG L", +avg(logs, "l").toFixed(2)]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Styles
  ["A1", "D1", "A2", "D2", "A3", "D3"].forEach((a) => {
    if (ws[a]) ws[a].s = { font: WHITE_BOLD, fill: SECTION_FILL, alignment: { vertical: "center" } };
  });
  ["B1", "E1", "B2", "E2", "B3", "E3"].forEach((a) => {
    if (ws[a]) ws[a].s = { font: BOLD, alignment: { vertical: "center" } };
  });

  // Header row at index 4 (row 5)
  const headerRow = 5;
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].forEach((col) => {
    const a = `${col}${headerRow}`;
    if (ws[a]) ws[a].s = { font: WHITE_BOLD, fill: HEADER_FILL, alignment: { horizontal: "center" } };
  });

  // Data rows alternating + colored CBM columns
  logs.forEach((_, i) => {
    const r = headerRow + 1 + i;
    const fillEven = i % 2 === 0;
    ["A", "B", "C", "D", "E", "J"].forEach((col) => {
      const a = `${col}${r}`;
      if (ws[a]) ws[a].s = { alignment: { horizontal: col === "J" ? "center" : "right" }, fill: fillEven ? { fgColor: { rgb: "F8FAFC" } } : undefined };
    });
    ["F", "G"].forEach((col) => {
      const a = `${col}${r}`;
      if (ws[a]) ws[a].s = { alignment: { horizontal: "right" }, fill: BLUE_FILL, font: { color: { rgb: "1E3A8A" }, bold: true } };
    });
    ["H", "I"].forEach((col) => {
      const a = `${col}${r}`;
      if (ws[a]) ws[a].s = { alignment: { horizontal: "right" }, fill: GREEN_FILL, font: { color: { rgb: "065F46" }, bold: true } };
    });
  });

  // Summary rows fills
  const summaryStart = headerRow + 1 + logs.length + 1;
  for (let r = summaryStart; r < summaryStart + 4; r++) {
    ["A", "B", "C", "D", "E", "F", "G"].forEach((col) => {
      const a = `${col}${r}`;
      if (ws[a]) ws[a].s = { fill: AMBER_FILL, font: BOLD };
    });
  }

  ws["!cols"] = [
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
  ];

  return ws;
}

function buildMasterSheet(purchases, companyName) {
  const data = [];
  data.push([`Company: ${companyName || ""}`]);
  data.push(["Master Summary Report"]);
  data.push([`Generated: ${new Date().toLocaleString()}`]);
  data.push([]);

  // Grand totals
  let g = { pieces: 0, cbm1: 0, cft1: 0, cbm2: 0, cft2: 0 };
  purchases.forEach((p) => {
    (p.containers || []).forEach((c) => {
      const t = c.totals || {};
      g.pieces += c.pieces ?? (c.measurements?.length || 0);
      g.cbm1 += num(t.cbm1); g.cft1 += num(t.cft1);
      g.cbm2 += num(t.cbm2); g.cft2 += num(t.cft2);
    });
  });
  const denom = Math.max(g.pieces, 1);
  data.push(["GRAND TOTALS"]);
  data.push(["Pieces", "CBM1", "CFT1", "Avg CBM1", "CBM2", "CFT2", "Avg CBM2"]);
  data.push([g.pieces, +g.cbm1.toFixed(4), +g.cft1.toFixed(4), +(g.cbm1 / denom).toFixed(4), +g.cbm2.toFixed(4), +g.cft2.toFixed(4), +(g.cbm2 / denom).toFixed(4)]);
  data.push([]);

  // Per BL+Container detail
  data.push(["BL", "Container", "Date", "Supplier", "Country", "Pcs", "CBM1", "CFT1", "AvgCBM1", "AvgG1", "AvgL", "CBM2", "CFT2", "AvgCBM2", "AvgG2"]);

  const headerRowIdx = data.length; // 1-indexed row number = data.length

  purchases.forEach((p) => {
    let bl = { pieces: 0, cbm1: 0, cft1: 0, cbm2: 0, cft2: 0 };
    (p.containers || []).forEach((c) => {
      const t = c.totals || {};
      const pcs = c.pieces ?? (c.measurements?.length || 0);
      bl.pieces += pcs;
      bl.cbm1 += num(t.cbm1); bl.cft1 += num(t.cft1);
      bl.cbm2 += num(t.cbm2); bl.cft2 += num(t.cft2);
      data.push([
        p.bl_number, c.container_number, p.bl_date, p.supplier_name, p.country,
        pcs,
        +num(t.cbm1).toFixed(4), +num(t.cft1).toFixed(4), +num(t.avg_cbm1).toFixed(4),
        +num(t.avg_g1).toFixed(2), +num(t.avg_l).toFixed(2),
        +num(t.cbm2).toFixed(4), +num(t.cft2).toFixed(4), +num(t.avg_cbm2).toFixed(4),
        +num(t.avg_g2).toFixed(2),
      ]);
    });
    data.push([
      `BL ${p.bl_number} Subtotal`, "", "", "", "",
      bl.pieces,
      +bl.cbm1.toFixed(4), +bl.cft1.toFixed(4), "",
      "", "",
      +bl.cbm2.toFixed(4), +bl.cft2.toFixed(4), "", "",
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Style top blocks
  ["A1", "A2", "A3"].forEach((a) => {
    if (ws[a]) ws[a].s = { font: { ...WHITE_BOLD, sz: 14 }, fill: SECTION_FILL };
  });
  if (ws["A5"]) ws["A5"].s = { font: { ...WHITE_BOLD }, fill: HEADER_FILL };
  // Grand totals header (row 6)
  ["A6", "B6", "C6", "D6", "E6", "F6", "G6"].forEach((a) => {
    if (ws[a]) ws[a].s = { font: WHITE_BOLD, fill: HEADER_FILL, alignment: { horizontal: "center" } };
  });
  ["A7", "B7", "C7", "D7", "E7", "F7", "G7"].forEach((a) => {
    if (ws[a]) ws[a].s = { fill: AMBER_FILL, font: BOLD, alignment: { horizontal: "right" } };
  });

  // Per-container header
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
  cols.forEach((col) => {
    const a = `${col}${headerRowIdx}`;
    if (ws[a]) ws[a].s = { font: WHITE_BOLD, fill: HEADER_FILL, alignment: { horizontal: "center" } };
  });

  // Subtotal rows: detect by content "BL ... Subtotal"
  const totalRows = data.length + 1; // safety bound; we'll iterate
  for (let r = headerRowIdx + 1; r <= data.length; r++) {
    const a = `A${r}`;
    if (ws[a] && typeof ws[a].v === "string" && ws[a].v.startsWith("BL ")) {
      cols.forEach((col) => {
        const cell = `${col}${r}`;
        if (ws[cell]) ws[cell].s = { fill: AMBER_FILL, font: BOLD };
      });
    }
  }

  ws["!cols"] = cols.map(() => ({ wch: 14 }));
  return ws;
}

export function exportContainerXlsx(purchase, container, companyName) {
  const wb = XLSX.utils.book_new();
  const ws = buildContainerSheet(purchase, container);
  XLSX.utils.book_append_sheet(wb, ws, container.container_number.slice(0, 28));
  XLSX.writeFile(wb, `${purchase.bl_number}_${container.container_number}.xlsx`);
}

export function exportBLXlsx(purchase, companyName) {
  const wb = XLSX.utils.book_new();
  const master = buildMasterSheet([purchase], companyName);
  XLSX.utils.book_append_sheet(wb, master, "Master Summary");
  (purchase.containers || []).forEach((c) => {
    const ws = buildContainerSheet(purchase, c);
    XLSX.utils.book_append_sheet(wb, ws, (c.container_number || "Container").slice(0, 28));
  });
  XLSX.writeFile(wb, `BL_${purchase.bl_number}.xlsx`);
}

export function exportAllXlsx(purchases, companyName) {
  const wb = XLSX.utils.book_new();
  const master = buildMasterSheet(purchases, companyName);
  XLSX.utils.book_append_sheet(wb, master, "Master Summary");
  purchases.forEach((p) => {
    (p.containers || []).forEach((c) => {
      const ws = buildContainerSheet(p, c);
      const sheetName = `${p.bl_number}_${c.container_number}`.slice(0, 28).replace(/[\\/?*[\]]/g, "_");
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  });
  XLSX.writeFile(wb, `TimberLog_All_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Deal Sheet Export - Supplier vs Measured Comparison
function buildDealSheet(purchase, companyName) {
  const containers = purchase.containers || [];
  const data = [];

  // Title block
  data.push([companyName || "Timber Management"]);
  data.push(["DEAL SHEET"]);
  data.push([`BL Number: ${purchase.bl_number}`, `BL Date: ${purchase.bl_date}`, `Supplier: ${purchase.supplier_name}`, `Country: ${purchase.country}`]);
  data.push([]);

  // Column headers
  data.push([
    "Sr.",
    "Container No.",
    "CBM Gross",
    "CBM Net",
    "CBM2 (Measured)",
    "Short CBM",
    "PCS Supplier",
    "PCS by Us",
    "Avg G Gross",
    "Avg G Net",
    "Avg G2 (Measured)",
    "Avg L1 (Supplier)",
    "Avg L2 (Measured)",
    "Bend %",
    "Measurement Date",
    "Quality (Supplier)",
    "Quality (by Us)"
  ]);

  // Container rows
  let totalCbmGross = 0;
  let totalCbmNet = 0;
  let totalCbm2 = 0;
  let totalPcsSupplier = 0;
  let totalPcsByUs = 0;
  let sumAvgGGross = 0;
  let sumAvgGNet = 0;
  let sumAvgG2 = 0;
  let sumAvgL1 = 0;
  let sumAvgL2 = 0;
  let sumBend = 0;
  let countContainers = 0;

  containers.forEach((c, idx) => {
    const logs = c.measurements || [];
    const cbm2Measured = logs.reduce((sum, lg) => sum + num(lg.cbm2), 0);
    const pcsByUs = logs.length;
    const avgG2 = pcsByUs > 0 ? logs.reduce((sum, lg) => sum + num(lg.g2), 0) / pcsByUs : 0;
    const avgL2 = pcsByUs > 0 ? logs.reduce((sum, lg) => sum + num(lg.l), 0) / pcsByUs : 0;

    const cbmGross = num(c.cbm_gross);
    const cbmNet = num(c.cbm_net);
    const pcsSupplier = num(c.pcs_supplier);
    const avgGirthGross = num(c.avg_girth_gross);
    const avgGirthNet = num(c.avg_girth_net);
    const avgL1 = num(c.l_avg);
    
    const shortCbm = cbmNet - cbm2Measured;

    data.push([
      c.sr_no || idx + 1,
      c.container_number || "",
      +cbmGross.toFixed(4),
      +cbmNet.toFixed(4),
      +cbm2Measured.toFixed(4),
      +shortCbm.toFixed(4),
      pcsSupplier,
      pcsByUs,
      +avgGirthGross.toFixed(4),
      +avgGirthNet.toFixed(4),
      +avgG2.toFixed(4),
      avgL1 ? +avgL1.toFixed(2) : "",
      +avgL2.toFixed(2),
      c.bend_percent ? +num(c.bend_percent).toFixed(2) : "",
      c.measurement_date || "",
      c.quality_supplier || "",
      c.quality_by_us || ""
    ]);

    totalCbmGross += cbmGross;
    totalCbmNet += cbmNet;
    totalCbm2 += cbm2Measured;
    totalPcsSupplier += pcsSupplier;
    totalPcsByUs += pcsByUs;
    sumAvgGGross += avgGirthGross;
    sumAvgGNet += avgGirthNet;
    sumAvgG2 += avgG2;
    sumAvgL1 += avgL1;
    sumAvgL2 += avgL2;
    if (c.bend_percent) sumBend += num(c.bend_percent);
    countContainers++;
  });

  const totalShortCbm = totalCbmNet - totalCbm2;
  const avgGGross = countContainers > 0 ? sumAvgGGross / countContainers : 0;
  const avgGNet = countContainers > 0 ? sumAvgGNet / countContainers : 0;
  const avgG2 = countContainers > 0 ? sumAvgG2 / countContainers : 0;
  const avgL1 = countContainers > 0 ? sumAvgL1 / countContainers : 0;
  const avgL2 = countContainers > 0 ? sumAvgL2 / countContainers : 0;
  const avgBend = countContainers > 0 ? sumBend / countContainers : 0;

  // Totals row
  data.push([]);
  data.push([
    "TOTALS / AVERAGES",
    "",
    +totalCbmGross.toFixed(4),
    +totalCbmNet.toFixed(4),
    +totalCbm2.toFixed(4),
    +totalShortCbm.toFixed(4),
    totalPcsSupplier,
    totalPcsByUs,
    +avgGGross.toFixed(4),
    +avgGNet.toFixed(4),
    +avgG2.toFixed(4),
    avgL1 > 0 ? +avgL1.toFixed(2) : "",
    +avgL2.toFixed(2),
    avgBend > 0 ? +avgBend.toFixed(2) : "",
    "",
    "",
    ""
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Styling
  const TITLE_FILL = { fgColor: { rgb: "064E3B" } };
  const HEADER_FILL_DARK = { fgColor: { rgb: "1E3A8A" } };
  const TOTALS_FILL = { fgColor: { rgb: "FEF3C7" } };
  const RED_FILL = { fgColor: { rgb: "FEE2E2" } };
  const GREEN_FILL = { fgColor: { rgb: "DCFCE7" } };
  const ORANGE_FILL = { fgColor: { rgb: "FFEDD5" } };

  // Title block styling
  ["A1", "A2"].forEach((addr) => {
    if (ws[addr]) ws[addr].s = { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: TITLE_FILL, alignment: { horizontal: "center" } };
  });
  
  ["A3", "B3", "C3", "D3"].forEach((addr) => {
    if (ws[addr]) ws[addr].s = { font: { bold: true, sz: 12 }, fill: TITLE_FILL, font: { color: { rgb: "FFFFFF" } } };
  });

  // Merge title cells
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }, // Company name (17 columns now)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } }, // DEAL SHEET
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },  // BL info spread
  ];

  // Header row (row 5)
  const headerRow = 5;
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"].forEach((col, idx) => {
    const addr = `${col}${headerRow}`;
    if (ws[addr]) ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 }, fill: HEADER_FILL_DARK, alignment: { horizontal: "center", wrapText: true } };
  });

  // Data rows with conditional formatting
  containers.forEach((c, idx) => {
    const row = headerRow + 1 + idx;
    const logs = c.measurements || [];
    const cbm2Measured = logs.reduce((sum, lg) => sum + num(lg.cbm2), 0);
    const cbmNet = num(c.cbm_net);
    const shortCbm = cbmNet - cbm2Measured;
    const bendPercent = c.bend_percent ? num(c.bend_percent) : 0;

    // Alternating row fill
    const alternateFill = idx % 2 === 0 ? { fgColor: { rgb: "F8FAFC" } } : undefined;

    // Short CBM conditional formatting
    const shortCbmAddr = `F${row}`;
    if (ws[shortCbmAddr]) {
      if (shortCbm > 0) {
        // Loss - RED
        ws[shortCbmAddr].s = { fill: RED_FILL, font: { bold: true, color: { rgb: "991B1B" } }, alignment: { horizontal: "right" } };
      } else if (shortCbm < 0) {
        // Gain - GREEN
        ws[shortCbmAddr].s = { fill: GREEN_FILL, font: { bold: true, color: { rgb: "065F46" } }, alignment: { horizontal: "right" } };
      } else {
        ws[shortCbmAddr].s = { alignment: { horizontal: "right" }, fill: alternateFill };
      }
    }

    // Bend % conditional formatting
    const bendAddr = `N${row}`;
    if (ws[bendAddr] && bendPercent > 10) {
      ws[bendAddr].s = { fill: ORANGE_FILL, font: { bold: true, color: { rgb: "9A3412" } }, alignment: { horizontal: "right" } };
    } else if (ws[bendAddr]) {
      ws[bendAddr].s = { alignment: { horizontal: "right" }, fill: alternateFill };
    }

    // Other cells - alternating fill
    ["A", "B", "C", "D", "E", "G", "H", "I", "J", "K", "L", "M", "O", "P", "Q"].forEach((col) => {
      const addr = `${col}${row}`;
      if (ws[addr]) ws[addr].s = { alignment: { horizontal: col === "B" || col === "P" || col === "Q" ? "left" : "right" }, fill: alternateFill };
    });
  });

  // Totals row styling
  const totalsRow = headerRow + 1 + containers.length + 1;
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"].forEach((col) => {
    const addr = `${col}${totalsRow}`;
    if (ws[addr]) ws[addr].s = { fill: TOTALS_FILL, font: { bold: true, sz: 11 }, alignment: { horizontal: col === "A" ? "left" : "right" } };
  });

  // Column widths
  ws["!cols"] = [
    { wch: 5 },  // Sr
    { wch: 18 }, // Container
    { wch: 12 }, // CBM Gross
    { wch: 12 }, // CBM Net
    { wch: 15 }, // CBM2 Measured
    { wch: 12 }, // Short CBM
    { wch: 13 }, // PCS Supplier
    { wch: 11 }, // PCS by Us
    { wch: 13 }, // Avg G Gross
    { wch: 12 }, // Avg G Net
    { wch: 16 }, // Avg G2 Measured
    { wch: 16 }, // Avg L1 Supplier
    { wch: 16 }, // Avg L2 Measured
    { wch: 10 }, // Bend %
    { wch: 16 }, // Measurement Date
    { wch: 18 }, // Quality Supplier
    { wch: 15 }, // Quality by Us
  ];

  return ws;
}

export function exportDealSheet(purchase, companyName) {
  const wb = XLSX.utils.book_new();
  const ws = buildDealSheet(purchase, companyName);
  XLSX.utils.book_append_sheet(wb, ws, "Deal Sheet");
  XLSX.writeFile(wb, `Deal_Sheet_${purchase.bl_number}.xlsx`);
}
