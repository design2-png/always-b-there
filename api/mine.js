/* POST /api/mine  { no, email, phone }
   「忘記儲存故事卡」：用投稿時的 Email＋手機證明這則故事是自己的。
   兩個都要對才算；成功回傳這組 Email＋手機投過的所有故事編號，前台就把它們標成「你的故事」並開放下載。
   不回傳任何個資。 */
const { F, airtable, send, readJson, ipHash, rateLimited } = require("../lib/core");

const q = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  let b;
  try { b = await readJson(req); } catch (e) { return send(res, e.status || 400, { error: "bad_request" }); }

  const no = Number(b.no), email = String(b.email || "").trim().toLowerCase(), phone = String(b.phone || "").replace(/\D/g, "");
  if (!Number.isInteger(no) || no <= 0 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email) || !/^09\d{8}$/.test(phone)) {
    return send(res, 422, { error: "invalid", message: "請輸入投稿時的 Email 與手機" });
  }
  const ip = ipHash(req);
  if (rateLimited("mine:" + ip, 10)) return send(res, 429, { error: "rate", message: "操作太頻繁，請稍後再試" });

  try {
    const formula = encodeURIComponent(`AND(LOWER({${F.email}})=${q(email)},{${F.phone}}=${q(phone)})`);
    const j = await airtable(`?maxRecords=20&filterByFormula=${formula}&fields%5B%5D=${encodeURIComponent(F.no)}&fields%5B%5D=${encodeURIComponent(F.isPublic)}`);
    const nos = (j.records || []).map((r) => r.fields[F.no]).filter(Boolean);
    if (!nos.includes(no)) return send(res, 404, { error: "no_match", message: "資料對不起來，請確認是投稿時填的 Email 與手機" });
    return send(res, 200, { ok: true, nos });
  } catch (e) {
    return send(res, e.status || 502, { error: "server", message: "暫時無法查詢，請稍後再試" });
  }
};
