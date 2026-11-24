// Renderiza o vídeo motion pitch: cenas animadas (cenas.html) quadro a quadro + narração Piper + trilha.
// Pré-requisito: python narrar.py (gera out/motion/audio/*.wav, tempos.json e qr.svg)
// Uso: node motion/render-motion.mjs [--total 180] [--fps 30] [--workers 4] [--teste]
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const OUT = join(AQUI, "..", "out", "motion");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const TOTAL = parseFloat(arg("total", "180"));
const FPS = parseInt(arg("fps", "30"), 10);
const WORKERS = parseInt(arg("workers", "4"), 10);
const TESTE = process.argv.includes("--teste");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const exe = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";

// ---------- linha do tempo ----------
const tempos = JSON.parse(readFileSync(join(OUT, "tempos.json"), "utf8"));
const ENTRADA = 0.3; // respiro curto antes da fala de cada cena
// a folga até o total vai só para as cenas de impacto, para a narração seguir fluida
const PESO = { revelacao: 1, cashback: 0.6, cta: 2 };
const fala = tempos.reduce((s, c) => s + c.audio + ENTRADA, 0);
const sobra = Math.max(0, TOTAL - fala);
const somaPeso = tempos.reduce((s, c) => s + (PESO[c.id] ?? 0), 0);
let t = 0;
const cenas = tempos.map((c) => {
  const dur = ENTRADA + c.audio + (sobra * (PESO[c.id] ?? 0)) / somaPeso;
  const cena = { id: c.id, inicio: t, fim: t + dur, falaInicio: t + ENTRADA, audio: c.audio, trechos: c.trechos };
  t += dur;
  return cena;
});
const DUR = t;
console.log(`duração: ${DUR.toFixed(1)}s · fala ${fala.toFixed(1)}s · ${cenas.length} cenas`);

// ---------- legendas SRT ----------
const ts = (s) => { const ms = Math.round(s * 1000); const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
writeFileSync(join(OUT, "..", "autoshieldfi-motion-pitch.srt"),
  cenas.flatMap((c) => c.trechos.map((tr) => [c.falaInicio + tr.ini, c.falaInicio + tr.fim + 0.1, tr.legenda]))
    .map(([a, b, l], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${l}\n`).join("\n"));

// ---------- quadros (em paralelo) ----------
const url = pathToFileURL(join(AQUI, "cenas.html")).href;
const nQuadros = TESTE ? 0 : Math.round(DUR * FPS);
const partes = join(OUT, "partes");
rmSync(partes, { recursive: true, force: true });
mkdirSync(partes, { recursive: true });

async function abrir(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.evaluate(async ([c, d]) => { window.configurar(c, d); await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); }, [cenas, DUR]);
  return page;
}

const browser = await chromium.launch({ executablePath: exe });

if (TESTE) { // capturas de conferência
  const page = await abrir(browser);
  for (const c of cenas) {
    await page.evaluate((x) => window.seek(x), c.falaInicio + c.audio * 0.97);
    await page.screenshot({ path: join(OUT, `teste-${c.id}.png`) });
  }
  await browser.close();
  console.log("capturas de teste em", OUT);
  process.exit(0);
}

async function renderizar(w) {
  const ini = Math.floor((nQuadros * w) / WORKERS), fim = Math.floor((nQuadros * (w + 1)) / WORKERS);
  const page = await abrir(browser);
  const saida = join(partes, `p${w}.mp4`);
  const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), saida], { stdio: ["pipe", "inherit", "inherit"] });
  const fechou = new Promise((ok, erro) => ff.on("close", (c) => (c === 0 ? ok() : erro(new Error(`ffmpeg parte ${w}: ${c}`)))));
  for (let f = ini; f < fim; f++) {
    await page.evaluate((x) => window.seek(x), f / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (w === 0 && (f - ini) % 150 === 0) console.log(`quadros ~${Math.round(((f - ini) / (fim - ini)) * 100)}%`);
  }
  ff.stdin.end();
  await fechou;
  return saida;
}

const arquivos = await Promise.all([...Array(WORKERS).keys()].map(renderizar));
await browser.close();
writeFileSync(join(partes, "lista.txt"), arquivos.map((a) => `file '${a}'`).join("\n"));
execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(partes, "lista.txt"), "-c", "copy", join(OUT, "video.mp4")]);

// ---------- trilha: pad Am–F–C–G gerado pelo ffmpeg ----------
const acordes = [[110, 130.81, 164.81, 220], [87.31, 110, 130.81, 174.61], [130.81, 164.81, 196, 261.63], [98, 123.47, 146.83, 196]];
const freq = (k) => acordes.reduceRight((acc, a, i) => `if(eq(floor(mod(t/4,4)),${i}),${a[k]},${acc})`, "0");
const env = "pow(sin(PI*mod(t,4)/4),0.6)";
const pad = [0, 1, 2, 3].map((k) => `0.16*sin(2*PI*${freq(k)}*t)`).join("+");
const baixo = `0.22*sin(PI*${freq(0)}*t)*exp(-5*mod(t,0.5))`;
execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "lavfi", "-i",
  `aevalsrc='(${pad})*${env}+${baixo}':s=44100:d=${DUR.toFixed(2)}`,
  "-af", `lowpass=f=1800,aecho=0.8:0.7:120|240:0.3|0.2,afade=t=in:d=2,afade=t=out:st=${(DUR - 3).toFixed(2)}:d=3,volume=0.5`,
  "-ac", "2", join(OUT, "trilha.wav")]);

// ---------- narração posicionada + mix com ducking ----------
const entradas = cenas.flatMap((c) => ["-i", join(OUT, "audio", `${c.id}.wav`)]);
const atrasos = cenas.map((c, i) => `[${i}:a]aresample=44100,adelay=${Math.round(c.falaInicio * 1000)}:all=1[v${i}]`).join(";");
const filtro = `${atrasos};${cenas.map((_, i) => `[v${i}]`).join("")}amix=inputs=${cenas.length}:normalize=0,apad,atrim=0:${DUR.toFixed(3)},asplit=2[voz][vozsc];` +
  `[${cenas.length}:a]volume=0.45[mus];[mus][vozsc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[musd];` +
  `[voz][musd]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
execFileSync(FFMPEG, ["-y", "-loglevel", "error", ...entradas, "-i", join(OUT, "trilha.wav"), "-filter_complex", filtro, "-map", "[a]",
  "-ar", "44100", "-ac", "2", join(OUT, "audio-final.wav")]);

const final = join(OUT, "..", "autoshieldfi-motion-pitch.mp4");
execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", join(OUT, "video.mp4"), "-i", join(OUT, "audio-final.wav"),
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final]);
console.log("pronto:", final);
