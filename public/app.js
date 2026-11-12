(function () {
  let presets = { scene: [], tryon: [] };
  let activeMode = 'scene';
  let selectedPresetId = 'marble_luxury';
  let demoSample = 'serum';
  let selectedFile = null;
  let publicOffer = null;

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

  function setStatus(type, msg) {
    if (!msg) {
      statusEl.className = 'status-banner';
      statusEl.textContent = '';
      return;
    }
    statusEl.className = `status-banner ${type}`;
    statusEl.textContent = msg;
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
      btn.innerHTML = `<div class="preset-title">${window.SnapStudioView.esc(p.name)}</div><div class="preset-tag">${window.SnapStudioView.esc(p.tag)}</div>`;
      btn.addEventListener('click', () => {
        selectedPresetId = p.id;
        renderPresets();
      });
      presetGrid.appendChild(btn);
    }
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
      let activeEngine = 'Local Studio Compositor (Add API key in /studio for AI)';
      if (pref === 'fal' && eng.falReady) {
        activeEngine = 'Fal.ai Product Shot Ready';
      } else if (pref === 'huggingface' && eng.hfReady) {
        activeEngine = 'HuggingFace Free Cutout Ready';
      } else if (pref === 'gemini' && eng.geminiReady) {
        activeEngine = 'Gemini 2.5 Flash Image Ready';
      } else if (pref === 'local') {
        activeEngine = 'Local Studio Compositor (₹0)';
      } else if (eng.geminiReady) {
        activeEngine = 'Gemini 2.5 Flash Image Ready';
      } else if (eng.falReady) {
        activeEngine = 'Fal.ai Product Shot Ready';
      } else if (eng.hfReady) {
        activeEngine = 'HuggingFace Free Cutout Ready';
      }
      document.getElementById('engineBadge').textContent = activeEngine;
      renderPresets();
    } catch {
      // ignore
    }
  }

  dropzone.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      previewThumb.src = reader.result;
      previewThumb.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  });

  document.querySelectorAll('.demo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedFile = null;
      imageInput.value = '';
      previewThumb.style.display = 'none';
      demoSample = btn.dataset.sample;
      document.getElementById('productInput').value = btn.dataset.name;
      document.getElementById('priceInput').value = btn.dataset.price;
      setStatus('info', `Selected built-in demo photo: ${btn.dataset.name}. Click "Generate Studio + Ad Pack" to preview!`);
    });
  });

  document.querySelectorAll('#modeTabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modeTabs .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeMode = btn.dataset.mode;
      renderPresets();
    });
  });

  document.getElementById('checkCreditBtn').addEventListener('click', async () => {
    const code = creditCodeInput.value.trim();
    if (!code) return;
    creditMsg.textContent = 'Checking code...';
    const res = await fetch('/api/credits/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      creditMsg.style.color = '#15803d';
      creditMsg.textContent = `✓ Active! "${data.label}" — ${data.remainingCredits} of ${data.totalCredits} HD credits remaining.`;
    } else {
      creditMsg.style.color = '#dc2626';
      creditMsg.textContent = data.error || 'Invalid credit code.';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    generateBtn.disabled = true;
    setStatus('info', 'Generating studio scene, Instagram Feed Ad, 9:16 Story Ad, and Before/After card...');

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
        creditMsg.style.color = '#15803d';
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
    }
  });

  init();
})();

