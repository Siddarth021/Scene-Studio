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
  const accent = safeColor(accentColor);
  const brand = esc((brandName || 'FEATURED BRAND').toUpperCase().slice(0, 28));
  const title = esc((productName || 'Bestselling Studio Edition').slice(0, 34));
  const price = esc((priceText || '₹499').slice(0, 18));
  const badge = esc((discountBadge || 'NEW LAUNCH').slice(0, 18));
  const cta = esc((ctaText || 'DM "ORDER" ON WHATSAPP').slice(0, 32));

  const hero = await sharp(studioBuffer).resize(820, 680, { fit: 'cover' }).png().toBuffer();
  const mask = `<svg width="820" height="680"><rect x="0" y="0" width="820" height="680" rx="28" ry="28" fill="#fff"/></svg>`;
  const roundedHero = await sharp(hero).ensureAlpha().composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toBuffer();

  const canvasSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#fafaf9"/>
    <rect x="0" y="0" width="${size}" height="128" fill="#0f172a"/>
    <text x="64" y="78" font-family="Arial,sans-serif" font-size="30" font-weight="bold" fill="#ffffff" letter-spacing="3">${brand}</text>
    <rect x="${size - 320}" y="38" width="256" height="52" rx="26" fill="${accent}"/>
    <text x="${size - 192}" y="72" font-family="Arial,sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">${badge}</text>
    <rect x="64" y="${size - 196}" width="952" height="148" rx="22" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <text x="98" y="${size - 126}" font-family="Arial,sans-serif" font-size="36" font-weight="bold" fill="#0f172a">${title}</text>
    <text x="98" y="${size - 78}" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="${accent}">${cta}</text>
    <rect x="750" y="${size - 166}" width="234" height="86" rx="16" fill="#0f172a"/>
    <text x="867" y="${size - 112}" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="#ffffff" text-anchor="middle">${price}</text>
  </svg>`;

  return sharp(Buffer.from(canvasSvg))
    .composite([{ input: roundedHero, left: 130, top: 164 }])
    .png()
    .toBuffer();
}

async function renderStoryAd({ studioBuffer, brandName, productName, priceText, discountBadge, ctaText, accentColor }) {
  const w = 1080;
  const h = 1920;
  const accent = safeColor(accentColor);
  const brand = esc((brandName || 'LIMITED DROP').toUpperCase().slice(0, 26));
  const title = esc((productName || 'Handcrafted Collection').slice(0, 30));
  const price = esc((priceText || '₹499').slice(0, 16));
  const badge = esc((discountBadge || 'LIMITED STOCK').slice(0, 20));
  const cta = esc((ctaText || 'TAP OR REPLY TO ORDER NOW →').slice(0, 34));

  const hero = await sharp(studioBuffer).resize(900, 960, { fit: 'cover' }).png().toBuffer();
  const mask = `<svg width="900" height="960"><rect x="0" y="0" width="900" height="960" rx="38" ry="38" fill="#fff"/></svg>`;
  const roundedHero = await sharp(hero).ensureAlpha().composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toBuffer();

  const canvasSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="stBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#stBg)"/>
    <rect x="330" y="100" width="420" height="58" rx="29" fill="${accent}"/>
    <text x="540" y="138" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="2">${badge}</text>
    <text x="540" y="232" font-family="Arial,sans-serif" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">${brand}</text>
    <text x="540" y="294" font-family="Arial,sans-serif" font-size="34" fill="#cbd5e1" text-anchor="middle">${title}</text>
    <rect x="90" y="1400" width="900" height="170" rx="28" fill="#ffffff"/>
    <text x="150" y="1474" font-family="Arial,sans-serif" font-size="32" font-weight="bold" fill="#0f172a">Special Direct Price</text>
    <text x="150" y="1526" font-family="Arial,sans-serif" font-size="24" fill="#475569">Fast Dispatch • Cash / UPI Accepted</text>
    <rect x="680" y="1434" width="270" height="102" rx="20" fill="${accent}"/>
    <text x="815" y="1500" font-family="Arial,sans-serif" font-size="42" font-weight="bold" fill="#ffffff" text-anchor="middle">${price}</text>
    <rect x="140" y="1640" width="800" height="106" rx="53" fill="${accent}"/>
    <text x="540" y="1706" font-family="Arial,sans-serif" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle">${cta}</text>
  </svg>`;

  return sharp(Buffer.from(canvasSvg))
    .composite([{ input: roundedHero, left: 90, top: 360 }])
    .png()
    .toBuffer();
}

async function renderMarketplaceClean({ studioBuffer }) {
  const size = 1080;
  const hero = await sharp(studioBuffer).resize(880, 880, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([{ input: hero, left: 100, top: 100 }])
    .png()
    .toBuffer();
}

async function renderBeforeAfterCard({ rawBuffer, studioBuffer, productName, brandName = 'SnapStudio' }) {
  const w = 1400;
  const h = 760;

  const leftImg = await sharp(rawBuffer).resize(600, 540, { fit: 'cover' }).png().toBuffer();
  const rightImg = await sharp(studioBuffer).resize(600, 540, { fit: 'cover' }).png().toBuffer();

  const mask = `<svg width="600" height="540"><rect x="0" y="0" width="600" height="540" rx="20" ry="20" fill="#fff"/></svg>`;
  const leftRounded = await sharp(leftImg).ensureAlpha().composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toBuffer();
  const rightRounded = await sharp(rightImg).ensureAlpha().composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toBuffer();

  const bgSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#0f172a"/>
    <text x="64" y="64" font-family="Arial,sans-serif" font-size="30" font-weight="bold" fill="#ffffff">${esc(productName || 'Product Transformation')} — Studio Upgrade</text>
    <rect x="64" y="96" width="240" height="40" rx="20" fill="#dc2626"/>
    <text x="184" y="123" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">BEFORE: PHONE PHOTO</text>
    <rect x="736" y="96" width="280" height="40" rx="20" fill="#10b981"/>
    <text x="876" y="123" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#064e3b" text-anchor="middle">AFTER: ${esc(brandName.toUpperCase())}</text>
    <circle cx="700" cy="415" r="32" fill="#ffffff"/>
    <text x="700" y="425" font-family="Arial,sans-serif" font-size="28" font-weight="bold" fill="#0f172a" text-anchor="middle">→</text>
    <text x="700" y="726" font-family="Arial,sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">Generated in 30 seconds • Ready for Instagram, Amazon, Meesho &amp; WhatsApp Catalogs</text>
  </svg>`;

  return sharp(Buffer.from(bgSvg))
    .composite([
      { input: leftRounded, left: 64, top: 152 },
      { input: rightRounded, left: 736, top: 152 }
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
  renderBeforeAfterCard
};

