const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const storage = require('./src/storage');
const { SCENE_PRESETS, TRYON_PRESETS, getPresetById, createDemoProductBuffer } = require('./src/presets');
const { generateStudioImage } = require('./src/imageEngine');
const { renderAdPack } = require('./src/adPackRenderer');
const { generateSellerDmScripts, getLaunchTemplates, createUpiPayQr } = require('./src/outreach');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes((file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or WebP images are allowed.'));
    }
  }
});

// In-memory rate limit for free un-credited generations
const freeGenHits = new Map();
function checkFreeRateLimit(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const recent = (freeGenHits.get(ip) || []).filter((t) => now - t < hourMs);
  if (recent.length >= 6) return false;
  recent.push(now);
  freeGenHits.set(ip, recent);
  return true;
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function getActivePin() {
  const envPin = (process.env.STUDIO_PIN || '').trim();
  if (envPin) return envPin;
  return (storage.getSettings().studioPin || '').trim();
}

function requireStudioAuth(req, res, next) {
  const pin = getActivePin();
  if (!pin) return next();
  const provided = String(req.headers['x-studio-pin'] || req.query.pin || '').trim();
  if (provided && provided === pin) return next();
  return res.status(401).json({ error: 'Studio PIN required', pinRequired: true });
}

async function buildOfferPayload(settings, baseUrl, note = 'SnapStudio 20-Photo Pack') {
  const upiQr = settings.upiId
    ? await createUpiPayQr(settings.upiId, settings.brandName || 'SnapStudio', settings.packIndiaPrice ?? 299, note)
    : null;
  const waDigits = String(settings.whatsappNumber || '').replace(/[^\d]/g, '');
  const whatsappLink = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi ${settings.founderName || ''}, I want to unlock a SnapStudio HD pack / Done-For-You catalog.`)}`
    : '';

  return {
    brandName: settings.brandName || 'SnapStudio',
    founderName: settings.founderName || 'Founder',
    packIndiaPrice: settings.packIndiaPrice ?? 299,
    packGlobalPrice: settings.packGlobalPrice ?? 12,
    dfyIndiaPrice: settings.dfyIndiaPrice ?? 2499,
    dfyGlobalPrice: settings.dfyGlobalPrice ?? 49,
    upiId: settings.upiId || '',
    upiUri: upiQr ? upiQr.upiUri : '',
    upiQrDataUrl: upiQr ? upiQr.dataUrl : '',
    razorpayLink: settings.razorpayLink || '',
    dodoLink: settings.dodoLink || '',
    whatsappLink,
    baseUrl,
    engines: {
      defaultEngine: settings.defaultEngine || 'auto',
      geminiReady: Boolean(settings.geminiApiKey),
      falReady: Boolean(settings.falApiKey),
      hfReady: Boolean(settings.hfApiKey),
      localReady: true
    }
  };
}

async function executeStudioPipeline({
  rawBuffer,
  afterBuffer = null,
  presetId,
  customPrompt = '',
  enginePreference = '',
  brandName = '',
  productName = '',
  priceText = '₹499',
  discountBadge = 'NEW LAUNCH',
  ctaText = 'DM TO ORDER ON WHATSAPP',
  sellerHandle = '',
  watermarked = true,
  creditCodeUsed = '',
  isStudioSample = false
}) {
  const settings = storage.getSettings();
  const preset = getPresetById(presetId);
  const runId = crypto.randomBytes(4).toString('hex');

  const rawFile = storage.saveAssetBuffer(`raw_${runId}.png`, rawBuffer);

  const gen = await generateStudioImage({
    inputBuffer: rawBuffer,
    afterBuffer,
    preset,
    customPrompt,
    enginePreference,
    settings,
    watermarked
  });

  if (gen.estimatedCostInr > 0 || gen.engineUsed.startsWith('gemini') || gen.engineUsed.startsWith('fal')) {
    storage.logApiUsage({
      engine: gen.engineUsed,
      estimatedCostInr: gen.estimatedCostInr,
      mode: preset.mode
    });
  }

  const studioFile = storage.saveAssetBuffer(`studio_${runId}.png`, gen.buffer);

  const adPack = await renderAdPack({
    rawBuffer,
    studioBuffer: gen.buffer,
    preset,
    brandName: brandName || 'YOUR BRAND',
    productName: productName || 'Studio Edition',
    priceText,
    discountBadge,
    ctaText,
    watermarked
  });

  const squareFile = storage.saveAssetBuffer(`sq_${runId}.png`, adPack.squarePost);
  const storyFile = storage.saveAssetBuffer(`st_${runId}.png`, adPack.storyAd);
  const marketFile = storage.saveAssetBuffer(`mk_${runId}.png`, adPack.marketplaceClean);
  const beforeAfterFile = storage.saveAssetBuffer(`ba_${runId}.png`, adPack.beforeAfterCard);

  const showcase = storage.saveShowcase({
    businessName: brandName || 'Seller Preview',
    productName: productName || 'Product Shot',
    sellerHandle,
    mode: preset.mode,
    presetId: preset.id,
    presetName: preset.name,
    rawFile,
    studioFile,
    adPackFiles: {
      squarePost: squareFile,
      storyAd: storyFile,
      marketplaceClean: marketFile
    },
    beforeAfterFile,
    unlocked: !watermarked,
    creditCodeUsed,
    isStudioSample,
    engineUsed: gen.engineUsed,
    estimatedCostInr: gen.estimatedCostInr,
    apiWarning: gen.apiWarning || ''
  });

  return showcase;
}

// Page routes
app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml').send(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0f766e"/><text x="16" y="22" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#fff" text-anchor="middle">S</text></svg>'
  );
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/showcase/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'showcase.html'));
});

