const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { spawn } = require('child_process');

const { createDemoProductBuffer, getPresetById, SCENE_PRESETS, TRYON_PRESETS } = require('../src/presets');
const { generateStudioImage } = require('../src/imageEngine');
const { renderAdPack } = require('../src/adPackRenderer');

async function verifyImageBuffer(buf, label, options = {}) {
  assert.ok(buf, `${label}: Buffer should exist`);
  assert.ok(Buffer.isBuffer(buf), `${label}: Must be a Buffer`);
  assert.ok(buf.length > 1024, `${label}: File size should be > 1KB (got ${buf.length} bytes)`);

  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch (err) {
    throw new Error(`${label}: Corrupt image header or invalid image data - ${err.message}`);
  }

  assert.ok(['png', 'jpeg', 'webp'].includes(meta.format), `${label}: Format must be png, jpeg or webp (got ${meta.format})`);
  assert.ok(meta.width > 0 && meta.height > 0, `${label}: Image dimensions must be > 0 (${meta.width}x${meta.height})`);

  if (options.exactWidth) {
    assert.strictEqual(meta.width, options.exactWidth, `${label}: Width must be ${options.exactWidth}, got ${meta.width}`);
  }
  if (options.exactHeight) {
    assert.strictEqual(meta.height, options.exactHeight, `${label}: Height must be ${options.exactHeight}, got ${meta.height}`);
  }
  if (options.minWidth) {
    assert.ok(meta.width >= options.minWidth, `${label}: Width must be >= ${options.minWidth}, got ${meta.width}`);
  }
  if (options.minHeight) {
    assert.ok(meta.height >= options.minHeight, `${label}: Height must be >= ${options.minHeight}, got ${meta.height}`);
  }

  // Ensure it's not a single solid flat color dummy (check image statistics)
  try {
    const stats = await sharp(buf).stats();
    // In sharp stats, channels contains stdev
    const hasVariance = stats.channels.some(c => c.stdev > 2);
    assert.ok(hasVariance, `${label}: Image appears to be a flat solid color (standard deviation too low)`);
  } catch (err) {
    // If stats fails for some reason, log warning but don't fail if metadata is solid
    console.warn(`  [Warning] Stats calculation skipped for ${label}: ${err.message}`);
  }

  return meta;
}

