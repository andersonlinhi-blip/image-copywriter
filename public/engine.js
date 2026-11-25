export const PLATFORM_GUIDES = {
  instagram: {
    label: 'Instagram 貼文',
    guidance:
      '首句必須有強烈鉤子（Hook）吸引滑動停頓，段落呼吸感強，結尾加入互動引導（如留言、收藏、標記好友），並搭配精準 Hashtags。',
  },
  threads: {
    label: 'Threads 脆文',
    guidance:
      '口語自然、像真人隨手分享想法或生活觀察，篇幅精煉有共鳴或微反差，避免過度廣告感與過多標籤。',
  },
  facebook: {
    label: 'Facebook 粉專',
    guidance:
      '兼顧資訊完整度與社群互動感，可用故事或痛點開場，中段帶出價值，結尾明確 CTA 或提問促進討論。',
  },
  xiaohongshu: {
    label: '小紅書筆記',
    guidance:
      '給出吸睛種草標題（含關鍵字），內文多用短句與視覺化 Emoji 分點整理亮點、體驗感受與適用人群。',
  },
  ecommerce: {
    label: '電商商品頁',
    guidance:
      '聚焦視覺細節轉化為購買理由：核心賣點條列、使用情境描繪、品質/信任感與立即行動誘因。',
  },
  line: {
    label: 'LINE / EDM 推播',
    guidance:
      '前 25 字內點出核心利益或亮點，行動呼籲明確直接，適合手機快速閱讀。',
  },
  general: {
    label: '通用社群文案',
    guidance:
      '根據圖片視覺重點自然組織開頭、主體描述與結尾收束，保持可讀性與吸引力。',
  },
};

export const TONE_GUIDES = {
  friendly: '親切活潑、像朋友推薦',
  professional: '專業質感、可信度高、克制優雅',
  witty: '幽默風趣、有網感與巧妙雙關',
  poetic: '感性細膩、有畫面感與情緒張力',
  minimal: '極簡俐落、字字精準不囉嗦',
  persuasive: '熱情種草、富有感染力與行動推力',
};

export const LENGTH_GUIDES = {
  short: '極簡短版：每組正文約 30–60 字',
  medium: '適中篇幅：每組正文約 90–180 字',
  long: '深度長文：每組正文約 220–380 字',
};

export const LANGUAGE_LABELS = {
  'zh-TW': '繁體中文（台灣慣用語與標點）',
  'zh-HK': '繁體中文（香港書面語/微粵語自然風格）',
  'zh-CN': '簡體中文',
  en: 'English',
  ja: '日本語',
  bilingual: '繁體中文＋英文雙語混搭或對照',
};

/**
 * Build system and user prompts for multimodal image copywriting.
 * @param {object} options
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildCopywritingPrompt(options = {}) {
  const {
    platform = 'instagram',
    tone = 'friendly',
    length = 'medium',
    language = 'zh-TW',
    variants = 3,
    includeHashtags = true,
    includeEmoji = true,
    extraContext = '',
    focusAngle = '',
  } = options;

  const safeVariants = Math.min(Math.max(Number(variants) || 3, 1), 5);
  const platformInfo = PLATFORM_GUIDES[platform] || PLATFORM_GUIDES.general;
  const toneDesc = TONE_GUIDES[tone] || TONE_GUIDES.friendly;
  const lengthDesc = LENGTH_GUIDES[length] || LENGTH_GUIDES.medium;
  const languageDesc = LANGUAGE_LABELS[language] || LANGUAGE_LABELS['zh-TW'];

  const systemPrompt = [
    '你是一位頂尖的品牌視覺行銷與社群文案總監，擅長從圖片的構圖、主體、光影、色調、細節與氛圍中提煉故事與賣點。',
    '你必須只根據圖片中真實可見的元素撰寫文案，切勿編造圖片中沒有出現的具體品牌、價格或規格（除非使用者在補充資訊中明確提供）。',
    '請務必回傳嚴格合法的 JSON 物件，不要包覆 Markdown 以外的多餘前言或解釋。',
  ].join('\n');

  const userLines = [
    '請仔細觀察附上的圖片，並根據以下設定生成文案：',
    `- 目標平台：${platformInfo.label}（${platformInfo.guidance}）`,
    `- 語氣風格：${toneDesc}`,
    `- 篇幅長度：${lengthDesc}`,
    `- 輸出語言：${languageDesc}`,
    `- 生成組數：請提供 ${safeVariants} 組切角明顯不同的文案版本`,
    `- Emoji 使用：${includeEmoji ? '請適度穿插符合語境的 Emoji 增加閱讀節奏' : '請完全不要使用 Emoji'}`,
    `- Hashtags：${includeHashtags ? '每組請提供 4–8 個精準且與圖片內容及平台相符的 Hashtag（不含 # 符號或含 # 皆可，但請統一放在 hashtags 陣列中）' : 'hashtags 請回傳空陣列 []'}`,
  ];

  if (extraContext && extraContext.trim()) {
    userLines.push(`- 使用者補充資訊／關鍵字／品牌背景：${extraContext.trim()}`);
  }
  if (focusAngle && focusAngle.trim()) {
    userLines.push(`- 特別指定切角或微調方向：${focusAngle.trim()}`);
  }

  userLines.push(
    '',
    '請以下列 JSON 格式回傳結果：',
    '{',
    '  "imageAnalysis": {',
    '    "subject": "圖片核心主體與場景簡述",',
    '    "mood": "視覺氛圍與色調感受",',
    '    "highlights": ["視覺亮點1", "視覺亮點2", "視覺亮點3"]',
    '  },',
    '  "copies": [',
    '    {',
    '      "angle": "這組文案的切角名稱（例如：故事共鳴版 / 賣點直擊版 / 輕鬆互動版）",',
    '      "headline": "吸睛標題或首句鉤子",',
    '      "body": "完整文案正文（可用 \\n 分段）",',
    '      "cta": "結尾行動呼籲或提問（若不適用可留空字串）",',
    '      "hashtags": ["#標籤1", "#標籤2"]',
    '    }',
    '  ]',
    '}'
  );

  return {
    systemPrompt,
    userPrompt: userLines.join('\n'),
  };
}

/**
 * Extract JSON object from model text response, tolerating markdown code fences.
 * @param {string} rawText
 * @returns {object}
 */
export function parseModelJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('模型未回傳文字內容');
  }

  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const sliced = candidate.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced);
    }
    throw new Error('無法解析模型回傳的 JSON 格式');
  }
}

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
 * Works identically in Node.js backend and pure-browser static deployments.
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
