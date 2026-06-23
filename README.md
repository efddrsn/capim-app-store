# Capim App Store

Catálogo interno dos apps do **Capim Challenge 2026** com um sistema de
**graduação em 3 níveis**. As pessoas publicam/submetem seus projetos pelo
próprio site; o catálogo e as submissões vivem em uma base do **Notion**.

## Os 3 níveis de graduação

| Nível | Nome | Acesso | Requisitos |
|------|------|--------|-----------|
| **1** | Catálogo aberto | Aberto · publicação imediata | Responsável (dono) + nome, área e descrição |
| **2** | Primeira graduação | Requer aprovação de admin | Tudo do N1 + link de acesso + repositório (codebase) + recursos/infra que usa + **SSO configurado** |
| **3** | Segurança & manutenção | Requer aprovação de admin | Tudo do N2 + responsável técnico dedicado + criticidade + uso de tokens/credenciais documentado |

- **Nível 1** publica na hora (Status = `Aprovado` automaticamente).
- **Nível 2 e 3** entram como `Pendente` e só aparecem no site depois que um
  admin aprova (veja "Aprovação" abaixo).

## Arquitetura

- `index.html` — SPA (HTML/CSS/JS) com o **guia dos 3 níveis**, o **catálogo**
  (carregado de `/api/apps`) e o **formulário de submissão** (modal). Segue o
  Capim Design System.
- `server.js` — servidor HTTP **sem dependências** (Node ≥ 18, usa `fetch`
  nativo). Serve o site e expõe a API; fala com o Notion via REST.
- `seed.js` — catálogo embutido, usado como **fallback** quando o Notion não
  está configurado/disponível.
- `railway.json` — configuração de deploy (Nixpacks, `node server.js`, health `/health`).

### API

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/apps` | GET | Lista apps com Status = `Aprovado` (Notion → fallback seed). |
| `/api/submit` | POST | Cria uma submissão no Notion (`Pendente`, ou `Aprovado` no N1). Validação por nível. |
| `/health` | GET | Healthcheck. |

## Backend no Notion

**Base:** *Capim App Store — Catálogo & Submissões*
`https://app.notion.com/p/f0265105f1834d73a5ab7e70d981e85b`
(database id `f0265105f1834d73a5ab7e70d981e85b`)

### Variáveis de ambiente

| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `NOTION_TOKEN` | sim (p/ produção) | Secret da integração interna do Notion. |
| `NOTION_DB_ID` | sim (p/ produção) | `f0265105f1834d73a5ab7e70d981e85b`. |
| `NOTION_VERSION` | não | Default `2022-06-28`. |
| `PORT` | não | Default `3000` (o Railway injeta). |

> Sem `NOTION_TOKEN`/`NOTION_DB_ID`, o site funciona em modo somente-leitura
> exibindo o `seed.js`, e o envio de submissões fica desabilitado (HTTP 503).

### Ativar o Notion (uma vez)

1. Crie uma **integração interna** em <https://www.notion.so/my-integrations>
   (capability "Insert content" + "Read content"). Copie o *Internal Integration
   Secret* → `NOTION_TOKEN`.
2. Abra a base no Notion → menu **•••** → **Connections / Conexões** → conecte
   a integração criada (isso autoriza o token a ler/escrever na base).
3. No Railway, defina as variáveis `NOTION_TOKEN` e `NOTION_DB_ID` no serviço e
   faça redeploy.

### Aprovação (admins)

A moderação acontece **no próprio Notion**, sem painel separado:

1. Submissões de Nível 2/3 chegam com **Status = `Pendente`**.
2. O admin abre a base, revisa os requisitos e muda **Status → `Aprovado`**
   (ou `Recusado`).
3. O site exibe **apenas** itens com Status = `Aprovado`. Mudou o status →
   reflete no próximo carregamento.

Para alterar o nível de um app já aprovado, basta editar a propriedade
**Nível** na base.

## Rodar localmente

```bash
npm start
# http://localhost:3000  (modo seed se NOTION_* não estiver setado)

# com Notion:
NOTION_TOKEN=secret_xxx NOTION_DB_ID=f0265105f1834d73a5ab7e70d981e85b npm start
```

## Deploy

Hospedado no **Railway** (build via Nixpacks, `node server.js`, health `/health`).
A branch de deploy do serviço é `claude/bold-maxwell-vzokmr` — alterações só vão
ao ar quando chegam nessa branch.

## Identidade visual

Segue o **Design System da Capim** (`capim-ds-mcp`). Tokens via CSS custom
properties em `index.html`:

- **Roxo (primário):** `#59399E` · rampa `#221540` → `#32205f` → `#3a2666` → `#ab9de8` → `#eeecfb`.
- **Lima (acento):** `#d9f363` / `#bee41e` / `#a6cd15`.
- **Neutros / ink:** `#201f26`, `#444152`, `#79778c`, bordas `#e9e9f2`, fundo `#f5f5fa`.
- **Status:** info `#3de4f5`, success `#119538`, danger `#dd3c3c`.
- **Badges de nível:** N1 lima · N2 roxo · N3 roxo-900.
- **Tipografia:** Red Hat Display (títulos) + Roboto (texto).
