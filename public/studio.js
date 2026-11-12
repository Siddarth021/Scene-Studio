(function () {
  let studioPin = sessionStorage.getItem('ss_studio_pin') || '';
  let state = { stats: {}, showcases: [], credits: [], prospects: [], settings: {}, launchTemplates: [] };
  let presets = [];
  let sSelectedFile = null;
  let lastShowcase = null;
  let lastShowcaseUrl = '';

  const pinGate = document.getElementById('pinGate');
  const pinForm = document.getElementById('pinForm');
  const pinError = document.getElementById('pinError');
  const studioApp = document.getElementById('studioApp');

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showStatus(el, type, msg) {
    if (!el) return;
    if (!msg) {
      el.className = 'status-banner';
      el.textContent = '';
      return;
    }
    el.className = `status-banner ${type}`;
    el.textContent = msg;
  }

  async function apiFetch(url, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (!(opts.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (studioPin) headers['x-studio-pin'] = studioPin;
    const res = await fetch(url, { ...opts, headers });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        studioPin = '';
        sessionStorage.removeItem('ss_studio_pin');
        pinGate.style.display = 'block';
        studioApp.style.display = 'none';
      }
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }

  function copyValue(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return;
      const old = btn.textContent;
      btn.textContent = 'Copied ✓';
      setTimeout(() => (btn.textContent = old), 1400);
    });
  }

  function renderStats() {
    const s = state.stats || {};
    document.getElementById('kpiInr').textContent = `₹${Number(s.revenueInr || 0).toLocaleString('en-IN')}`;
    document.getElementById('kpiUsd').textContent = `$${Number(s.revenueUsd || 0).toLocaleString('en-US')}`;
    document.getElementById('kpiApi').textContent = `₹${s.apiSpendInr || 0} / ₹${s.apiBudgetInr || 1300}`;
    document.getElementById('kpiToday').textContent = `${s.sentToday || 0} / 20`;
    document.getElementById('kpiReply').textContent = `${s.replyRate || 0}%`;
    document.getElementById('creditCount').textContent = String((state.credits || []).length);
    document.getElementById('crmCount').textContent = String((state.prospects || []).length);
  }

  function renderPresetOptions() {
    const sel = document.getElementById('sPreset');
    const prev = sel.value;
    sel.innerHTML = '';
    for (const p of presets) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.mode === 'tryon' ? '[Model] ' : '[Scene] '}${p.name}`;
      sel.appendChild(opt);
    }
    if (prev) sel.value = prev;
  }

  function renderCredits() {
    const tbody = document.getElementById('creditsTableBody');
    const list = state.credits || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted small">No credit codes issued yet. Create one on the left when a buyer pays via UPI / Razorpay / Dodo!</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map((c) => {
        const sym = c.currency === 'USD' ? '$' : '₹';
        return `
          <tr>
            <td><strong><code>${esc(c.code)}</code></strong> <button class="btn btn-sm btn-secondary copy-code" data-code="${esc(c.code)}" type="button">Copy</button></td>
            <td>${esc(c.label)}</td>
            <td><strong>${c.remainingCredits}</strong> / ${c.totalCredits}</td>
            <td>${sym}${c.pricePaid}</td>
            <td><button class="btn btn-sm btn-secondary toggle-code" data-id="${esc(c.id)}" data-active="${c.active}" type="button">${c.active ? 'Disable' : 'Enable'}</button></td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('.copy-code').forEach((btn) => {
      btn.addEventListener('click', () => copyValue(btn.dataset.code, btn));
    });
    tbody.querySelectorAll('.toggle-code').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nextActive = btn.dataset.active !== 'true';
        await apiFetch('/api/studio/credits/' + encodeURIComponent(btn.dataset.id), {
          method: 'PATCH',
          body: JSON.stringify({ active: nextActive })
        });
        await bootstrap();
      });
    });
  }

  function renderCrm() {
    const tbody = document.getElementById('crmTableBody');
    const list = state.prospects || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted small">No sellers saved yet. Generate a sample in Tab 1 and click "Save to CRM".</td></tr>';
      return;
    }
    const stages = [
      ['found', 'Found'],
      ['sample_ready', 'Sample Ready'],
      ['dm_sent', 'DM Sent'],
      ['replied', 'Replied'],
      ['paid', 'Paid 💰'],
      ['delivered', 'Delivered ✓']
    ];
    tbody.innerHTML = list
      .map((p) => {
        const sym = p.currency === 'INR' ? '₹' : '$';
        return `
          <tr data-pid="${esc(p.id)}">
            <td>
              <strong>${esc(p.businessName)}</strong><br/>
              <span class="small muted">${esc(p.productName || '')}</span><br/>
              ${p.showcaseId ? `<a class="small" href="/showcase/${esc(p.showcaseId)}" target="_blank">Open Showcase ↗</a>` : ''}
            </td>
            <td><span class="badge badge-neutral">${esc(p.channel)}</span><br/><span class="small">${esc(p.sellerHandle || '—')}</span></td>
            <td>
              <select class="crm-stage" style="min-width:125px;padding:6px 8px;">
                ${stages.map(([v, l]) => `<option value="${v}" ${p.stage === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </td>
            <td>
              <div style="display:flex;align-items:center;gap:4px;">
                <span>${sym}</span>
                <input class="crm-val" type="number" value="${esc(p.dealValue)}" style="width:86px;padding:6px 8px;" />
              </div>
            </td>
            <td><input class="crm-notes" type="text" value="${esc(p.notes || '')}" style="min-width:140px;padding:6px 8px;" /></td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-sm btn-secondary crm-save" type="button">Save</button>
                <button class="btn btn-sm btn-secondary crm-del" type="button" style="color:#dc2626;">✕</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('tr[data-pid]').forEach((row) => {
      const id = row.dataset.pid;
      const stageSel = row.querySelector('.crm-stage');
      const valInput = row.querySelector('.crm-val');
      const notesInput = row.querySelector('.crm-notes');
      const saveBtn = row.querySelector('.crm-save');
      const delBtn = row.querySelector('.crm-del');

      stageSel.addEventListener('change', async () => {
        const res = await apiFetch('/api/studio/prospects/' + encodeURIComponent(id), {
          method: 'PATCH',
          body: JSON.stringify({ stage: stageSel.value })
        });
        state.stats = res.stats;
        renderStats();
      });

      saveBtn.addEventListener('click', async () => {
        const res = await apiFetch('/api/studio/prospects/' + encodeURIComponent(id), {
          method: 'PATCH',
          body: JSON.stringify({ stage: stageSel.value, dealValue: Number(valInput.value), notes: notesInput.value })
        });
        state.stats = res.stats;
        renderStats();
        saveBtn.textContent = 'Saved ✓';
        setTimeout(() => (saveBtn.textContent = 'Save'), 1200);
      });

      delBtn.addEventListener('click', async () => {
        const res = await apiFetch('/api/studio/prospects/' + encodeURIComponent(id), { method: 'DELETE' });
        state.prospects = state.prospects.filter((x) => x.id !== id);
        state.stats = res.stats;
        renderStats();
        renderCrm();
      });
    });
  }

  function renderSettings() {
    const s = state.settings || {};
    document.getElementById('navBrand').textContent = s.brandName || 'SnapStudio';
    document.getElementById('setBrand').value = s.brandName || '';
    document.getElementById('setFounder').value = s.founderName || '';
    document.getElementById('setGemini').value = s.geminiApiKey || '';
    document.getElementById('setFal').value = s.falApiKey || '';
    document.getElementById('setEngine').value = s.defaultEngine || 'auto';
    document.getElementById('setPin').value = s.studioPin || '';
    document.getElementById('setUpi').value = s.upiId || '';
    document.getElementById('setWa').value = s.whatsappNumber || '';
    document.getElementById('setRzp').value = s.razorpayLink || '';
    document.getElementById('setDodo').value = s.dodoLink || '';
    document.getElementById('setPackInr').value = s.packIndiaPrice ?? 299;
    document.getElementById('setPackUsd').value = s.packGlobalPrice ?? 12;
    document.getElementById('setDfyInr').value = s.dfyIndiaPrice ?? 2499;
    document.getElementById('setDfyUsd').value = s.dfyGlobalPrice ?? 49;
    document.getElementById('setWaVerify').value = s.whatsappVerifyToken || 'snapstudio_verify';
    document.getElementById('setWaPhoneId').value = s.whatsappPhoneNumberId || '';
    document.getElementById('setWaToken').value = s.whatsappAccessToken || '';
  }

  function renderLaunchTemplates() {
    const el = document.getElementById('launchList');
    el.innerHTML = (state.launchTemplates || [])
      .map(
        (t, i) => `
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
            <strong class="small">${esc(t.channel)}</strong>
            <button class="btn btn-sm btn-secondary copy-launch" data-idx="${i}" type="button">Copy</button>
          </div>
          <div class="small" style="font-weight:700;margin-bottom:6px;">${esc(t.title)}</div>
          <textarea rows="5" readonly>${esc(t.body)}</textarea>
        </div>
      `
      )
      .join('');
    el.querySelectorAll('.copy-launch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = state.launchTemplates[Number(btn.dataset.idx)];
        copyValue(`${t.title}\n\n${t.body}`, btn);
      });
    });
  }

  async function bootstrap() {
    const auth = await fetch('/api/studio/auth-status', {
      headers: studioPin ? { 'x-studio-pin': studioPin } : {}
    }).then((r) => r.json());

    if (auth.pinEnabled && !auth.authorized) {
      pinGate.style.display = 'block';
      studioApp.style.display = 'none';
      return;
    }
    pinGate.style.display = 'none';
    studioApp.style.display = 'block';

    const [cfg, data] = await Promise.all([
      fetch('/api/public-config').then((r) => r.json()),
      apiFetch('/api/studio/bootstrap')
    ]);
    presets = [...(cfg.presets?.scene || []), ...(cfg.presets?.tryon || [])];
    state = data;
    renderPresetOptions();
    renderStats();
    renderCredits();
    renderCrm();
    renderSettings();
    renderLaunchTemplates();
  }

  pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    studioPin = document.getElementById('pinInput').value.trim();
    sessionStorage.setItem('ss_studio_pin', studioPin);
    try {
      await bootstrap();
      showStatus(pinError, '', '');
    } catch {
      showStatus(pinError, 'error', 'Incorrect Studio PIN.');
    }
  });

  document.getElementById('refreshBtn').addEventListener('click', bootstrap);

  document.querySelectorAll('#studioTabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#studioTabs .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.studio-pane').forEach((p) => (p.style.display = 'none'));
      document.getElementById('pane-' + btn.dataset.tab).style.display = 'block';
    });
  });

  const sDropzone = document.getElementById('sDropzone');
  const sImageInput = document.getElementById('sImageInput');
  const sThumb = document.getElementById('sThumb');
  sDropzone.addEventListener('click', () => sImageInput.click());
  sImageInput.addEventListener('change', () => {
    const file = sImageInput.files?.[0];
    if (!file) return;
    sSelectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      sThumb.src = reader.result;
      sThumb.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('dmSampleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dmStatus = document.getElementById('dmStatus');
    const btn = document.getElementById('genSampleBtn');
    btn.disabled = true;
    showStatus(dmStatus, 'info', 'Generating clean HD sample, Before/After DM card, and seller outreach copy...');
    try {
      const fd = new FormData();
      if (sSelectedFile) fd.append('image', sSelectedFile);
      else fd.append('demoSample', 'jewelry');
      fd.append('businessName', document.getElementById('sBiz').value.trim());
      fd.append('productName', document.getElementById('sProd').value.trim());
      fd.append('sellerHandle', document.getElementById('sHandle').value.trim());
      fd.append('market', document.getElementById('sMarket').value);
      fd.append('priceText', document.getElementById('sPrice').value.trim());
      fd.append('presetId', document.getElementById('sPreset').value);
      fd.append('engine', document.getElementById('sEngine').value);
      fd.append('customPrompt', document.getElementById('sPrompt').value.trim());

      const data = await apiFetch('/api/studio/generate-sample', { method: 'POST', body: fd });
      lastShowcase = data.showcase;
      lastShowcaseUrl = data.showcaseUrl;
      state.stats = data.stats;
      renderStats();

      document.getElementById('dmEmpty').style.display = 'none';
      document.getElementById('dmResults').style.display = 'block';
      const linkBtn = document.getElementById('sShowcaseLink');
      linkBtn.style.display = 'inline-flex';
      linkBtn.href = data.showcaseUrl;

      const baUrl = `/assets/${encodeURIComponent(data.showcase.beforeAfterFile)}`;
      document.getElementById('sBaImg').src = baUrl;
      document.getElementById('sBaDownload').href = baUrl;

      document.getElementById('txtIgDm').value = data.scripts.instagramDm;
      document.getElementById('txtWa').value = data.scripts.whatsappConcierge;
      document.getElementById('txtEmail').value = data.scripts.etsyOrEmail;
      document.getElementById('saveSellerBtn').disabled = false;

      showStatus(
        dmStatus,
        'success',
        `Ready via ${data.showcase.engineUsed}! ${data.showcase.apiWarning || 'Attach the Before/After PNG + Showcase Link in your DM.'}`
      );
    } catch (err) {
      showStatus(dmStatus, 'error', err.message);
    } finally {
      btn.disabled = false;
    }
  });

  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      copyValue(target.value, btn);
    });
  });

  document.getElementById('saveSellerBtn').addEventListener('click', async () => {
    if (!lastShowcase) return;
    const market = document.getElementById('sMarket').value;
    const res = await apiFetch('/api/studio/prospects', {
      method: 'POST',
      body: JSON.stringify({
        businessName: lastShowcase.businessName,
        productName: lastShowcase.productName,
        sellerHandle: document.getElementById('sHandle').value.trim(),
        channel: document.getElementById('sChannel').value,
        market,
        stage: 'dm_sent',
        showcaseId: lastShowcase.id,
        notes: `Sent sample: ${lastShowcaseUrl}`
      })
    });
    state.prospects.unshift(res.prospect);
    state.stats = res.stats;
    renderStats();
    renderCrm();
    showStatus(document.getElementById('dmStatus'), 'success', `Saved "${res.prospect.businessName}" to Seller CRM as DM Sent!`);
  });

  document.getElementById('creditForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('creditStatus');
    try {
      const res = await apiFetch('/api/studio/credits', {
        method: 'POST',
        body: JSON.stringify({
          label: document.getElementById('cLabel').value.trim(),
          totalCredits: Number(document.getElementById('cTotal').value),
          market: document.getElementById('cMarket').value,
          pricePaid: Number(document.getElementById('cPrice').value),
          customCode: document.getElementById('cCustom').value.trim()
        })
      });
      state.credits.unshift(res.credit);
      state.stats = res.stats;
      renderStats();
      renderCredits();
      showStatus(statusEl, 'success', `Issued code ${res.credit.code} (${res.credit.totalCredits} HD credits). Send it to your buyer!`);
    } catch (err) {
      showStatus(statusEl, 'error', err.message);
    }
  });

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('settingsStatus');
    try {
      const res = await apiFetch('/api/studio/settings', {
        method: 'PUT',
        body: JSON.stringify({
          brandName: document.getElementById('setBrand').value.trim(),
          founderName: document.getElementById('setFounder').value.trim(),
          geminiApiKey: document.getElementById('setGemini').value.trim(),
          falApiKey: document.getElementById('setFal').value.trim(),
          defaultEngine: document.getElementById('setEngine').value,
          studioPin: document.getElementById('setPin').value.trim(),
          upiId: document.getElementById('setUpi').value.trim(),
          whatsappNumber: document.getElementById('setWa').value.trim(),
          razorpayLink: document.getElementById('setRzp').value.trim(),
          dodoLink: document.getElementById('setDodo').value.trim(),
          packIndiaPrice: Number(document.getElementById('setPackInr').value),
          packGlobalPrice: Number(document.getElementById('setPackUsd').value),
          dfyIndiaPrice: Number(document.getElementById('setDfyInr').value),
          dfyGlobalPrice: Number(document.getElementById('setDfyUsd').value),
          whatsappVerifyToken: document.getElementById('setWaVerify').value.trim(),
          whatsappPhoneNumberId: document.getElementById('setWaPhoneId').value.trim(),
          whatsappAccessToken: document.getElementById('setWaToken').value.trim()
        })
      });
      state.settings = res.settings;
      const newPin = document.getElementById('setPin').value.trim();
      if (newPin && !newPin.startsWith('••••')) {
        studioPin = newPin;
        sessionStorage.setItem('ss_studio_pin', studioPin);
      }
      renderSettings();
      showStatus(statusEl, 'success', 'All AI keys, payment rails, and WhatsApp settings saved!');
    } catch (err) {
      showStatus(statusEl, 'error', err.message);
    }
  });

  bootstrap();
})();
