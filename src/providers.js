import {
  PLATFORM_GUIDES,
  TONE_GUIDES,
  buildCopywritingPrompt,
  parseModelJson,
} from './prompts.js';

/**
 * Parse a data URL (data:image/png;base64,...) into mimeType and raw base64.
 * @param {string} dataUrl
 * @returns {{ mimeType: string, base64Data: string, dataUrl: string }}
 */
export function parseImageDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('請提供有效的圖片資料');
  }
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new Error('圖片格式不支援，請上傳 PNG、JPG、WebP 或 GIF 圖片');
  }
  const mimeType = match[1].toLowerCase();
  const base64Data = match[2].replace(/\s+/g, '');
  return {
    mimeType,
    base64Data,
    dataUrl: `data:${mimeType};base64,${base64Data}`,
  };
}

/**
 * Normalize model output into a consistent schema for the frontend.
 * @param {object} raw
 * @param {boolean} includeHashtags
 * @returns {object}
 */
export function normalizeCopyResult(raw, includeHashtags = true) {
  const analysis = raw?.imageAnalysis || {};
  const rawCopies = Array.isArray(raw?.copies) ? raw.copies : [];

  const copies = rawCopies
    .filter((item) => item && (item.body || item.headline))
    .map((item, idx) => {
      const hashtags = includeHashtags && Array.isArray(item.hashtags)
        ? item.hashtags
            .map((tag) => String(tag).trim())
            .filter(Boolean)
            .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
        : [];

      return {
        angle: String(item.angle || `版本 ${idx + 1}`).trim(),
        headline: String(item.headline || '').trim(),
        body: String(item.body || '').trim(),
        cta: String(item.cta || '').trim(),
        hashtags,
      };
    });

  if (copies.length === 0) {
    throw new Error('模型回傳的文案內容為空，請重試');
  }

  return {
    imageAnalysis: {
      subject: String(analysis.subject || '已完成圖片視覺分析').trim(),
      mood: String(analysis.mood || '自然清晰').trim(),
      highlights: Array.isArray(analysis.highlights)
        ? analysis.highlights.map((h) => String(h).trim()).filter(Boolean)
        : [],
    },
    copies,
  };
}

/**
 * Generate copywriting via Google Gemini REST API.
 */
