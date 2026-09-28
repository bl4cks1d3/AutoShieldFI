# 🇧🇷 PT/BR

# AutoShieldFI

AutoShieldFI é um dApp (aplicativo descentralizado) focado em proteção veicular para o mercado brasileiro. Nosso objetivo é oferecer uma alternativa acessível, eficiente e transparente ao seguro veicular tradicional por meio de infraestrutura Web3, proporcionando uma melhor experiência ao usuário e a possibilidade de retorno financeiro quando a cobertura não é utilizada.

## Problema

Atualmente, no Brasil, apenas cerca de 30% da frota de veículos possui seguro, principalmente devido aos altos custos dos seguros convencionais. Como consequência, milhões de motoristas permanecem financeiramente expostos a riscos relevantes em caso de acidentes, furtos ou eventos adversos.

## Solução

O AutoShieldFI oferece uma solução descentralizada baseada em Smart Contracts na blockchain Solana. A plataforma permite que usuários contratem proteção veicular diretamente pelo dApp, acionem sinistros digitalmente e acompanhem todo o ciclo de resolução com transparência on-chain.

Além disso, o modelo econômico inclui um mecanismo de staking que possibilita retorno financeiro ao usuário quando não há utilização da cobertura, promovendo maior eficiência de capital.

## Funcionalidades Principais

- Contratação de proteção veicular descentralizada via dApp  
- Acionamento digital de sinistros  
- Acompanhamento transparente do processo de resolução  
- Mecanismo de staking com potencial retorno ao usuário  
- Interface web responsiva e versão PWA instalável  

## Principais Tecnologias Utilizadas

- Blockchain Solana para execução dos Smart Contracts  
- Anchor Framework para desenvolvimento dos programas on-chain  
- Next.js para frontend web  
- Progressive Web App (PWA) para experiência mobile instalável  
- Solana Web3 / Web3.js para integração com a blockchain  

## Arquitetura

```
┌──────────────────────────┐        ┌───────────────────────────────────────────┐
│  app/ (Next.js 16 + PWA) │  RPC   │  programs/autoshield (Anchor / Solana)    │
│                          │───────▶│                                           │
│  /cotar      cotação     │        │  Pool (PDA "pool")                        │
│  /apolices   apólices    │        │   ├─ Vault (PDA "vault", token tBRL)      │
│  /sinistros  sinistros   │        │   ├─ parâmetros, avaliadores, quórum      │
│  /pool       staking LP  │        │   └─ contabilidade (cobertura, reservas)  │
│  /avaliacao  avaliadores │        │  Policy     (PDA "policy", dono, nonce)   │
│                          │        │  Claim      (PDA "claim", apólice, idx)   │
│  Modo Demo (localStorage)│        │  StakePosition (PDA "stake", pool, dono)  │
│  Modo On-chain (carteira)│        │  tBRL mint  (PDA "test_mint") + faucet    │
└──────────────────────────┘        └───────────────────────────────────────────┘
```

### Modelo econômico (on-chain)

| Regra | Implementação |
|---|---|
| **Prêmio** | `valor FIPE × taxa base (3,5% a.a.) × multiplicador do plano × dias / 365` — calculado no contrato (`pricing.rs`) e espelhado no frontend (`pricing.ts`) |
| **Planos** | Básico ×0,6 (roubo/furto, natureza) · Essencial ×1,0 (+ colisão) · Completo ×1,4 (+ terceiros, outros) |
| **Franquia** | 5% da FIPE para danos parciais; roubo/furto e eventos da natureza (perda total) são isentos |
| **Cashback** | 20% do prêmio fica reservado e volta ao motorista ao fim da vigência se não houver sinistro pago |
| **Staking (LPs)** | Provedores aportam stablecoin e recebem cotas proporcionais ao patrimônio do pool; prêmios valorizam a cota e indenizações a desvalorizam |
| **Solvência** | Nova apólice ou saque só é aceito se `patrimônio ≥ 10% da cobertura ativa + sinistros pendentes` |
| **Sinistros** | Motorista registra (tipo, valor, descrição, hash SHA-256 das evidências) → comitê de avaliadores vota com quórum → pagamento permissionless direto do cofre. Sem quórum no prazo, qualquer pessoa pode encerrar o pedido |
| **Governança** | Autoridade do pool ajusta parâmetros, avaliadores, pausa e transferência de autoridade |

### Instruções do programa

`initialize_pool`, `update_params`, `set_assessors`, `set_paused`, `transfer_authority`, `init_test_mint`, `faucet`, `deposit_liquidity`, `withdraw_liquidity`, `purchase_policy`, `settle_policy`, `file_claim`, `vote_claim`, `expire_claim`, `pay_claim`.

