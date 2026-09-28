# Guia de instalação — AutoShieldFI

Este guia cobre a instalação completa do projeto:

| Parte | Pasta | Onde roda |
|---|---|---|
| Programa Solana (Anchor) | `programs/autoshield` | WSL / Linux / macOS |
| Scripts e testes on-chain | `scripts/`, `tests/` | WSL / Linux / macOS |
| Frontend Next.js + PWA + API FIPE | `app/` | Windows, Linux ou macOS |

Há três formas de rodar o app:

1. **Modo Demo** — só o frontend, tudo simulado no navegador. Não precisa de carteira nem de Solana.
2. **Localnet** — validador Solana local; ideal para desenvolvimento.
3. **Devnet** — rede pública de testes; qualquer pessoa com carteira consegue usar.

---

## 1. Pré-requisitos

| Ferramenta | Versão | Usada em |
|---|---|---|
| Git | qualquer | todo o projeto |
| Node.js | 20 ou superior | frontend, scripts, testes |
| npm | vem com o Node | frontend (`app/`) |
| Yarn | 1.22 | raiz (scripts e testes Anchor) |
| Rust | estável (rustup) | programa |
| Solana CLI (Agave) | 2.1.x | programa, validador, deploy |
| Anchor CLI | 0.31.1 | programa, deploy, bootstrap |
| Carteira Solana | Phantom, Solflare ou Backpack | uso on-chain no navegador |

> **Windows:** o toolchain Solana/Anchor não roda nativamente no Windows. Use o **WSL 2 com Ubuntu** para
> o programa e os scripts. O frontend pode rodar no Windows normalmente.

---

## 2. Clonar o repositório

```bash
git clone https://github.com/bl4cks1d3/AutoShieldFI.git
cd AutoShieldFI
```

---

## 3. Frontend — modo Demo (mais rápido)

Só precisa de Node.js 20+.

```bash
cd app
npm install
npm run dev
```

Abra http://localhost:3000. No topo, selecione **Demo**. Use **+7 dias / +30 dias** para avançar o relógio
e demonstrar vencimento e cashback.

---

## 4. Ambiente Solana (WSL / Linux)

### 4.1 Instalar o WSL (somente Windows)

No PowerShell como administrador:

```powershell
wsl --install -d Ubuntu
```

Reinicie, abra o **Ubuntu** e crie seu usuário. Os comandos a seguir rodam dentro do Ubuntu.
Os arquivos do Windows ficam em `/mnt/c/...`, por exemplo:

```bash
cd /mnt/c/Users/SEU_USUARIO/Documents/repo/AutoShieldFI
```

### 4.2 Pacotes do sistema

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev libudev-dev curl git bzip2
```

> O `bzip2` evita um erro de `tar` durante o `anchor build` (download do Criterion para os testes da IDL).

### 4.3 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
. "$HOME/.cargo/env"
rustc --version
```

### 4.4 Solana CLI (Agave 2.1)

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.21/install)"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
solana --version
```

### 4.5 Anchor CLI 0.31.1

Binário pré-compilado (não precisa compilar):

```bash
mkdir -p ~/.local/bin
curl -sSfL -o ~/.local/bin/anchor \
  https://github.com/solana-foundation/anchor/releases/download/v0.31.1/anchor-0.31.1-x86_64-unknown-linux-gnu
chmod +x ~/.local/bin/anchor
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
anchor --version
```

> Alternativa: `cargo install --git https://github.com/coral-xyz/anchor avm --force` e
> `avm install 0.31.1 && avm use 0.31.1` (mais lento, compila do código-fonte).

### 4.6 Node.js 20 e Yarn (no WSL)

O Ubuntu traz Node 18, que é antigo demais. Use o nvm:

```bash
curl -sSfL -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm alias default 20
npm install -g yarn
node --version && yarn --version
```

### 4.7 Carteira da CLI

```bash
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json
solana address
```

