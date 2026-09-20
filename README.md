<div align="center">

# 🐾 Panet

**A intranet da Pan** — postagens, eventos, aniversários, folgas, galerias e jogos
multiplayer, num só lugar. Feita para a galera da Agência Pan se conectar.

[![CI](https://github.com/thiagoarraes/panet/actions/workflows/ci.yml/badge.svg)](https://github.com/thiagoarraes/panet/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%C2%B7%20Auth%20%C2%B7%20Realtime-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-deploy-000000?logo=vercel&logoColor=white)

</div>

---

## ✨ Visão geral

O **Panet** é um portal interno (intranet) construído como SPA em **React + Vite**,
com **Supabase** como backend (Postgres, Auth, Realtime e Storage) e **Vercel** para
hospedagem, serverless functions e middleware de Open Graph. Autenticação roda em
**cookies httpOnly** via funções serverless — tokens nunca tocam o `localStorage` em
produção.

## 🧩 Funcionalidades

| Módulo | O que faz |
|--------|-----------|
| 🏠 **Dashboard** | Visão geral: posts recentes, mural, aniversários, folgas e humor do time |
| 📰 **PanNews** | Postagens com editor rich-text, capa, curtidas e comentários |
| 👥 **Colaboradores** | Diretório do time com perfis e avatares |
| 🎂 **Aniversários** | Aniversariantes do mês + parabéns |
| 🌴 **Folgas (PanOff)** | Férias e ausências da equipe |
| 📅 **Eventos (Presencial)** | Agendas, confirmações e amigo secreto |
| 🖼️ **Galerias** | Álbuns de fotos de eventos |
| 📊 **Enquetes & Mural** | Votações e recados rápidos |
| 🎮 **Jogos** | Multiplayer em tempo real: **Adedonha** e **Gartic** (veja abaixo) |
| 🛠️ **Admin** | Gestão de colaboradores, postagens, folgas, eventos, galeria, mural e enquetes |

## 🎮 Jogos multiplayer

Dois jogos online, em tempo real, para a galera jogar junto:

- **Adedonha** (StopotS-like) — sorteia uma letra, todos preenchem categorias e correm
  pra gritar **STOP!**. Validação por votação e pontuação 10/5/0.
- **Gartic** (Skribbl-like) — um jogador desenha uma palavra secreta e os demais
  adivinham no chat. Desenho ao vivo, dica progressiva e pontos por acerto rápido.

> **Arquitetura dos jogos:** estado da sala via Supabase Realtime (`postgres_changes`)
> + polling de fallback, transições **host-autoritativas**, presença em tempo real e
> migração de host. No Gartic, os traços do desenho trafegam por **broadcast efêmero**
> (nunca tocam o banco) e a palavra fica protegida por **RLS**.

## 🏗️ Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18, Vite 5, JavaScript (JSX) + JSDoc |
| Estado servidor | TanStack Query v5 (cache persistido) |
| Estado app | React Context |
| Backend | Supabase — Postgres + Auth + Realtime + Storage |
| Serverless | Vercel Functions (`/api/auth/*`) + middleware (OG tags) |
| UI | CSS custom (design tokens, temas light/dark), `lucide-react`, TipTap |
| Testes | Vitest |
| Qualidade | ESLint (`--max-warnings 0`), GitHub Actions CI |

## 📁 Estrutura

```text
src/
├── pages/          # Páginas (lazy): Dashboard, PanNews, Jogos, Admin/*, ...
│   └── jogos/      # Adedonha e Gartic (cada jogo num chunk lazy)
├── components/     # UI compartilhada (Sidebar, Avatar, PostCard, ...)
├── context/        # AuthContext (sessão, tema, navegação)
├── hooks/
│   ├── queries/    # TanStack Query (dados + realtime/presença)
│   └── mutations/  # Mutations (posts, jogos, ...)
├── lib/            # Lógica pura e utilitários (supabase, router, gartic, ...)
└── styles/         # global.css (tokens/temas) + estilos por feature
api/auth/           # Serverless de autenticação (cookies httpOnly)
supabase/migrations # Schema do Postgres + RLS
```

## 🚀 Começando

### Pré-requisitos
- **Node.js 20+**
- Um projeto **Supabase** (gratuito serve)

### Passos

```bash
# 1. Clone
git clone https://github.com/thiagoarraes/panet.git
cd panet

# 2. Instale as dependências
npm install

# 3. Configure o ambiente
cp .env.example .env
#   → preencha com as chaves do seu projeto Supabase

# 4. Rode em desenvolvimento (http://localhost:5173)
npm run dev
```

## 🔑 Variáveis de ambiente

Copie `.env.example` para `.env`. Resumo:

| Variável | Onde | Descrição |
|----------|------|-----------|
| `VITE_SUPABASE_URL` | cliente | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | cliente | **Preferida.** Chave publishable (`sb_publishable_…`), exposta no bundle |
| `VITE_SUPABASE_ANON_KEY` | cliente | Chave anon legada (JWT). Só fallback — some quando as legacy keys forem desativadas |
| `SUPABASE_URL` | servidor | URL para as serverless de auth e scripts |
| `SUPABASE_PUBLISHABLE_KEY` | servidor | **Preferida** pelas serverless de auth |
| `SUPABASE_ANON_KEY` | servidor | Fallback legado das serverless |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | Service role / secret key (ignora RLS) — **só servidor/scripts** |

### Precedência de chave pública

`src/lib/supabase.js`, `middleware.js` e `api/auth/*` resolvem a chave na
**mesma ordem**: publishable primeiro, anon legada como fallback. Isso é
deliberado — ordens divergentes entre arquivos já causaram incidente (partes do
app usando chaves diferentes). Ao mexer em um, mexa nos três.

> A migração para o esquema novo de API keys só termina quando o bundle publicado
> deixar de carregar a anon legada. Para conferir qual chave está em produção,
> procure o prefixo `sb_publishable_` nos assets servidos.

> ⚠️ Nunca exponha a `SUPABASE_SERVICE_ROLE_KEY` no cliente nem a comite. Variáveis
> `VITE_*` vão para o bundle público — use sempre a chave anon nelas.

## 📜 Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Vite, porta 5173) |
| `npm run build` | Build de produção (encoding check + edge functions + Vite) |
| `npm run build:app` | Apenas o build do Vite |
| `npm run build:analyze` | Build com análise de bundle |
| `npm run preview` | Pré-visualiza o build de produção |
| `npm run lint` | ESLint (falha com qualquer warning) |
| `npm test` | Testes (Vitest, run único) |
| `npm run test:watch` | Testes em modo watch |
| `npm run check:encoding` | Garante UTF-8 nos arquivos |
| `npm run cleanup:storage:orphans` | Lista arquivos órfãos no Storage (dry-run) |

## 🗄️ Banco de dados

O schema vive em `supabase/migrations/` (Postgres + **RLS** em todas as tabelas).
Aplique as migrations no seu projeto via [Supabase CLI](https://supabase.com/docs/guides/cli)
(`supabase db push`) ou pelo painel/MCP.

## 🧪 Testes

```bash
npm test          # roda toda a suíte
npm run test:watch
```

A lógica de regras dos jogos (pontuação, sorteio, rodízio) fica em funções puras
em `src/lib/*.js`, cobertas por testes em `src/lib/*.test.js`.

## 🔄 CI

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em cada **push
no `main`** e em **pull requests**, executando: `lint` → `test` → `check:encoding` →
`build`.

## ☁️ Deploy

Deploy contínuo na **Vercel**: serverless functions (`/api/*`), middleware de Open
Graph para posts compartilhados e build automático. Configure as mesmas variáveis de
ambiente no painel da Vercel.

## 🤝 Convenções

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`,
  `fix:`, `chore:`, `perf:`, `test:`, `ci:`…).
- **Lint**: o build/CI falha com qualquer warning — rode `npm run lint` antes de
  commitar.
- **Idioma**: comunicação, docs e commits em **português (pt-br)**.

---

<div align="center">
Feito com 💚 pela Pan.
</div>