## Como rodar

### Frontend (modo demonstração — não precisa de carteira)

```bash
cd app
npm install
npm run dev          # http://localhost:3000
```

O **modo Demo** simula o protocolo inteiro no navegador com as mesmas regras do contrato. Use os botões
**+7 dias / +30 dias** no topo para avançar o relógio e mostrar vencimento e cashback.

### API FIPE (por modelo e por placa)

O app expõe rotas próprias que normalizam a tabela FIPE (`app/src/lib/fipe/`):

| Rota | Retorno |
|---|---|
| `GET /api/fipe/status` | `{ modelo, placa }` — recursos habilitados no servidor |
| `GET /api/fipe/{carros\|motos\|caminhoes}/marcas` | marcas |
| `GET /api/fipe/{tipo}/marcas/{marca}/modelos` | modelos |
| `GET /api/fipe/{tipo}/marcas/{marca}/modelos/{modelo}/anos` | anos/combustível |
| `GET /api/fipe/{tipo}/marcas/{marca}/modelos/{modelo}/anos/{ano}` | preço (`FipeQuote`) |
| `GET /api/fipe/{tipo}/codigo/{codigoFipe}/anos[/{ano}]` | anos / preço pelo código FIPE |
| `GET /api/placa/{placa}` | veículo + versões FIPE compatíveis (`PlateLookup`) |

A busca por modelo usa a API pública FIPE v2 (parallelum) e funciona sem configuração. A consulta por
placa depende de um provedor pago (WDAPI2 / apiplacas.com.br): defina `PLACA_API_TOKEN` em `app/.env.local`.
Os tokens ficam só no servidor.

### Programa Solana

Requisitos: Rust, Solana CLI (Agave 2.1.x), Anchor CLI 0.31.1, Node 20+ e Yarn.

```bash
yarn install
anchor build                         # compila o programa e gera o IDL
cargo test -p autoshield             # testes unitários de precificação
anchor test                          # 12 testes de integração no validador local
```

> O `Cargo.lock` fixa `blake3 = 1.5.5` e versões compatíveis com o Rust 1.79 do toolchain SBF da Agave 2.1.
> Se atualizar dependências, rode `cargo update -p blake3 --precise 1.5.5` antes do `anchor build`.

### Deploy em devnet e uso on-chain

```bash
solana config set -u devnet
solana airdrop 2                      # repita até ter ~4 SOL (ou use faucet.solana.com)
anchor keys sync                      # gera/atualiza o Program ID no código
anchor build && anchor deploy --provider.cluster devnet
# inicializa mint tBRL, pool e 500k de liquidez. SECONDS_PER_DAY=60 acelera a demo (1 dia = 1 min)
SECONDS_PER_DAY=60 ASSESSORS=<pubkey1>,<pubkey2> anchor run bootstrap --provider.cluster devnet
cd app && npm run sync-idl
cp .env.example .env.local            # ajuste NEXT_PUBLIC_PROGRAM_ID
npm run dev                           # selecione "Devnet" no topo e conecte a Phantom/Solflare
```

Teste de fumaça do cliente do frontend contra um cluster real:

```bash
cd app && RPC_URL=http://127.0.0.1:8899 npx tsx scripts/smoke-onchain.ts
```

## Roteiro de demonstração (pitch de 3 minutos)

1. **Home** — problema (30% da frota segurada) e exemplo de preço por plano.
2. **Faucet** — pegue 50.000 tBRL no topo.
3. **Contratar** — escolha um carro popular (ou consulte a FIPE), placa `ABC1D23`, plano Essencial, 1 ano. Mostre o resumo com franquia e cashback.
4. **Sinistros** — registre uma colisão de R$ 12.000 com fotos (o hash vai on-chain) e veja a indenização estimada já com franquia.
5. **Avaliação** — vote como Avaliador 1 e Avaliador 2 → quórum atingido → execute o pagamento.
6. **Pool & Staking** — mostre patrimônio, colateral mínimo, sinistralidade, aporte e valor da cota.
7. **+30 dias** — contrate um plano Básico de 30 dias, avance o tempo e **resgate o cashback** em Minhas apólices.
8. Instale o app pelo navegador do celular (PWA).

## Estrutura do repositório

```
programs/autoshield/src/   programa Anchor (state, pricing, instructions/*)
tests/autoshield.ts        testes de integração (mocha)
scripts/bootstrap.ts       inicialização de cluster (mint, pool, liquidez)
target/idl, target/types   IDL e tipos gerados
app/                       frontend Next.js + PWA
  src/lib/client/          cliente on-chain (Anchor) e simulador demo
  src/lib/pricing.ts       fórmula de preço espelhada do contrato
  public/sw.js             service worker (offline + instalação)
```

