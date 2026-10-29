/* Registro de visitas e cliques do site, guardado num Durable Object (SQLite) da Cloudflare.
   Rotas:
     POST /api/hit    { type: "visit" | "click" | "leave", ... }   (chamado pela página)
     GET  /api/stats  (precisa do cabeçalho x-panel-key com a senha do painel)
   Tudo que não é /api/* é servido como arquivo estático (index.html, musica.mp3, ícones). */

const MAX_VISITS = 6000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const id = env.STATS.idFromName("main");
      return env.STATS.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

export class Stats {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, vid TEXT, ip TEXT, country TEXT, region TEXT, city TEXT, postal TEXT,
      lat REAL, lon TEXT, asn TEXT, isp TEXT, colo TEXT, ua TEXT, browser TEXT, os TEXT, device TEXT, lang TEXT, langs TEXT, tz TEXT,
      ref TEXT, screen TEXT, viewport TEXT, dpr REAL, platform TEXT, cores INTEGER, mem REAL, conn TEXT, touch INTEGER, gpu TEXT, url TEXT, dur INTEGER DEFAULT 0
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, vid TEXT, visit_id INTEGER, link TEXT, name TEXT)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS visits_ts ON visits(ts)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS clicks_ts ON clicks(ts)`);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const cors = { "Access-Control-Allow-Origin": url.origin, "Cache-Control": "no-store" };
    try {
      if (url.pathname === "/api/hit" && request.method === "POST") return this.hit(request, cors);
      if (url.pathname === "/api/stats" && request.method === "GET") return this.stats(request, url, cors);
      return new Response("nada aqui", { status: 404, headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e && e.message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }

  async hit(request, cors) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ ok: false }, 400, cors);
    const ua = request.headers.get("user-agent") || "";
    if (/bot|crawler|spider|headless|preview|facebookexternalhit|whatsapp|telegram|discordbot/i.test(ua)) return json({ ok: true, bot: true }, 200, cors);
    const cf = request.cf || {};
    const vid = str(body.vid, 48);
    const now = Date.now();

    if (body.type === "visit") {
      const info = parseUA(ua, request.headers);
      const row = this.sql.exec(
        `INSERT INTO visits (ts, vid, ip, country, region, city, postal, lat, lon, asn, isp, colo, ua, browser, os, device, lang, langs, tz, ref, screen, viewport, dpr, platform, cores, mem, conn, touch, gpu, url)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
        now, vid, request.headers.get("cf-connecting-ip") || "", cf.country || "", cf.region || "", cf.city || "", cf.postalCode || "",
        num(cf.latitude), str(cf.longitude, 24), cf.asn ? String(cf.asn) : "", cf.asOrganization || "", cf.colo || "", str(ua, 400),
        info.browser, info.os, info.device, str(body.lang, 16), str(body.langs, 80), str(body.tz || cf.timezone, 48), str(body.ref, 300),
        str(body.screen, 20), str(body.viewport, 20), num(body.dpr), str(body.platform, 40), int(body.cores), num(body.mem), str(body.conn, 16),
        body.touch ? 1 : 0, str(body.gpu, 120), str(body.url, 200)
      ).one();
      const count = this.sql.exec(`SELECT COUNT(*) AS n FROM visits`).one().n;
      if (count > MAX_VISITS) this.sql.exec(`DELETE FROM visits WHERE id IN (SELECT id FROM visits ORDER BY ts ASC LIMIT ?)`, count - MAX_VISITS);
      return json({ ok: true, visit: row.id }, 200, cors);
    }
    if (body.type === "click") {
      this.sql.exec(`INSERT INTO clicks (ts, vid, visit_id, link, name) VALUES (?,?,?,?,?)`, now, vid, int(body.visit), str(body.link, 300), str(body.name, 60));
      return json({ ok: true }, 200, cors);
    }
    if (body.type === "leave") {
      const dur = Math.min(int(body.dur) || 0, 86400);
      if (body.visit) this.sql.exec(`UPDATE visits SET dur = MAX(dur, ?) WHERE id = ? AND vid = ?`, dur, int(body.visit), vid);
      return json({ ok: true }, 200, cors);
    }
    return json({ ok: false }, 400, cors);
  }

  async stats(request, url, cors) {
    const key = request.headers.get("x-panel-key") || "";
    const hash = await sha256(key);
    if (!this.env.PANEL_HASH || hash !== this.env.PANEL_HASH) return json({ ok: false, error: "senha errada" }, 401, cors);
    const limit = Math.min(500, Math.max(1, int(url.searchParams.get("limit")) || 200));
    const dayStart = new Date(); dayStart.setUTCHours(dayStart.getUTCHours() - 24);
    const since24 = Date.now() - 86400000, since7 = Date.now() - 7 * 86400000;
    const totals = {
      visits: this.sql.exec(`SELECT COUNT(*) AS n FROM visits`).one().n,
      visitors: this.sql.exec(`SELECT COUNT(DISTINCT vid) AS n FROM visits`).one().n,
      clicks: this.sql.exec(`SELECT COUNT(*) AS n FROM clicks`).one().n,
      visits24: this.sql.exec(`SELECT COUNT(*) AS n FROM visits WHERE ts > ?`, since24).one().n,
      visits7: this.sql.exec(`SELECT COUNT(*) AS n FROM visits WHERE ts > ?`, since7).one().n,
      avgDur: Math.round(this.sql.exec(`SELECT AVG(dur) AS n FROM visits WHERE dur > 0`).one().n || 0)
    };
    const byLink = this.sql.exec(`SELECT name, link, COUNT(*) AS n FROM clicks GROUP BY link ORDER BY n DESC LIMIT 30`).toArray();
    const byCountry = this.sql.exec(`SELECT country, COUNT(*) AS n FROM visits GROUP BY country ORDER BY n DESC LIMIT 15`).toArray();
    const byCity = this.sql.exec(`SELECT city, region, country, COUNT(*) AS n FROM visits WHERE city != '' GROUP BY city, region, country ORDER BY n DESC LIMIT 15`).toArray();
    const byDevice = this.sql.exec(`SELECT device, COUNT(*) AS n FROM visits GROUP BY device ORDER BY n DESC`).toArray();
    const byBrowser = this.sql.exec(`SELECT browser, COUNT(*) AS n FROM visits GROUP BY browser ORDER BY n DESC LIMIT 10`).toArray();
    const byRef = this.sql.exec(`SELECT ref, COUNT(*) AS n FROM visits WHERE ref != '' GROUP BY ref ORDER BY n DESC LIMIT 15`).toArray();
    const visits = this.sql.exec(`SELECT * FROM visits ORDER BY ts DESC LIMIT ?`, limit).toArray();
    const ids = visits.map(v => v.id);
    const clicks = ids.length ? this.sql.exec(`SELECT visit_id, name, link, ts FROM clicks WHERE visit_id IN (${ids.map(() => "?").join(",")}) ORDER BY ts ASC`, ...ids).toArray() : [];
    const seen = {}; this.sql.exec(`SELECT vid, COUNT(*) AS n FROM visits GROUP BY vid`).toArray().forEach(r => { seen[r.vid] = r.n; });
    visits.forEach(v => { v.clicks = clicks.filter(c => c.visit_id === v.id).map(c => ({ name: c.name, link: c.link, ts: c.ts })); v.times = seen[v.vid] || 1; });
    return json({ ok: true, totals, byLink, byCountry, byCity, byDevice, byBrowser, byRef, visits }, 200, cors);
  }
}

function json(o, status, extra) { return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...extra } }); }
function str(v, max) { return v == null ? "" : String(v).slice(0, max); }
function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }
function int(v) { const n = parseInt(v, 10); return isFinite(n) ? n : null; }
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function parseUA(ua, h) {
  let browser = "outro", os = "outro", device = "computador";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux/.test(ua)) os = "Linux";
  const mobile = h.get("sec-ch-ua-mobile") === "?1" || /Mobi|Android|iPhone/.test(ua);
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobi/.test(ua))) device = "tablet";
  else if (mobile) device = "celular";
  if (/iPhone/.test(ua)) device = "iPhone";
  else if (/Android/.test(ua) && mobile) { const m = /Android[^;]*;\s*([^;)]+)\s*(?:Build|\))/.exec(ua); device = m && m[1] && !/wv/.test(m[1]) ? "Android · " + m[1].trim().slice(0, 30) : "Android"; }
  const ver = (() => { const m = /(Edg|OPR|SamsungBrowser|Chrome|Firefox|Version)\/(\d+)/.exec(ua); return m ? " " + m[2] : ""; })();
  return { browser: browser + ver, os, device };
}
