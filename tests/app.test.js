import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCopywritingPrompt, parseModelJson } from '../src/prompts.js';
import { parseImageDataUrl, normalizeCopyResult, generateCopyFromImage } from '../src/providers.js';
import { createAppServer } from '../server.js';

const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('buildCopywritingPrompt includes platform, tone, context and clamps variants', () => {
  const { systemPrompt, userPrompt } = buildCopywritingPrompt({
    platform: 'threads',
    tone: 'witty',
    length: 'short',
    language: 'zh-TW',
    variants: 9,
    includeHashtags: false,
    includeEmoji: false,
    extraContext: '新上市檸檬氣泡咖啡',
  });

  assert.match(systemPrompt, /品牌視覺行銷/);
  assert.match(userPrompt, /Threads 脆文/);
  assert.match(userPrompt, /幽默風趣/);
  assert.match(userPrompt, /請提供 5 組/);
  assert.match(userPrompt, /完全不要使用 Emoji/);
  assert.match(userPrompt, /hashtags 請回傳空陣列/);
  assert.match(userPrompt, /新上市檸檬氣泡咖啡/);
});

test('parseModelJson handles plain JSON, markdown fenced JSON, and rejects invalid text', () => {
  const fenced = '```json\n{"imageAnalysis":{"subject":"杯子"},"copies":[{"body":"測試"}]}\n```';
  const parsed = parseModelJson(fenced);
  assert.equal(parsed.imageAnalysis.subject, '杯子');
  assert.equal(parsed.copies[0].body, '測試');

  const wrapped = '好的，結果如下：{"copies":[{"body":"內容"}]} 以上。';
  assert.equal(parseModelJson(wrapped).copies[0].body, '內容');

  assert.throws(() => parseModelJson('not json at all'), /無法解析/);
});

test('parseImageDataUrl validates supported image data URLs', () => {
  const parsed = parseImageDataUrl(SAMPLE_PNG_DATA_URL);
  assert.equal(parsed.mimeType, 'image/png');
  assert.ok(parsed.base64Data.length > 10);

  assert.throws(() => parseImageDataUrl('https://example.com/a.png'), /格式不支援/);
  assert.throws(() => parseImageDataUrl(''), /有效的圖片資料/);
});

test('normalizeCopyResult prefixes # on hashtags and strips hashtags when disabled', () => {
  const raw = {
    imageAnalysis: { subject: '拿鐵咖啡', mood: '溫暖', highlights: ['拉花'] },
    copies: [
      { angle: '故事版', headline: '早安', body: '一杯拿鐵', cta: '來喝一杯', hashtags: ['咖啡', '#日常'] },
    ],
  };

  const withTags = normalizeCopyResult(raw, true);
  assert.deepEqual(withTags.copies[0].hashtags, ['#咖啡', '#日常']);

  const withoutTags = normalizeCopyResult(raw, false);
  assert.deepEqual(withoutTags.copies[0].hashtags, []);
});

test('generateCopyFromImage works with Gemini and OpenAI-compatible providers via mocked fetch', async () => {
  const originalFetch = globalThis.fetch;

  try {
    // Mock Gemini response
    globalThis.fetch = async (url, init) => {
      assert.match(url, /generativelanguage\.googleapis\.com/);
      assert.equal(init.headers['x-goog-api-key'], 'test-gemini-key');
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      imageAnalysis: { subject: '手沖咖啡', mood: '溫馨', highlights: ['木質桌面'] },
                      copies: [{ angle: '品牌故事', headline: '早晨第一杯', body: '細緻香氣', cta: '立即品嚐', hashtags: ['手沖'] }],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const geminiOut = await generateCopyFromImage({
      imageDataUrl: SAMPLE_PNG_DATA_URL,
      provider: 'gemini',
      apiKey: 'test-gemini-key',
      model: 'gemini-2.5-flash',
      options: { variants: 1 },
    });
    assert.equal(geminiOut.provider, 'gemini');
    assert.equal(geminiOut.copies[0].hashtags[0], '#手沖');

    // Mock OpenAI-compatible response
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://mock-llm.local/v1/chat/completions');
      assert.equal(init.headers.Authorization, 'Bearer test-openai-key');
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  imageAnalysis: { subject: '極簡海報', mood: '俐落', highlights: ['高對比'] },
                  copies: [{ angle: '亮點版', headline: '焦點鎖定', body: '質感滿分', cta: '', hashtags: ['#設計'] }],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const openaiOut = await generateCopyFromImage({
      imageDataUrl: SAMPLE_PNG_DATA_URL,
      provider: 'openai',
      apiKey: 'test-openai-key',
      baseUrl: 'https://mock-llm.local/v1',
      model: 'gpt-4o-mini',
      options: { variants: 1 },
    });
    assert.equal(openaiOut.provider, 'openai');
    assert.equal(openaiOut.imageAnalysis.subject, '極簡海報');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('HTTP server serves UI, health check, demo generation, and validates bad requests', async () => {
  const server = createAppServer({ GEMINI_API_KEY: 'env-key-present', OPENAI_API_KEY: '' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ok, true);
    assert.equal(health.hasServerGeminiKey, true);
    assert.equal(health.hasServerOpenAIKey, false);

    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /圖文靈感工坊/);

    const demoRes = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: SAMPLE_PNG_DATA_URL,
        provider: 'demo',
        visualMeta: { width: 800, height: 600, moodHint: '明亮通透的暖色調' },
        options: {
          platform: 'instagram',
          tone: 'friendly',
          variants: 3,
          includeHashtags: true,
          extraContext: '精品手沖咖啡',
        },
      }),
    });
    assert.equal(demoRes.status, 200);
    const demoData = await demoRes.json();
    assert.equal(demoData.provider, 'demo');
    assert.equal(demoData.copies.length, 3);
    assert.match(demoData.copies[0].headline, /精品手沖咖啡/);

    const badRes = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: 'invalid-data', provider: 'demo' }),
    });
    assert.equal(badRes.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