async function generateWithGemini({ image, prompt, apiKey, model }) {
  if (!apiKey) {
    throw new Error('尚未設定 Gemini API Key，請在右上角「API 設定」輸入或切換至「示範模式」');
  }
  const targetModel = (model || 'gemini-2.5-flash').trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: prompt.systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: image.mimeType,
                data: image.base64Data,
              },
            },
            { text: prompt.userPrompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: 'application/json',
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMsg = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API 呼叫失敗：${apiMsg}`);
  }

  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const rawText = parts.map((p) => p.text || '').join('\n').trim();
  return parseModelJson(rawText);
}

/**
 * Generate copywriting via OpenAI or OpenAI-compatible Vision API (OpenAI, OpenRouter, Ollama, LM Studio).
 */
async function generateWithOpenAICompatible({ image, prompt, apiKey, baseUrl, model }) {
  const cleanBase = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  const isLocalEndpoint = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(cleanBase);

  if (!apiKey && !isLocalEndpoint) {
    throw new Error('尚未設定 OpenAI / 相容 API Key，請在「API 設定」輸入或切換至「示範模式」');
  }

  const targetModel = (model || 'gpt-4o-mini').trim();
  const endpoint = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const baseBody = {
    model: targetModel,
    temperature: 0.85,
    messages: [
      { role: 'system', content: prompt.systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt.userPrompt },
          {
            type: 'image_url',
            image_url: { url: image.dataUrl },
          },
        ],
      },
    ],
  };

  let response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...baseBody, response_format: { type: 'json_object' } }),
  });

  // Some OpenAI-compatible servers reject response_format; retry once without it.
  if (response.status === 400) {
    const errPreview = await response.text().catch(() => '');
    if (/response_format/i.test(errPreview)) {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(baseBody),
      });
    } else {
      let msg = errPreview;
      try {
        msg = JSON.parse(errPreview)?.error?.message || errPreview;
      } catch {
        // keep plain text
      }
      throw new Error(`OpenAI 相容 API 呼叫失敗：${msg || 'HTTP 400'}`);
    }
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMsg = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`OpenAI 相容 API 呼叫失敗：${apiMsg}`);
  }

  const rawText = payload?.choices?.[0]?.message?.content || '';
  return parseModelJson(rawText);
}

/**
 * Deterministic local demo generator so users can preview the workflow without an API key.
 */
function generateDemoResult(options, visualMeta = {}) {
  const {
    platform = 'instagram',
    tone = 'friendly',
    length = 'medium',
    variants = 3,
    includeHashtags = true,
    includeEmoji = true,
    extraContext = '',
    language = 'zh-TW',
  } = options;

  const platformLabel = PLATFORM_GUIDES[platform]?.label || '社群貼文';
  const toneLabel = TONE_GUIDES[tone] || '親切自然';
  const topic = extraContext.trim() || '這張圖片捕捉到的質感瞬間';
  const moodHint = visualMeta.moodHint || '自然光影與層次感';
  const resolution = visualMeta.width && visualMeta.height
    ? `${visualMeta.width}×${visualMeta.height}`
    : '高畫質影像';

  const e = (symbol) => (includeEmoji ? `${symbol} ` : '');
  const expand = length === 'long';
  const compact = length === 'short';

  const isEnglish = language === 'en';

  const templates = isEnglish
    ? [
        {
          angle: 'Storytelling Hook',
          headline: `${e('✨')}Captured a moment worth slowing down for.`,
          body: compact
            ? `Sometimes one frame says everything about ${topic}.`
            : `Every detail in this frame reflects ${moodHint}. When it comes to ${topic}, it's the quiet craftsmanship and mood that turn an ordinary scroll into a real pause.${expand ? '\n\nTake a closer look at the textures and composition—this is made for anyone who appreciates intentional living.' : ''}`,
          cta: 'Save this post or share what caught your eye first!',
          hashtags: ['#VisualStory', '#DailyInspiration', '#CuratedMoments', '#Aesthetic'],
        },
        {
          angle: 'Spotlight & Highlights',
          headline: `${e('🔥')}Why everyone is stopping for ${topic}`,
          body: compact
            ? `Clean composition, standout mood—built for ${platformLabel}.`
            : `From the very first glance, the ${moodHint} sets the tone.\n• Crisp focal point with balanced framing\n• Distinct atmosphere tailored for ${platformLabel}\n• Effortless fit for ${topic}`,
          cta: 'Drop a comment if you want the behind-the-scenes details.',
          hashtags: ['#MustSee', '#StyleGuide', '#CreativeDirection', '#Featured'],
        },
        {
          angle: 'Community Question',
          headline: `${e('💬')}Quick question: what mood does this frame give you?`,
          body: compact
            ? `Warm, minimal, or bold? Tell us how ${topic} feels to you.`
            : `We love how ${topic} carries ${moodHint}. Some people see calm focus, others see weekend energy—there's no wrong answer here.`,
          cta: 'Comment 1, 2, or 3 to share your vibe!',
          hashtags: ['#CommunityPick', '#VisualMood', '#ShareYourView', '#DesignTalk'],
        },
      ]
    : [
        {
          angle: '故事共鳴版',
          headline: `${e('✨')}把日常裡最耐看的那一格，留給${topic}`,
          body: compact
            ? `光影剛好的瞬間，不用太多解釋，畫面自己就會說話。`
            : `很多時候打動人的不是繁複的裝飾，而是畫面裡自然流動的${moodHint}。\n\n看著這張呈現「${topic}」的畫面，會讓人不自覺放慢滑手機的速度。${expand ? '\n\n無論是在忙碌的午後，還是想為生活添一點儀式感，這樣的視覺節奏都能帶來剛好的療癒與靈感。真正好的細節，越看越有味道。' : ''}`,
          cta: '你第一眼先注意到畫面裡的哪個角落？留言告訴我！',
          hashtags: ['#視覺靈感', '#生活美學', '#質感日常', '#攝影紀錄', '#好物分享'],
        },
        {
          angle: '亮點吸睛版',
          headline: `${e('⚡')}第一眼就被圈粉！關於「${topic}」的三個細節`,
          body: compact
            ? `俐落構圖＋${moodHint}，這組視覺直接把期待值拉滿。`
            : `整理給正在找靈感的你，這張圖之所以特別抓眼球：\n1. 主體焦點明確，第一秒就抓住視線\n2. ${moodHint}，讓整體氛圍更有記憶點\n3. 非常適合用在「${platformLabel}」做出差異化風格${expand ? '\n\n把「' + topic + '」放進日常場景裡，不需要刻意擺拍，就能展現恰到好處的質感。' : ''}`,
          cta: '先按收藏存起來，下次發「' + platformLabel + '」直接參考！',
          hashtags: ['#亮點整理', '#氛圍感', '#社群靈感', '#細節控', '#推薦清單'],
        },
        {
          angle: '互動提問版',
          headline: `${e('💬')}如果是你，會怎麼形容這張圖的氛圍？`,
          body: compact
            ? `（示範模式預覽）以「${toneLabel}」語氣生成，填入 API Key 即可真實辨識圖片內容！`
            : `有人在這裡看見安靜的質感，也有人感受到滿滿能量。\n\n目前你正在使用的是「離線示範模式」（已讀取圖片規格：${resolution}、${moodHint}）。只要在右上角「API 設定」填入 Gemini 或 OpenAI 相容金鑰，系統就會實際解析圖片中的物件、文字、色彩與場景，為「${topic}」量身產出更精準的${platformLabel}文案！`,
          cta: 'A 療癒系 / B 質感派 / C 行動派，你選哪一個？',
          hashtags: ['#互動話題', '#靈感測試', '#圖文創作', '#AI文案助手'],
        },
      ];

  const count = Math.min(Math.max(Number(variants) || 3, 1), 5);
  const selected = [];
  for (let i = 0; i < count; i += 1) {
    const base = templates[i % templates.length];
    selected.push({
      ...base,
      hashtags: includeHashtags ? base.hashtags : [],
    });
  }

  return {
    imageAnalysis: {
      subject: `示範模式預覽（${resolution}）${extraContext ? `｜關鍵字：${extraContext.trim()}` : ''}`,
      mood: moodHint,
      highlights: [
        `偵測視覺特徵：${moodHint}`,
        `目標平台適配：${platformLabel}`,
        '提示：設定 Gemini / OpenAI API Key 後將啟用真實 AI 看圖解析',
      ],
    },
    copies: selected,
  };
}

