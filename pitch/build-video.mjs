#!/usr/bin/env node
// Monta o vídeo pitch do AutoShieldFI só com JavaScript (Node):
// slides PNG + narração pt-BR com a voz Piper (ONNX no onnxruntime-node,
// fonemas do piper-phonemize em WebAssembly) + legendas.
//
// Uso:
//   npm run video                          # voz Piper pt_BR-faber-medium, legendas na imagem
//   node build-video.mjs                   # legendas como faixa opcional do MP4
//   node build-video.mjs --voz espeak      # prévia com espeak-ng do sistema (sem Hugging Face)
//
// Saída: out/autoshieldfi-pitch.mp4 e out/autoshieldfi-pitch.srt
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "out");
const WORK = join(OUT, "build");
const VOICES = join(ROOT, ".voices");
const VOICE = "pt_BR-faber-medium";
const HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium";

const LEAD_IN = 0.45; // silêncio antes da fala em cada cena (s)
const TAIL = 0.55; // silêncio depois da fala (s)
const FADE = 0.35; // fade de vídeo na entrada e na saída (s)
const SENTENCE_GAP = 0.22; // pausa entre frases (s)

const args = process.argv.slice(2);
const voz = args.includes("--voz") ? args[args.indexOf("--voz") + 1] : "piper";
const legendasFixas = args.includes("--legendas-fixas");

function ffmpegPath() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    return require("@ffmpeg-installer/ffmpeg").path;
  }
}
const FFMPEG = ffmpegPath();
const ff = (...a) => execFileSync(FFMPEG, ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });

// ---------- WAV ----------
function writeWav(path, samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
  return samples.length / rate;
}

function wavDuration(path) {
  const b = readFileSync(path);
  let p = 12, rate = 0, block = 0;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === "fmt ") { rate = b.readUInt32LE(p + 12); block = b.readUInt16LE(p + 20); }
    if (id === "data") return Math.min(size, b.length - p - 8) / block / rate;
    p += 8 + size + (size % 2);
  }
  throw new Error(`WAV inválido: ${path}`);
}

