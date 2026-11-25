import { generateCopyFromImage } from './engine.js';

const STORAGE_SETTINGS_KEY = 'imageCopywriter.settings.v1';
const STORAGE_HISTORY_KEY = 'imageCopywriter.history.v1';

const state = {
  image: null, // { dataUrl, thumbUrl, name, width, height, sizeBytes, visualMeta }
  platform: 'instagram',
  tone: 'friendly',
  result: null,
  hasBackend: false,
  serverHealth: { hasServerGeminiKey: false, hasServerOpenAIKey: false },
  settings: loadSettings(),
  history: loadHistory(),
};

const els = {
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  dropPlaceholder: document.getElementById('dropPlaceholder'),
  previewContainer: document.getElementById('previewContainer'),
  previewImg: document.getElementById('previewImg'),
  imageMeta: document.getElementById('imageMeta'),
  paletteBar: document.getElementById('paletteBar'),
  replaceImgBtn: document.getElementById('replaceImgBtn'),
  clearImgBtn: document.getElementById('clearImgBtn'),
  loadSampleBtn: document.getElementById('loadSampleBtn'),
  platformGroup: document.getElementById('platformGroup'),
  toneGroup: document.getElementById('toneGroup'),
  languageSelect: document.getElementById('languageSelect'),
  lengthSelect: document.getElementById('lengthSelect'),
  variantsSelect: document.getElementById('variantsSelect'),
  includeHashtags: document.getElementById('includeHashtags'),
  includeEmoji: document.getElementById('includeEmoji'),
  extraContext: document.getElementById('extraContext'),
  generateBtn: document.getElementById('generateBtn'),
  generateBtnText: document.getElementById('generateBtnText'),
  modeHint: document.getElementById('modeHint'),

  emptyState: document.getElementById('emptyState'),
  loadingState: document.getElementById('loadingState'),
  loadingSubtext: document.getElementById('loadingSubtext'),
  errorBanner: document.getElementById('errorBanner'),
  errorMessage: document.getElementById('errorMessage'),
  errorOpenSettings: document.getElementById('errorOpenSettings'),
  resultsContent: document.getElementById('resultsContent'),
  resultModelBadge: document.getElementById('resultModelBadge'),
  analysisSubject: document.getElementById('analysisSubject'),
  analysisMood: document.getElementById('analysisMood'),
  analysisHighlights: document.getElementById('analysisHighlights'),
  copiesList: document.getElementById('copiesList'),
  exportMdBtn: document.getElementById('exportMdBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),

  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  providerSelect: document.getElementById('providerSelect'),
  geminiConfigBox: document.getElementById('geminiConfigBox'),
  openaiConfigBox: document.getElementById('openaiConfigBox'),
  demoConfigBox: document.getElementById('demoConfigBox'),
  geminiKeyInput: document.getElementById('geminiKeyInput'),
  geminiModelInput: document.getElementById('geminiModelInput'),
  openaiBaseUrlInput: document.getElementById('openaiBaseUrlInput'),
  openaiKeyInput: document.getElementById('openaiKeyInput'),
  openaiModelInput: document.getElementById('openaiModelInput'),
  serverGeminiHint: document.getElementById('serverGeminiHint'),
  serverOpenaiHint: document.getElementById('serverOpenaiHint'),
  providerStatusDot: document.getElementById('providerStatusDot'),
  providerBadgeText: document.getElementById('providerBadgeText'),

  historyBtn: document.getElementById('historyBtn'),
  historyBadge: document.getElementById('historyBadge'),
  historyModal: document.getElementById('historyModal'),
  closeHistoryBtn: document.getElementById('closeHistoryBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  historyList: document.getElementById('historyList'),
  toast: document.getElementById('toast'),
};

function defaultSettings() {
  return {
    provider: 'gemini',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    return { ...defaultSettings(), ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return defaultSettings();
  }
}

function saveSettings(next) {
  state.settings = next;
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(next));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  state.history = list.slice(0, 15);
  try {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(state.history));
  } catch {
    // Trim older items if storage quota is tight
    state.history = state.history.slice(0, 5);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(state.history));
  }
  renderHistoryBadge();
}

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 2400);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Analyze palette & brightness and downscale oversized images for fast API requests.
 */
