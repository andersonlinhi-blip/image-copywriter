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
