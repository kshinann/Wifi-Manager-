// Builds printable Word versions of the safety templates and the abbreviation
// list from mockup/data/*.js (the same data the app uses).
//   node tools/build-printables.js   ->  templates/word/*.docx
// PDFs are then made with LibreOffice; see tools/build-printables.sh.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  ShadingType, AlignmentType, BorderStyle, PageOrientation, Footer, PageNumber,
  HeightRule, VerticalAlign, TableLayoutType,
} = require('docx');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'templates', 'word');
fs.mkdirSync(OUT, { recursive: true });

// Load the browser data files
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['glossary.js', 'safety-templates.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'mockup', 'data', f), 'utf8'), ctx);
}
const GLOSSARY = ctx.window.VC_GLOSSARY;
const TEMPLATES = ctx.window.VC_TEMPLATES;

// Look & feel
const FONT = 'Arial';
const INK = '1B2328', MUTED = '5B676F', LINE = 'B8C0C5', BAND = '1F4E79', HIVIS = 'F2A900', TINT = 'EEF2F5';
const A4 = { width: 11906, height: 16838 };
const MARGIN = 720; // 0.5"
const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 18, bold: o.bold, italics: o.italics, color: o.color || INK });
const para = (text, o = {}) => new Paragraph({
  children: Array.isArray(text) ? text : [run(text, o)],
  alignment: o.align, spacing: { before: o.before || 0, after: o.after ?? 60 },
  shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
  keepNext: o.keepNext,
});
function cell(content, width, o = {}) {
  const children = (Array.isArray(content) ? content : [content]).map(c =>
    c instanceof Paragraph ? c : para(String(c ?? ''), { size: o.size || 17, bold: o.bold, color: o.color, align: o.align, after: 0 }));
  return new TableCell({
    children, width: { size: width, type: WidthType.DXA }, columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    verticalAlign: o.valign || VerticalAlign.CENTER,
  });
}
function table(widths, rows, o = {}) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths, borders, layout: TableLayoutType.FIXED,
    rows: rows.map((r, i) => new TableRow({
      children: r, tableHeader: o.header && i === 0, cantSplit: true,
      height: o.minHeight && !(o.header && i === 0) ? { value: o.minHeight, rule: HeightRule.ATLEAST } : undefined,
    })),
  });
}
const spacer = (after = 120) => new Paragraph({ children: [], spacing: { after } });
const split = (total, parts) => { const w = parts.map(p => Math.floor(total * p)); w[w.length - 1] += total - w.reduce((a, b) => a + b, 0); return w; };
const BOX = '☐'; // ☐

function sectionHeading(text) {
  return new Paragraph({
    children: [run(text.toUpperCase(), { size: 18, bold: true, color: 'FFFFFF' })],
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: BAND },
    spacing: { before: 160, after: 60 }, keepNext: true,
  });
}

