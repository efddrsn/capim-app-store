# Capim App Store

Catálogo interno dos apps construídos no **Capim Challenge 2026**.

Mostra, para cada app: link de acesso, descrição, responsável (dono) e área.
Não inclui notas/avaliação.

## Rodar localmente

```bash
npm start
# http://localhost:3000
```

## Deploy

Hospedado no Railway (build via Nixpacks, `node server.js`). Healthcheck em `/health`.

## Estrutura

- `index.html` — catálogo (HTML/CSS/JS, dados embutidos), com busca e filtro por área.
- `server.js` — servidor HTTP mínimo (sem dependências) que serve o `index.html`.
- `railway.json` — configuração de deploy.

## Identidade visual

A interface segue o **Design System da Capim** (fonte: `capim-ds-mcp` —
`foundation.tokens.json` + componentes + logos). Tokens aplicados via CSS
custom properties em `index.html`:

- **Marca — Roxo (primário):** `#59399E` (primary), com rampa `#221540` → `#32205f` → `#3a2666` → `#ab9de8` → `#eeecfb`.
- **Marca — Lima (acento):** `#d9f363` / `#bee41e` / `#a6cd15`, usada na barra do header e detalhes.
- **Neutros / ink:** `#201f26` (títulos), `#444152` (corpo), `#79778c` (secundário), `#e9e9f2` (bordas), `#f5f5fa` (fundo).
- **Status:** info `#3de4f5`, success `#119538`, danger `#dd3c3c`.
- **Tipografia:** Red Hat Display (títulos) + Roboto (texto), via Google Fonts.
- **Raio:** 8px (botões/inputs), 12px, 16px (cards), pill (chips).
- **Sombras:** Níveis 1/2/3 (cinza frio `#9190A0` / ink em baixa opacidade).
