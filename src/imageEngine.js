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

async function detectIsCutout(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.hasAlpha) return false;
    const stats = await sharp(buffer).stats();
    return stats.channels[3] && stats.channels[3].min < 200;
  } catch {
    return false;
  }
}

async function createGroundReflection(productBuffer, width, height, maxReflectionH = 100, opacity = 0.22) {
  const refH = Math.min(Math.round(height * 0.25), maxReflectionH);
  if (refH <= 8) return null;
  const flipped = await sharp(productBuffer)
    .flip()
    .resize(width, refH, { fit: 'fill' })
    .blur(2.5)
    .toBuffer();

  const fadeMask = Buffer.from(
    `<svg width="${width}" height="${refH}">
       <defs>
         <linearGradient id="refFade" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stop-color="#ffffff" stop-opacity="${opacity}"/>
           <stop offset="65%" stop-color="#ffffff" stop-opacity="${opacity * 0.25}"/>
           <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
         </linearGradient>
       </defs>
       <rect width="${width}" height="${refH}" fill="url(#refFade)"/>
     </svg>`
  );

  return sharp(flipped)
    .composite([{ input: fadeMask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function buildStudioBackdropSvg({ size, preset, pw, ph, left, top, baseY, isCutout }) {
  const isDark = preset.id === 'dark_moody';
  const isWhite = preset.id === 'amazon_white';
  const isMarble = preset.id === 'marble_luxury';
  const isSunlight = preset.id === 'sunlight_lifestyle';
  const isFestive = preset.id === 'festive_indian';

  // 1. Amazon Pure White Standard (#FFFFFF)
  if (isWhite) {
    return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="softbox" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="85%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#f8fafc"/>
        </radialGradient>
        <filter id="tightBlur"><feGaussianBlur stdDeviation="3.5"/></filter>
        <filter id="midBlur"><feGaussianBlur stdDeviation="14"/></filter>
        <filter id="wideBlur"><feGaussianBlur stdDeviation="28"/></filter>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#softbox)"/>
      <ellipse cx="${size / 2}" cy="${baseY}" rx="${Math.round(pw * 0.38)}" ry="7" fill="rgba(15,23,42,0.65)" filter="url(#tightBlur)"/>
      <ellipse cx="${size / 2}" cy="${baseY + 5}" rx="${Math.round(pw * 0.46)}" ry="16" fill="rgba(30,41,59,0.20)" filter="url(#midBlur)"/>
      <ellipse cx="${size / 2}" cy="${baseY + 12}" rx="${Math.round(pw * 0.54)}" ry="32" fill="rgba(71,85,105,0.08)" filter="url(#wideBlur)"/>
    </svg>`;
  }

  // Common 3D Podium Geometry
  const podiumTopY = baseY + 10;
  const podiumRx = Math.max(Math.round(pw * 0.62), 340);
  const podiumRy = Math.round(podiumRx * 0.19);
  const podiumHeight = 100;
  const podiumBotY = podiumTopY + podiumHeight;
  const cx = size / 2;

  let bgGradientDefs = '';
  let wallDecorSvg = '';
  let tightShadowColor = isDark ? 'rgba(0,0,0,0.92)' : 'rgba(15,23,42,0.85)';
  let midShadowColor = isDark ? 'rgba(0,0,0,0.60)' : 'rgba(28,25,23,0.38)';
  let castShadowColor = isDark ? 'rgba(0,0,0,0.40)' : 'rgba(45,35,28,0.22)';
  let podiumShadowColor = isDark ? 'rgba(0,0,0,0.70)' : 'rgba(15,23,42,0.32)';

  if (isMarble) {
    bgGradientDefs = `
      <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fdfbf9"/>
        <stop offset="60%" stop-color="#f5efe6"/>
        <stop offset="100%" stop-color="#ebe0d2"/>
      </linearGradient>
      <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ebe0d2"/>
        <stop offset="100%" stop-color="#dfd3c3"/>
      </linearGradient>
      <linearGradient id="podiumTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="50%" stop-color="#fcfbf9"/>
        <stop offset="100%" stop-color="#f2ebe1"/>
      </linearGradient>
      <linearGradient id="cylinder" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#d6cbbe"/>
        <stop offset="25%" stop-color="#fbf9f6"/>
        <stop offset="70%" stop-color="#e5dcd0"/>
        <stop offset="100%" stop-color="#cfc3b4"/>
      </linearGradient>
      <linearGradient id="rimLightGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#d6cbbe" stop-opacity="0.1"/>
      </linearGradient>
    `;
    wallDecorSvg = `
      <g filter="url(#botanicalBlur)" opacity="0.12" fill="#475569">
        <path d="M780,80 Q850,140 920,200 Q980,260 900,320 Q840,240 760,180 Z"/>
        <path d="M840,160 Q910,190 960,230 Q910,260 850,220 Z"/>
        <path d="M740,200 Q800,240 850,300 Q800,330 750,270 Z"/>
        <circle cx="890" cy="210" r="30"/>
        <circle cx="820" cy="270" r="25"/>
      </g>
      <g opacity="0.22" stroke="#b0a293" stroke-width="1.8" fill="none">
        <path d="M${cx - podiumRx * 0.7},${podiumTopY - podiumRy * 0.2} Q${cx - podiumRx * 0.3},${podiumTopY + podiumRy * 0.4} ${cx + podiumRx * 0.2},${podiumTopY - podiumRy * 0.1} T${cx + podiumRx * 0.75},${podiumTopY + podiumRy * 0.3}"/>
        <path d="M${cx - podiumRx * 0.4},${podiumTopY + podiumRy * 0.1} Q${cx},${podiumTopY - podiumRy * 0.3} ${cx + podiumRx * 0.5},${podiumTopY + podiumRy * 0.2}" stroke-width="1.2" opacity="0.15"/>
      </g>
    `;
  } else if (isSunlight) {
    bgGradientDefs = `
      <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fdfbf7"/>
        <stop offset="60%" stop-color="#fbf2e3"/>
        <stop offset="100%" stop-color="#f2dfc6"/>
      </linearGradient>
      <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f2dfc6"/>
        <stop offset="100%" stop-color="#e3cbac"/>
      </linearGradient>
      <linearGradient id="podiumTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff8ed"/>
        <stop offset="60%" stop-color="#faebd7"/>
        <stop offset="100%" stop-color="#ebd5be"/>
      </linearGradient>
      <linearGradient id="cylinder" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#dfcaaF"/>
        <stop offset="28%" stop-color="#fff6ea"/>
        <stop offset="75%" stop-color="#ebd2b5"/>
        <stop offset="100%" stop-color="#cfb495"/>
      </linearGradient>
      <linearGradient id="rimLightGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="60%" stop-color="#fef3c7" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#d97706" stop-opacity="0.1"/>
      </linearGradient>
    `;
    wallDecorSvg = `
      <g transform="rotate(-22 ${cx} ${baseY - 100})" opacity="0.18">
        <rect x="100" y="80" width="800" height="42" rx="12" fill="#ffffff" filter="url(#sunGlow)"/>
        <rect x="80" y="160" width="850" height="48" rx="12" fill="#ffffff" filter="url(#sunGlow)"/>
        <rect x="60" y="248" width="900" height="52" rx="12" fill="#ffffff" filter="url(#sunGlow)"/>
        <rect x="40" y="340" width="950" height="56" rx="12" fill="#ffffff" filter="url(#sunGlow)"/>
      </g>
    `;
  } else if (isDark) {
    bgGradientDefs = `
      <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#070a12"/>
      </linearGradient>
      <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#070a12"/>
        <stop offset="100%" stop-color="#020306"/>
      </linearGradient>
      <linearGradient id="podiumTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#334155"/>
        <stop offset="60%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <linearGradient id="cylinder" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="25%" stop-color="#475569"/>
        <stop offset="70%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
      <linearGradient id="rimLightGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="45%" stop-color="#94a3b8" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#334155" stop-opacity="0.05"/>
      </linearGradient>
    `;
  } else if (isFestive) {
    bgGradientDefs = `
      <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b0819"/>
        <stop offset="55%" stop-color="#581028"/>
        <stop offset="100%" stop-color="#2d0513"/>
      </linearGradient>
      <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2d0513"/>
        <stop offset="100%" stop-color="#1a020a"/>
      </linearGradient>
      <linearGradient id="podiumTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="40%" stop-color="#eab308"/>
        <stop offset="100%" stop-color="#a16207"/>
      </linearGradient>
      <linearGradient id="cylinder" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="25%" stop-color="#fde047"/>
        <stop offset="65%" stop-color="#ca8a04"/>
        <stop offset="100%" stop-color="#451a03"/>
      </linearGradient>
      <linearGradient id="rimLightGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="#fef08a" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="#b45309" stop-opacity="0.1"/>
      </linearGradient>
    `;
    wallDecorSvg = `
      <g filter="url(#bokehBlur)" opacity="0.38">
        <circle cx="160" cy="180" r="38" fill="#fde047"/>
        <circle cx="280" cy="240" r="24" fill="#fbbf24"/>
        <circle cx="840" cy="160" r="44" fill="#fde047"/>
        <circle cx="920" cy="260" r="28" fill="#f59e0b"/>
        <circle cx="780" cy="290" r="32" fill="#fbbf24"/>
        <circle cx="200" cy="340" r="26" fill="#f59e0b"/>
      </g>
    `;
    tightShadowColor = 'rgba(26,2,10,0.88)';
    midShadowColor = 'rgba(45,5,19,0.48)';
    castShadowColor = 'rgba(69,26,3,0.30)';
  } else {
    // Pastel Studio or General Studio Default
    const topCol = preset.bgTop || '#eef2ff';
    const botCol = preset.bgBottom || '#c7d2fe';
    bgGradientDefs = `
      <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${topCol}"/>
        <stop offset="100%" stop-color="${botCol}"/>
      </linearGradient>
      <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${botCol}"/>
        <stop offset="100%" stop-color="#94a3b8"/>
      </linearGradient>
      <linearGradient id="podiumTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="60%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
      <linearGradient id="cylinder" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#cbd5e1"/>
        <stop offset="26%" stop-color="#ffffff"/>
        <stop offset="70%" stop-color="#e2e8f0"/>
        <stop offset="100%" stop-color="#94a3b8"/>
      </linearGradient>
      <linearGradient id="rimLightGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#cbd5e1" stop-opacity="0.1"/>
      </linearGradient>
    `;
  }

  const floorHorizonY = Math.round(size * 0.63);

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${bgGradientDefs}
      <radialGradient id="keySpotlight" cx="36%" cy="28%" r="68%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="${isDark ? '0.24' : '0.65'}"/>
        <stop offset="55%" stop-color="#ffffff" stop-opacity="${isDark ? '0.06' : '0.15'}"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
        <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="${isDark ? '0.45' : '0.15'}"/>
      </radialGradient>
      <filter id="tightBlur"><feGaussianBlur stdDeviation="3.5"/></filter>
      <filter id="midBlur"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="wideBlur"><feGaussianBlur stdDeviation="30"/></filter>
      <filter id="podiumBlur"><feGaussianBlur stdDeviation="22"/></filter>
      <filter id="botanicalBlur"><feGaussianBlur stdDeviation="26"/></filter>
      <filter id="sunGlow"><feGaussianBlur stdDeviation="16"/></filter>
      <filter id="bokehBlur"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>

    <!-- Studio Wall & Seamless Floor Horizon -->
    <rect width="${size}" height="${floorHorizonY}" fill="url(#wallGrad)"/>
    <rect y="${floorHorizonY}" width="${size}" height="${size - floorHorizonY}" fill="url(#floorGrad)"/>
    
    <!-- Directional Key Spotlight & Edge Vignette -->
    <rect width="${size}" height="${size}" fill="url(#keySpotlight)"/>
    ${wallDecorSvg}
    <rect width="${size}" height="${size}" fill="url(#vignette)"/>

    <!-- 3D Studio Podium Platform -->
    <!-- Base Shadow Under Podium -->
    <ellipse cx="${cx}" cy="${podiumBotY + 12}" rx="${Math.round(podiumRx * 1.05)}" ry="${Math.round(podiumRy * 0.95)}" fill="${podiumShadowColor}" filter="url(#podiumBlur)"/>
    
    <!-- Cylinder Body (Front Wall) -->
    <path d="M ${cx - podiumRx},${podiumTopY} A ${podiumRx},${podiumRy} 0 0,0 ${cx + podiumRx},${podiumTopY} L ${cx + podiumRx},${podiumBotY} A ${podiumRx},${podiumRy} 0 0,1 ${cx - podiumRx},${podiumBotY} Z" fill="url(#cylinder)"/>
    
    <!-- Podium Top Surface -->
    <ellipse cx="${cx}" cy="${podiumTopY}" rx="${podiumRx}" ry="${podiumRy}" fill="url(#podiumTop)"/>
    
    <!-- Specular Rim Light on Podium Top Edge -->
    <path d="M ${cx - podiumRx},${podiumTopY} A ${podiumRx},${podiumRy} 0 0,1 ${cx + podiumRx},${podiumTopY}" fill="none" stroke="url(#rimLightGrad)" stroke-width="2.6"/>

    <!-- Multi-Pass Product Contact & Ambient Occlusion Shadows -->
    <!-- Pass 1: Tight Contact Shadow (Ambient Occlusion) -->
    <ellipse cx="${cx}" cy="${baseY - 1}" rx="${Math.round(pw * 0.38)}" ry="8" fill="${tightShadowColor}" filter="url(#tightBlur)"/>
    <!-- Pass 2: Mid Occlusion Penumbra -->
    <ellipse cx="${cx + 6}" cy="${baseY + 6}" rx="${Math.round(pw * 0.44)}" ry="18" fill="${midShadowColor}" filter="url(#midBlur)"/>
    <!-- Pass 3: Soft Directional Cast Shadow -->
    <ellipse cx="${cx + 18}" cy="${baseY + 14}" rx="${Math.round(pw * 0.50)}" ry="34" fill="${castShadowColor}" filter="url(#wideBlur)"/>
  </svg>`;
}

async function renderLocalStudioComposite({ normBuffer, preset, isCutout = false }) {
  const size = 1024;
  const isAlphaCutout = isCutout || (await detectIsCutout(normBuffer));

  // Scale product to fit naturally inside studio frame
  const maxDim = isAlphaCutout ? 640 : 620;
  const prod = await sharp(normBuffer)
    .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();

  const prodMeta = await sharp(prod).metadata();
  const pw = prodMeta.width || 620;
  const ph = prodMeta.height || 620;
  const left = Math.round((size - pw) / 2);

  // Position product baseline at ~68% height
  let baseY = Math.round(size * 0.68);
  let top = baseY - ph;
  if (top < 60) {
    top = 60;
    baseY = top + ph;
  }

  const bgSvg = buildStudioBackdropSvg({ size, preset, pw, ph, left, top, baseY, isCutout: isAlphaCutout });

  const composites = [];

  let framedProduct;
  if (isAlphaCutout) {
    framedProduct = await sharp(prod).ensureAlpha().png().toBuffer();

    // On reflective studio surfaces (Marble Luxury or Dark Moody), add ground reflection
    if (preset.id === 'marble_luxury' || preset.id === 'dark_moody') {
      const refOpacity = preset.id === 'dark_moody' ? 0.14 : 0.20;
      const ref = await createGroundReflection(framedProduct, pw, ph, 90, refOpacity);
      if (ref) {
        composites.push({ input: ref, left, top: baseY - 4 });
      }
    }
  } else {
    // Elegant studio presentation frame with rounded corners and fine specular border
    const frameMask = `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${pw}" height="${ph}" rx="20" ry="20" fill="#ffffff"/>
    </svg>`;
    const roundedProd = await sharp(prod)
      .ensureAlpha()
      .composite([{ input: Buffer.from(frameMask), blend: 'dest-in' }])
      .png()
      .toBuffer();

    const borderSvg = `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${pw}" height="${ph}" rx="20" ry="20" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>
    </svg>`;
    framedProduct = await sharp(roundedProd)
      .composite([{ input: Buffer.from(borderSvg) }])
      .png()
      .toBuffer();
  }

  composites.push({ input: framedProduct, left, top });

  return sharp(Buffer.from(bgSvg))
    .composite(composites)
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
  normalizeInputPng,
  renderLocalStudioComposite
};

