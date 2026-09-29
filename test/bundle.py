"""把網站打包成單一 HTML（給 Claude Artifact 預覽用，DEMO 模式）"""
import re, base64, os
R = os.path.join(os.path.dirname(__file__), "..", "public")
rd = lambda p: open(os.path.join(R, p), encoding="utf-8").read()
def uri(p):
    b = open(os.path.join(R, p.lstrip("/")), "rb").read()
    mime = "image/svg+xml" if p.endswith(".svg") else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(b).decode()
html = rd("index.html")
head = re.search(r"<head>(.*)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
title = re.search(r"<title>.*?</title>", head).group(0)
fonts = re.search(r'<link href="https://fonts.googleapis.com[^>]+>', head).group(0)
body = re.sub(r'src="(/assets/[^"]+)"', lambda m: f'src="{uri(m.group(1))}"', body)
body = body.replace('<script src="/config.js"></script>', "<script>" + rd("config.js") + "</script>")
assets = {f"/assets/intro/p{i}.jpg": uri(f"/assets/intro/p{i}.jpg") for i in range(1, 6)}
assets.update({f"/assets/demo/{k}.jpg": uri(f"/assets/demo/{k}.jpg") for k in "abcdefgh"})
for s in ("wordmark.svg", "mark-10th.svg"): assets["/assets/" + s] = uri("/assets/" + s)
import json
body = body.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js" defer></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>')
body = body.replace('<script src="/app.js" defer></script>', "<script>window.ABT_ASSETS=" + json.dumps(assets) + ";</script><script>" + rd("app.js") + "</script>")
out = title + "\n" + '<link rel="preconnect" href="https://fonts.googleapis.com">' + fonts + "\n<style>" + rd("styles.css") + "</style>\n" + body
os.makedirs(os.path.join(R, "..", "dist"), exist_ok=True)
open(os.path.join(R, "..", "dist", "always-b-there-preview.html"), "w", encoding="utf-8").write(out)
print(len(out) // 1024, "KB")