Essa carteira é a **autoridade do pool** e a primeira **avaliadora** após o bootstrap.

---

## 5. Compilar e testar o programa

Na raiz do projeto (no WSL):

```bash
yarn install
anchor build
```

Na primeira vez o `anchor build` baixa o toolchain SBF e leva alguns minutos.

### Program ID

O Program ID atual é `GPnGSA7KH3vqnF1KfzHGzQNvnEBVD3XRfCayEBhQsuRC`, gerado pelo keypair em
`target/deploy/autoshield-keypair.json`. Esse arquivo **não é versionado**. Em um clone novo o
`anchor build` gera outro keypair; sincronize o ID no código com:

```bash
anchor keys sync
anchor build
```

E atualize `NEXT_PUBLIC_PROGRAM_ID` no `app/.env.local` (seção 8).

### Testes

```bash
cargo test -p autoshield      # testes unitários de precificação
anchor test                   # testes de integração num validador local temporário
```

> O `Cargo.lock` fixa `blake3 = 1.5.5`, compatível com o Rust do toolchain SBF da Agave 2.1. Se atualizar
> dependências, rode `cargo update -p blake3 --precise 1.5.5` antes do `anchor build`.

---

## 6. Rodar na Localnet

### 6.1 Subir o validador

Em um terminal WSL dedicado (deixe aberto):

```bash
solana-test-validator --ledger ~/autoshield-ledger/ledger
```

> Para zerar o estado, pare o validador e rode novamente com `--reset`.

### 6.2 Deploy e bootstrap

Em outro terminal WSL, na raiz do projeto:

```bash
solana config set -u localhost
solana airdrop 100
anchor deploy --provider.cluster localnet
SECONDS_PER_DAY=60 CLAIM_VOTING_SECS=600 anchor run bootstrap --provider.cluster localnet
cd app && node scripts/sync-idl.mjs
```

O bootstrap cria o token de teste **tBRL**, o **pool** e aporta **500.000 tBRL** de liquidez.

| Variável do bootstrap | Padrão | Efeito |
|---|---|---|
| `SECONDS_PER_DAY` | 86400 | duração de 1 "dia" de apólice; `60` acelera a demo |
| `CLAIM_VOTING_SECS` | 259200 | prazo de votação dos sinistros |
| `WITHDRAW_COOLDOWN` | 0 | carência de saque dos provedores de liquidez |
| `ASSESSORS` | — | chaves públicas extras de avaliadores, separadas por vírgula |
| `THRESHOLD` | min(2, nº de avaliadores) | quórum de aprovação |
| `SEED_LIQUIDITY` | 500000 | liquidez inicial em tBRL |

### 6.3 Teste de fumaça do cliente do app

Roda o fluxo completo (faucet → apólice → sinistro → voto → pagamento → vencimento) com o mesmo cliente
usado pelo frontend. Com `SECONDS_PER_DAY=60` leva cerca de 30 minutos, por esperar o vencimento.

```bash
cd app
RPC_URL=http://127.0.0.1:8899 npx tsx scripts/smoke-onchain.ts
```

### 6.4 Frontend apontando para a Localnet

Crie `app/.env.local` conforme a seção 8 (perfil Localnet) e rode `npm run dev` em `app/`.

Na carteira do navegador, ative a rede local (`http://127.0.0.1:8899`). Na Phantom:
**Configurações → Configurações de desenvolvedor → Localnet**. Use o botão **Airdrop SOL** do topo do app
para pagar as taxas e **Faucet tBRL** para receber tokens de teste.

---

## 7. Rodar na Devnet

No WSL, na raiz do projeto:

```bash
solana config set -u devnet
solana airdrop 2          # repita até ter ~4 SOL
solana balance
anchor deploy --provider.cluster devnet
SECONDS_PER_DAY=60 CLAIM_VOTING_SECS=600 anchor run bootstrap --provider.cluster devnet
cd app && node scripts/sync-idl.mjs
```