async function processImageFile(fileOrBlob, fileName = 'image.png') {
  const originalDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.readAsDataURL(fileOrBlob);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('圖片格式損毀或無法解碼'));
    el.src = originalDataUrl;
  });

  const maxSide = 1600;
  let targetW = img.naturalWidth;
  let targetH = img.naturalHeight;
  if (Math.max(targetW, targetH) > maxSide) {
    const scale = maxSide / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Extract 4 sampled colors + brightness hint
  const visualMeta = extractVisualMeta(ctx, targetW, targetH, img.naturalWidth, img.naturalHeight);

  // Keep GIF intact if small; otherwise export crisp JPEG/PNG
  const isGif = fileOrBlob.type === 'image/gif' && fileOrBlob.size < 4 * 1024 * 1024;
  const uploadDataUrl = isGif
    ? originalDataUrl
    : canvas.toDataURL(fileOrBlob.type === 'image/png' && fileOrBlob.size < 1.5 * 1024 * 1024 ? 'image/png' : 'image/jpeg', 0.88);

  // Create tiny thumbnail for history storage
  const thumbCanvas = document.createElement('canvas');
  const thumbScale = Math.min(1, 220 / Math.max(targetW, targetH));
  thumbCanvas.width = Math.max(1, Math.round(targetW * thumbScale));
  thumbCanvas.height = Math.max(1, Math.round(targetH * thumbScale));
  thumbCanvas.getContext('2d').drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);

  state.image = {
    name: fileName,
    dataUrl: uploadDataUrl,
    thumbUrl,
    width: img.naturalWidth,
    height: img.naturalHeight,
    sizeBytes: fileOrBlob.size || uploadDataUrl.length,
    visualMeta,
  };

  renderImagePreview();
}

function extractVisualMeta(ctx, w, h, natW, natH) {
  const sampleCoords = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.3, 0.75],
  ];
  const colors = [];
  let lumSum = 0;
  let warmScore = 0;

  for (const [rx, ry] of sampleCoords) {
    const px = Math.min(w - 1, Math.max(0, Math.floor(w * rx)));
    const py = Math.min(h - 1, Math.max(0, Math.floor(h * ry)));
    const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    colors.push(hex);
    lumSum += 0.299 * r + 0.587 * g + 0.114 * b;
    warmScore += r - b;
  }

  const avgLum = lumSum / sampleCoords.length;
  const brightness = avgLum > 165 ? '明亮通透' : avgLum > 95 ? '自然柔和' : '深邃沉穩';
  const temperature = warmScore > 25 ? '暖色調' : warmScore < -25 ? '冷色調' : '中性平衡色調';

  return {
    width: natW,
    height: natH,
    colors,
    moodHint: `${brightness}的${temperature}`,
  };
}

function renderImagePreview() {
  if (!state.image) {
    els.dropPlaceholder.classList.remove('hidden');
    els.previewContainer.classList.add('hidden');
    els.previewImg.removeAttribute('src');
    els.paletteBar.innerHTML = '';
    return;
  }

  els.dropPlaceholder.classList.add('hidden');
  els.previewContainer.classList.remove('hidden');
  els.previewImg.src = state.image.dataUrl;
  els.imageMeta.textContent = `${state.image.name} · ${state.image.width}×${state.image.height} · ${formatBytes(state.image.sizeBytes)}`;

  els.paletteBar.innerHTML = '';
  for (const hex of state.image.visualMeta.colors) {
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = hex;
    swatch.title = hex;
    els.paletteBar.appendChild(swatch);
  }
  const label = document.createElement('span');
  label.className = 'palette-label';
  label.textContent = `色彩氛圍：${state.image.visualMeta.moodHint}`;
  els.paletteBar.appendChild(label);
}

/**
 * Generate a pleasant sample product photo on Canvas for quick one-click testing.
 */
