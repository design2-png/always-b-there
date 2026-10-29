/* ============================================================
   開站前的「等待頁」閘門（Vercel Edge Middleware）
   - 徵件開始（config.js 的 start，台北 11/6 00:00）之前，所有人看到 /wait 倒數頁。
   - 工作人員在等待頁輸入通關密語（Vercel 環境變數 GATE_CODE；沒設就是 2016），
     會拿到一枚 60 天的 cookie，之後正常瀏覽整個網站。
   - 時間一到自動放行；想提前撤掉閘門：在 Vercel 設 GATE_OFF=1 後 Redeploy，
     或直接把這個檔案從 repo 刪掉。
   ============================================================ */
const OPEN_AT = Date.parse("2026-11-06T00:00:00+08:00");
const COOKIE = "abt_pass";

export const config = { matcher: "/((?!assets/|favicon).*)" };

export default function middleware(request) {
  const env = (typeof process !== "undefined" && process.env) || {};
  const url = new URL(request.url);
  const path = url.pathname;
  const code = env.GATE_CODE || "2016";
  const token = "ok-" + hash(code + "|" + (env.GATE_SALT || "always-b-there"));
  const gateOn = env.GATE_OFF !== "1" && Date.now() < (env.GATE_UNTIL ? Date.parse(env.GATE_UNTIL) : OPEN_AT);

  /* 通關密語 */
  if (path === "/unlock") {
    if ((url.searchParams.get("code") || "").trim() === code) {
      return redirect("/", { "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=${60 * 86400}; HttpOnly; Secure; SameSite=Lax` });
    }
    return redirect("/wait?bad=1");
  }

  const passed = (request.headers.get("cookie") || "").split(/;\s*/).some((c) => c === `${COOKIE}=${token}`);
  if (!gateOn || passed) {
    if (path === "/wait" || path === "/wait.html") return redirect("/");   // 已開站就別停在等待頁
    return;                                                                // 正常放行
  }
  if (path === "/wait" || path === "/wait.html") return;
  if (path.startsWith("/api/")) return new Response(JSON.stringify({ ok: false, error: "not_open" }), { status: 403, headers: { "content-type": "application/json; charset=utf-8" } });
  return rewrite(new URL("/wait", url));
}

function rewrite(to) { return new Response(null, { headers: { "x-middleware-rewrite": String(to) } }); }
function redirect(to, headers = {}) { return new Response(null, { status: 302, headers: { Location: to, ...headers } }); }
/* 簡單的 32-bit 雜湊：cookie 值不等於密語本身 */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); }
