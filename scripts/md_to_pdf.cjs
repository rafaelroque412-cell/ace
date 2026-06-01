const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const { chromium } = require("playwright");

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/md_to_pdf.cjs <input.md> <output.pdf>");
  process.exit(1);
}

const markdown = fs.readFileSync(inputPath, "utf8");
const body = marked.parse(markdown);

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Spec Driven Development</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 17mm 20mm 17mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #172033;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.52;
      background: #ffffff;
    }

    .cover {
      min-height: 87vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-bottom: 1px solid #d7dde8;
      margin-bottom: 26px;
    }

    .eyebrow {
      color: #0f766e;
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 18px;
    }

    .cover h1 {
      color: #111827;
      font-size: 31pt;
      line-height: 1.06;
      margin: 0 0 18px 0;
      max-width: 720px;
    }

    .subtitle {
      color: #40516d;
      font-size: 13pt;
      max-width: 680px;
      margin-bottom: 34px;
    }

    .meta {
      display: grid;
      grid-template-columns: 145px 1fr;
      gap: 8px 18px;
      color: #334155;
      font-size: 10.5pt;
      max-width: 620px;
      padding-top: 20px;
      border-top: 3px solid #0f766e;
    }

    .meta strong {
      color: #111827;
    }

    h1, h2, h3 {
      color: #111827;
      page-break-after: avoid;
    }

    h1 {
      font-size: 23pt;
      margin: 0 0 18px;
    }

    h2 {
      font-size: 16.5pt;
      margin: 26px 0 9px;
      padding-bottom: 5px;
      border-bottom: 1px solid #d7dde8;
    }

    h3 {
      font-size: 12.8pt;
      margin: 18px 0 7px;
    }

    p {
      margin: 0 0 9px;
    }

    ul {
      margin: 6px 0 12px 20px;
      padding: 0;
    }

    li {
      margin: 2px 0;
    }

    pre {
      margin: 10px 0 14px;
      padding: 12px 14px;
      white-space: pre-wrap;
      word-break: break-word;
      background: #f5f7fb;
      border: 1px solid #dce3ee;
      border-radius: 6px;
      color: #172033;
      font-size: 9.2pt;
      line-height: 1.42;
      page-break-inside: avoid;
    }

    code {
      font-family: Consolas, "Courier New", monospace;
    }

    p code, li code {
      background: #eef6f5;
      color: #115e59;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 9.3pt;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 9.8pt;
    }

    th, td {
      border: 1px solid #d7dde8;
      padding: 7px 8px;
      vertical-align: top;
    }

    th {
      background: #eef6f5;
      color: #0f3f3b;
      text-align: left;
    }

    blockquote {
      border-left: 4px solid #0f766e;
      margin: 12px 0;
      padding: 8px 12px;
      background: #f5fbfa;
      color: #334155;
    }

    .content > h1:first-child {
      display: none;
    }

    .content {
      counter-reset: section;
    }

    .content h2 {
      break-after: avoid;
    }
  </style>
</head>
<body>
  <section class="cover">
    <div class="eyebrow">Documento para desarrollo</div>
    <h1>Spec Driven Development</h1>
    <div class="subtitle">
      Aplicacion web con IA para expedientes de contratacion publica,
      generacion de contratos de bienes/servicios y consulta juridica con fuentes.
    </div>
    <div class="meta">
      <strong>Proyecto</strong><span>Aplicativo de contratos y consulta juridica IA</span>
      <strong>Audiencia</strong><span>Desarrolladores, equipo legal y responsables del producto</span>
      <strong>Version</strong><span>SDD v1.0</span>
      <strong>Fecha</strong><span>1 de junio de 2026</span>
    </div>
  </section>
  <main class="content">${body}</main>
</body>
</html>`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div></div>`,
    footerTemplate: `
      <div style="font-family: Segoe UI, Arial, sans-serif; font-size: 8px; color: #64748b; width: 100%; padding: 0 17mm; display: flex; justify-content: space-between;">
        <span>Spec Driven Development</span>
        <span>Pagina <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: "18mm",
      right: "17mm",
      bottom: "20mm",
      left: "17mm",
    },
  });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