function renderSection(s, W) {
  const out = [sectionHeading(s.h)];
  if (s.type === 'fields') {
    const w = split(W, [0.34, 0.66]);
    out.push(table(w, s.fields.map(f => [
      cell(f.l, w[0], { fill: TINT, bold: true }),
      cell(f.t === 'select' ? f.opts.map(o => `${BOX} ${o}`).join('    ') : '', w[1], { size: 16, color: MUTED }),
    ]), { minHeight: 380 }));
    // taller rows for long answers
  } else if (s.type === 'yesno') {
    const w = split(W, [0.05, 0.53, 0.07, 0.07, 0.07, 0.21]);
    const head = ['No.', 'Item', 'Yes', 'No', 'N/A', 'Remarks'].map((h, i) => cell(h, w[i], { fill: TINT, bold: true, align: i > 1 && i < 5 ? AlignmentType.CENTER : undefined }));
    out.push(table(w, [head, ...s.items.map((it, i) => [
      cell(String(i + 1), w[0]), cell(it, w[1]),
      cell(BOX, w[2], { align: AlignmentType.CENTER, size: 22 }), cell(BOX, w[3], { align: AlignmentType.CENTER, size: 22 }),
      cell(BOX, w[4], { align: AlignmentType.CENTER, size: 22 }), cell('', w[5]),
    ])], { header: true, minHeight: 360 }));
  } else if (s.type === 'checks') {
    const w = split(W, [0.5, 0.5]);
    const rows = [];
    for (let i = 0; i < s.items.length; i += 2) {
      rows.push([cell(`${BOX}  ${s.items[i]}`, w[0]), cell(s.items[i + 1] ? `${BOX}  ${s.items[i + 1]}` : '', w[1])]);
    }
    out.push(table(w, rows, { minHeight: 340 }));
  } else if (s.type === 'table') {
    const n = s.cols.length;
    const w = split(W, s.w || Array(n).fill(1 / n));
    const head = s.cols.map((c, i) => cell(c, w[i], { fill: TINT, bold: true, size: 15 }));
    const blank = () => s.cols.map((_, i) => cell('', w[i]));
    out.push(table(w, [head, ...Array.from({ length: s.rows }, blank)], { header: true, minHeight: 440 }));
  } else if (s.type === 'signs') {
    const w = split(W, [0.37, 0.23, 0.22, 0.18]);
    const head = ['Role', 'Name', 'Signature', 'Date & time'].map((h, i) => cell(h, w[i], { fill: TINT, bold: true }));
    out.push(table(w, [head, ...s.roles.map(r => [cell(r, w[0], { size: 16 }), cell('', w[1]), cell('', w[2]), cell('', w[3])])], { header: true, minHeight: 620 }));
  } else if (s.type === 'matrix') {
    const L = ['5 Most likely', '4 Possible', '3 Conceivable', '2 Remote', '1 Inconceivable'];
    const S = ['1 Negligible', '2 Minor', '3 Serious', '4 Fatal', '5 Catastrophic'];
    const w = split(W, [0.2, 0.16, 0.16, 0.16, 0.16, 0.16]);
    const color = v => v >= 15 ? 'E8A39B' : v >= 5 ? 'F6D58A' : 'A9D8B8';
    const rows = [[cell('Likelihood ↓  /  Severity →', w[0], { fill: TINT, bold: true, size: 15 }), ...S.map((s2, i) => cell(s2, w[i + 1], { fill: TINT, bold: true, align: AlignmentType.CENTER, size: 15 }))]];
    L.forEach((l, r) => {
      const lv = 5 - r;
      rows.push([cell(l, w[0], { fill: TINT, bold: true, size: 15 }), ...S.map((_, c) => {
        const v = lv * (c + 1);
        return cell(String(v), w[c + 1], { fill: color(v), align: AlignmentType.CENTER, bold: true });
      })]);
    });
    out.push(table(w, rows, { minHeight: 360 }));
    out.push(para([run('Risk = Likelihood × Severity.  ', { size: 16, bold: true }),
      run('15–25 HIGH: stop, act immediately.  5–12 MEDIUM: plan controls, then proceed with care.  1–4 LOW: acceptable, keep monitoring.', { size: 16 })], { before: 60 }));
  } else if (s.type === 'note') {
    out.push(para(s.text, { size: 17, fill: TINT, before: 40, after: 60 }));
  }
  return out;
}

const landscapeIds = new Set(['RA-HIRARC', 'INS-PPE']);

