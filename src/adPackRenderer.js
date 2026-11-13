const sharp = require('sharp');
const { applyWatermark } = require('./imageEngine');

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeColor(hex, fallback = '#0f766e') {
  const c = String(hex || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
}

async function renderSquareAdPost({ studioBuffer, brandName, productName, priceText, discountBadge, ctaText, accentColor }) {
  const size = 1080;
  const accent = safeColor(accentColor, '#0f766e');
  const brand = esc((brandName || 'STUDIO BRAND').toUpperCase().slice(0, 26));
  const title = esc((productName || 'Bestselling Studio Edition').slice(0, 32));
  const price = esc((priceText || '₹499').slice(0, 16));
  const badge = esc((discountBadge || 'LIMITED EDITION').slice(0, 22));
  const cta = esc((ctaText || 'ORDER ON WHATSAPP').slice(0, 26));

  const heroW = 960;
  const heroH = 690;
  const heroX = 60;
  const heroY = 120;

  const hero = await sharp(studioBuffer).resize(heroW, heroH, { fit: 'cover' }).png().toBuffer();
  const mask = `<svg width="${heroW}" height="${heroH}"><rect x="0" y="0" width="${heroW}" height="${heroH}" rx="24" ry="24" fill="#ffffff"/></svg>`;
  const roundedHero = await sharp(hero).ensureAlpha().composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toBuffer();

  const canvasSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="60%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#f1f5f9"/>
      </linearGradient>
      <filter id="heroShadow"><feGaussianBlur stdDeviation="18"/><feColorMatrix type="matrix" values="0 0 0 0 0.05 0 0 0 0 0.08 0 0 0 0 0.15 0 0 0 0.16 0"/></filter>
      <filter id="cardShadow"><feGaussianBlur stdDeviation="12"/><feColorMatrix type="matrix" values="0 0 0 0 0.05 0 0 0 0 0.08 0 0 0 0 0.15 0 0 0 0.10 0"/></filter>
    </defs>

    <!-- Canvas Background -->
    <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>
    <rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="#e2e8f0" stroke-width="2"/>

    <!-- Top Brand & Header Bar -->
    <rect x="60" y="38" width="8" height="8" rx="4" fill="${accent}"/>
    <text x="78" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="#64748b" letter-spacing="1.5">OFFICIAL D2C BRAND</text>
    <text x="60" y="86" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="30" font-weight="900" fill="#0f172a" letter-spacing="2">${brand}</text>

    <!-- Urgency Badge Pill -->
    <rect x="${size - 360}" y="42" width="300" height="46" rx="23" fill="${accent}"/>
    <text x="${size - 210}" y="72" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1">⚡ ${badge}</text>

    <!-- Drop Shadow for Hero Image -->
    <rect x="${heroX + 4}" y="${heroY + 8}" width="${heroW}" height="${heroH}" rx="24" fill="#000000" filter="url(#heroShadow)"/>

    <!-- Bottom Action & Conversion Card -->
    <!-- Card Drop Shadow -->
    <rect x="62" y="854" width="956" height="176" rx="24" fill="#000000" filter="url(#cardShadow)"/>
    <!-- Card Body -->
    <rect x="60" y="846" width="960" height="180" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>

    <!-- Product Title & Details -->
    <text x="96" y="888" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="${accent}" letter-spacing="2">HANDCRAFTED PREMIUM EDITION</text>
    <text x="96" y="930" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="32" font-weight="900" fill="#0f172a">${title}</text>
    <text x="96" y="970" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="17" font-weight="500" fill="#475569">🚚 Express Delivery • Cash on Delivery • 100% Genuine Guarantee</text>
    <text x="96" y="998" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="#10b981">★ 4.9/5 Rating (2,400+ Verified Buyers)</text>

    <!-- Price & CTA Box on Right -->
    <rect x="710" y="862" width="290" height="148" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
    <text x="855" y="906" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="36" font-weight="900" fill="#0f172a" text-anchor="middle">${price}</text>
    <rect x="726" y="924" width="258" height="66" rx="33" fill="${accent}"/>
    <text x="855" y="965" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1">${cta} →</text>
  </svg>`;

  return sharp(Buffer.from(canvasSvg))
    .composite([
      { input: roundedHero, left: heroX, top: heroY }
    ])
    .png()
    .toBuffer();
}

async function renderStoryAd({ studioBuffer, brandName, productName, priceText, discountBadge, ctaText, accentColor }) {
  const w = 1080;
  const h = 1920;
  const accent = safeColor(accentColor, '#0f766e');
  const brand = esc((brandName || 'LIMITED DROP').toUpperCase().slice(0, 24));
  const title = esc((productName || 'Handcrafted Collection').slice(0, 30));
  const price = esc((priceText || '₹499').slice(0, 16));
  const badge = esc((discountBadge || 'LIMITED DROP').slice(0, 22));
  const cta = esc((ctaText || 'TAP TO ORDER ON WHATSAPP').slice(0, 30));

  const heroW = 940;
  const heroH = 1020;
  const heroX = 70;
  const heroY = 360;

  const hero = await sharp(studioBuffer).resize(heroW, heroH, { fit: 'cover' }).png().toBuffer();
  const mask = `<svg width="${heroW}" height="${heroH}"><rect x="0" y="0" width="${heroW}" height="${heroH}" rx="32" ry="32" fill="#ffffff"/></svg>`;
  const roundedHero = await sharp(hero).ensureAlpha().composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toBuffer();

  const canvasSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="storyBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="35%" stop-color="#0f172a"/>
        <stop offset="75%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
      <radialGradient id="centerGlow" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <filter id="heroShadowStory"><feGaussianBlur stdDeviation="24"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.45 0"/></filter>
      <filter id="cardShadowStory"><feGaussianBlur stdDeviation="16"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0"/></filter>
    </defs>

    <!-- Canvas Background -->
    <rect width="${w}" height="${h}" fill="url(#storyBg)"/>
    <rect width="${w}" height="${h}" fill="url(#centerGlow)"/>

    <!-- Story Safe Top Zone & Header -->
    <rect x="340" y="180" width="400" height="52" rx="26" fill="${accent}"/>
    <text x="540" y="213" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="2">⚡ ${badge}</text>
    
    <text x="540" y="295" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="48" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="3">${brand}</text>
    <text x="540" y="340" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="#94a3b8" text-anchor="middle">${title}</text>

    <!-- Hero Image Shadow -->
    <rect x="${heroX}" y="${heroY + 12}" width="${heroW}" height="${heroH}" rx="32" fill="#000000" filter="url(#heroShadowStory)"/>

    <!-- Trust Feature Badges Bar -->
    <g transform="translate(70, 1406)">
      <rect x="0" y="0" width="296" height="52" rx="26" fill="rgba(30,41,59,0.9)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <text x="148" y="33" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#ffffff" text-anchor="middle">✓ 100% Genuine</text>

      <rect x="322" y="0" width="296" height="52" rx="26" fill="rgba(30,41,59,0.9)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <text x="470" y="33" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#ffffff" text-anchor="middle">✓ Fast 48h Dispatch</text>

      <rect x="644" y="0" width="296" height="52" rx="26" fill="rgba(30,41,59,0.9)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <text x="792" y="33" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#ffffff" text-anchor="middle">✓ Cash on Delivery</text>
    </g>

    <!-- Pricing Glass Card -->
    <rect x="70" y="1484" width="940" height="136" rx="28" fill="#ffffff" filter="url(#cardShadowStory)"/>
    <text x="120" y="1542" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="32" font-weight="900" fill="#0f172a">Special Direct Launch Price</text>
    <text x="120" y="1584" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="22" font-weight="500" fill="#475569">Direct Artisan Workshop • Zero Middleman Markup</text>
    
    <rect x="720" y="1506" width="260" height="92" rx="20" fill="${accent}"/>
    <text x="850" y="1568" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle">${price}</text>

    <!-- Tap CTA Button -->
    <rect x="70" y="1650" width="940" height="106" rx="53" fill="${accent}"/>
    <text x="540" y="1716" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="30" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">${cta} 👆</text>
  </svg>`;

  return sharp(Buffer.from(canvasSvg))
    .composite([
      { input: roundedHero, left: heroX, top: heroY }
    ])
    .png()
    .toBuffer();
}

async function renderMarketplaceClean({ studioBuffer }) {
  const size = 1080;
  // Amazon/Flipkart/Meesho requirement: 100% pure white background (#ffffff)
  // Centered with high-end commercial softbox contact shadow underneath
  const heroSize = 880;
  const hero = await sharp(studioBuffer)
    .resize(heroSize, heroSize, { fit: 'contain', background: '#ffffff' })
    .png()
    .toBuffer();

  const shadowSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="mkTightBlur"><feGaussianBlur stdDeviation="3.5"/></filter>
      <filter id="mkMidBlur"><feGaussianBlur stdDeviation="16"/></filter>
      <filter id="mkSoftBlur"><feGaussianBlur stdDeviation="36"/></filter>
    </defs>
    <rect width="${size}" height="${size}" fill="#ffffff"/>
    <!-- Commercial Lightbox Softbox Shadows -->
    <ellipse cx="540" cy="940" rx="340" ry="8" fill="rgba(15,23,42,0.48)" filter="url(#mkTightBlur)"/>
    <ellipse cx="540" cy="946" rx="420" ry="22" fill="rgba(30,41,59,0.18)" filter="url(#mkMidBlur)"/>
    <ellipse cx="540" cy="956" rx="490" ry="46" fill="rgba(71,85,105,0.08)" filter="url(#mkSoftBlur)"/>
  </svg>`;

  return sharp(Buffer.from(shadowSvg))
    .composite([{ input: hero, left: 100, top: 70 }])
    .png()
    .toBuffer();
}

async function renderBeforeAfterCard({ rawBuffer, studioBuffer, productName, brandName = 'SnapStudio' }) {
  const w = 1400;
  const h = 760;
  const brand = esc(brandName.toUpperCase());
  const title = esc((productName || 'Product Transformation').slice(0, 36));

  const cardW = 604;
  const cardH = 504;
  const leftX = 64;
  const rightX = 732;
  const cardY = 144;

  const leftImg = await sharp(rawBuffer).resize(cardW, cardH, { fit: 'cover' }).png().toBuffer();
  const rightImg = await sharp(studioBuffer).resize(cardW, cardH, { fit: 'cover' }).png().toBuffer();

  const mask = `<svg width="${cardW}" height="${cardH}"><rect x="0" y="0" width="${cardW}" height="${cardH}" rx="20" ry="20" fill="#ffffff"/></svg>`;
  const leftRounded = await sharp(leftImg).ensureAlpha().composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toBuffer();
  const rightRounded = await sharp(rightImg).ensureAlpha().composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toBuffer();

  const bgSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="dmCardBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0b0f19"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#030712"/>
      </linearGradient>
      <filter id="baShadow"><feGaussianBlur stdDeviation="20"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0"/></filter>
      <filter id="hubGlow"><feGaussianBlur stdDeviation="14"/><feColorMatrix type="matrix" values="0 0 0 0 0.06 0 0 0 0 0.72 0 0 0 0 0.5 0 0 0 0.6 0"/></filter>
    </defs>

    <!-- Canvas Background -->
    <rect width="${w}" height="${h}" fill="url(#dmCardBg)"/>
    <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#1e293b" stroke-width="2"/>

    <!-- Header Section -->
    <rect x="64" y="32" width="270" height="34" rx="17" fill="rgba(99,102,241,0.15)" stroke="#6366f1" stroke-width="1.2"/>
    <text x="199" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="800" fill="#818cf8" text-anchor="middle" letter-spacing="1.5">⚡ AI STUDIO TRANSFORMATION</text>

    <text x="64" y="104" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="32" font-weight="900" fill="#ffffff">${title} — Studio Upgrade</text>

    <!-- Metric Badge on Top-Right -->
    <rect x="1006" y="44" width="330" height="46" rx="23" fill="rgba(16,185,129,0.12)" stroke="#10b981" stroke-width="1.5"/>
    <text x="1171" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="17" font-weight="800" fill="#34d399" text-anchor="middle">📈 3.4x Higher ROAS on Meta Ads</text>

    <!-- Drop Shadows Behind Image Cards -->
    <rect x="${leftX}" y="${cardY + 8}" width="${cardW}" height="${cardH}" rx="20" fill="#000000" filter="url(#baShadow)"/>
    <rect x="${rightX}" y="${cardY + 8}" width="${cardW}" height="${cardH}" rx="20" fill="#000000" filter="url(#baShadow)"/>

    <!-- Central Transformation Hub (30s AI Indicator) -->
    <circle cx="698" cy="396" r="38" fill="#000000" filter="url(#hubGlow)"/>
    <circle cx="698" cy="396" r="34" fill="#0f172a" stroke="#10b981" stroke-width="3"/>
    <text x="698" y="390" font-family="Arial,sans-serif" font-size="18" fill="#10b981" text-anchor="middle">⚡</text>
    <text x="698" y="412" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="900" fill="#ffffff" text-anchor="middle">30 SEC</text>

    <!-- Bottom Seller Pitch Bar -->
    <rect x="64" y="674" width="1272" height="54" rx="18" fill="rgba(15,23,42,0.85)" stroke="#1e293b" stroke-width="1"/>
    <text x="700" y="708" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="17" font-weight="600" fill="#94a3b8" text-anchor="middle">✦ Ready for Instagram, Amazon, Flipkart, Meesho &amp; WhatsApp • Zero Studio Rent • Saved ₹25,000/shoot</text>
  </svg>`;

  // Badges to composite over images
  const leftBadgeSvg = `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="20" width="240" height="38" rx="19" fill="#dc2626"/>
    <text x="140" y="45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1">✕ BEFORE: PHONE PHOTO</text>
    <rect x="20" y="${cardH - 58}" width="340" height="38" rx="12" fill="rgba(15,23,42,0.88)"/>
    <text x="190" y="${cardH - 34}" font-family="Arial,sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Flat lighting • Cluttered background</text>
    <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="20" fill="none" stroke="#334155" stroke-width="2.5"/>
  </svg>`;

  const rightBadgeSvg = `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="20" width="260" height="38" rx="19" fill="#10b981"/>
    <text x="150" y="45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="800" fill="#042f2e" text-anchor="middle" letter-spacing="1">✓ AFTER: ${brand}</text>
    <rect x="20" y="${cardH - 58}" width="360" height="38" rx="12" fill="rgba(15,23,42,0.88)"/>
    <text x="200" y="${cardH - 34}" font-family="Arial,sans-serif" font-size="14" fill="#6ee7b7" text-anchor="middle">85mm Lens • Magazine Studio Lighting</text>
    <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="20" fill="none" stroke="#10b981" stroke-width="3"/>
  </svg>`;

  const compLeft = await sharp(leftRounded).composite([{ input: Buffer.from(leftBadgeSvg) }]).png().toBuffer();
  const compRight = await sharp(rightRounded).composite([{ input: Buffer.from(rightBadgeSvg) }]).png().toBuffer();

  return sharp(Buffer.from(bgSvg))
    .composite([
      { input: compLeft, left: leftX, top: cardY },
      { input: compRight, left: rightX, top: cardY }
    ])
    .png()
    .toBuffer();
}

async function renderAdPack({
  rawBuffer,
  studioBuffer,
  preset,
  brandName,
  productName,
  priceText,
  discountBadge,
  ctaText,
  watermarked = false
}) {
  const accentColor = preset?.accent || '#0f766e';

  let [squarePost, storyAd, marketplaceClean, beforeAfterCard] = await Promise.all([
    renderSquareAdPost({ studioBuffer, brandName, productName, priceText, discountBadge, ctaText, accentColor }),
    renderStoryAd({ studioBuffer, brandName, productName, priceText, discountBadge, ctaText, accentColor }),
    renderMarketplaceClean({ studioBuffer }),
    renderBeforeAfterCard({ rawBuffer, studioBuffer, productName, brandName: brandName || 'SnapStudio' })
  ]);

  if (watermarked) {
    [squarePost, storyAd, marketplaceClean] = await Promise.all([
      applyWatermark(squarePost),
      applyWatermark(storyAd),
      applyWatermark(marketplaceClean)
    ]);
  }

  return { squarePost, storyAd, marketplaceClean, beforeAfterCard };
}

module.exports = {
  renderAdPack,
  renderBeforeAfterCard,
  renderSquareAdPost,
  renderStoryAd,
  renderMarketplaceClean
};
