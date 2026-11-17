# Vídeo pitch (pt-BR)

Vídeo de ~3 minutos com os 14 slides do pitch deck, narração em português do Brasil e legendas.

- `slides/` — os slides do deck em PNG 1920×1080
- `roteiro.json` — o roteiro: para cada cena, o slide, o texto da legenda (`texto`) e o texto falado (`fala`, com números e siglas por extenso para a voz)
- `build_video.py` — gera a narração, monta o vídeo e as legendas

## Gerar o vídeo

Requisitos: Python 3.9+, `ffmpeg` e `pip install piper-tts`.

```bash
python3 pitch/build_video.py --legendas-fixas
```

Na primeira execução o script baixa a voz Piper `pt_BR-faber-medium` do Hugging Face para `pitch/.voices/`.
O resultado fica em `pitch/out/autoshieldfi-pitch.mp4` (legendas na imagem) e `pitch/out/autoshieldfi-pitch.srt`.
Sem `--legendas-fixas`, as legendas vão como faixa opcional dentro do MP4.

Sem acesso ao Hugging Face, `--voz espeak` gera uma prévia com voz offline
(`apt-get install espeak-ng mbrola mbrola-br4`), útil só para conferir tempo e cortes.

Para mudar a narração, edite `roteiro.json` e rode o script de novo.
