const sharp = require('sharp');

const SCENE_PRESETS = [
  {
    id: 'marble_luxury',
    mode: 'scene',
    name: 'Luxury Marble Vanity',
    tag: 'Jewelry • Skincare • Perfume',
    accent: '#0f766e',
    bgTop: '#f5f0ea',
    bgBottom: '#dfd5c9',
    prompt:
      'Place this exact product on a polished white Carrara marble countertop with soft warm morning window light, gentle natural shadows, subtle dried eucalyptus shadow out of focus in the background, ultra-clean commercial e-commerce photography, 85mm lens, photorealistic. Preserve the exact product shape, color, pattern, and label text untouched.'
  },
  {
    id: 'sunlight_lifestyle',
    mode: 'scene',
    name: 'Golden Hour Lifestyle',
    tag: 'Candles • D2C • Home Decor',
    accent: '#b45309',
    bgTop: '#fef3c7',
    bgBottom: '#e7cba9',
    prompt:
      'Place this exact product on a warm natural travertine stone surface with golden hour sunlight casting soft window-blind shadows across a warm beige plaster wall, editorial D2C brand product photography, sharp focus on product. Preserve the exact product design, colors, and text.'
  },
  {
    id: 'amazon_white',
    mode: 'scene',
    name: 'Marketplace Pure White',
    tag: 'Amazon • Meesho • Flipkart • Etsy',
    accent: '#1d4ed8',
    bgTop: '#ffffff',
    bgBottom: '#f8fafc',
    prompt:
      'Isolate this exact product cleanly centered on a pure crisp white studio background (#FFFFFF) with bright even commercial softbox lighting and a very subtle natural contact shadow directly underneath. E-commerce main listing photo quality. Keep every product detail and label 100% accurate.'
  },
  {
    id: 'podium_pastel',
    mode: 'scene',
    name: 'Minimalist Studio Podium',
    tag: 'Beauty • Tech • Bottles',
    accent: '#4f46e5',
    bgTop: '#eef2ff',
    bgBottom: '#c7d2fe',
    prompt:
      'Place this exact product standing on a smooth matte cylindrical studio podium in soft sage-and-cream tones, clean gradient studio backdrop, crisp commercial rim lighting, high-converting Meta ad creative look. Keep the original product unaltered.'
  },
  {
    id: 'festive_indian',
    mode: 'scene',
    name: 'Festive Boutique Showcase',
    tag: 'Sarees • Ethnic • Sweets • Gifts',
    accent: '#9f1239',
    bgTop: '#fff1f2',
    bgBottom: '#fecdd3',
    prompt:
      'Display this exact product on rich ivory raw silk fabric with warm soft festive fairy-light bokeh and subtle brass accents softly blurred in the background, warm luxury Indian boutique photography. Keep the product completely faithful to the original.'
  },
  {
    id: 'dark_moody',
    mode: 'scene',
    name: 'Dark Editorial Hero Ad',
    tag: 'Watches • Men’s Grooming • Coffee',
    accent: '#0f172a',
    bgTop: '#1e293b',
    bgBottom: '#090d16',
    prompt:
      'Place this exact product on dark matte slate stone with dramatic high-contrast studio spotlighting, subtle rim highlights, luxury dark commercial advertising photo. Preserve all logos, shapes, and colors accurately.'
  }
];

const TRYON_PRESETS = [
  {
    id: 'model_indian_ethnic',
    mode: 'tryon',
    name: 'Indian Boutique Model',
    tag: 'Sarees • Kurtis • Lehengas',
    accent: '#be123c',
    bgTop: '#fdf2f8',
    bgBottom: '#fbcfe8',
    prompt:
      'Create a realistic high-fashion e-commerce lookbook photograph of an Indian female fashion model gracefully wearing/draping this exact garment from the uploaded photo, posed naturally in a bright warm sunlit boutique studio, editorial catalog quality. Keep the exact fabric color, border, embroidery, and print faithful to the input.'
  },
  {
    id: 'model_casual_street',
    mode: 'tryon',
    name: 'Modern Lifestyle Model',
    tag: 'Tees • Hoodies • Shirts • Dresses',
    accent: '#0369a1',
    bgTop: '#f0f9ff',
    bgBottom: '#bae6fd',
    prompt:
      'Create a photorealistic e-commerce lookbook photograph of a stylish young model wearing this exact clothing item from the uploaded image in soft natural daylight outdoors/cafe setting, natural posture, DSLR 50mm f/2.0 look. Keep the garment design, print, and color identical.'
  },
  {
    id: 'model_jewelry_closeup',
    mode: 'tryon',
    name: 'Jewelry & Watch Editorial',
    tag: 'Necklaces • Earrings • Watches',
    accent: '#a16207',
    bgTop: '#fefce8',
    bgBottom: '#fde68a',
    prompt:
      'Create an ultra-realistic macro editorial fashion photograph showing a model gracefully wearing this exact jewelry piece or watch from the input photo, warm soft skin lighting, shallow depth of field, luxury catalog look. Preserve the exact metal, stones, and craftsmanship.'
  },
  {
    id: 'model_hand_hold',
    mode: 'tryon',
    name: 'Creator Hand-Hold UGC',
    tag: 'Skincare • Candles • Pouches • Gadgets',
    accent: '#047857',
    bgTop: '#ecfdf5',
    bgBottom: '#a7f3d0',
    prompt:
      'Create a realistic lifestyle UGC product photo of a person’s hand naturally holding this exact product in a bright aesthetic modern room with soft window daylight, clean focus on the product label and shape. Keep the original product completely accurate.'
  }
];