async function loadSampleImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  // Warm sunlit background
  const grad = ctx.createLinearGradient(0, 0, 960, 720);
  grad.addColorStop(0, '#f7ead9');
  grad.addColorStop(1, '#e6cbb0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 960, 720);

  // Tabletop
  ctx.fillStyle = '#cfa982';
  ctx.fillRect(0, 480, 960, 240);

  // Saucer & Coffee cup
  ctx.fillStyle = 'rgba(70, 42, 22, 0.16)';
  ctx.beginPath();
  ctx.ellipse(485, 535, 165, 36, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fffdf9';
  ctx.beginPath();
  ctx.ellipse(480, 520, 150, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(380, 340, 200, 175, [12, 12, 70, 70]);
  ctx.fill();

  // Handle
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(585, 420, 42, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Coffee surface & latte heart
  ctx.fillStyle = '#734525';
  ctx.beginPath();
  ctx.ellipse(480, 346, 92, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f5e7d6';
  ctx.beginPath();
  ctx.arc(468, 343, 12, 0, Math.PI * 2);
  ctx.arc(492, 343, 12, 0, Math.PI * 2);
  ctx.lineTo(480, 362);
  ctx.closePath();
  ctx.fill();

  // Subtle badge text
  ctx.fillStyle = '#4a3425';
  ctx.font = '600 26px sans-serif';
  ctx.fillText('MORNING ROAST · HANDCRAFTED LATTE', 235, 140);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  await processImageFile(blob, 'sample-latte.jpg');
  showToast('已載入範例咖啡圖片');
}

function setupPillGroup(container, onChange) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    container.querySelectorAll('.pill').forEach((el) => el.classList.remove('active'));
    btn.classList.add('active');
    onChange(btn.dataset.value);
  });
}

function getEffectiveProviderInfo() {
  const { provider, geminiApiKey, geminiModel, openaiApiKey, openaiBaseUrl, openaiModel } = state.settings;
  if (provider === 'demo') {
    return { ready: true, mode: 'demo', label: '示範模式' };
  }
  if (provider === 'gemini') {
    const hasKey = Boolean(geminiApiKey || state.serverHealth.hasServerGeminiKey);
    return {
      ready: hasKey,
      mode: 'ready',
      label: hasKey ? `Gemini · ${geminiModel || 'gemini-2.5-flash'}` : 'Gemini（待填 Key）',
    };
  }
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(openaiBaseUrl || '');
  const hasKey = Boolean(openaiApiKey || state.serverHealth.hasServerOpenAIKey || isLocal);
  return {
    ready: hasKey,
    mode: 'ready',
    label: hasKey ? `OpenAI 相容 · ${openaiModel || 'gpt-4o-mini'}` : 'OpenAI（待填 Key）',
  };
}

function updateProviderStatusUI() {
  const info = getEffectiveProviderInfo();
  els.providerBadgeText.textContent = info.label;
  els.providerStatusDot.className = `status-dot ${info.mode === 'demo' ? 'demo' : info.ready ? 'ready' : ''}`;

  if (state.settings.provider === 'demo') {
    els.modeHint.textContent = '目前為「離線示範模式」，點擊上方按鈕可切換 Gemini / OpenAI 真實看圖生成。';
  } else if (!info.ready) {
    els.modeHint.textContent = '尚未填入 API Key：請點右上角設定金鑰，或先切換「示範模式」體驗。';
  } else {
    els.modeHint.textContent = `目前引擎：${info.label}`;
  }
}

async function generateCopy({ focusAngle = '' } = {}) {
  if (!state.image) {
    showToast('請先上傳或載入一張圖片');
    return;
  }

  const info = getEffectiveProviderInfo();
  if (!info.ready && state.settings.provider !== 'demo') {
    openSettingsModal();
    showToast('請先填入 API Key 或切換至「示範模式」');
    return;
  }

  setGenerating(true, focusAngle ? `正在以「${focusAngle}」切角重寫…` : '正在分析構圖、氛圍與關鍵視覺亮點');
  hideError();

  const { provider, geminiApiKey, geminiModel, openaiApiKey, openaiBaseUrl, openaiModel } = state.settings;
  const payload = {
    imageDataUrl: state.image.dataUrl,
    provider,
    apiKey: provider === 'gemini' ? geminiApiKey : openaiApiKey,
    baseUrl: openaiBaseUrl,
    model: provider === 'gemini' ? geminiModel : openaiModel,
    visualMeta: state.image.visualMeta,
    options: {
      platform: state.platform,
      tone: state.tone,
      language: els.languageSelect.value,
      length: els.lengthSelect.value,
      variants: Number(els.variantsSelect.value),
      includeHashtags: els.includeHashtags.checked,
      includeEmoji: els.includeEmoji.checked,
      extraContext: els.extraContext.value,
      focusAngle,
    },
  };

  try {
    let data;
    if (state.hasBackend) {
      const res = await fetch('./api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `伺服器錯誤 (${res.status})`);
      }
    } else {
      // Static web mode (e.g. GitHub Pages): run directly in browser
      data = await generateCopyFromImage(payload);
    }

    state.result = data;
    renderResults(data);
    recordHistory(data);
  } catch (err) {
    showError(err.message || '生成失敗，請稍後再試');
  } finally {
    setGenerating(false);
  }
}

function setGenerating(isLoading, subtext = '') {
  els.generateBtn.disabled = isLoading;
  els.generateBtnText.textContent = isLoading ? '生成中，請稍候…' : '✦ 立即生成圖片文案';

  if (isLoading) {
    els.emptyState.classList.add('hidden');
    els.resultsContent.classList.add('hidden');
    els.loadingState.classList.remove('hidden');
    els.loadingSubtext.textContent = subtext;
  } else {
    els.loadingState.classList.add('hidden');
  }
}

function showError(msg) {
  els.errorMessage.textContent = msg;
  els.errorBanner.classList.remove('hidden');
  if (!state.result) {
    els.emptyState.classList.remove('hidden');
  } else {
    els.resultsContent.classList.remove('hidden');
  }
}

function hideError() {
  els.errorBanner.classList.add('hidden');
}

function renderResults(data) {
  els.emptyState.classList.add('hidden');
  els.resultsContent.classList.remove('hidden');

  els.resultModelBadge.textContent = `${data.provider.toUpperCase()} · ${data.model}`;
  els.analysisSubject.textContent = data.imageAnalysis.subject;
  els.analysisMood.textContent = data.imageAnalysis.mood;

  els.analysisHighlights.innerHTML = '';
  for (const h of data.imageAnalysis.highlights || []) {
    const chip = document.createElement('span');
    chip.className = 'highlight-chip';
    chip.textContent = h;
    els.analysisHighlights.appendChild(chip);
  }

  els.copiesList.innerHTML = '';
  data.copies.forEach((copy, index) => {
    const card = document.createElement('article');
    card.className = 'copy-card';

    const countText = () => {
      const totalChars = (copy.headline + copy.body + copy.cta).replace(/\s+/g, '').length;
      return `${totalChars} 字`;
    };

    card.innerHTML = `
      <div class="copy-card-header">
        <div class="copy-title-group">
          <span class="angle-badge">${escapeHtml(copy.angle || `版本 ${index + 1}`)}</span>
          <span class="char-count">${countText()}</span>
        </div>
        <div class="copy-card-actions">
          <button type="button" class="btn btn-xs btn-outline copy-full-btn">複製全文</button>
          <button type="button" class="btn btn-xs btn-ghost copy-plain-btn">複製純正文</button>
          <button type="button" class="btn btn-xs btn-ghost regen-angle-btn">依此切角重寫</button>
        </div>
      </div>
      <div class="copy-field-label">標題 / 首句鉤子</div>
      <input type="text" class="editable-headline" value="${escapeAttr(copy.headline)}" />
      <div class="copy-field-label">文案正文（可直接點擊修改）</div>
      <textarea class="editable-body">${escapeHtml(copy.body)}</textarea>
      <div class="copy-field-label">行動呼籲 / 互動提問 (CTA)</div>
      <input type="text" class="editable-cta" value="${escapeAttr(copy.cta)}" placeholder="（無）" />
      <div class="hashtags-box"></div>
    `;

    const hashtagsBox = card.querySelector('.hashtags-box');
    if (copy.hashtags && copy.hashtags.length > 0) {
      copy.hashtags.forEach((tag) => {
        const span = document.createElement('span');
        span.className = 'hashtag-chip';
        span.textContent = tag;
        hashtagsBox.appendChild(span);
      });
    } else {
      hashtagsBox.classList.add('hidden');
    }

    const headlineEl = card.querySelector('.editable-headline');
    const bodyEl = card.querySelector('.editable-body');
    const ctaEl = card.querySelector('.editable-cta');
    const countEl = card.querySelector('.char-count');

    const syncEdits = () => {
      copy.headline = headlineEl.value;
      copy.body = bodyEl.value;
      copy.cta = ctaEl.value;
      countEl.textContent = countText();
    };
    headlineEl.addEventListener('input', syncEdits);
    bodyEl.addEventListener('input', syncEdits);
    ctaEl.addEventListener('input', syncEdits);

    card.querySelector('.copy-full-btn').addEventListener('click', () => {
      const parts = [copy.headline, copy.body, copy.cta].filter(Boolean);
      if (copy.hashtags?.length) parts.push(copy.hashtags.join(' '));
      copyToClipboard(parts.join('\n\n'), '已複製完整文案（含 Hashtags）');
    });

    card.querySelector('.copy-plain-btn').addEventListener('click', () => {
      const parts = [copy.headline, copy.body, copy.cta].filter(Boolean);
      copyToClipboard(parts.join('\n\n'), '已複製純正文');
    });

    card.querySelector('.regen-angle-btn').addEventListener('click', () => {
      generateCopy({ focusAngle: `請特別聚焦「${copy.angle}」風格再重新發想不同寫法` });
    });

    els.copiesList.appendChild(card);
  });
}

async function copyToClipboard(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
  } catch {
    showToast('複製失敗，請手動選取文字複製');
  }
}

