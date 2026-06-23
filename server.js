const http = require("http");
const fs = require("fs");
const path = require("path");
const SEED = require("./seed");

const PORT = process.env.PORT || 3000;

// ── Notion (opcional) ─────────────────────────────────────────────
// Configure NOTION_TOKEN (secret da integração interna) e NOTION_DB_ID
// (id do database) para usar o Notion como fonte de verdade. Sem eles,
// o catálogo cai no seed embutido e o formulário fica indisponível.
const NOTION_TOKEN = process.env.NOTION_TOKEN || "";
const NOTION_DB_ID = process.env.NOTION_DB_ID || "";
const NOTION_VERSION = process.env.NOTION_VERSION || "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";
const notionEnabled = Boolean(NOTION_TOKEN && NOTION_DB_ID);

const AREAS = [
  "Engenharia", "Riscos & Crédito", "Customer Success", "Finanças",
  "Comercial & Marketing", "Dados & Analytics", "Produto",
];
const CRITICALITIES = ["Baixa", "Média", "Alta"];

const html = fs.readFileSync(path.join(__dirname, "index.html"));

// ── Helpers Notion ────────────────────────────────────────────────
function notionFetch(endpoint, options = {}) {
  return fetch(`${NOTION_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

const plain = (rich) => (Array.isArray(rich) ? rich.map((r) => r.plain_text || "").join("") : "");
const levelFromName = (name) => {
  const m = /(\d)/.exec(name || "");
  return m ? Number(m[1]) : 1;
};

function pageToApp(page) {
  const p = page.properties || {};
  const get = (k) => p[k] || {};
  return {
    name: plain(get("Name").title),
    owner: plain(get("Responsável").rich_text),
    area: get("Área").select ? get("Área").select.name : "",
    level: levelFromName(get("Nível").select ? get("Nível").select.name : ""),
    desc: plain(get("Descrição").rich_text),
    deck: get("Deck").url || "",
    video: get("Vídeo").url || "",
    accessUrl: get("Link de acesso").url || "",
    repoUrl: get("Repositório").url || "",
    resources: plain(get("Recursos/Infra").rich_text),
    sso: Boolean(get("SSO configurado").checkbox),
    techOwner: plain(get("Responsável técnico").rich_text),
    criticality: get("Criticidade").select ? get("Criticidade").select.name : "",
    tokenUsage: plain(get("Uso de tokens").rich_text),
    submittedAt: get("Submetido em").created_time || page.created_time || "",
  };
}

async function fetchApprovedApps() {
  const apps = [];
  let cursor;
  do {
    const body = {
      filter: { property: "Status", select: { equals: "Aprovado" } },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionFetch(`/databases/${NOTION_DB_ID}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Notion query ${res.status}: ${txt.slice(0, 300)}`);
    }
    const data = await res.json();
    for (const page of data.results) apps.push(pageToApp(page));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return apps;
}

// Constrói o payload de propriedades do Notion a partir de uma submissão.
function buildNotionProperties(s) {
  const text = (v) => (v ? { rich_text: [{ text: { content: String(v).slice(0, 1900) } }] } : { rich_text: [] });
  const url = (v) => ({ url: v ? String(v) : null });
  const props = {
    Name: { title: [{ text: { content: s.name.slice(0, 200) } }] },
    Status: { select: { name: s.level === 1 ? "Aprovado" : "Pendente" } },
    "Nível": { select: { name: `Nível ${s.level}` } },
    "Área": { select: { name: s.area } },
    "Responsável": text(s.owner),
    "Descrição": text(s.desc),
    Deck: url(s.deck),
    "Vídeo": url(s.video),
    "Link de acesso": url(s.accessUrl),
    "Repositório": url(s.repoUrl),
    "Recursos/Infra": text(s.resources),
    "SSO configurado": { checkbox: Boolean(s.sso) },
    "Responsável técnico": text(s.techOwner),
    "Uso de tokens": text(s.tokenUsage),
  };
  if (s.criticality) props["Criticidade"] = { select: { name: s.criticality } };
  if (s.email) props["Submetido por"] = { email: s.email };
  return props;
}

// ── Validação da submissão ────────────────────────────────────────
const isUrl = (v) => typeof v === "string" && /^https?:\/\/.+/i.test(v.trim());
const isEmail = (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const str = (v) => (typeof v === "string" ? v.trim() : "");

function validateSubmission(raw) {
  const errors = [];
  const s = {
    name: str(raw.name),
    owner: str(raw.owner),
    area: str(raw.area),
    level: Number(raw.level),
    desc: str(raw.desc),
    email: str(raw.email),
    deck: str(raw.deck),
    video: str(raw.video),
    accessUrl: str(raw.accessUrl),
    repoUrl: str(raw.repoUrl),
    resources: str(raw.resources),
    sso: Boolean(raw.sso),
    techOwner: str(raw.techOwner),
    criticality: str(raw.criticality),
    tokenUsage: str(raw.tokenUsage),
  };

  if (!s.name || s.name.length > 200) errors.push("Nome do app é obrigatório (até 200 caracteres).");
  if (!s.owner || s.owner.length > 200) errors.push("Responsável (dono) é obrigatório.");
  if (!AREAS.includes(s.area)) errors.push("Área inválida.");
  if (![1, 2, 3].includes(s.level)) errors.push("Nível inválido.");
  if (!s.desc || s.desc.length > 2000) errors.push("Descrição é obrigatória (até 2000 caracteres).");
  if (s.email && !isEmail(s.email)) errors.push("E-mail de quem submete é inválido.");
  for (const [field, label] of [["deck", "Deck"], ["video", "Vídeo"], ["accessUrl", "Link de acesso"], ["repoUrl", "Repositório"]]) {
    if (s[field] && !isUrl(s[field])) errors.push(`${label} deve ser uma URL http(s) válida.`);
  }

  if (s.level >= 2) {
    if (!isUrl(s.accessUrl)) errors.push("Nível 2+: link de acesso à ferramenta é obrigatório.");
    if (!isUrl(s.repoUrl)) errors.push("Nível 2+: link do repositório (codebase) é obrigatório.");
    if (!s.resources) errors.push("Nível 2+: descreva os recursos/infra que o código usa.");
    if (!s.sso) errors.push("Nível 2+: o SSO precisa estar configurado.");
  }
  if (s.level === 3) {
    if (!s.techOwner) errors.push("Nível 3: responsável técnico dedicado é obrigatório.");
    if (!CRITICALITIES.includes(s.criticality)) errors.push("Nível 3: criticidade é obrigatória.");
    if (!s.tokenUsage) errors.push("Nível 3: descreva o uso de tokens/credenciais.");
  }
  return { s, errors };
}

// ── Rate limit simples em memória (anti-spam) ─────────────────────
const hits = new Map(); // ip -> [timestamps]
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20;
}

// ── HTTP utils ────────────────────────────────────────────────────
function sendJson(res, status, obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(buf);
}

function readBody(req, limit = 50 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("payload too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ── Server ────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = url.pathname;

  if (route === "/health" || route === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  // GET /api/apps — catálogo (Notion → fallback seed)
  if (route === "/api/apps" && req.method === "GET") {
    if (!notionEnabled) {
      sendJson(res, 200, { apps: SEED, source: "seed", notionConfigured: false });
      return;
    }
    try {
      const apps = await fetchApprovedApps();
      sendJson(res, 200, { apps, source: "notion", notionConfigured: true });
    } catch (err) {
      console.error("[api/apps] Notion falhou, usando seed:", err.message);
      sendJson(res, 200, { apps: SEED, source: "seed", notionConfigured: true, degraded: true });
    }
    return;
  }

  // POST /api/submit — nova submissão
  if (route === "/api/submit" && req.method === "POST") {
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
    if (rateLimited(ip)) { sendJson(res, 429, { ok: false, errors: ["Muitas submissões. Tente novamente em alguns minutos."] }); return; }

    let raw;
    try {
      raw = JSON.parse((await readBody(req)) || "{}");
    } catch {
      sendJson(res, 400, { ok: false, errors: ["JSON inválido."] });
      return;
    }
    const { s, errors } = validateSubmission(raw);
    if (errors.length) { sendJson(res, 400, { ok: false, errors }); return; }

    if (!notionEnabled) {
      sendJson(res, 503, { ok: false, errors: ["Submissões ainda não estão habilitadas: o backend do Notion não está configurado. Avise o responsável pela App Store."] });
      return;
    }
    try {
      const r = await notionFetch("/pages", {
        method: "POST",
        body: JSON.stringify({ parent: { database_id: NOTION_DB_ID }, properties: buildNotionProperties(s) }),
      });
      if (!r.ok) {
        const txt = await r.text();
        console.error("[api/submit] Notion erro:", r.status, txt.slice(0, 300));
        sendJson(res, 502, { ok: false, errors: ["Não foi possível registrar no Notion. Tente novamente."] });
        return;
      }
      const status = s.level === 1 ? "publicado" : "pendente";
      sendJson(res, 200, {
        ok: true,
        status,
        message: s.level === 1
          ? "Projeto publicado no catálogo (Nível 1)."
          : `Submissão recebida! Vai para a fila de aprovação do Nível ${s.level}.`,
      });
    } catch (err) {
      console.error("[api/submit] erro:", err.message);
      sendJson(res, 502, { ok: false, errors: ["Erro ao registrar a submissão."] });
    }
    return;
  }

  // GET / (e qualquer outra rota) — serve a SPA
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=120" });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`Capim App Store na porta ${PORT} — Notion: ${notionEnabled ? "configurado" : "OFF (usando seed)"}`);
});