function templateDoc(t) {
  const land = landscapeIds.has(t.id);
  const W = (land ? A4.height : A4.width) - 2 * MARGIN;
  const headW = split(W, [0.72, 0.28]);
  const header = table(headW, [[
    cell([
      para([run('VARIA CONNECT  ·  ' + t.cat.toUpperCase(), { size: 15, bold: true, color: MUTED })], { after: 40 }),
      para([run(t.title, { size: 30, bold: true })], { after: 20 }),
      para([run(t.bm, { size: 20, italics: true, color: MUTED })], { after: 0 }),
    ], headW[0], { valign: VerticalAlign.TOP }),
    cell([
      para([run('Form ', { size: 15, color: MUTED }), run(t.id, { size: 18, bold: true })], { after: 40 }),
      para([run('Company logo', { size: 15, color: MUTED })], { after: 0 }),
    ], headW[1], { fill: TINT, valign: VerticalAlign.TOP }),
  ]]);
  const children = [
    header,
    new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: HIVIS, space: 1 } }, spacing: { after: 80 } }),
    para([run('When to use: ', { bold: true, size: 17 }), run(t.use, { size: 17 })], { after: 40 }),
    para([run('Validity / frequency: ', { bold: true, size: 17 }), run(t.validity, { size: 17 })], { after: 60 }),
  ];
  t.sections.forEach(s => children.push(...renderSection(s, W)));
  children.push(spacer(80));
  children.push(para('Keep the original at the site office for the duration of the project. Display permits at the work area while work is in progress.', { size: 15, color: MUTED }));

  return new Document({
    creator: 'Varia Connect', title: `${t.id} ${t.title}`, description: t.use,
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [{
      properties: { page: { size: { width: A4.width, height: A4.height, orientation: land ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      footers: { default: new Footer({ children: [para([
        run(`Varia Connect  ·  ${t.id}  ·  Draft template: SHO to review before use  ·  Page `, { size: 14, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: MUTED }),
        run(' of ', { size: 14, color: MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: MUTED }),
      ], { align: AlignmentType.CENTER })] }) },
      children,
    }],
  });
}

function glossaryDoc() {
  const W = A4.width - 2 * MARGIN;
  const w = split(W, [0.17, 0.42, 0.41]);
  const cats = [...new Set(GLOSSARY.map(g => g[3]))];
  const children = [
    para([run('VARIA CONNECT  ·  REFERENCE', { size: 15, bold: true, color: MUTED })], { after: 40 }),
    para([run('Construction Abbreviation List', { size: 34, bold: true })], { after: 20 }),
    para([run('Senarai Singkatan Pembinaan', { size: 22, italics: true, color: MUTED })], { after: 80 }),
    new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: HIVIS, space: 1 } }, spacing: { after: 100 } }),
    para(`${GLOSSARY.length} abbreviations used on Malaysian construction sites, grouped into ${cats.length} areas, with English and Bahasa Malaysia meanings. Where one abbreviation has several meanings, the area is shown in brackets.`, { size: 17, after: 60 }),
    para([run('Areas: ', { bold: true, size: 17 }), run(cats.join('  ·  '), { size: 17 })], { after: 120 }),
  ];
  cats.forEach(c => {
    const items = GLOSSARY.filter(g => g[3] === c).sort((a, b) => a[0].localeCompare(b[0]));
    children.push(sectionHeading(`${c}  (${items.length})`));
    children.push(table(w, [
      ['Abbreviation', 'English', 'Bahasa Malaysia'].map((h, i) => cell(h, w[i], { fill: TINT, bold: true })),
      ...items.map(g => [cell(g[0], w[0], { bold: true }), cell(g[1], w[1]), cell(g[2], w[2], { color: MUTED })]),
    ], { header: true }));
  });
  children.push(spacer(80));
  children.push(para('Draft list. Bahasa Malaysia terms are suggested translations; check official terms with the relevant authority before using them in contract documents.', { size: 15, color: MUTED }));
  return new Document({
    creator: 'Varia Connect', title: 'Construction Abbreviation List',
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [{
      properties: { page: { size: A4, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      footers: { default: new Footer({ children: [para([
        run('Varia Connect  ·  Construction Abbreviation List  ·  Page ', { size: 14, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: MUTED }),
        run(' of ', { size: 14, color: MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: MUTED }),
      ], { align: AlignmentType.CENTER })] }) },
      children,
    }],
  });
}

const slug = s => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
(async () => {
  const files = [];
  for (const t of TEMPLATES) {
    const name = `${t.id}_${slug(t.title.split(' — ')[0])}.docx`;
    fs.writeFileSync(path.join(OUT, name), await Packer.toBuffer(templateDoc(t)));
    files.push(name);
  }
  const g = '00_Construction-Abbreviation-List.docx';
  fs.writeFileSync(path.join(OUT, g), await Packer.toBuffer(glossaryDoc()));
  files.unshift(g);
  console.log(`Wrote ${files.length} Word files to templates/word`);
})();