app.get('/studio', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studio.html'));
});

// Safe asset serving
app.get('/assets/:filename', (req, res) => {
  const filePath = storage.getAssetPath(req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Asset not found');
  }
  res.sendFile(filePath);
});

// Health & Public Config
app.get('/api/health', (req, res) => {
  const s = storage.getSettings();
  res.json({
    ok: true,
    service: 'snapstudio',
    engines: {
      gemini: Boolean(s.geminiApiKey),
      fal: Boolean(s.falApiKey),
      hf: Boolean(s.hfApiKey),
      local: true
    }
  });
});

app.get('/api/public-config', async (req, res) => {
  try {
    const settings = storage.getSettings();
    const offer = await buildOfferPayload(settings, getBaseUrl(req));
    res.json({
      offer,
      presets: {
        scene: SCENE_PRESETS,
        tryon: TRYON_PRESETS
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Credit Check
app.post('/api/credits/check', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const credit = storage.getCreditByCode(code);
  if (!credit) {
    return res.status(404).json({ valid: false, error: 'Invalid or exhausted credit code.' });
  }
  res.json({
    valid: true,
    code: credit.code,
    label: credit.label,
    remainingCredits: credit.remainingCredits,
    totalCredits: credit.totalCredits
  });
});

// Public Generate Endpoint (Multipart upload OR demoSample)
app.post('/api/generate', (req, res) => {
  upload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || 'Image upload failed.' });
    }
    try {
      const body = req.body || {};
      const creditCode = String(body.creditCode || '').trim().toUpperCase();
      let unlocked = false;
      let creditRecord = null;

      if (creditCode) {
        creditRecord = storage.consumeCredit(creditCode, 1);
        if (!creditRecord) {
          return res.status(400).json({ error: 'Credit code is invalid or has 0 credits left.' });
        }
        unlocked = true;
      } else {
        if (!checkFreeRateLimit(req.ip)) {
          return res.status(429).json({
            error: 'Free hourly preview limit reached. Enter a Pack Credit Code to unlock unlimited HD renders.'
          });
        }
      }

      let rawBuffer = req.file?.buffer || null;
      if (!rawBuffer) {
        const sampleKey = body.demoSample || 'serum';
        rawBuffer = await createDemoProductBuffer(sampleKey);
      }

      const showcase = await executeStudioPipeline({
        rawBuffer,
        presetId: body.presetId || 'marble_luxury',
        customPrompt: body.customPrompt || '',
        enginePreference: body.engine || '',
        brandName: body.brandName || '',
        productName: body.productName || '',
        priceText: body.priceText || '₹499',
        discountBadge: body.discountBadge || 'NEW DROP',
        ctaText: body.ctaText || 'DM TO ORDER ON WHATSAPP',
        watermarked: !unlocked,
        creditCodeUsed: creditRecord ? creditRecord.code : ''
      });

      const baseUrl = getBaseUrl(req);
      res.json({
        showcase,
        showcaseUrl: `${baseUrl}/showcase/${showcase.id}`,
        remainingCredits: creditRecord ? creditRecord.remainingCredits : null
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Generation failed.' });
    }
  });
});

app.get('/api/showcase/:id', async (req, res) => {
  const showcase = storage.getShowcase(req.params.id, true);
  if (!showcase) {
    return res.status(404).json({ error: 'Showcase not found.' });
  }
  const settings = storage.getSettings();
  const offer = await buildOfferPayload(settings, getBaseUrl(req), `SnapStudio ${showcase.businessName}`);
  res.json({ showcase, offer });
});

// Meta WhatsApp Cloud API Webhook (Verification + Incoming Image Handler)
app.get('/api/whatsapp/webhook', (req, res) => {
  const settings = storage.getSettings();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === settings.whatsappVerifyToken) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Verification failed');
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  // Always ACK quickly to Meta webhook
  res.status(200).json({ received: true });
  try {
    const settings = storage.getSettings();
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg || msg.type !== 'image' || !settings.whatsappAccessToken || !settings.whatsappPhoneNumberId) {
      return;
    }
    const mediaId = msg.image?.id;
    const fromPhone = msg.from;
    const caption = msg.image?.caption || 'WhatsApp Seller Product';
    if (!mediaId || !fromPhone) return;

    // Fetch media URL from Meta Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${settings.whatsappAccessToken}` }
    });
    const metaJson = await metaRes.json();
    if (!metaJson.url) return;

    const imgRes = await fetch(metaJson.url, {
      headers: { Authorization: `Bearer ${settings.whatsappAccessToken}` }
    });
    const rawBuffer = Buffer.from(await imgRes.arrayBuffer());

    const showcase = await executeStudioPipeline({
      rawBuffer,
      presetId: 'marble_luxury',
      productName: caption.slice(0, 32),
      brandName: 'WhatsApp Studio Preview',
      sellerHandle: fromPhone,
      watermarked: true,
      isStudioSample: true
    });

    const host = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
    const link = `${host}/showcase/${showcase.id}`;
    const replyText = `✨ Your SnapStudio preview is ready!\n\nView Before/After & Instagram Story cards here:\n${link}\n\nUnlock 20 HD unwatermarked photos for ₹${settings.packIndiaPrice} — reply PACK to get your UPI link!`;

    await fetch(`https://graph.facebook.com/v20.0/${settings.whatsappPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.whatsappAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: fromPhone,
        type: 'text',
        text: { body: replyText }
      })
    });
  } catch (err) {
    console.error('WhatsApp webhook processing note:', err.message);
  }
});

// Studio Auth Status
app.get('/api/studio/auth-status', (req, res) => {
  const pin = getActivePin();
  const provided = String(req.headers['x-studio-pin'] || '').trim();
  res.json({
    pinEnabled: Boolean(pin),
    authorized: !pin || provided === pin
  });
});

// Studio Protected APIs
app.get('/api/studio/bootstrap', requireStudioAuth, (req, res) => {
  const settings = storage.getSettings();
  const masked = {
    ...settings,
    geminiApiKey: settings.geminiApiKey ? '••••' + settings.geminiApiKey.slice(-4) : '',
    falApiKey: settings.falApiKey ? '••••' + settings.falApiKey.slice(-4) : '',
    hfApiKey: settings.hfApiKey ? '••••' + settings.hfApiKey.slice(-4) : '',
    whatsappAccessToken: settings.whatsappAccessToken ? '••••' : '',
    studioPin: settings.studioPin ? '••••' : ''
  };
  res.json({
    stats: storage.getStats(),
    showcases: storage.listShowcases(30),
    credits: storage.listCredits(),
    prospects: storage.listProspects(),
    settings: masked,
    launchTemplates: getLaunchTemplates(getBaseUrl(req), settings)
  });
});

app.post('/api/studio/generate-sample', requireStudioAuth, (req, res) => {
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'afterImage', maxCount: 1 }
  ])(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    try {
      const body = req.body || {};
      const rawFileObj = req.files?.image?.[0];
      const afterFileObj = req.files?.afterImage?.[0];
      const rawBuffer = rawFileObj?.buffer || (await createDemoProductBuffer(body.demoSample || 'jewelry'));
      const afterBuffer = afterFileObj?.buffer || null;
      const showcase = await executeStudioPipeline({
        rawBuffer,
        afterBuffer,
        presetId: body.presetId || 'marble_luxury',
        customPrompt: body.customPrompt || '',
        enginePreference: body.engine || '',
        brandName: body.businessName || 'Boutique Seller',
        productName: body.productName || 'Featured Item',
        priceText: body.priceText || '₹799',
        discountBadge: body.discountBadge || 'STUDIO SAMPLE',
        ctaText: body.ctaText || 'DM TO ORDER NOW',
        sellerHandle: body.sellerHandle || '',
        watermarked: false, // Founder DM sample is clean HD so seller sees real quality!
        isStudioSample: true
      });

      const settings = storage.getSettings();
      const showcaseUrl = `${getBaseUrl(req)}/showcase/${showcase.id}`;
      const scripts = generateSellerDmScripts({
        showcase,
        showcaseUrl,
        market: body.market === 'global' ? 'global' : 'india',
        settings
      });

      res.json({
        showcase,
        showcaseUrl,
        scripts,
        stats: storage.getStats()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

app.post('/api/studio/credits', requireStudioAuth, (req, res) => {
  const b = req.body || {};
  const credit = storage.createCreditCode({
    label: b.label || '20-Photo HD Pack',
    totalCredits: Number(b.totalCredits) || 20,
    market: b.market === 'global' ? 'global' : 'india',
    pricePaid: Number(b.pricePaid) || (b.market === 'global' ? 12 : 299),
    currency: b.market === 'global' ? 'USD' : 'INR',
    customCode: b.customCode || ''
  });
  res.status(201).json({ credit, stats: storage.getStats() });
});

app.patch('/api/studio/credits/:id', requireStudioAuth, (req, res) => {
  const updated = storage.toggleCredit(req.params.id, req.body?.active);
  if (!updated) return res.status(404).json({ error: 'Credit code not found' });
  res.json({ credit: updated });
});

app.post('/api/studio/prospects', requireStudioAuth, (req, res) => {
  const prospect = storage.addProspect(req.body || {});
  res.status(201).json({ prospect, stats: storage.getStats() });
});

app.patch('/api/studio/prospects/:id', requireStudioAuth, (req, res) => {
  const updated = storage.updateProspect(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Prospect not found' });
  res.json({ prospect: updated, stats: storage.getStats() });
});

app.delete('/api/studio/prospects/:id', requireStudioAuth, (req, res) => {
  const ok = storage.deleteProspect(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Prospect not found' });
  res.json({ ok: true, stats: storage.getStats() });
});

app.put('/api/studio/settings', requireStudioAuth, (req, res) => {
  const patch = { ...(req.body || {}) };
  for (const secretField of ['geminiApiKey', 'falApiKey', 'hfApiKey', 'whatsappAccessToken', 'studioPin']) {
    if (typeof patch[secretField] === 'string' && patch[secretField].startsWith('••••')) {
      delete patch[secretField];
    }
  }
  const saved = storage.updateSettings(patch);
  res.json({
    settings: {
      ...saved,
      geminiApiKey: saved.geminiApiKey ? '••••' + saved.geminiApiKey.slice(-4) : '',
      falApiKey: saved.falApiKey ? '••••' + saved.falApiKey.slice(-4) : '',
      hfApiKey: saved.hfApiKey ? '••••' + saved.hfApiKey.slice(-4) : '',
      whatsappAccessToken: saved.whatsappAccessToken ? '••••' : '',
      studioPin: saved.studioPin ? '••••' : ''
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n📸 SnapStudio AI Product Studio running at http://localhost:${PORT}`);
  console.log(`   • Public Storefront: http://localhost:${PORT}/`);
  console.log(`   • Founder Studio & Outreach Engine: http://localhost:${PORT}/studio\n`);
});

