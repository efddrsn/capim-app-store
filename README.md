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