- O deploy de um programa de ~520 KB custa cerca de **3,7 SOL** em aluguel.
- O airdrop da devnet tem limite por hora. Se falhar, use https://faucet.solana.com com o endereço de
  `solana address`.
- Para incluir sua carteira do navegador como avaliadora, adicione `ASSESSORS=<seu endereço>` ao bootstrap.

Depois ajuste o `app/.env.local` para o perfil Devnet (seção 8), reinicie o `npm run dev` e selecione
**Devnet** na carteira.

---

## 8. Variáveis de ambiente do frontend

Copie o modelo e ajuste:

```bash
cd app
cp .env.example .env.local
```

### Perfis de rede

| Variável | Localnet | Devnet |
|---|---|---|
| `NEXT_PUBLIC_DEFAULT_MODE` | `chain` | `chain` |
| `NEXT_PUBLIC_RPC_URL` | `http://127.0.0.1:8899` | `https://api.devnet.solana.com` |
| `NEXT_PUBLIC_CLUSTER_LABEL` | `Localnet` | `Devnet` |
| `NEXT_PUBLIC_EXPLORER_CLUSTER` | `localnet` | `devnet` |
| `NEXT_PUBLIC_PROGRAM_ID` | Program ID do deploy | Program ID do deploy |
| `NEXT_PUBLIC_STABLE_SYMBOL` | `tBRL` | `tBRL` |

Use `NEXT_PUBLIC_DEFAULT_MODE=demo` para abrir no modo demonstração.

### Tabela FIPE (somente servidor)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `FIPE_API_TOKEN` | não | token da API FIPE v2 (parallelum); sem ele, ~1000 consultas/dia |
| `PLACA_API_TOKEN` | para busca por placa | token do provedor de placas (WDAPI2 / apiplacas.com.br), pago por consulta |
| `PLACA_API_URL` | não | padrão `https://wdapi2.com.br/consulta` |

Essas variáveis **não** levam o prefixo `NEXT_PUBLIC_`: ficam só no servidor e nunca chegam ao navegador.
Sem `PLACA_API_TOKEN`, a aba **Por placa** fica desabilitada e a busca **Por modelo** continua funcionando.

Reinicie o `npm run dev` sempre que alterar o `.env.local`.

---

## 9. Build de produção do frontend

```bash
cd app
npm run lint      # verificação de tipos
npm run build
npm run start     # http://localhost:3000
```

O app precisa de um servidor Node (não é export estático), por causa das rotas `/api/fipe` e `/api/placa`.

---

## 10. Solução de problemas

| Sintoma | Causa / solução |
|---|---|
| "Pool não encontrado nesta rede" | O bootstrap não rodou nessa rede, ou `NEXT_PUBLIC_PROGRAM_ID` / `NEXT_PUBLIC_RPC_URL` não batem com o deploy. |
| `tar: bzip2: Cannot exec` no `anchor build` | Falta o pacote `bzip2` (`sudo apt install bzip2`). Afeta só os testes da IDL; o `.so` é gerado. |
| `solana`/`anchor: command not found` | PATH não carregado: `source ~/.bashrc` ou abra um terminal novo. |
| Airdrop da devnet falha | Limite por hora; use https://faucet.solana.com. |
| Carteira conecta mas a transação falha | A carteira está em outra rede; selecione a mesma do app (Localnet/Devnet). |
| Não consigo votar / usar Governança | Sua carteira não é avaliadora/autoridade. Rode o bootstrap com `ASSESSORS=` ou use a tela **Governança** com a carteira da autoridade. |
| Aviso "multiple lockfiles" do Next.js | Inofensivo (há `yarn.lock` na raiz e `package-lock.json` em `app/`). |
| `bigint: Failed to load bindings` | Aviso inofensivo; usa a implementação em JS. |
| Validador parou | O processo precisa ficar em execução; suba de novo com `solana-test-validator --ledger ~/autoshield-ledger/ledger`. |
