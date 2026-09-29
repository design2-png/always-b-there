"""端到端測試：MOCK 後台 + 真瀏覽器。python3 test/e2e.py  → 截圖存在 test/shots/"""
import os, re, sys, json, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:3000")
OUT = os.path.join(os.path.dirname(__file__), "shots"); os.makedirs(OUT, exist_ok=True)
MATTER = "/tmp/package/build/matter.min.js"
PHOTO = os.path.join(os.path.dirname(__file__), "..", "public/assets/intro/p2.jpg")
fails = []
def check(cond, msg):
    print(("  ok  " if cond else "  FAIL ") + msg)
    if not cond: fails.append(msg)

def routes(ctx):
    ctx.route(re.compile(r"https://cdnjs\.cloudflare\.com/.*matter.*"), lambda r: r.fulfill(path=MATTER, content_type="text/javascript"))
    ctx.route(re.compile(r"https://fonts\.(googleapis|gstatic)\.com/.*"), lambda r: r.fulfill(body="", content_type="text/css"))
    def cl_img(route):
        m = re.search(r"demo-([a-h])", route.request.url)
        route.fulfill(path=os.path.join(os.path.dirname(__file__), "..", f"public/assets/demo/{m.group(1) if m else 'a'}.jpg"), content_type="image/jpeg")
    ctx.route(re.compile(r"https://res\.cloudinary\.com/.*"), cl_img)
    def cl_up(route):
        req = urllib.request.Request(BASE + "/__mock_upload", data=route.request.post_data_buffer, method="POST")
        body = urllib.request.urlopen(req).read()
        route.fulfill(body=body, content_type="application/json")
    ctx.route(re.compile(r"https://api\.cloudinary\.com/.*/image/upload"), cl_up)

