#!/usr/bin/env python3
"""Monta o vídeo pitch do AutoShieldFI: slides + narração pt-BR + legendas.

Uso:
    python3 pitch/build_video.py                 # voz Piper pt_BR-faber-medium (baixa do Hugging Face)
    python3 pitch/build_video.py --voz espeak    # voz offline (espeak-ng + mbrola br4), só para prévia
    python3 pitch/build_video.py --legendas-fixas

Requisitos: ffmpeg; para a voz Piper, `pip install piper-tts`; para a prévia,
`apt-get install espeak-ng mbrola mbrola-br4`.
Saída: pitch/out/autoshieldfi-pitch.mp4 e pitch/out/autoshieldfi-pitch.srt
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
WORK = OUT / "build"
VOICES = ROOT / ".voices"
HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium"

LEAD_IN = 0.45   # silêncio antes da fala em cada cena (s)
TAIL = 0.55      # silêncio depois da fala (s)
FADE = 0.35      # fade de vídeo na entrada e na saída de cada cena (s)


def run(cmd):
    subprocess.run(cmd, check=True)


def wav_duration(path):
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()


def piper_model():
    VOICES.mkdir(exist_ok=True)
    model = VOICES / "pt_BR-faber-medium.onnx"
    config = VOICES / "pt_BR-faber-medium.onnx.json"
    for target in (model, config):
        if not target.exists():
            print(f"baixando {target.name} ...")
            urllib.request.urlretrieve(f"{HF}/{target.name}", target)
    return model


def synth_piper(texts, outdir):
    from piper import PiperVoice, SynthesisConfig

    voice = PiperVoice.load(str(piper_model()))
    cfg = SynthesisConfig(length_scale=0.95, noise_scale=0.6, noise_w_scale=0.8)
    files = []
    for i, text in enumerate(texts):
        out = outdir / f"fala-{i:02d}.wav"
        with wave.open(str(out), "wb") as w:
            voice.synthesize_wav(text, w, syn_config=cfg)
        files.append(out)
    return files


def synth_espeak(texts, outdir):
    voice = "mb-br4" if Path("/usr/share/mbrola/br4").exists() else "pt-br"
    files = []
    for i, text in enumerate(texts):
        out = outdir / f"fala-{i:02d}.wav"
        run(["espeak-ng", "-v", voice, "-s", "155", "-w", str(out), text])
        files.append(out)
    return files


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def cues(text, start, dur, max_chars=84):
    """Divide a fala da cena em legendas curtas, com tempo proporcional ao tamanho."""
    parts = []
    for sentence in re.split(r"(?<=[.!?:])\s+", text.strip()):
        words, line = sentence.split(), ""
        for word in words:
            if line and len(line) + 1 + len(word) > max_chars:
                parts.append(line)
                line = word
            else:
                line = f"{line} {word}".strip()
        if line:
            parts.append(line)
    total = sum(len(p) for p in parts)
    t, out = start, []
    for p in parts:
        d = dur * len(p) / total
        out.append((t, t + d, p))
        t += d
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voz", choices=["piper", "espeak"], default="piper")
    ap.add_argument("--legendas-fixas", action="store_true", help="queima as legendas na imagem")
    args = ap.parse_args()
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg não encontrado")

    roteiro = json.loads((ROOT / "roteiro.json").read_text(encoding="utf-8"))
    cenas = roteiro["cenas"]
    shutil.rmtree(WORK, ignore_errors=True)
    WORK.mkdir(parents=True)

    falas = [c["fala"] for c in cenas]
    wavs = synth_piper(falas, WORK) if args.voz == "piper" else synth_espeak(falas, WORK)

    clips, srt, t = [], [], 0.0
    for i, (cena, wav) in enumerate(zip(cenas, wavs)):
        speech = wav_duration(wav)
        dur = LEAD_IN + speech + TAIL
        clip = WORK / f"cena-{i:02d}.mp4"
        delay = int(LEAD_IN * 1000)
        run([
            "ffmpeg", "-loglevel", "error", "-y",
            "-loop", "1", "-framerate", "30", "-i", str(ROOT / "slides" / cena["slide"]),
            "-i", str(wav),
            "-filter_complex",
            f"[0:v]scale=1920:1080,format=yuv420p,fade=t=in:st=0:d={FADE},fade=t=out:st={dur - FADE:.3f}:d={FADE}[v];"
            f"[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay={delay}|{delay},apad,atrim=0:{dur:.3f}[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{dur:.3f}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "160k", "-r", "30", str(clip),
        ])
        clips.append(clip)
        srt += cues(cena["texto"], t + LEAD_IN, speech)
        t += dur
        print(f"cena {i + 1:02d}: {dur:5.1f}s  ({cena['slide']})")

    srt_path = OUT / "autoshieldfi-pitch.srt"
    srt_path.write_text(
        "\n".join(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{txt}\n" for n, (a, b, txt) in enumerate(srt, 1)),
        encoding="utf-8",
    )
    lista = WORK / "lista.txt"
    lista.write_text("".join(f"file '{c.name}'\n" for c in clips))
    joined = WORK / "joined.mp4"
    run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lista), "-c", "copy", str(joined)])

    final = OUT / "autoshieldfi-pitch.mp4"
    if args.legendas_fixas:
        style = "FontName=Inter,FontSize=14,PrimaryColour=&H00F5F8F2,OutlineColour=&H00191F0B,BorderStyle=3,Outline=6,Shadow=0,MarginV=36"
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(joined),
             "-vf", f"subtitles={srt_path}:force_style='{style}'",
             "-c:v", "libx264", "-preset", "medium", "-crf", "20",
             "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k",
             "-movflags", "+faststart", str(final)])
    else:
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(joined), "-i", str(srt_path),
             "-map", "0", "-map", "1", "-c:v", "copy", "-c:s", "mov_text",
             "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k",
             "-metadata:s:s:0", "language=por", "-movflags", "+faststart", str(final)])
    print(f"\nduração total: {t // 60:.0f}min {t % 60:04.1f}s\nvídeo: {final}\nlegendas: {srt_path}")


if __name__ == "__main__":
    main()