## Limitações conhecidas (escopo de hackathon)

- tBRL é um token de teste com faucet; em produção o pool usaria uma stablecoin real (BRZ, USDC).
- Evidências ficam fora da cadeia; apenas o hash SHA-256 é registrado. Integração com IPFS/Arweave é o próximo passo.
- A precificação usa apenas valor FIPE, plano e vigência; fatores de risco (CEP, perfil, telemetria) exigiriam oráculos.
- Não é um produto de seguro regulado pela SUSEP.

## Como Contribuir

Se você está interessado em contribuir com o projeto AutoShieldFI, siga estas etapas:

1. Faça um fork do repositório  
2. Clone o fork para o seu ambiente local  
3. Implemente as melhorias ou correções desejadas  
4. Envie um pull request com uma descrição detalhada das alterações  

## Equipe

- Wesley Cardoso — Smart Contracts / Backend  
- Jaqueline Queroz — Frontend / UX/UI  
- Amanda Almeida — Business / Marketing  

## Contato

Para mais informações sobre o AutoShieldFI, entre em contato pelo email:  
**wcsd1995@gmail.com**

Agradecemos seu interesse em tornar a proteção veicular mais acessível e eficiente para os motoristas brasileiros.

---

# 🇺🇸 English

# AutoShieldFI

AutoShieldFI is a decentralized application (dApp) focused on vehicle protection for the Brazilian market. Our mission is to provide an affordable, efficient, and transparent alternative to traditional vehicle insurance using Web3 infrastructure, while enabling users to potentially earn financial returns when coverage is not utilized.

## Problem

In Brazil, only about 30% of the vehicle fleet is insured, largely due to the high cost of traditional insurance products. As a result, millions of drivers remain financially exposed to significant risks in the event of accidents, theft, or other adverse events.

## Solution

AutoShieldFI delivers a decentralized solution powered by Smart Contracts on the Solana blockchain. Users can purchase vehicle protection directly through the dApp, submit claims digitally, and track the full resolution lifecycle with on-chain transparency.

Additionally, the protocol includes a staking-based economic model that enables users to receive potential financial returns when coverage is not used, improving overall capital efficiency.

## Main Features

- Decentralized vehicle protection subscription via dApp  
- Digital claims submission  
- Transparent claim tracking  
- Staking mechanism with potential user returns  
- Responsive web interface and installable PWA  

## Main Technologies Used

- Solana blockchain for Smart Contract execution  
- Anchor Framework for on-chain program development  
- Next.js for web frontend  
- Progressive Web App (PWA) for installable mobile experience  
- Solana Web3 / Web3.js for blockchain integration  

## Architecture & running (summary)

- **On-chain program** (`programs/autoshield`, Anchor 0.31): a mutual risk pool whose LPs stake stablecoin for shares; drivers buy policies priced on-chain (`FIPE value × 3.5%/yr × tier multiplier × days/365`); claims are voted by an assessor committee with a quorum and paid permissionlessly from the vault (5% deductible for partial damage); drivers without paid claims get 20% of the premium back when settling an expired policy; a 10% minimum-collateral rule guards solvency on every purchase and withdrawal.
- **Frontend** (`app/`, Next.js 16 + Tailwind + Solana Wallet Adapter, installable PWA): quote with FIPE lookup, policies, claims with SHA-256 evidence hashing, LP staking dashboard and assessor panel. A **Demo mode** runs the same rules in the browser (with a time-travel control) so the full lifecycle can be shown without a wallet.
- **Run the app:** `cd app && npm install && npm run dev`.
- **Program:** `yarn install && anchor build && anchor test` (12 integration tests). Deploy + `anchor run bootstrap --provider.cluster devnet` to create the tBRL test mint, the pool and seed liquidity.

## How to Contribute

If you are interested in contributing to AutoShieldFI, please follow these steps:

1. Fork the repository  
2. Clone your fork locally  
3. Implement the desired improvements or fixes  
4. Submit a pull request with a detailed description of your changes  

## Team

- Wesley Cardoso — Smart Contracts / Backend  
- Jaqueline Queroz — Frontend / UX/UI  
- Amanda Almeida — Business / Marketing  

## Contact

For more information about AutoShieldFI, please contact:  
**wcsd1995@gmail.com**

We appreciate your interest in making vehicle protection more accessible and efficient for Brazilian drivers.
