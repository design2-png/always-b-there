/* 本機測試伺服器：模擬 Vercel（public/ 靜態檔 + api/ 函式 + /s/:no 轉址）。
   MOCK=1 時用記憶體假裝 Airtable 與 Cloudinary，不需要任何帳號。
   用法：MOCK=1 SUBMIT_ALWAYS_OPEN=1 node test/devserver.js  → http://localhost:3000 */
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const PORT = +process.env.PORT || 3000;

if (process.env.MOCK === "1") {
  Object.assign(process.env, {
    AIRTABLE_TOKEN: "mock", AIRTABLE_BASE_ID: "appMOCK", CLOUDINARY_CLOUD_NAME: "mockcloud",
    CLOUDINARY_API_KEY: "123", CLOUDINARY_API_SECRET: "sec", CLOUDINARY_FOLDER: "always-b-there"
  });
  const db = []; let auto = 0;
  const resources = global.__mockResources = new Map();
  const realFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
    if (u.hostname === "api.airtable.com") {
      if ((opts.method || "GET") === "POST") {
        const body = JSON.parse(opts.body);
        const out = body.records.map((r) => { const rec = { id: "rec" + (++auto), fields: { ...r.fields, "投稿編號": auto, "投稿時間": new Date().toISOString() } }; db.push(rec); return rec; });
        return json({ records: out });
      }
      const f = u.searchParams.get("filterByFormula") || "";
      let rows = db.slice();
      if (f.startsWith("OR(")) {
        const vals = [...f.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
        rows = rows.filter((r) => vals.some((v) => (r.fields.Email || "").toLowerCase() === v || r.fields["手機"] === v || String(r.fields["照片指紋"] || "").includes(v)));
      } else if (f.includes("{投稿編號}=")) {
        const n = +f.match(/=(\d+)/)[1]; rows = rows.filter((r) => r.fields["公開"] && r.fields["投稿編號"] === n);
      } else if (f === "{公開}") rows = rows.filter((r) => r.fields["公開"]).sort((a, b) => b.fields["投稿編號"] - a.fields["投稿編號"]);
      return json({ records: rows.slice(0, +(u.searchParams.get("maxRecords") || 100)) });
    }
    if (u.hostname === "api.cloudinary.com") {
      const m = u.pathname.match(/resources\/image\/upload\/(.+)$/);
      if (m) { const id = decodeURIComponent(m[1]); const r = resources.get(id); return r ? json(r) : json({ error: { message: "not found" } }, 404); }
      if (u.pathname.endsWith("/image/destroy")) return json({ result: "ok" });
    }
    if (u.hostname === "challenges.cloudflare.com") return json({ success: true });
    return realFetch(url, opts);
  };
  global.__mockDb = db;
  if (process.env.SEED === "1") {
    const P = ["Orca", "Kabuto™", "Allround Desk 電動升降桌", "Orca", "Viking™ 樂手椅", "Kangaroo™", "Dyback 04 電動升降桌", "Mamba™"];
    const T = ["椅背調回來了", "三坪的一半是它", "站著開會", "爸爸的椅子", "唯一不出聲的", "考研那一年", "一人一組高度", "它才八歲"];
    const SZ = { a: [560, 373], b: [560, 373], c: [560, 373], d: [520, 347], e: [520, 416], f: [520, 293], g: [293, 520], h: [293, 520] };
    "abcdefgh".split("").forEach((k, i) => db.push({ id: "rec" + (++auto), fields: { "投稿編號": auto, "暱稱": "測試" + (i + 1), "開始使用年份": String(2017 + i), "產品": P[i], "故事": "陪我度過很多個加班的晚上，現在還是每天坐。", "一句話": T[i], Email: `seed${i}@x.tw`, "手機": "09000000" + String(i).padStart(2, "0"), "照片 ID": "always-b-there/demo-" + k, "照片寬": SZ[k][0], "照片高": SZ[k][1], "公開": i !== 3, "投稿時間": new Date().toISOString() } }));
  }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  req.query = Object.fromEntries(u.searchParams);
  let p = u.pathname;
  const s = p.match(/^\/s\/(\d+)$/); if (s) { req.query.no = s[1]; p = "/api/story"; }
  /* 模擬 Cloudinary 上傳（瀏覽器端測試用） */
  if (p === "/__mock_upload" && process.env.MOCK === "1") {
    const chunks = []; for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks); const id = "always-b-there/" + crypto.randomBytes(6).toString("hex");
    const r = { public_id: id, width: 1600, height: 1200, etag: crypto.createHash("md5").update(buf).digest("hex"), secure_url: "/assets/demo/a.jpg" };
    global.__mockResources.set(id, r); res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(r));
  }
  if (p.startsWith("/api/")) {
    const f = path.join(ROOT, p + ".js");
    if (!fs.existsSync(f)) { res.statusCode = 404; return res.end("not found"); }
    try { return await require(f)(req, res); } catch (e) { console.error(e); res.statusCode = 500; return res.end("err"); }
  }
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, "public", path.normalize(p));
  if (!file.startsWith(path.join(ROOT, "public")) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});
server.listen(PORT, () => console.log(`dev server http://localhost:${PORT} ${process.env.MOCK === "1" ? "(MOCK)" : ""}`));
module.exports = server;
