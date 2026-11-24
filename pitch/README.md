# Vídeo pitch (pt-BR)

Vídeo de ~3 minutos com os 14 slides do pitch deck, narração em português do Brasil com a voz
[Piper](https://github.com/rhasspy/piper) `pt_BR-faber-medium` e legendas. Tudo em JavaScript (Node 18+).

- `deck/` — os slides do pitch deck em HTML
- `slides/` — os mesmos slides em PNG 1920×1080 (gerados por `render-slides.mjs`)
- `roteiro.json` — para cada cena: o slide, o texto da legenda (`texto`) e o texto falado (`fala`, com números e siglas por extenso)
- `build-video.mjs` — gera a narração com o Piper e monta o vídeo e as legendas
- `render-slides.mjs` — gera os PNG a partir do HTML do deck

## Como o Piper roda em JavaScript

- `piper-phonemize` — o fonetizador do Piper (espeak-ng) compilado em WebAssembly
- `onnxruntime-node` — roda o modelo de voz ONNX do Piper
- o script converte os fonemas em IDs exatamente como o Piper faz e grava o WAV a 22,05 kHz

## Gerar o vídeo

```bash
cd pitch
npm install
npm run video
```

Na primeira execução, o script baixa a voz `pt_BR-faber-medium` do Hugging Face para `pitch/.voices/` (cerca de 63 MB).
O resultado fica em `pitch/out/autoshieldfi-pitch.mp4` (legendas na imagem) e `pitch/out/autoshieldfi-pitch.srt`.
Para deixar as legendas como faixa opcional dentro do MP4: `node build-video.mjs`.

Usa o `ffmpeg` do sistema; se não houver, usa o binário do pacote `@ffmpeg-installer/ffmpeg`.

Sem acesso ao Hugging Face, `node build-video.mjs --voz espeak --legendas-fixas` gera uma prévia com o espeak-ng do sistema
(`apt-get install espeak-ng mbrola mbrola-br4`), útil só para conferir tempo e cortes.

## Mudar o conteúdo

- Narração: edite `roteiro.json` e rode `npm run video` de novo.
- Slides: edite `deck/slides/*.html`, rode `npm run slides` (com `CHROMIUM_PATH` se o Playwright não achar o navegador) e depois `npm run video`.

## Vídeo motion (3 minutos, com QR code)

Versão com cenas animadas e storytelling de startup: gancho, história, problema, solução, cashback, prova, mercado, visão e CTA com QR code para o app.
A narração usa o Piper em Python, e as cenas são renderizadas quadro a quadro com o Playwright.

```bash
python -m venv .venv && .venv/bin/pip install piper-tts huggingface_hub qrcode
.venv/bin/python motion/narrar.py --velocidade 1.08   # narração (baixa a voz para .voices/) + QR code
node motion/render-motion.mjs                          # vídeo de 180 s (--teste gera só capturas)
```

Resultado: `out/autoshieldfi-motion-pitch.mp4` e `out/autoshieldfi-motion-pitch.srt`. Roteiro em `motion/roteiro-motion.json`, cenas em `motion/cenas.html`.
