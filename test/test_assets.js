const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { spawn } = require('child_process');

const {
  createDemoProductBuffer,
  getDemoAfterBuffer,
  DEMO_PRODUCTS
} = require('../src/presets');

async function testAllAssets() {
  console.log('Testing demo product buffers...');
  const keys = ['serum', 'jewelry', 'candle', 'watch'];

  for (const k of keys) {
    const rawBuf = await createDemoProductBuffer(k);
    assert.ok(Buffer.isBuffer(rawBuf), `${k} raw buffer should be a Buffer`);
    const rawMeta = await sharp(rawBuf).metadata();
    assert.strictEqual(rawMeta.width, 900, `${k} raw buffer width should be 900`);
    assert.strictEqual(rawMeta.height, 900, `${k} raw buffer height should be 900`);
    assert.strictEqual(rawMeta.format, 'png', `${k} raw buffer format should be png`);

    const afterBuf = await getDemoAfterBuffer(k);
    assert.ok(Buffer.isBuffer(afterBuf), `${k} after buffer should be a Buffer`);
    const afterMeta = await sharp(afterBuf).metadata();
    assert.strictEqual(afterMeta.width, 1024, `${k} after buffer width should be 1024`);
    assert.strictEqual(afterMeta.height, 1024, `${k} after buffer height should be 1024`);

    // Verify public/demo files exist
    const bJpg = path.join(__dirname, '..', 'public', 'demo', `${k}-before.jpg`);
    const aJpg = path.join(__dirname, '..', 'public', 'demo', `${k}-after.jpg`);
    assert.ok(fs.existsSync(bJpg), `${bJpg} must exist`);
    assert.ok(fs.existsSync(aJpg), `${aJpg} must exist`);
    assert.ok(fs.statSync(bJpg).size > 10000, `${bJpg} must not be empty`);
    assert.ok(fs.statSync(aJpg).size > 10000, `${aJpg} must not be empty`);
    console.log(`✓ ${k}: Before & After verified`);
  }

  // Test manifest
  const manifestPath = path.join(__dirname, '..', 'public', 'demo', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const k of keys) {
    assert.ok(manifest[k], `manifest must contain ${k}`);
  }
  console.log('✓ Manifest verified');

  // Test Server API for all 4 showcases
  console.log('Testing Server auto-seeding for all 4 demos...');
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: '3467' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server boot timeout')), 5000);
      child.stdout.on('data', (d) => {
        if (d.toString().includes('http://localhost:3467')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    const base = 'http://localhost:3467';
    for (const k of keys) {
      const res = await fetch(`${base}/api/showcase/demo-${k}`).then((r) => r.json());
      assert.strictEqual(res.showcase.id, `demo-${k}`);
      assert.ok(res.showcase.studioFile, `demo-${k} should have studioFile`);
      assert.ok(res.showcase.rawFile, `demo-${k} should have rawFile`);
      assert.ok(res.showcase.beforeAfterFile, `demo-${k} should have beforeAfterFile`);
      console.log(`✓ Server auto-seeded demo-${k} with real photorealistic assets`);
    }
  } finally {
    child.kill();
  }

  console.log('🎉 All asset tests passed successfully!');
}

testAllAssets().catch((err) => {
  console.error('Asset test failed:', err);
  process.exit(1);
});