function recordHistory(result) {
  if (!state.image) return;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    thumbUrl: state.image.thumbUrl,
    imageName: state.image.name,
    platform: state.platform,
    tone: state.tone,
    result,
  };
  saveHistory([entry, ...state.history]);
}

function renderHistoryBadge() {
  if (state.history.length > 0) {
    els.historyBadge.textContent = String(state.history.length);
    els.historyBadge.classList.remove('hidden');
  } else {
    els.historyBadge.classList.add('hidden');
  }
}

function renderHistoryModal() {
  els.historyList.innerHTML = '';
  if (state.history.length === 0) {
    els.historyList.innerHTML = '<p style="color:var(--ink-muted);text-align:center;padding:24px;">目前尚無生成紀錄</p>';
    return;
  }

  state.history.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'history-item';
    const firstCopy = entry.result?.copies?.[0];
    const timeStr = new Date(entry.createdAt).toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    row.innerHTML = `
      <img src="${entry.thumbUrl}" alt="${escapeAttr(entry.imageName)}" />
      <div>
        <div class="history-meta">${escapeHtml(timeStr)} · ${escapeHtml(entry.platform)} · ${escapeHtml(entry.result?.model || '')}</div>
        <div class="history-preview">${escapeHtml(firstCopy?.headline || firstCopy?.body || '無標題')}</div>
      </div>
      <div class="history-actions">
        <button type="button" class="btn btn-xs btn-outline restore-btn">載入檢視</button>
        <button type="button" class="btn btn-xs btn-ghost-danger delete-btn">刪除</button>
      </div>
    `;

    row.querySelector('.restore-btn').addEventListener('click', () => {
      state.result = entry.result;
      renderResults(entry.result);
      closeHistoryModal();
      showToast('已載入歷史文案');
    });

    row.querySelector('.delete-btn').addEventListener('click', () => {
      saveHistory(state.history.filter((h) => h.id !== entry.id));
      renderHistoryModal();
    });

    els.historyList.appendChild(row);
  });
}