async function runExtendedVerification() {
  console.log('========================================================');
  console.log('🧪 SNAPSTUDIO COMPREHENSIVE END-TO-END VERIFICATION');
  console.log('========================================================\n');

  const results = {
    demoAssets: { passed: 0, failed: 0, details: [] },
    enginePipeline: { passed: 0, failed: 0, details: [] },
    adPackCompositor: { passed: 0, failed: 0, details: [] },
    apiRoutes: { passed: 0, failed: 0, details: [] },
    frontendIntegrity: { passed: 0, failed: 0, details: [] }
  };

  // 1. Verify Demo Assets in public/demo/ and presets
  console.log('--- 1. DEMO ASSETS & PRESETS INSPECTION ---');
  const demoDir = path.join(__dirname, '..', 'public', 'demo');
  if (fs.existsSync(demoDir)) {
    const files = fs.readdirSync(demoDir).filter(f => /\.(png|jpe?g|webp)$/i.test(f));
    console.log(`Found ${files.length} demo asset files in public/demo:`, files);
    for (const file of files) {
      const filePath = path.join(demoDir, file);
      const buf = fs.readFileSync(filePath);
      try {
        const meta = await verifyImageBuffer(buf, `Demo asset public/demo/${file}`, { minWidth: 400, minHeight: 400 });
        console.log(`  ✅ public/demo/${file}: ${meta.format.toUpperCase()} ${meta.width}x${meta.height}, ${(buf.length / 1024).toFixed(1)} KB`);
        results.demoAssets.passed++;
        results.demoAssets.details.push({ file, meta, size: buf.length, status: 'pass' });
      } catch (err) {
        console.error(`  ❌ public/demo/${file} FAILED:`, err.message);
        results.demoAssets.failed++;
        results.demoAssets.details.push({ file, error: err.message, status: 'fail' });
      }
    }
  } else {
    console.log('  ⚠️ public/demo directory does not exist yet.');
  }

  // Test createDemoProductBuffer for all samples
  const demoSamples = ['serum', 'jewelry', 'candle'];
  for (const sample of demoSamples) {
    try {
      const buf = await createDemoProductBuffer(sample);
      const meta = await verifyImageBuffer(buf, `createDemoProductBuffer('${sample}')`, { minWidth: 600, minHeight: 600 });
      console.log(`  ✅ createDemoProductBuffer('${sample}'): ${meta.format.toUpperCase()} ${meta.width}x${meta.height}, ${(buf.length / 1024).toFixed(1)} KB`);
      results.demoAssets.passed++;
    } catch (err) {
      console.error(`  ❌ createDemoProductBuffer('${sample}') FAILED:`, err.message);
      results.demoAssets.failed++;
    }
  }

  // 2. Engine Pipeline: Local Studio Composite with multiple presets
  console.log('\n--- 2. ENGINE PIPELINE (renderLocalStudioComposite) ---');
  const sampleBuf = await createDemoProductBuffer('serum');
  const testPresets = ['marble_luxury', 'sunlight_lifestyle', 'amazon_white', 'podium_pastel', 'festive_indian', 'dark_moody'];
  
  for (const presetId of testPresets) {
    const preset = getPresetById(presetId);
    try {
      const render = await generateStudioImage({
        inputBuffer: sampleBuf,
        preset,
        enginePreference: 'local',
        watermarked: false
      });
      assert.strictEqual(render.engineUsed, 'local-studio-compositor');
      const meta = await verifyImageBuffer(render.buffer, `Engine render for '${presetId}'`, {
        exactWidth: 1024,
        exactHeight: 1024
      });
      console.log(`  ✅ Preset '${presetId}': Rendered ${meta.width}x${meta.height}, ${(render.buffer.length / 1024).toFixed(1)} KB`);
      results.enginePipeline.passed++;
    } catch (err) {
      console.error(`  ❌ Preset '${presetId}' FAILED:`, err.message);
      results.enginePipeline.failed++;
    }
  }

  // 3. Ad-Pack Compositor: 1:1, 9:16, Clean White, Before/After
  console.log('\n--- 3. AD-PACK COMPOSITOR ---');
  try {
    const preset = getPresetById('marble_luxury');
    const studioRender = await generateStudioImage({
      inputBuffer: sampleBuf,
      preset,
      enginePreference: 'local',
      watermarked: false
    });
    const pack = await renderAdPack({
      rawBuffer: sampleBuf,
      studioBuffer: studioRender.buffer,
      preset,
      brandName: 'Noor Glow',
      productName: 'Saffron Serum',
      priceText: '₹699',
      discountBadge: '20% OFF',
      ctaText: 'ORDER ON WHATSAPP',
      watermarked: false
    });

    const sqMeta = await verifyImageBuffer(pack.squarePost, 'AdPack squarePost', { exactWidth: 1080, exactHeight: 1080 });
    console.log(`  ✅ Square Post (1:1): ${sqMeta.width}x${sqMeta.height}, ${(pack.squarePost.length / 1024).toFixed(1)} KB`);
    results.adPackCompositor.passed++;

    const stMeta = await verifyImageBuffer(pack.storyAd, 'AdPack storyAd', { exactWidth: 1080, exactHeight: 1920 });
    console.log(`  ✅ Story Ad (9:16): ${stMeta.width}x${stMeta.height}, ${(pack.storyAd.length / 1024).toFixed(1)} KB`);
    results.adPackCompositor.passed++;

    const mkMeta = await verifyImageBuffer(pack.marketplaceClean, 'AdPack marketplaceClean', { exactWidth: 1080, exactHeight: 1080 });
    console.log(`  ✅ Marketplace Clean: ${mkMeta.width}x${mkMeta.height}, ${(pack.marketplaceClean.length / 1024).toFixed(1)} KB`);
    results.adPackCompositor.passed++;

    const baMeta = await verifyImageBuffer(pack.beforeAfterCard, 'AdPack beforeAfterCard', { minWidth: 1200, minHeight: 700 });
    console.log(`  ✅ Before/After Card: ${baMeta.width}x${baMeta.height}, ${(pack.beforeAfterCard.length / 1024).toFixed(1)} KB`);
    results.adPackCompositor.passed++;
  } catch (err) {
    console.error('  ❌ AdPack rendering FAILED:', err.message);
    results.adPackCompositor.failed++;
  }

  // 4. API Routes: Live Server Verification
  console.log('\n--- 4. LIVE HTTP SERVER & API ROUTES ---');
  const dbPath = path.join(__dirname, '..', 'data', 'db.json');
  const assetsDir = path.join(__dirname, '..', 'data', 'assets');
  const hadDb = fs.existsSync(dbPath);
  const origDb = hadDb ? fs.readFileSync(dbPath, 'utf8') : null;
  const beforeAssets = new Set(fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []);

  const TEST_PORT = '3499';
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: TEST_PORT, STUDIO_PIN: '9988', WHATSAPP_VERIFY_TOKEN: 'token123' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const base = `http://localhost:${TEST_PORT}`;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server boot timeout (5s)')), 5000);
      child.stdout.on('data', (d) => {
        if (d.toString().includes(`http://localhost:${TEST_PORT}`)) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.stderr.on('data', (d) => {
        console.error('Server stderr:', d.toString());
      });
    });
    console.log(`  ✅ Test server running on ${base}`);

    // GET /
    const homeRes = await fetch(`${base}/`);
    assert.strictEqual(homeRes.status, 200, 'GET / must return 200');
    const homeHtml = await homeRes.text();
    assert.ok(homeHtml.includes('<!DOCTYPE html>') || homeHtml.includes('<html'), 'GET / must return valid HTML');
    assert.ok(homeHtml.includes('viewport'), 'GET / must have responsive viewport meta');
    console.log('  ✅ GET / (Homepage) passed');
    results.apiRoutes.passed++;

    // GET /studio
    const studioRes = await fetch(`${base}/studio`);
    assert.strictEqual(studioRes.status, 200, 'GET /studio must return 200');
    const studioHtml = await studioRes.text();
    assert.ok(studioHtml.includes('SnapStudio') || studioHtml.includes('Studio'), 'GET /studio must return studio HTML');
    console.log('  ✅ GET /studio passed');
    results.apiRoutes.passed++;

    // GET /showcase/demo-jewelry
    const demoJewelryPageRes = await fetch(`${base}/showcase/demo-jewelry`);
    assert.strictEqual(demoJewelryPageRes.status, 200, 'GET /showcase/demo-jewelry must return 200');
    console.log('  ✅ GET /showcase/demo-jewelry page passed');
    results.apiRoutes.passed++;

    // GET /showcase/demo-serum
    const demoSerumPageRes = await fetch(`${base}/showcase/demo-serum`);
    assert.strictEqual(demoSerumPageRes.status, 200, 'GET /showcase/demo-serum must return 200');
    console.log('  ✅ GET /showcase/demo-serum page passed');
    results.apiRoutes.passed++;

    // GET /api/showcase/demo-jewelry
    const demoJewelryApiRes = await fetch(`${base}/api/showcase/demo-jewelry`);
    assert.strictEqual(demoJewelryApiRes.status, 200, 'GET /api/showcase/demo-jewelry must return 200');
    const demoJewelryData = await demoJewelryApiRes.json();
    assert.ok(demoJewelryData.showcase, 'Showcase object must exist in response');
    assert.strictEqual(demoJewelryData.showcase.id, 'demo-jewelry');
    console.log(`  ✅ GET /api/showcase/demo-jewelry JSON passed (brand: ${demoJewelryData.showcase.businessName})`);
    results.apiRoutes.passed++;

    // GET /api/showcase/demo-serum
    const demoSerumApiRes = await fetch(`${base}/api/showcase/demo-serum`);
    assert.strictEqual(demoSerumApiRes.status, 200, 'GET /api/showcase/demo-serum must return 200');
    const demoSerumData = await demoSerumApiRes.json();
    assert.ok(demoSerumData.showcase, 'Showcase object must exist in response');
    assert.strictEqual(demoSerumData.showcase.id, 'demo-serum');
    console.log(`  ✅ GET /api/showcase/demo-serum JSON passed (brand: ${demoSerumData.showcase.businessName})`);
    results.apiRoutes.passed++;

    // Check assets served from demo-jewelry
    const jewelryAdFile = demoJewelryData.showcase.adPackFiles.squarePost;
    const jewelryAssetRes = await fetch(`${base}/assets/${jewelryAdFile}`);
    assert.strictEqual(jewelryAssetRes.status, 200, `Asset ${jewelryAdFile} must return 200`);
    const jewelryAssetBuf = Buffer.from(await jewelryAssetRes.arrayBuffer());
    await verifyImageBuffer(jewelryAssetBuf, `Asset ${jewelryAdFile}`, { exactWidth: 1080, exactHeight: 1080 });
    console.log(`  ✅ GET /assets/${jewelryAdFile} is a valid 1080x1080 image`);
    results.apiRoutes.passed++;

    // POST /api/generate (with demoSample = candle)
    const fdDemo = new FormData();
    fdDemo.append('demoSample', 'candle');
    fdDemo.append('presetId', 'sunlight_lifestyle');
    fdDemo.append('brandName', 'Aura Candle Co.');
    fdDemo.append('productName', 'Lavender Dreams');
    const genRes = await fetch(`${base}/api/generate`, { method: 'POST', body: fdDemo });
    assert.strictEqual(genRes.status, 200, 'POST /api/generate must return 200');
    const genData = await genRes.json();
    assert.ok(genData.showcase && genData.showcase.id, 'POST /api/generate must return showcase');
    console.log(`  ✅ POST /api/generate (demoSample) passed (id: ${genData.showcase.id})`);
    results.apiRoutes.passed++;

    // Check generated story ad image buffer
    const storyFile = genData.showcase.adPackFiles.storyAd;
    const storyRes = await fetch(`${base}/assets/${storyFile}`);
    assert.strictEqual(storyRes.status, 200, `Asset ${storyFile} must return 200`);
    const storyBuf = Buffer.from(await storyRes.arrayBuffer());
    await verifyImageBuffer(storyBuf, `Generated storyAd ${storyFile}`, { exactWidth: 1080, exactHeight: 1920 });
    console.log(`  ✅ Generated storyAd ${storyFile} is valid 1080x1920 PNG`);
    results.apiRoutes.passed++;

    // POST /api/generate (with direct image file upload)
    const testImageBlob = new Blob([sampleBuf], { type: 'image/png' });
    const fdUpload = new FormData();
    fdUpload.append('image', testImageBlob, 'test_product.png');
    fdUpload.append('presetId', 'podium_pastel');
    fdUpload.append('brandName', 'Upload Test Brand');
    fdUpload.append('productName', 'Hydra Gel');
    const genUploadRes = await fetch(`${base}/api/generate`, { method: 'POST', body: fdUpload });
    assert.strictEqual(genUploadRes.status, 200, 'POST /api/generate (file upload) must return 200');
    const genUploadData = await genUploadRes.json();
    assert.ok(genUploadData.showcase && genUploadData.showcase.id, 'Upload showcase created');
    console.log(`  ✅ POST /api/generate (file upload) passed (id: ${genUploadData.showcase.id})`);
    results.apiRoutes.passed++;

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

  // 5. Frontend Files Integrity Check
  console.log('\n--- 5. FRONTEND STATIC ASSETS & CODE QUALITY ---');
  const frontendFiles = [
    'public/index.html',
    'public/showcase.html',
    'public/studio.html',
    'public/app.js',
    'public/renderShowcase.js',
    'public/showcase.js',
    'public/studio.js',
    'public/styles.css'
  ];
  for (const relFile of frontendFiles) {
    const fullPath = path.join(__dirname, '..', relFile);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      assert.ok(stats.size > 0, `${relFile} must not be 0 bytes`);
      console.log(`  ✅ ${relFile}: Exists and non-empty (${(stats.size / 1024).toFixed(1)} KB)`);
      results.frontendIntegrity.passed++;
    } else {
      console.error(`  ❌ ${relFile} MISSING`);
      results.frontendIntegrity.failed++;
    }
  }

  console.log('\n========================================================');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('========================================================');
  const totalPassed = results.demoAssets.passed + results.enginePipeline.passed + results.adPackCompositor.passed + results.apiRoutes.passed + results.frontendIntegrity.passed;
  const totalFailed = results.demoAssets.failed + results.enginePipeline.failed + results.adPackCompositor.failed + results.apiRoutes.failed + results.frontendIntegrity.failed;
  console.log(`Passed: ${totalPassed}, Failed: ${totalFailed}`);

  if (totalFailed > 0) {
    throw new Error(`Verification failed with ${totalFailed} errors.`);
  }
  console.log('🎉 ALL EXTENDED VERIFICATION CHECKS PASSED!\n');
}

if (require.main === module) {
  runExtendedVerification().catch(err => {
    console.error('FATAL VERIFICATION ERROR:', err);
    process.exit(1);
  });
}

module.exports = { runExtendedVerification, verifyImageBuffer };
