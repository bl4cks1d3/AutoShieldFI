#!/usr/bin/env node
// Renderiza os slides do pitch deck (deck/slides/*.html) em PNG 1920x1080 para o vídeo.
// Uso: npm run slides   (CHROMIUM_PATH=/caminho/do/chrome se o Playwright não achar o navegador)
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const ROOT = dirname(fileURLToPath(import.meta.url));
const BRAND = join(ROOT, "..", "assets", "brand");
const OUT = join(ROOT, "slides");
const order = JSON.parse(readFileSync(join(ROOT, "deck", "deck.json"), "utf8")).order;

// Imagens do deck publicado -> arquivos da marca no repositório.
const blobs = {
  "/_blob/09fd258e7b46a7144f40b5788cbd0942": "autoshieldfi-logo-dark.png",
  "/_blob/d5db19562e312c185f1a14d8fba9ff10": "autoshieldfi-mark.png",
};

// <x-icon> do deck -> SVG equivalente (traço no estilo Lucide).
const icons = {
  Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  Home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  Lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  Chart: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
  Lightning: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
};

const font = (pkg, family, weight, file) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url('${pathToFileURL(require.resolve(`${pkg}/files/${file}`))}')}`;
const css = [
  ...[500, 700, 800].map((w) => font("@fontsource/plus-jakarta-sans", "Plus Jakarta Sans", w, `plus-jakarta-sans-latin-${w}-normal.woff2`)),
  ...[400, 500, 600].map((w) => font("@fontsource/inter", "Inter", w, `inter-latin-${w}-normal.woff2`)),
  "html,body{margin:0;width:1920px;height:1080px;overflow:hidden}",
  "*{box-sizing:border-box;margin:0}",
  "section{position:relative;width:1920px;height:1080px;overflow:hidden}",
  "aside{display:none}",
  "ul{padding-left:40px}",
].join("\n");

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const tmp = join(OUT, "_slide.html");
for (const [i, id] of order.entries()) {
  let html = readFileSync(join(ROOT, "deck", "slides", `${id}.html`), "utf8");
  for (const [blob, file] of Object.entries(blobs)) html = html.split(blob).join(pathToFileURL(join(BRAND, file)).href);
  html = html.replace(
    /<x-icon name="(\w+)" style="color:([^;]+);width:(\d+)px;height:(\d+)px"><\/x-icon>/g,
    (_, name, color, w, h) =>
      `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${icons[name] ?? ""}</svg>`,
  );
  writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  const out = join(OUT, `${String(i + 1).padStart(2, "0")}-${id}.png`);
  await page.screenshot({ path: out });
  console.log(out);
}
unlinkSync(tmp);
await browser.close();
