const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { spawn } = require('child_process');

const { createDemoProductBuffer, getPresetById } = require('../src/presets');
const { generateStudioImage } = require('../src/imageEngine');
const { renderAdPack } = require('../src/adPackRenderer');
const { generateSellerDmScripts } = require('../src/outreach');

async function runTests() {
  console.log('1. Testing demo product buffer, local studio compositor & watermarking...');
  const rawBuf = await createDemoProductBuffer('serum');
  const rawMeta = await sharp(rawBuf).metadata();
  assert.strictEqual(rawMeta.width, 900);

  const preset = getPresetById('marble_luxury');
  const freeRender = await generateStudioImage({
    inputBuffer: rawBuf,
    preset,
    enginePreference: 'local',
    watermarked: true
  });
  const freeMeta = await sharp(freeRender.buffer).metadata();
  assert.strictEqual(freeMeta.width, 1024);
  assert.strictEqual(freeMeta.height, 1024);
  assert.strictEqual(freeRender.engineUsed, 'local-studio-compositor');

  // Test ₹0 free custom AI "After" upload path
  const afterRender = await generateStudioImage({
    inputBuffer: rawBuf,
    afterBuffer: rawBuf,
    preset,
    watermarked: false
  });
  assert.strictEqual(afterRender.engineUsed, 'free-ai-web-upload');
  assert.strictEqual(afterRender.estimatedCostInr, 0);

  console.log('2. Testing Seller Ad-Pack compositor (1:1 Feed, 9:16 Story, White Listing, Before/After)...');
  const pack = await renderAdPack({
    rawBuffer: rawBuf,
    studioBuffer: freeRender.buffer,
    preset,
    brandName: 'Noor Glow',
    productName: 'Saffron Serum',
    priceText: '₹699',
    discountBadge: '20% OFF',
    ctaText: 'DM ON WHATSAPP',
    watermarked: false
  });
  assert.strictEqual((await sharp(pack.squarePost).metadata()).width, 1080);
  assert.strictEqual((await sharp(pack.storyAd).metadata()).height, 1920);
  assert.strictEqual((await sharp(pack.marketplaceClean).metadata()).width, 1080);
  assert.strictEqual((await sharp(pack.beforeAfterCard).metadata()).width, 1400);

  console.log('3. Testing seller DM script generator...');
  const scripts = generateSellerDmScripts({
    showcase: { businessName: 'Zari Craft', productName: 'Kundan Choker' },
    showcaseUrl: 'https://snapstudio.app/showcase/sh_123',
    market: 'india',
    settings: { packIndiaPrice: 299, dfyIndiaPrice: 2499, founderName: 'Kiran' }
  });
  assert.ok(scripts.instagramDm.includes('₹299'));
  assert.ok(scripts.whatsappConcierge.includes('sh_123'));

  console.log('4. Testing Express HTTP server, credit unlock, showcase, PIN lock, CRM & WhatsApp webhook...');
  const dbPath = path.join(__dirname, '..', 'data', 'db.json');
  const assetsDir = path.join(__dirname, '..', 'data', 'assets');
  const hadDb = fs.existsSync(dbPath);
  const origDb = hadDb ? fs.readFileSync(dbPath, 'utf8') : null;
  const beforeAssets = new Set(fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []);

  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: '3466', STUDIO_PIN: '7744', WHATSAPP_VERIFY_TOKEN: 'verify_abc' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server boot timeout')), 5000);
      child.stdout.on('data', (d) => {
        if (d.toString().includes('http://localhost:3466')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    const base = 'http://localhost:3466';
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.strictEqual(health.ok, true);

    // WhatsApp webhook challenge
    const waChallenge = await fetch(`${base}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify_abc&hub.challenge=12345`).then((r) => r.text());
    assert.strictEqual(waChallenge, '12345');

    // Studio auth enforcement
    const unauth = await fetch(`${base}/api/studio/bootstrap`);
    assert.strictEqual(unauth.status, 401);

    const authHeaders = { 'x-studio-pin': '7744' };

    // Issue credit code in Studio
    const credRes = await fetch(`${base}/api/studio/credits`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Test Pack', totalCredits: 5, market: 'india', pricePaid: 299 })
    }).then((r) => r.json());
    assert.strictEqual(credRes.credit.remainingCredits, 5);

    // Public preview generation (watermarked)
    const fdFree = new FormData();
    fdFree.append('demoSample', 'candle');
    fdFree.append('presetId', 'sunlight_lifestyle');
    fdFree.append('brandName', 'Noor');
    fdFree.append('productName', 'Soy Candle');
    const freeGen = await fetch(`${base}/api/generate`, { method: 'POST', body: fdFree }).then((r) => r.json());
    assert.strictEqual(freeGen.showcase.unlocked, false);

    // Credit-unlocked generation (unwatermarked HD + decrements credit)
    const fdPaid = new FormData();
    fdPaid.append('demoSample', 'jewelry');
    fdPaid.append('presetId', 'model_jewelry_closeup');
    fdPaid.append('creditCode', credRes.credit.code);
    const paidGen = await fetch(`${base}/api/generate`, { method: 'POST', body: fdPaid }).then((r) => r.json());
    assert.strictEqual(paidGen.showcase.unlocked, true);
    assert.strictEqual(paidGen.remainingCredits, 4);

    // Showcase & generated asset serving
    const showRes = await fetch(`${base}/api/showcase/${paidGen.showcase.id}`).then((r) => r.json());
    assert.strictEqual(showRes.showcase.id, paidGen.showcase.id);

    // Auto-seeded permanent demo showcase verification
    const demoJewelryRes = await fetch(`${base}/api/showcase/demo-jewelry`).then((r) => r.json());
    assert.strictEqual(demoJewelryRes.showcase.id, 'demo-jewelry');
    assert.ok(demoJewelryRes.showcase.businessName.includes('Eclaypse'));

    const imgRes = await fetch(`${base}/assets/${paidGen.showcase.adPackFiles.storyAd}`);
    assert.strictEqual(imgRes.status, 200);
    assert.ok((imgRes.headers.get('content-type') || '').includes('image/png'));

    // Studio DM Sample generation + CRM save
    const fdSample = new FormData();
    fdSample.append('demoSample', 'jewelry');
    fdSample.append('businessName', 'Kundan House');
    fdSample.append('productName', 'Bridal Set');
    fdSample.append('presetId', 'festive_indian');
    const sampleRes = await fetch(`${base}/api/studio/generate-sample`, {
      method: 'POST',
      headers: authHeaders,
      body: fdSample
    }).then((r) => r.json());
    assert.strictEqual(sampleRes.showcase.unlocked, true);
    assert.ok(sampleRes.scripts.instagramDm.includes('Kundan House'));

    const crmRes = await fetch(`${base}/api/studio/prospects`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: 'Kundan House', market: 'india', stage: 'paid', dealValue: 2499 })
    }).then((r) => r.json());
    assert.ok(crmRes.stats.revenueInr >= 2499 + 299);

    console.log('✅ All SnapStudio unit & end-to-end tests passed!');
  } finally {
    child.kill();
    if (hadDb) {
      fs.writeFileSync(dbPath, origDb, 'utf8');
    } else if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (fs.existsSync(assetsDir)) {
      for (const f of fs.readdirSync(assetsDir)) {
        if (!beforeAssets.has(f)) {
          fs.unlinkSync(path.join(assetsDir, f));
        }
      }
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

