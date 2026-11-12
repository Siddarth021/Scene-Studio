const sharp = require('sharp');
const { fal } = require('@fal-ai/client');

function escXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function normalizeInputPng(inputBuffer) {
  return sharp(inputBuffer)
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function applyWatermark(imageBuffer, label = 'SNAPSTUDIO PREVIEW • UNLOCK HD') {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 1024;

  const wmSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-24 ${w / 2} ${h / 2})" opacity="0.28">
      <text x="${w / 2}" y="${h * 0.3}" font-family="Arial,sans-serif" font-size="${Math.round(w * 0.055)}" font-weight="bold" fill="#ffffff" stroke="#0f172a" stroke-width="2" text-anchor="middle">${escXml(label)}</text>
      <text x="${w / 2}" y="${h * 0.55}" font-family="Arial,sans-serif" font-size="${Math.round(w * 0.055)}" font-weight="bold" fill="#ffffff" stroke="#0f172a" stroke-width="2" text-anchor="middle">${escXml(label)}</text>
      <text x="${w / 2}" y="${h * 0.8}" font-family="Arial,sans-serif" font-size="${Math.round(w * 0.055)}" font-weight="bold" fill="#ffffff" stroke="#0f172a" stroke-width="2" text-anchor="middle">${escXml(label)}</text>
    </g>
    <rect x="0" y="${h - 54}" width="${w}" height="54" fill="rgba(15,23,42,0.78)"/>
    <text x="${w / 2}" y="${h - 20}" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">PREVIEW ONLY — ENTER PACK CODE TO DOWNLOAD UNWATERMARKED HD</text>
  </svg>`;

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(wmSvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function generateWithGemini({ normBuffer, prompt, apiKey }) {
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
  const payload = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: 'image/png',
              data: normBuffer.toString('base64')
            }
          },
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT']
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini API returned ${res.status}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline && inline.data) {
      return Buffer.from(inline.data, 'base64');
    }
  }
  throw new Error('Gemini did not return an image part.');
}

async function generateWithFal({ normBuffer, prompt, mode, apiKey }) {
  fal.config({ credentials: apiKey });
  const blob = new Blob([normBuffer], { type: 'image/png' });
  const uploadedUrl = await fal.storage.upload(blob);

  const modelId = mode === 'tryon' ? 'fal-ai/flux-pro/kontext' : 'fal-ai/bria/product-shot';
  const input =
    modelId === 'fal-ai/bria/product-shot'
      ? {
          image_url: uploadedUrl,
          scene_description: prompt,
          placement_type: 'automatic'
        }
      : {
          image_url: uploadedUrl,
          prompt
        };

  const result = await fal.subscribe(modelId, { input });
  const outUrl =
    result?.data?.images?.[0]?.url ||
    result?.data?.image?.url ||
    result?.images?.[0]?.url;

  if (!outUrl) {
    throw new Error(`Fal.ai (${modelId}) returned no image URL.`);
  }
  const imgRes = await fetch(outUrl);
  if (!imgRes.ok) throw new Error('Failed to fetch generated image from Fal.ai');
  return Buffer.from(await imgRes.arrayBuffer());
}

async function generateWithHuggingFaceCutout({ normBuffer, preset, apiKey }) {
  const endpoint = 'https://router.huggingface.co/hf-inference/models/briaai/RMBG-1.4';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'image/png'
      },
      body: normBuffer
    });
  } finally {
    clearTimeout(timer);
  }

  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.ok || !ctype.startsWith('image/')) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg ? msg.slice(0, 140) : `HuggingFace returned ${res.status}`);
  }
  const cutoutBuffer = Buffer.from(await res.arrayBuffer());
  return renderLocalStudioComposite({ normBuffer: cutoutBuffer, preset, isCutout: true });
}

async function renderLocalStudioComposite({ normBuffer, preset, isCutout = false }) {
  const size = 1024;
  const prod = await sharp(normBuffer)
    .resize(620, 620, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  const prodMeta = await sharp(prod).metadata();
  const pw = prodMeta.width || 620;
  const ph = prodMeta.height || 620;
  const left = Math.round((size - pw) / 2);
  const top = Math.round((size - ph) / 2) - 24;

  const isDark = preset.id === 'dark_moody';
  const shadowColor = isDark ? 'rgba(0,0,0,0.65)' : 'rgba(15,23,42,0.28)';
  const podiumColor = isDark ? '#334155' : '#ffffff';

  const bgSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="studioBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${preset.bgTop}"/>
        <stop offset="100%" stop-color="${preset.bgBottom}"/>
      </linearGradient>
      <radialGradient id="spotlight" cx="50%" cy="38%" r="55%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="${isDark ? '0.20' : '0.75'}"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <filter id="blurShadow"><feGaussianBlur stdDeviation="16"/></filter>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#studioBg)"/>
    <rect width="${size}" height="${size}" fill="url(#spotlight)"/>
    <ellipse cx="${size / 2}" cy="${top + ph + 16}" rx="${Math.round(pw * 0.48)}" ry="28" fill="${shadowColor}" filter="url(#blurShadow)"/>
    <rect x="${Math.round(size * 0.14)}" y="${top + ph + 12}" width="${Math.round(size * 0.72)}" height="18" rx="9" fill="${podiumColor}" opacity="${isDark ? '0.25' : '0.7'}"/>
  </svg>`;

  let framedProduct;
  if (isCutout) {
    framedProduct = await sharp(prod).ensureAlpha().png().toBuffer();
  } else {
    // Round product frame subtly for clean studio placement
    const maskSvg = `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${pw}" height="${ph}" rx="28" ry="28" fill="#ffffff"/>
    </svg>`;
    framedProduct = await sharp(prod)
      .ensureAlpha()
      .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  return sharp(Buffer.from(bgSvg))
    .composite([{ input: framedProduct, left, top }])
    .png()
    .toBuffer();
}

async function generateStudioImage({
  inputBuffer,
  afterBuffer = null,
  preset,
  customPrompt = '',
  enginePreference = 'auto',
  settings = {},
  watermarked = false
}) {
  if (afterBuffer) {
    let customFinal = await sharp(afterBuffer)
      .rotate()
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toBuffer();
    if (watermarked) customFinal = await applyWatermark(customFinal);
    return {
      buffer: customFinal,
      engineUsed: 'free-ai-web-upload',
      estimatedCostInr: 0,
      apiWarning: ''
    };
  }

  const normBuffer = await normalizeInputPng(inputBuffer);
  const fullPrompt = customPrompt ? `${preset.prompt} Additional styling note: ${customPrompt}` : preset.prompt;

  const geminiKey = settings.geminiApiKey || '';
  const falKey = settings.falApiKey || '';
  const hfKey = settings.hfApiKey || '';

  let chosen = enginePreference || settings.defaultEngine || 'auto';
  if (chosen === 'auto') {
    if (geminiKey) chosen = 'gemini';
    else if (falKey) chosen = 'fal';
    else if (hfKey) chosen = 'huggingface';
    else chosen = 'local';
  }

  let outputBuffer = null;
  let engineUsed = chosen;
  let estimatedCostInr = 0;
  let apiWarning = '';

  if (chosen === 'gemini') {
    if (!geminiKey) {
      apiWarning = 'No Gemini API key configured; falling back.';
      chosen = falKey ? 'fal' : hfKey ? 'huggingface' : 'local';
    } else {
      try {
        outputBuffer = await generateWithGemini({ normBuffer, prompt: fullPrompt, apiKey: geminiKey });
        engineUsed = 'gemini-2.5-flash-image';
        estimatedCostInr = 0;
      } catch (err) {
        chosen = falKey ? 'fal' : hfKey ? 'huggingface' : 'local';
        apiWarning = `Gemini fallback (${err.message}); used ${chosen}.`;
      }
    }
  }

  if (chosen === 'fal' && !outputBuffer) {
    if (!falKey) {
      apiWarning = 'No Fal.ai API key configured; falling back.';
      chosen = hfKey ? 'huggingface' : 'local';
    } else {
      try {
        outputBuffer = await generateWithFal({ normBuffer, prompt: fullPrompt, mode: preset.mode, apiKey: falKey });
        engineUsed = preset.mode === 'tryon' ? 'fal-flux-pro-kontext' : 'fal-bria-product-shot';
        estimatedCostInr = 3.5;
      } catch (err) {
        chosen = hfKey ? 'huggingface' : 'local';
        apiWarning = `Fal.ai fallback (${err.message}); used ${chosen}.`;
      }
    }
  }

  if (chosen === 'huggingface' && !outputBuffer) {
    if (!hfKey) {
      apiWarning = 'No HuggingFace token configured; used Local Studio Compositor.';
      chosen = 'local';
    } else {
      try {
        outputBuffer = await generateWithHuggingFaceCutout({ normBuffer, preset, apiKey: hfKey });
        engineUsed = 'huggingface-rmbg-studio';
        estimatedCostInr = 0;
      } catch (err) {
        apiWarning = `HuggingFace fallback (${err.message}); used Local Studio Compositor.`;
        chosen = 'local';
      }
    }
  }

  if (!outputBuffer) {
    outputBuffer = await renderLocalStudioComposite({ normBuffer, preset });
    engineUsed = 'local-studio-compositor';
    estimatedCostInr = 0;
  }

  // Ensure crisp 1024x1024 PNG output
  let finalBuffer = await sharp(outputBuffer)
    .resize(1024, 1024, { fit: 'cover' })
    .png()
    .toBuffer();

  if (watermarked) {
    finalBuffer = await applyWatermark(finalBuffer);
  }

  return {
    buffer: finalBuffer,
    engineUsed,
    estimatedCostInr,
    apiWarning
  };
}

module.exports = {
  generateStudioImage,
  applyWatermark,
  normalizeInputPng
};

