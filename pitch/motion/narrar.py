"""Gera a narração do vídeo motion com o Piper (Python) e o QR code.

Uso: python narrar.py [--velocidade 1.0]
Saída: pitch/out/motion/audio/<cena>.wav, pitch/out/motion/tempos.json, pitch/out/motion/qr.svg
"""
import argparse
import json
import wave
from pathlib import Path

import qrcode
import qrcode.image.svg
from piper import PiperVoice, SynthesisConfig

AQUI = Path(__file__).resolve().parent
PITCH = AQUI.parent
SAIDA = PITCH / "out" / "motion"
VOZES = PITCH / ".voices"
PAUSA = 0.22  # segundos entre frases da mesma cena


def baixar_voz(nome: str) -> Path:
    modelo = VOZES / f"{nome}.onnx"
    if modelo.exists() and (VOZES / f"{nome}.onnx.json").exists():
        return modelo
    from huggingface_hub import hf_hub_download

    lang, regiao = nome.split("-")[0], nome.split("_")[0]
    falante, qualidade = nome.split("-")[1], nome.split("-")[2]
    base = f"{regiao}/{lang}/{falante}/{qualidade}/{nome}"
    VOZES.mkdir(parents=True, exist_ok=True)
    for ext in (".onnx", ".onnx.json"):
        p = hf_hub_download("rhasspy/piper-voices", base + ext)
        (VOZES / f"{nome}{ext}").write_bytes(Path(p).read_bytes())
    return modelo


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--velocidade", type=float, default=1.0, help="length_scale do Piper (<1 = mais rápido)")
    args = ap.parse_args()

    roteiro = json.loads((AQUI / "roteiro-motion.json").read_text(encoding="utf-8"))
    voz = PiperVoice.load(str(baixar_voz(roteiro["voz_piper"])))
    cfg = SynthesisConfig(length_scale=args.velocidade, noise_scale=0.6, noise_w_scale=0.8)

    (SAIDA / "audio").mkdir(parents=True, exist_ok=True)
    tempos = []
    for cena in roteiro["cenas"]:
        wav = SAIDA / "audio" / f"{cena['id']}.wav"
        quadros, trechos, taxa, t = b"", [], 22050, 0.0
        for i, (legenda, fala) in enumerate(cena["trechos"]):
            pedacos = list(voz.synthesize(fala, syn_config=cfg))
            taxa = pedacos[0].sample_rate
            audio = b"".join(p.audio_int16_bytes for p in pedacos)
            dur = len(audio) / 2 / taxa
            trechos.append({"legenda": legenda, "ini": round(t, 3), "fim": round(t + dur, 3)})
            quadros += audio
            t += dur
            if i < len(cena["trechos"]) - 1:  # respiro curto entre frases
                quadros += b"\x00\x00" * int(PAUSA * taxa)
                t += PAUSA
        with wave.open(str(wav), "wb") as wf:
            wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(taxa); wf.writeframes(quadros)
        tempos.append({"id": cena["id"], "audio": round(t, 3), "trechos": trechos})
        print(f"{cena['id']:<10} {t:5.2f}s")

    (SAIDA / "tempos.json").write_text(json.dumps(tempos, ensure_ascii=False, indent=2), encoding="utf-8")

    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    qr.add_data(roteiro["url_qr"])
    qr.make(fit=True)
    qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(str(SAIDA / "qr.svg"))
    print(f"total de fala: {sum(t['audio'] for t in tempos):.1f}s")


if __name__ == "__main__":
    main()
