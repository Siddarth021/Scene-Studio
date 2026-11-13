(function () {
  let presets = { scene: [], tryon: [] };
  let activeMode = 'scene';
  let selectedPresetId = 'marble_luxury';
  let demoSample = 'jewelry';
  let selectedFile = null;
  let publicOffer = null;

  // Cached demo showcase data
  const demoShowcaseCache = {};

  const form = document.getElementById('genForm');
  const dropzone = document.getElementById('dropzone');
  const imageInput = document.getElementById('imageInput');
  const previewThumb = document.getElementById('previewThumb');
  const presetGrid = document.getElementById('presetGrid');
  const statusEl = document.getElementById('genStatus');
  const resultContainer = document.getElementById('resultContainer');
  const generateBtn = document.getElementById('generateBtn');
  const creditCodeInput = document.getElementById('creditCodeInput');
  const creditMsg = document.getElementById('creditMsg');
  const heroDemoContent = document.getElementById('heroDemoContent');

  function setStatus(type, msg) {
    if (!msg) {
      statusEl.className = 'status-banner';
      statusEl.textContent = '';
      statusEl.style.display = 'none';
      return;
    }
    statusEl.className = `status-banner ${type}`;
    statusEl.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ️'}</span> <span>${window.SnapStudioView ? window.SnapStudioView.esc(msg) : msg}</span>`;
    statusEl.style.display = 'flex';
  }

  function renderPresets() {
    const list = presets[activeMode] || [];
    if (!list.some((p) => p.id === selectedPresetId) && list[0]) {
      selectedPresetId = list[0].id;
    }
    presetGrid.innerHTML = '';
    for (const p of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-card' + (p.id === selectedPresetId ? ' selected' : '');
      const esc = window.SnapStudioView ? window.SnapStudioView.esc : (s) => s;
      btn.innerHTML = `
        <div class="preset-title">
          <span>${esc(p.name)}</span>
          ${p.id === selectedPresetId ? '<span style="color:var(--accent);font-size:12px;">✓</span>' : ''}
        </div>
        <div class="preset-tag">${esc(p.tag)}</div>
      `;
      btn.addEventListener('click', () => {
        selectedPresetId = p.id;
        renderPresets();
      });
      presetGrid.appendChild(btn);
    }
  }

  // Load and render interactive demo showcase in Hero section
  async function loadHeroDemo(sampleKey) {
    if (!heroDemoContent) return;

    const demoMap = {
      jewelry: { id: 'demo-jewelry', name: 'Royal Kundan Choker', brand: 'Eclaypse Handmade Jewelry', price: '₹1,499', preset: 'marble_luxury' },
      serum: { id: 'demo-serum', name: 'Saffron Glow Serum', brand: 'Noor Essentials', price: '₹699', preset: 'marble_luxury' },
      candle: { id: 'demo-candle', name: 'Vanilla Soy Candle', brand: 'Botanica Aromas', price: '₹499', preset: 'sunlight_lifestyle' },
      watch: { id: 'demo-watch', name: 'Vintage Leather Chronograph', brand: 'Aethel Chrono', price: '₹2,499', preset: 'dark_moody' }
    };

    const d = demoMap[sampleKey] || demoMap.jewelry;

    try {
      if (!demoShowcaseCache[d.id]) {
        heroDemoContent.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);"><span class="live-pulse" style="display:inline-block;margin-right:8px;"></span> Loading interactive ${d.name} studio showcase...</div>`;
        const res = await fetch(`/api/showcase/${encodeURIComponent(d.id)}`);
        if (res.ok) {
          const data = await res.json();
          demoShowcaseCache[d.id] = data;
        }
      }

      const cached = demoShowcaseCache[d.id];
      if (cached && window.SnapStudioView) {
        window.SnapStudioView.renderShowcase(heroDemoContent, {
          showcase: cached.showcase,
          offer: cached.offer || publicOffer,
          showcaseUrl: `${window.location.origin}/showcase/${d.id}`,
          isPublicShowcase: false
        });

        // Add "Use This Product in Generator" action banner at the top of demo
        const heroCard = heroDemoContent.querySelector('.card');
        if (heroCard) {
          const ctaBanner = document.createElement('div');
          ctaBanner.style.cssText = 'background:var(--accent-soft);border:1px solid var(--accent-border);border-radius:12px;padding:10px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;';
          ctaBanner.innerHTML = `
            <div class="small" style="color:var(--accent);font-weight:700;">
              💡 Love this result? Try generating your own version with this demo product:
            </div>
            <button type="button" class="btn btn-sm btn-primary" id="btnUseDemoInGen">
              Load Into Studio Generator ↓
            </button>
          `;
          heroCard.insertBefore(ctaBanner, heroCard.firstChild);

          const useBtn = ctaBanner.querySelector('#btnUseDemoInGen');
          if (useBtn) {
            useBtn.addEventListener('click', () => {
              applyDemoProduct(sampleKey, d.name, d.price, d.brand, d.preset);
              const genSec = document.getElementById('generatorSection');
              if (genSec) genSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }
        }
      }
    } catch (err) {
      console.error('Error loading hero demo:', err);
    }
  }

  function applyDemoProduct(sampleKey, name, price, brand = '', preset = '') {
    selectedFile = null;
    imageInput.value = '';
    demoSample = sampleKey;
    previewThumb.src = `/demo/${sampleKey}-before.jpg`;
    previewThumb.style.display = 'inline-block';

    if (name) document.getElementById('productInput').value = name;
    if (price) document.getElementById('priceInput').value = price;
    if (brand) document.getElementById('brandInput').value = brand;

    if (preset) {
      selectedPresetId = preset;
      renderPresets();
    }

    setStatus('info', `Selected demo product: "${name}". Customize details and click "Generate Studio + Ad Pack" below!`);
  }

  async function init() {
    try {
      const res = await fetch('/api/public-config');
      const data = await res.json();
      presets = data.presets || { scene: [], tryon: [] };
      publicOffer = data.offer || null;
      if (publicOffer?.brandName) {
        document.getElementById('navBrand').textContent = publicOffer.brandName;
      }
      const eng = publicOffer?.engines || {};
      const pref = eng.defaultEngine || 'auto';
      let activeEngine = 'Local Studio Compositor (₹0 Cost)';
      if (pref === 'fal' && eng.falReady) {
        activeEngine = 'Fal.ai Photorealistic Studio';
      } else if (pref === 'gemini' && eng.geminiReady) {
        activeEngine = 'Gemini 2.5 Flash Engine';
      } else if (pref === 'huggingface' && eng.hfReady) {
        activeEngine = 'HuggingFace Studio Ready';
      } else if (eng.geminiReady) {
        activeEngine = 'Gemini 2.5 Flash Engine';
      } else if (eng.falReady) {
        activeEngine = 'Fal.ai Photorealistic Studio';
      }
      document.getElementById('engineBadge').textContent = activeEngine;
      renderPresets();

      // Load initial hero demo
      loadHeroDemo('jewelry');
    } catch (err) {
      console.warn('Config init error:', err);
    }
  }

  // Hero Demo Category Switcher
  document.querySelectorAll('#heroDemoTabs .demo-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#heroDemoTabs .demo-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const sample = chip.dataset.sample;
      loadHeroDemo(sample);
    });
  });

  // Dropzone Drag & Drop
  dropzone.addEventListener('click', () => imageInput.click());
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleSelectedFile(files[0]);
    }
  });

  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (file) handleSelectedFile(file);
  });

  function handleSelectedFile(file) {
    if (!file.type.match(/^image\/(png|jpe?g|webp)$/i)) {
      setStatus('error', 'Please upload a valid JPG, PNG, or WebP product image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus('error', 'File size exceeds 10 MB limit.');
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      previewThumb.src = reader.result;
      previewThumb.style.display = 'inline-block';
      setStatus('info', `Photo selected: ${file.name} (${(file.size / 1024).toFixed(0)} KB). Ready to generate!`);
    };
    reader.readAsDataURL(file);
  }

  // Demo item buttons in Generator
  document.querySelectorAll('.demo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyDemoProduct(btn.dataset.sample, btn.dataset.name, btn.dataset.price, '', btn.dataset.preset);
    });
  });

  // Workflow Mode Tabs
  document.querySelectorAll('#modeTabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modeTabs .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeMode = btn.dataset.mode;
      renderPresets();
    });
  });

  // Credit Verification
  document.getElementById('checkCreditBtn').addEventListener('click', async () => {
    const code = creditCodeInput.value.trim();
    if (!code) return;
    creditMsg.textContent = 'Verifying code...';
    try {
      const res = await fetch('/api/credits/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        creditMsg.style.color = 'var(--pass)';
        creditMsg.textContent = `✓ Active Pack! "${data.label}" — ${data.remainingCredits} of ${data.totalCredits} HD credits remaining.`;
      } else {
        creditMsg.style.color = 'var(--danger)';
        creditMsg.textContent = data.error || 'Invalid credit code.';
      }
    } catch {
      creditMsg.style.color = 'var(--danger)';
      creditMsg.textContent = 'Verification error.';
    }
  });

  // Form Submit & Generation
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    generateBtn.disabled = true;
    const originalBtnText = generateBtn.innerHTML;
    generateBtn.innerHTML = '<span>⚡</span> Generating Studio + 4 Ad Formats...';

    setStatus('info', 'Compositing luxury studio scene, 1:1 Feed Ad, 9:16 Story Ad, Pure White listing & Before/After proof card...');

    try {
      const fd = new FormData();
      if (selectedFile) {
        fd.append('image', selectedFile);
      } else {
        fd.append('demoSample', demoSample);
      }
      fd.append('presetId', selectedPresetId);
      fd.append('brandName', document.getElementById('brandInput').value.trim());
      fd.append('productName', document.getElementById('productInput').value.trim());
      fd.append('priceText', document.getElementById('priceInput').value.trim());
      fd.append('discountBadge', document.getElementById('badgeInput').value.trim());
      fd.append('ctaText', document.getElementById('ctaInput').value.trim());
      fd.append('customPrompt', document.getElementById('promptInput').value.trim());
      if (creditCodeInput.value.trim()) {
        fd.append('creditCode', creditCodeInput.value.trim());
      }

      const res = await fetch('/api/generate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed.');

      if (data.remainingCredits !== null && data.remainingCredits !== undefined) {
        creditMsg.style.color = 'var(--pass)';
        creditMsg.textContent = `✓ Unlocked HD render! ${data.remainingCredits} credits remaining.`;
      }

      setStatus('success', 'Studio & Seller Ad Pack ready! Drag the slider below to inspect Before vs. After.');
      window.SnapStudioView.renderShowcase(resultContainer, {
        showcase: data.showcase,
        offer: publicOffer,
        showcaseUrl: data.showcaseUrl,
        isPublicShowcase: false
      });
      resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      setStatus('error', err.message || 'Unable to generate images.');
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = originalBtnText;
    }
  });

  init();
})();