function exportAsMarkdown() {
  if (!state.result) return;
  const lines = [
    `# 圖片文案生成結果`,
    `- **圖片**：${state.image?.name || '未命名'}`,
    `- **平台 / 語氣**：${state.platform} / ${state.tone}`,
    `- **模型**：${state.result.provider} (${state.result.model})`,
    '',
    `## 視覺解讀`,
    `- **畫面主體**：${state.result.imageAnalysis.subject}`,
    `- **氛圍與色調**：${state.result.imageAnalysis.mood}`,
    `- **亮點**：${(state.result.imageAnalysis.highlights || []).join('、')}`,
    '',
  ];

  state.result.copies.forEach((c, i) => {
    lines.push(`## 版本 ${i + 1}：${c.angle}`);
    if (c.headline) lines.push(`**${c.headline}**`, '');
    if (c.body) lines.push(c.body, '');
    if (c.cta) lines.push(`> ${c.cta}`, '');
    if (c.hashtags?.length) lines.push(c.hashtags.join(' '), '');
  });

  downloadFile(`copywriting-${Date.now()}.md`, lines.join('\n'), 'text/markdown;charset=utf-8');
}

function exportAsJson() {
  if (!state.result) return;
  downloadFile(
    `copywriting-${Date.now()}.json`,
    JSON.stringify({ image: state.image?.name, platform: state.platform, tone: state.tone, ...state.result }, null, 2),
    'application/json;charset=utf-8'
  );
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openSettingsModal() {
  const s = state.settings;
  els.providerSelect.value = s.provider;
  els.geminiKeyInput.value = s.geminiApiKey;
  els.geminiModelInput.value = s.geminiModel;
  els.openaiBaseUrlInput.value = s.openaiBaseUrl;
  els.openaiKeyInput.value = s.openaiApiKey;
  els.openaiModelInput.value = s.openaiModel;
  els.serverGeminiHint.textContent = state.serverHealth.hasServerGeminiKey
    ? '✓ 偵測到本機伺服器 .env 已設定 GEMINI_API_KEY，留空即可直接使用'
    : '';
  els.serverOpenaiHint.textContent = state.serverHealth.hasServerOpenAIKey
    ? '✓ 偵測到本機伺服器 .env 已設定 OPENAI_API_KEY，留空即可直接使用'
    : '';
  syncProviderBoxes();
  els.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  els.settingsModal.classList.add('hidden');
}

function syncProviderBoxes() {
  const p = els.providerSelect.value;
  els.geminiConfigBox.classList.toggle('hidden', p !== 'gemini');
  els.openaiConfigBox.classList.toggle('hidden', p !== 'openai');
  els.demoConfigBox.classList.toggle('hidden', p !== 'demo');
}

function openHistoryModal() {
  renderHistoryModal();
  els.historyModal.classList.remove('hidden');
}

function closeHistoryModal() {
  els.historyModal.classList.add('hidden');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll('"', '&quot;');
}

async function init() {
  setupPillGroup(els.platformGroup, (val) => {
    state.platform = val;
  });
  setupPillGroup(els.toneGroup, (val) => {
    state.tone = val;
  });

  // File picker & Dropzone
  els.dropZone.addEventListener('click', (e) => {
    if (e.target.closest('.preview-container') && !e.target.closest('#replaceImgBtn')) return;
    els.fileInput.click();
  });
  els.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.fileInput.click();
    }
  });
  els.replaceImgBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    els.fileInput.click();
  });
  els.clearImgBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.image = null;
    els.fileInput.value = '';
    renderImagePreview();
  });
  els.fileInput.addEventListener('change', async () => {
    const file = els.fileInput.files?.[0];
    if (file) {
      await processImageFile(file, file.name);
    }
  });

  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('drag-over');
  });
  els.dropZone.addEventListener('dragleave', () => {
    els.dropZone.classList.remove('drag-over');
  });
  els.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processImageFile(file, file.name);
    } else {
      showToast('請拖入有效的圖片檔案');
    }
  });

  // Clipboard paste support
  window.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          await processImageFile(file, `pasted-${Date.now()}.png`);
          showToast('已從剪貼簿貼上圖片');
          break;
        }
      }
    }
  });

  els.loadSampleBtn.addEventListener('click', loadSampleImage);
  els.generateBtn.addEventListener('click', () => generateCopy());
  els.exportMdBtn.addEventListener('click', exportAsMarkdown);
  els.exportJsonBtn.addEventListener('click', exportAsJson);

  // Settings modal events
  els.settingsBtn.addEventListener('click', openSettingsModal);
  els.errorOpenSettings.addEventListener('click', openSettingsModal);
  els.closeSettingsBtn.addEventListener('click', closeSettingsModal);
  els.providerSelect.addEventListener('change', syncProviderBoxes);
  els.saveSettingsBtn.addEventListener('click', () => {
    saveSettings({
      provider: els.providerSelect.value,
      geminiApiKey: els.geminiKeyInput.value.trim(),
      geminiModel: els.geminiModelInput.value.trim() || 'gemini-2.5-flash',
      openaiBaseUrl: els.openaiBaseUrlInput.value.trim() || 'https://api.openai.com/v1',
      openaiApiKey: els.openaiKeyInput.value.trim(),
      openaiModel: els.openaiModelInput.value.trim() || 'gpt-4o-mini',
    });
    updateProviderStatusUI();
    closeSettingsModal();
    showToast('設定已儲存');
  });

  // History modal events
  els.historyBtn.addEventListener('click', openHistoryModal);
  els.closeHistoryBtn.addEventListener('click', closeHistoryModal);
  els.clearHistoryBtn.addEventListener('click', () => {
    saveHistory([]);
    renderHistoryModal();
    showToast('已清空歷史紀錄');
  });

  // Backdrop click close
  [els.settingsModal, els.historyModal].forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  renderHistoryBadge();

  try {
    const healthRes = await fetch('./api/health');
    if (healthRes.ok) {
      const contentType = healthRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        state.serverHealth = await healthRes.json();
        state.hasBackend = true;
      }
    }
  } catch {
    state.hasBackend = false;
  }
  updateProviderStatusUI();
}

init();
