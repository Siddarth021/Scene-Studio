const path = require('path');
const fs = require('fs');
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

const DEMO_PRODUCTS = {
  serum: {
    id: 'serum',
    title: 'GLOW DROP',
    name: 'Saffron Vitamin C Serum',
    brand: 'Noor Essentials',
    price: '₹699',
    presetId: 'marble_luxury',
    beforeFile: 'serum-before.jpg',
    afterFile: 'serum-after.jpg'
  },
  jewelry: {
    id: 'jewelry',
    title: 'ROYAL KUNDAN',
    name: 'Royal Kundan Choker Set',
    brand: 'Eclaypse Handmade Jewelry',
    price: '₹1,499',
    presetId: 'marble_luxury',
    beforeFile: 'jewelry-before.jpg',
    afterFile: 'jewelry-after.jpg'
  },
  candle: {
    id: 'candle',
    title: 'NOOR STUDIO',
    name: 'Vanilla Soy Scented Candle',
    brand: 'Botanica Aromas',
    price: '₹499',
    presetId: 'sunlight_lifestyle',
    beforeFile: 'candle-before.jpg',
    afterFile: 'candle-after.jpg'
  },
  watch: {
    id: 'watch',
    title: 'AETHEL CHRONO',
    name: 'Vintage Leather Chronograph',
    brand: 'Aethel Chrono',
    price: '₹2,499',
    presetId: 'dark_moody',
    beforeFile: 'watch-before.jpg',
    afterFile: 'watch-after.jpg'
  },
  theumbrellastore: {
    id: 'theumbrellastore',
    title: 'THE UMBRELLA STORE',
    name: 'Morning Brew Scented Soy Candle',
    brand: 'The Umbrella Store',
    price: '₹399',
    presetId: 'sunlight_lifestyle',
    beforeFile: 'umbrellastore-before.jpg',
    afterFile: 'umbrellastore-after.png'
  },
  bongoniketan: {
    id: 'bongoniketan',
    title: 'BONGONIKETAN',
    name: 'Handwoven Royal Mulberry Silk Saree',
    brand: 'Bongoniketan',
    price: '₹4,140',
    presetId: 'festive_indian',
    beforeFile: 'bongoniketan-before.jpg',
    afterFile: 'bongoniketan-after.png'
  }
};

async function createDemoProductBuffer(sampleKey = 'serum') {
  const normalizedKey = (sampleKey || 'serum').toLowerCase().trim();
  const item = DEMO_PRODUCTS[normalizedKey] || DEMO_PRODUCTS[normalizedKey === 'kundan' ? 'jewelry' : 'serum'];
  const key = item ? item.id : 'serum';
  
  if (item && item.beforeFile) {
    const customPath = path.join(__dirname, '..', 'public', 'demo', item.beforeFile);
    if (fs.existsSync(customPath)) {
      return sharp(customPath)
        .resize(900, 900, { fit: 'cover' })
        .png()
        .toBuffer();
    }
  }

  const pngPath = path.join(__dirname, '..', 'public', 'demo', `${key}-before.png`);
  if (fs.existsSync(pngPath)) {
    return sharp(pngPath)
      .resize(900, 900, { fit: 'cover' })
      .png()
      .toBuffer();
  }
  
  const jpgPath = path.join(__dirname, '..', 'public', 'demo', `${key}-before.jpg`);
  if (fs.existsSync(jpgPath)) {
    return sharp(jpgPath)
      .resize(900, 900, { fit: 'cover' })
      .png()
      .toBuffer();
  }

  throw new Error(`Photorealistic demo asset not found for: ${sampleKey}`);
}

async function getDemoAfterBuffer(sampleKey = 'serum') {
  const normalizedKey = (sampleKey || 'serum').toLowerCase().trim();
  const item = DEMO_PRODUCTS[normalizedKey] || DEMO_PRODUCTS[normalizedKey === 'kundan' ? 'jewelry' : 'serum'];
  const key = item ? item.id : 'serum';
  
  if (item && item.afterFile) {
    const customPath = path.join(__dirname, '..', 'public', 'demo', item.afterFile);
    if (fs.existsSync(customPath)) {
      return sharp(customPath)
        .resize(1024, 1024, { fit: 'cover' })
        .png()
        .toBuffer();
    }
  }

  const pngPath = path.join(__dirname, '..', 'public', 'demo', `${key}-after.png`);
  if (fs.existsSync(pngPath)) {
    return sharp(pngPath)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toBuffer();
  }

  const jpgPath = path.join(__dirname, '..', 'public', 'demo', `${key}-after.jpg`);
  if (fs.existsSync(jpgPath)) {
    return sharp(jpgPath)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toBuffer();
  }

  return null;
}

module.exports = {
  SCENE_PRESETS,
  TRYON_PRESETS,
  ALL_PRESETS,
  DEMO_PRODUCTS,
  getPresetById,
  createDemoProductBuffer,
  getDemoAfterBuffer
};