// ---------- Piper ----------
async function download(url, dest) {
  console.log(`baixando ${url.split("/").pop()} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download falhou (${res.status}): ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function piperVoice() {
  mkdirSync(VOICES, { recursive: true });
  const model = join(VOICES, `${VOICE}.onnx`);
  const config = join(VOICES, `${VOICE}.onnx.json`);
  if (!existsSync(config)) await download(`${HF}/${VOICE}.onnx.json`, config);
  if (!existsSync(model)) await download(`${HF}/${VOICE}.onnx`, model);
  const ort = require("onnxruntime-node");
  const phonemizer = require("piper-phonemize");
  const cfg = JSON.parse(readFileSync(config, "utf8"));
  const session = await ort.InferenceSession.create(model);
  const idMap = cfg.phoneme_id_map;
  const rate = cfg.audio.sample_rate;
  const espeakVoice = cfg.espeak?.voice ?? "pt-br";
  const { noise_scale = 0.667, length_scale = 1, noise_w = 0.8 } = cfg.inference ?? {};

  // Mesmo mapeamento do Piper: BOS, cada fonema seguido de PAD, EOS.
  const toIds = (phonemes) => {
    const ids = [...idMap["^"]];
    for (const ph of phonemes) {
      if (!idMap[ph]) continue;
      ids.push(...idMap[ph], ...idMap["_"]);
    }
    ids.push(...idMap["$"]);
    return ids;
  };

  return async (text) => {
    const parts = [];
    for (const sentence of phonemizer.phonemizeToString(text, espeakVoice) ?? []) {
      const ids = toIds([...sentence.normalize("NFD")]);
      const feeds = {
        input: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
        input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
        scales: new ort.Tensor("float32", Float32Array.from([noise_scale, length_scale * 0.95, noise_w]), [3]),
      };
      const out = await session.run(feeds);
      parts.push(out[session.outputNames[0]].data, new Float32Array(Math.round(SENTENCE_GAP * rate)));
    }
    const total = parts.reduce((n, p) => n + p.length, 0);
    const audio = new Float32Array(total);
    let o = 0;
    for (const p of parts) { audio.set(p, o); o += p.length; }
    return { audio, rate };
  };
}

// ---------- Legendas ----------
const srtTime = (t) => {
  const ms = Math.round(t * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

function cues(text, start, dur, maxChars = 84) {
  const parts = [];
  for (const sentence of text.trim().split(/(?<=[.!?:])\s+/)) {
    let line = "";
    for (const word of sentence.split(/\s+/)) {
      if (line && line.length + 1 + word.length > maxChars) { parts.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) parts.push(line);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  let t = start;
  return parts.map((p) => {
    const d = (dur * p.length) / total;
    const cue = [t, t + d, p];
    t += d;
    return cue;
  });
}

// ---------- Montagem ----------
const roteiro = JSON.parse(readFileSync(join(ROOT, "roteiro.json"), "utf8"));
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const speak = voz === "piper" ? await piperVoice() : null;
const clips = [];
const srt = [];
let t = 0;

for (const [i, cena] of roteiro.cenas.entries()) {
  const wav = join(WORK, `fala-${String(i).padStart(2, "0")}.wav`);
  let speech;
  if (speak) {
    const { audio, rate } = await speak(cena.fala);
    speech = writeWav(wav, audio, rate);
  } else {
    const espeakVoice = existsSync("/usr/share/mbrola/br4") ? "mb-br4" : "pt-br";
    execFileSync("espeak-ng", ["-v", espeakVoice, "-s", "155", "-w", wav, cena.fala], { stdio: "ignore" });
    speech = wavDuration(wav);
  }
  const dur = LEAD_IN + speech + TAIL;
  const delay = Math.round(LEAD_IN * 1000);
  const clip = join(WORK, `cena-${String(i).padStart(2, "0")}.mp4`);
  ff(
    "-loop", "1", "-framerate", "30", "-i", join(ROOT, "slides", cena.slide), "-i", wav,
    "-filter_complex",
    `[0:v]scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${(dur - FADE).toFixed(3)}:d=${FADE}[v];` +
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${delay}|${delay},apad,atrim=0:${dur.toFixed(3)}[a]`,
    "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-tune", "stillimage",
    "-c:a", "aac", "-b:a", "160k", "-r", "30", clip,
  );
  clips.push(clip);
  srt.push(...cues(cena.texto, t + LEAD_IN, speech));
  t += dur;
  console.log(`cena ${String(i + 1).padStart(2, "0")}: ${dur.toFixed(1).padStart(5)}s  (${cena.slide})`);
}

const srtPath = join(OUT, "autoshieldfi-pitch.srt");
writeFileSync(srtPath, srt.map(([a, b, txt], n) => `${n + 1}\n${srtTime(a)} --> ${srtTime(b)}\n${txt}\n`).join("\n"));
const lista = join(WORK, "lista.txt");
writeFileSync(lista, clips.map((c) => `file '${c}'\n`).join(""));
const joined = join(WORK, "joined.mp4");
ff("-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", joined);

const final = join(OUT, "autoshieldfi-pitch.mp4");
const loud = ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k"];
if (legendasFixas) {
  const style = "FontName=Inter,FontSize=14,PrimaryColour=&H00F5F8F2,OutlineColour=&H00191F0B,BorderStyle=3,Outline=6,Shadow=0,MarginV=36";
  ff("-i", joined, "-vf", `subtitles=${srtPath}:force_style='${style}'`, "-c:v", "libx264", "-preset", "medium", "-crf", "20", ...loud, "-movflags", "+faststart", final);
} else {
  ff("-i", joined, "-i", srtPath, "-map", "0", "-map", "1", "-c:v", "copy", "-c:s", "mov_text", "-metadata:s:s:0", "language=por", ...loud, "-movflags", "+faststart", final);
}
console.log(`\nduração total: ${Math.floor(t / 60)}min ${(t % 60).toFixed(1)}s\nvídeo: ${final}\nlegendas: ${srtPath}`);
