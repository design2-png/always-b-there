/* GET /api/stories — 故事牆資料（只含公開欄位），CDN 快取 30 秒 */
const { listPublic, isOpen, send } = require("../lib/core");

module.exports = async (req, res) => {
  if (req.method !== "GET") return send(res, 405, { error: "method" });
  try {
    const stories = await listPublic();
    send(res, 200, { cloud: process.env.CLOUDINARY_CLOUD_NAME || "", open: isOpen(), stories }, { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" });
  } catch (e) {
    console.error("stories failed:", e.message, JSON.stringify(e.detail || {}));
    /* 只回傳錯誤類型，方便排查；不含任何金鑰或個資 */
    send(res, e.status || 500, { error: "stories_unavailable", reason: e.detail?.error?.type || e.message }, { "Cache-Control": "no-store" });
  }
};
