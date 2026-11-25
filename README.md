# 圖文靈感工坊｜AI 圖片文案生成工具

一個零外部相依、開箱即用的本機網頁工具，支援上傳圖片並依據目標平台、語氣風格與補充背景資訊，自動生成多組不同切角的社群與電商文案。

## 功能特色

- **多元圖片匯入**：支援拖曳上傳、檔案選擇、`Ctrl+V` 直接貼上剪貼簿圖片，並內建「載入範例圖片」一鍵體驗。
- **前端智慧預處理**：自動擷取圖片尺寸與主色調色票，並將過大圖片等比壓縮後傳送，兼顧辨識品質與速度。
- **多平台與風格參數**：
  - 平台：Instagram、Threads、Facebook、小紅書、電商商品頁、LINE / EDM、通用
  - 語氣：親切活潑、專業質感、幽默風趣、文青感性、極簡俐落、熱情種草
  - 語言：繁體中文（台灣 / 香港）、簡體中文、English、日本語、中英雙語
  - 控制項目：篇幅長度（精簡 / 適中 / 長文）、生成組數（1–5 組）、Hashtags 開關、Emoji 開關、補充關鍵字／優惠資訊
- **多模型引擎支援**：
  - **Google Gemini**（預設 `gemini-2.5-flash`）
  - **OpenAI / 相容視覺 API**（OpenAI `gpt-4o-mini` / `gpt-4o`、OpenRouter、Ollama、LM Studio 等）
  - **離線示範模式（Demo）**：免 API Key 即可預覽完整介面、視覺色調解析與結構化範例文案
- **編輯與匯出**：支援直接修改生成的標題／正文／CTA、單鍵複製全文或純正文、依單組切角重寫、本機歷史紀錄（`localStorage`）以及匯出 Markdown / JSON。

## 快速啟動

需求：**Node.js 18+**（無需 `npm install`）。

```bash
cd image-copywriter
node server.js
```

啟動後於瀏覽器開啟：`http://127.0.0.1:3456`

### 設定 API Key（擇一）

1. **直接在網頁右上角「API 設定」輸入**（儲存於瀏覽器 `localStorage`，不會寫入專案檔案）。
2. **透過環境變數或 `.env` 檔**：複製 `.env.example` 為 `.env` 並填入 `GEMINI_API_KEY` 或 `OPENAI_API_KEY` 後重新啟動 `node server.js`。

## 執行測試

```bash
node --test tests/*.test.js
```