const ALL_PRESETS = [...SCENE_PRESETS, ...TRYON_PRESETS];

function getPresetById(id) {
  return ALL_PRESETS.find((p) => p.id === id) || SCENE_PRESETS[0];
}

async function createDemoProductBuffer(sampleKey = 'serum') {
  const configs = {
    serum: {
      title: 'GLOW DROP',
      sub: 'Saffron Vitamin C Serum',
      bg: '#cbd5e1',
      cardBg: '#94a3b8',
      bottle: '#d97706',
      cap: '#1e293b',
      label: '#fffbeb'
    },
    jewelry: {
      title: 'ROYAL KUNDAN',
      sub: 'Handcrafted Choker Set',
      bg: '#d6d3d1',
      cardBg: '#a8a29e',
      bottle: '#ca8a04',
      cap: '#78350f',
      label: '#fef9c3'
    },
    candle: {
      title: 'NOOR STUDIO',
      sub: 'Hand-Poured Soy Candle',
      bg: '#e2e8f0',
      cardBg: '#cbd5e1',
      bottle: '#7c2d12',
      cap: '#0f172a',
      label: '#fff7ed'
    }
  };
  const c = configs[sampleKey] || configs.serum;

  // Deliberately slightly "raw phone-photo" looking backdrop (flat bedsheet/table tone) so before/after transformation shines
  const svg = `<svg width="900" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="rawbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c.bg}"/>
        <stop offset="100%" stop-color="${c.cardBg}"/>
      </linearGradient>
      <filter id="soft"><feDropShadow dx="4" dy="10" stdDeviation="8" flood-opacity="0.22"/></filter>
    </defs>
    <rect width="900" height="900" fill="url(#rawbg)"/>
    <path d="M0,620 Q300,590 600,630 T900,610 L900,900 L0,900 Z" fill="#b8c0cc" opacity="0.55"/>
    <g filter="url(#soft)" transform="rotate(-2 450 470)">
      ${
        sampleKey === 'jewelry'
          ? `
            <rect x="270" y="210" width="360" height="460" rx="22" fill="#451a03"/>
            <path d="M330,300 Q450,480 570,300" fill="none" stroke="#facc15" stroke-width="18" stroke-linecap="round"/>
            <circle cx="380" cy="368" r="14" fill="#fef08a" stroke="#ca8a04" stroke-width="4"/>
            <circle cx="450" cy="402" r="20" fill="#fef08a" stroke="#ca8a04" stroke-width="5"/>
            <circle cx="520" cy="368" r="14" fill="#fef08a" stroke="#ca8a04" stroke-width="4"/>
            <rect x="330" y="510" width="240" height="82" rx="10" fill="${c.label}"/>
            <text x="450" y="548" font-family="Georgia,serif" font-size="22" font-weight="bold" fill="#78350f" text-anchor="middle">${c.title}</text>
            <text x="450" y="576" font-family="Arial,sans-serif" font-size="14" fill="#92400e" text-anchor="middle">${c.sub}</text>
          `
          : `
            <rect x="385" y="185" width="130" height="85" rx="14" fill="${c.cap}"/>
            <rect x="355" y="265" width="190" height="42" rx="12" fill="#334155"/>
            <rect x="310" y="295" width="280" height="390" rx="34" fill="${c.bottle}"/>
            <rect x="335" y="365" width="230" height="230" rx="14" fill="${c.label}"/>
            <text x="450" y="455" font-family="Arial,sans-serif" font-size="26" font-weight="bold" fill="#0f172a" text-anchor="middle">${c.title}</text>
            <text x="450" y="492" font-family="Arial,sans-serif" font-size="15" fill="#475569" text-anchor="middle">${c.sub}</text>
            <text x="450" y="545" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#b45309" text-anchor="middle">100% PURE • 30 ML</text>
          `
      }
    </g>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = {
  SCENE_PRESETS,
  TRYON_PRESETS,
  ALL_PRESETS,
  getPresetById,
  createDemoProductBuffer
};