/**
 * Main entry point to generate copywriting from an uploaded image.
 */
export async function generateCopyFromImage(params, envKeys = {}) {
  const {
    imageDataUrl,
    provider = 'gemini',
    apiKey = '',
    baseUrl = '',
    model = '',
    options = {},
    visualMeta = {},
  } = params || {};

  const image = parseImageDataUrl(imageDataUrl);
  const includeHashtags = options.includeHashtags !== false;

  if (provider === 'demo') {
    const demoRaw = generateDemoResult(options, visualMeta);
    return {
      provider: 'demo',
      model: 'demo-preview',
      ...normalizeCopyResult(demoRaw, includeHashtags),
    };
  }

  const prompt = buildCopywritingPrompt(options);
  let rawResult;
  let usedModel = model;

  if (provider === 'gemini') {
    const effectiveKey = (apiKey || envKeys.GEMINI_API_KEY || '').trim();
    usedModel = (model || 'gemini-2.5-flash').trim();
    rawResult = await generateWithGemini({
      image,
      prompt,
      apiKey: effectiveKey,
      model: usedModel,
    });
  } else if (provider === 'openai') {
    const effectiveKey = (apiKey || envKeys.OPENAI_API_KEY || '').trim();
    const effectiveBase = (baseUrl || envKeys.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim();
    usedModel = (model || 'gpt-4o-mini').trim();
    rawResult = await generateWithOpenAICompatible({
      image,
      prompt,
      apiKey: effectiveKey,
      baseUrl: effectiveBase,
      model: usedModel,
    });
  } else {
    throw new Error(`不支援的 AI 供應商：${provider}`);
  }

  return {
    provider,
    model: usedModel,
    ...normalizeCopyResult(rawResult, includeHashtags),
  };
}
