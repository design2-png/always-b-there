# Always B There — Backbone 十週年線上故事牆

活動站（故事牆＋投稿＋活動規則）＋ 後台（Airtable）＋ 圖片（Cloudinary）＋ 主機（Vercel）。
視覺依《20260922_十週年主視覺提案定稿》；文案、欄位、規則依行銷部 Canva《Always B There 線上故事牆徵集活動》。

```
public/            前台（純靜態）
  index.html       頁面
  styles.css       定稿色彩／字體
  app.js           互動、投稿流程、故事卡生成
  config.js        ★ 活動設定：日期、公布日、產品清單、IG 連結…（前後台共用，改這支就好）
  assets/          標誌、10th 識別、脊椎橢圓、intro 照片、OG 分享圖
api/               後端（Vercel Functions，金鑰只在這裡）
  stories.js       GET  故事牆資料（只回傳可公開欄位）
  sign.js          POST 發 Cloudinary 上傳簽章
  submit.js        POST 驗證 → 防重複 → 寫入 Airtable
  story.js         /s/編號 單則故事分享頁（FB/LINE 預覽圖）
lib/core.js        Airtable／Cloudinary／驗證共用
test/              本機假後台 + 瀏覽器自動測試
```

沒有接上後台時，網站會自動進入 **DEMO 模式**（左下角有標示），可以直接給老闆看流程。

---

## 上線步驟（第一次約 40 分鐘）

### 1. Airtable（收稿＋行銷部後台）

1. 建一個 base，例如「Backbone 十週年徵件」，裡面一張表叫 **投稿**。
2. 欄位照下表建立（名稱要一字不差）：

| 欄位名稱 | 類型 | 說明 |
|---|---|---|
| 投稿編號 | Autonumber | 流水號，網站上的 #0001 |
| 暱稱 | Single line text | |
| 開始使用年份 | Single line text | 2016–2026 或「忘記了」 |
| 產品 | Single line text | 21 款之一 |
| 故事 | Long text | 50 字內 |
| 一句話 | Single line text | 10 字內 |
| Email | Email | 不公開 |
| 手機 | Phone number | 不公開 |
| 照片 | Attachment | 後台直接看、下載原圖 |
| 照片 ID | Single line text | Cloudinary 用，不要改 |
| 照片寬 | Number | |
| 照片高 | Number | |
| 照片指紋 | Single line text | 防同一張照片重複投稿 |
| 公開 | Checkbox | ✅ 投稿時預設勾選；取消勾選＝從牆上撤下 |
| 同意條款 | Checkbox | |
| 來源指紋 | Single line text | 雜湊過的 IP，查灌水用 |
| 投稿時間 | Created time | |

3. 行銷部後台需求對照（Canva 第 13 頁）— Airtable 內建就有：
   - **預設最新在最上面**：Grid view → Sort → 投稿時間 ↓（存成「全部投稿」view）
   - **篩選日期**：Filter → 投稿時間 is within／is after／is before（開始、結束都可以不填）
   - **搜尋**（投稿編號、姓名、手機、Email）：右上角放大鏡
   - **選取／全選／批量刪除**：勾選列左邊方框 → 右鍵 Delete records
   - **匯出名單**：view 名稱旁 ▾ → Download CSV
   - **查看＆編輯故事、編輯姓名／手機／Email**：點開那一列直接改，網站 30 秒內同步
   - **照片查看＆下載**：點「照片」欄的縮圖 → 下載
   - **公開／不公開**：勾掉「公開」就立刻從牆上消失（刪除整列也會消失）
4. 權限：只邀請需要的同事（個資），**不要開公開分享連結**。
5. 建 Personal Access Token：<https://airtable.com/create/tokens>
   - Scopes：`data.records:read`、`data.records:write`
   - Access：只勾這一個 base
   - 記下 token（`pat…`）和 base ID（網址裡的 `app…`）

> 方案：Airtable 免費版每個 base 上限 1,000 筆，目標也是 1,000 則，**建議升 Team 方案**（或活動中途把舊資料匯出另存）。

### 2. Cloudinary（存照片、自動壓縮、分享圖）

1. 註冊 <https://cloudinary.com>（免費方案就夠）。
2. Dashboard 記下 **Cloud name / API Key / API Secret**。
3. 不需要建 upload preset（網站用後端簽章上傳，比較安全）。

### 3. GitHub + Vercel（主機）

1. 把這個資料夾推到 GitHub（新 repo，例如 `design2-png/always-b-there`，設 Private 也可以）。
2. <https://vercel.com> 用 GitHub 登入 → Add New Project → 選這個 repo → Framework Preset 選 **Other** → Deploy。
3. Project → Settings → **Environment Variables**，照 `.env.example` 填：
   `AIRTABLE_TOKEN`、`AIRTABLE_BASE_ID`、`AIRTABLE_TABLE`（投稿）、`CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET`、`CLOUDINARY_FOLDER`、`IP_SALT`
4. 再 Redeploy 一次。之後每次 push 到 GitHub 都會自動更新。
5. 自訂網域（選用）：Settings → Domains，例如 `story.backbone.tw`，照畫面在 DNS 加 CNAME。

### 4. 上線前測試

- 在 Vercel 暫時加 `SUBMIT_ALWAYS_OPEN=1` → 自己投一則 → 確認 Airtable 出現、照片可下載、牆上出現、故事卡能存。
- 用同一個 Email／手機／照片再投一次 → 應該被擋。
- 測完把那幾筆刪掉，**移除 `SUBMIT_ALWAYS_OPEN`**，Redeploy。
- 十週年主站「面」區塊的投稿按鈕，連到這個網站網址。

### 5. 活動期間要改的東西（都在 `public/config.js`）

- `igPostUrl`：IG 活動貼文發出後填網址（完成頁「活動貼文」會變成連結）
- 日期、公布日、兌獎期限、產品清單
- 選用：Cloudflare Turnstile 防機器人 → `turnstileSiteKey` 填 site key、Vercel 加 `TURNSTILE_SECRET`

---

## 投稿規則怎麼被執行

| 規則 | 做法 |
|---|---|
| 11/6 00:00 – 12/31 23:59 才能投 | 前台依後端回報的狀態鎖按鈕；後端 `submit`／`sign` 也會擋 |
| Email、手機、照片各只能一次 | 後端查 Airtable（Email 不分大小寫；照片用原檔 SHA-256 + Cloudinary etag 兩道指紋） |
| 暱稱 12／故事 50／一句話 10 字、手機 09 開頭 10 碼 | 前台即時提示＋後端再驗一次 |
| 照片 10MB 內 | 前台檢查，並先壓成長邊 2400px JPG 再上傳（手機 HEIC 在 iPhone Safari 可直接用） |
| 個資不公開 | Email、手機只存在 Airtable，任何公開 API 都不會回傳 |
| 防機器人 | 隱藏欄位、開頁 4 秒內送出不收、同 IP 頻率限制，選用 Turnstile |
| 預設公開 | 投稿即上牆；行銷部在 Airtable 取消「公開」即下架 |

## 本機預覽／測試

```bash
MOCK=1 SEED=1 SUBMIT_ALWAYS_OPEN=1 node test/devserver.js   # http://localhost:3000，不用任何帳號
python3 test/e2e.py                                          # 桌機＋手機自動測試，截圖在 test/shots/
```