def fill(page, email="me@example.com", phone="0912345678", photo=PHOTO):
    page.set_input_files("#photo", photo)
    page.wait_for_function("document.getElementById('drop').classList.contains('has')")
    page.fill("#name", "小明")
    page.select_option("#since", "2019")
    page.select_option("#product", "Orca")
    page.fill("#story", "陪我熬過每一個截稿日，腰到現在都沒事。")
    page.fill("#title", "挺好的夥伴")
    page.fill("#email", email); page.fill("#phone", phone)
    page.check("#agree")

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- 桌機 ----------
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    routes(ctx); page = ctx.new_page()
    errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(BASE + "/")
    page.wait_for_timeout(1400); page.screenshot(path=f"{OUT}/d01_intro_fan.png")
    check(page.evaluate("document.body.classList.contains('locked')"), "intro 播放時主頁不能滑")
    page.wait_for_timeout(3300); page.screenshot(path=f"{OUT}/d02_intro_rows.png")
    page.wait_for_timeout(3600); page.screenshot(path=f"{OUT}/d03_hero.png")
    check(not page.evaluate("document.getElementById('intro').classList.contains('on')"), "intro 結束後關閉")
    check(page.inner_text("#count") == "7", "故事數只算公開的（7）")
    page.evaluate("document.getElementById('stories').scrollIntoView()"); page.wait_for_timeout(800)
    page.screenshot(path=f"{OUT}/d04_wall.png")
    # 搜尋
    page.fill("#q", "5"); page.wait_for_timeout(400)
    check(page.locator("#wall .card").count() == 1, "搜尋故事編號 #5 只剩一則")
    page.fill("#q", ""); page.wait_for_timeout(400)
    page.select_option("#fProd", "Orca"); page.wait_for_timeout(300)
    check(page.locator("#wall .card").count() == 1, "產品篩選（Orca 公開 1 則）")
    page.select_option("#fProd", ""); page.wait_for_timeout(300)
    page.locator("#wall .card").first.click(); page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/d05_lightbox.png")
    check("?s=" in page.url, "燈箱網址帶故事編號")
    page.keyboard.press("Escape")
    # 表單：空送
    page.evaluate("document.getElementById('submit').scrollIntoView()"); page.wait_for_timeout(500)
    page.click("#sendBtn"); page.wait_for_timeout(700)
    check(page.locator(".story-form .field.bad").count() == 9, "空白送出 → 9 個欄位錯誤")
    page.screenshot(path=f"{OUT}/d06_form_errors.png")
    page.wait_for_timeout(4200)  # 防機器人：開頁 4 秒內不收
    fill(page)
    page.screenshot(path=f"{OUT}/d07_form_filled.png")
    page.click("#sendBtn")
    page.wait_for_selector("#doneov.on", timeout=15000); page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/d08_done.png")
    check(page.inner_text("#doneNo") == "#0009", "完成頁編號 #0009")
    page.click("[data-style=B]"); page.wait_for_timeout(800); page.screenshot(path=f"{OUT}/d09_card_B.png")
    page.click("[data-style=C]"); page.wait_for_timeout(800); page.screenshot(path=f"{OUT}/d10_card_C.png")
    for n, sel in (("S", "#cardS"), ("P", "#cardP")):
        src = page.get_attribute(sel, "src"); import base64
        open(f"{OUT}/card_C_{n}.jpg", "wb").write(base64.b64decode(src.split(",")[1]))
    page.click("[data-style=A]"); page.wait_for_timeout(800)
    for n, sel in (("S", "#cardS"), ("P", "#cardP")):
        src = page.get_attribute(sel, "src")
        open(f"{OUT}/card_A_{n}.jpg", "wb").write(base64.b64decode(src.split(",")[1]))
    page.click("[data-style=B]"); page.wait_for_timeout(800)
    open(f"{OUT}/card_B_S.jpg", "wb").write(base64.b64decode(page.get_attribute("#cardS", "src").split(",")[1]))
    with page.expect_download() as dl: page.click("#save")
    check(dl.value.suggested_filename.startswith("AlwaysBThere_0009"), "儲存故事卡會下載檔案")
    page.click("#doneX"); page.wait_for_timeout(2200)
    page.screenshot(path=f"{OUT}/d11_after_drop.png")
    check(page.inner_text("#count") == "8", "送出後牆上 +1")
    # 重複投稿
    page.evaluate("document.getElementById('submit').scrollIntoView()")
    fill(page, email="ME@example.com", phone="0987654321")
    page.click("#sendBtn"); page.wait_for_timeout(1500)
    check(page.locator("#fEmail.bad").count() == 1 and "已經投稿" in page.inner_text("#eEmail"), "同一 Email（不分大小寫）擋下")
    check(page.locator("#fPhoto.bad").count() == 1, "同一張照片擋下")
    page.screenshot(path=f"{OUT}/d12_dup.png")
    # 規則
    page.evaluate("document.getElementById('rules').scrollIntoView()"); page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/d13_rules.png", full_page=False)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)"); page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/d14_footer.png")
    page.goto(BASE + "/"); page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/d00_fullpage.png", full_page=True)
    check(not errs, "沒有 JS 錯誤 " + "; ".join(errs[:3]))
    ctx.close()

    # ---------- 手機 ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    routes(ctx); page = ctx.new_page(); errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(BASE + "/"); page.wait_for_timeout(1500); page.screenshot(path=f"{OUT}/m01_intro.png")
    page.click("#introSkip"); page.wait_for_timeout(2200); page.screenshot(path=f"{OUT}/m02_hero.png")
    sw = page.evaluate("document.documentElement.scrollWidth"); check(sw <= 390, f"手機沒有橫向捲動（{sw}）")
    for i, sec in enumerate(["stories", "submit", "rules"]):
        page.evaluate(f"document.getElementById('{sec}').scrollIntoView()"); page.wait_for_timeout(700)
        page.screenshot(path=f"{OUT}/m0{3+i}_{sec}.png")
    page.evaluate("document.querySelector('.story-form').scrollIntoView()"); page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/m06_form.png", full_page=False)
    page.goto(BASE + "/?s=2"); page.wait_for_timeout(1800); page.screenshot(path=f"{OUT}/m07_deeplink_lb.png")
    check(page.evaluate("document.getElementById('lbov').classList.contains('on')"), "分享連結 ?s=2 直接打開那一則")
    check(not errs, "手機沒有 JS 錯誤 " + "; ".join(errs[:3]))
    b.close()

print("\nFAILED:" if fails else "\nALL PASSED", *fails, sep="\n  ")
sys.exit(1 if fails else 0)
