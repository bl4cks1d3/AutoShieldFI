import { NextResponse } from "next/server";

// Envia as evidencias de um sinistro (fotos, B.O., orcamento) para o IPFS via
// Pinata. A chave (PINATA_JWT) fica so no servidor. Sem ela, o app segue
// registrando apenas o hash SHA-256 dos arquivos on-chain.

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.PINATA_JWT) });
}

export async function POST(req: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return NextResponse.json({ error: "Armazenamento IPFS não configurado" }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido" }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Máximo de ${MAX_FILES} arquivos` }, { status: 400 });
  for (const f of files) {
    if (f.size > MAX_BYTES) return NextResponse.json({ error: `${f.name} excede 10 MB` }, { status: 400 });
    if (!ALLOWED.test(f.type)) return NextResponse.json({ error: `Tipo não permitido: ${f.name}` }, { status: 400 });
  }

  // Agrupa os arquivos numa pasta: um unico CID para todas as evidencias.
  const out = new FormData();
  files.forEach((f, i) => {
    const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
    out.append("file", f, `evidencias/${String(i + 1).padStart(2, "0")}${ext}`);
  });
  out.append("pinataMetadata", JSON.stringify({ name: `autoshield-evidencias-${Date.now()}` }));

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: out,
    });
    if (!res.ok) return NextResponse.json({ error: `IPFS indisponível (${res.status})` }, { status: 502 });
    const { IpfsHash } = (await res.json()) as { IpfsHash: string };
    return NextResponse.json({ cid: IpfsHash, uri: `ipfs://${IpfsHash}` });
  } catch {
    return NextResponse.json({ error: "Falha ao enviar para o IPFS" }, { status: 502 });
  }
}
