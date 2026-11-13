(function (global) {
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message) {
    const existing = document.querySelector('.toast-notice');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notice';
    toast.innerHTML = `<span>✓</span> <span>${esc(message)}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.25s, transform 0.25s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  }

  function copyText(text, btnEl, feedbackText = 'Copied ✓') {
    if (!navigator.clipboard) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      if (btnEl) {
        const orig = btnEl.textContent;
        btnEl.textContent = feedbackText;
        setTimeout(() => (btnEl.textContent = orig), 1500);
      }
      showToast(feedbackText);
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      if (btnEl) {
        const orig = btnEl.textContent;
        btnEl.textContent = feedbackText;
        setTimeout(() => (btnEl.textContent = orig), 1500);
      }
      showToast(feedbackText);
    });
  }

  function attachSlider(wrapEl) {
    if (!wrapEl) return;
    const afterImg = wrapEl.querySelector('.ba-after');
    const divider = wrapEl.querySelector('.ba-divider');
    const handle = wrapEl.querySelector('.ba-handle');

    if (!afterImg || !divider || !handle) return;

    let currentPct = 50;

    function setPos(pct) {
      currentPct = Math.max(2, Math.min(98, pct));
      afterImg.style.clipPath = `inset(0 0 0 ${currentPct}%)`;
      afterImg.style.webkitClipPath = `inset(0 0 0 ${currentPct}%)`;
      divider.style.left = `${currentPct}%`;
      handle.style.left = `${currentPct}%`;
    }

    function updateFromClientX(clientX) {
      const rect = wrapEl.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setPos(pct);
    }

    let dragging = false;

    // Pointer events
    wrapEl.addEventListener('pointerdown', (e) => {
      dragging = true;
      wrapEl.setPointerCapture?.(e.pointerId);
      updateFromClientX(e.clientX);
    });

    wrapEl.addEventListener('pointermove', (e) => {
      if (dragging) updateFromClientX(e.clientX);
    });

    const stopDrag = (e) => {
      if (dragging) {
        dragging = false;
        wrapEl.releasePointerCapture?.(e.pointerId);
      }
    };
    wrapEl.addEventListener('pointerup', stopDrag);
    wrapEl.addEventListener('pointercancel', stopDrag);

    // Keyboard support
    wrapEl.setAttribute('tabindex', '0');
    wrapEl.setAttribute('role', 'slider');
    wrapEl.setAttribute('aria-label', 'Before and After Image Comparison');
    wrapEl.setAttribute('aria-valuenow', '50');

    wrapEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPos(currentPct - 5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPos(currentPct + 5);
      }
    });

    // Expose programmatic control
    wrapEl._setSliderPos = setPos;
    wrapEl._getSliderPos = () => currentPct;
  }

  function renderShowcase(container, { showcase, offer, showcaseUrl, isPublicShowcase = false }) {
    if (!container || !showcase) return;

    const rawUrl = showcase.rawUrl || `/assets/${encodeURIComponent(showcase.rawFile)}`;
    const studioUrl = showcase.studioUrl || `/assets/${encodeURIComponent(showcase.studioFile)}`;
    const sqUrl = showcase.sqUrl || (showcase.adPackFiles?.squarePost ? `/assets/${encodeURIComponent(showcase.adPackFiles.squarePost)}` : studioUrl);
    const stUrl = showcase.stUrl || (showcase.adPackFiles?.storyAd ? `/assets/${encodeURIComponent(showcase.adPackFiles.storyAd)}` : studioUrl);
    const mkUrl = showcase.mkUrl || (showcase.adPackFiles?.marketplaceClean ? `/assets/${encodeURIComponent(showcase.adPackFiles.marketplaceClean)}` : studioUrl);
    const baUrl = showcase.baUrl || (showcase.beforeAfterFile ? `/assets/${encodeURIComponent(showcase.beforeAfterFile)}` : studioUrl);

    const packInr = `₹${Number(offer?.packIndiaPrice ?? 299).toLocaleString('en-IN')}`;
    const packUsd = `$${Number(offer?.packGlobalPrice ?? 12).toLocaleString('en-US')}`;
    const dfyInr = `₹${Number(offer?.dfyIndiaPrice ?? 2499).toLocaleString('en-IN')}`;
    const dfyUsd = `$${Number(offer?.dfyGlobalPrice ?? 49).toLocaleString('en-US')}`;

    const payBtns = [];
    if (offer?.razorpayLink) {
      payBtns.push(`<a class="btn btn-primary" href="${esc(offer.razorpayLink)}" target="_blank" rel="noopener">Unlock 20 HD Shots (${packInr} India) →</a>`);
    }
    if (offer?.dodoLink) {
      payBtns.push(`<a class="btn btn-primary" href="${esc(offer.dodoLink)}" target="_blank" rel="noopener">Unlock 20 HD Shots (${packUsd} Global) →</a>`);
    }
    if (offer?.whatsappLink) {
      payBtns.push(`<a class="btn btn-secondary" href="${esc(offer.whatsappLink)}" target="_blank" rel="noopener">Order via WhatsApp Concierge →</a>`);
    }

    const shareLink = showcaseUrl || `${window.location.origin}/showcase/${showcase.id}`;
    const brandDisplay = showcase.businessName || 'Your Brand';
    const productDisplay = showcase.productName || 'Product Edition';
    const priceDisplay = showcase.priceText || '₹499';

    // Cold DM & Pitch Scripts
    const scriptInstagram = `Hey ${brandDisplay} team! 👋 Love your collection.\n\nQuick question: are you shooting all your product photos in-house? We tested your ${productDisplay} photo with our luxury studio AI lighting setup and generated a ready-to-post 4-format ad pack (Feed + 9:16 Story + Pure White + Before/After proof):\n${shareLink}\n\nThought you'd love to see it! Let me know if you want the unwatermarked HD files.`;

    const scriptWhatsApp = `Hi! I came across ${brandDisplay} and saw your ${productDisplay}.\n\nWe turned your raw phone snapshot into 4 high-converting studio shots and Meta ads in seconds: ${shareLink}\n\nTake a look at the Before vs After comparison slider! We can do your entire catalog for ₹299 (20 photos). Interested?`;

    const scriptAdCaption = `✨ Elevate your everyday luxury with ${productDisplay}.\n\nHandcrafted quality, premium finish, and pure aesthetic satisfaction.\n\n🏷️ Special Price: ${priceDisplay}\n🛒 DM us on Instagram or tap the link in bio to order yours today!\n\n#${brandDisplay.replace(/\s+/g, '')} #${productDisplay.replace(/\s+/g, '')} #D2C #Handcrafted #LuxuryAesthetic #Shoppable`;

    container.innerHTML = `
      <div style="display:grid;gap:24px;margin:28px auto 60px;">
        <!-- Top Main Showcase Card -->
        <div class="card">
          <!-- Card Header & Meta Badges -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);">
            <div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center;">
                <span class="badge ${showcase.unlocked ? 'badge-pass' : 'badge-warn'}">
                  ${showcase.unlocked ? '✓ UNLOCKED HD PACK' : 'FREE PREVIEW (WATERMARKED)'}
                </span>
                <span class="badge badge-neutral">${esc(showcase.presetName || showcase.presetId)}</span>
                <span class="badge badge-neutral">Engine: ${esc(showcase.engineUsed || 'Studio Compositor')}</span>
                ${showcase.isStudioSample ? '<span class="badge" style="background:#eef2ff;color:#4f46e5;border:1px solid #c7d2fe;">OFFICIAL DEMO</span>' : ''}
              </div>
              <h2 style="margin:0;font-size:26px;letter-spacing:-0.025em;color:var(--ink);">
                ${esc(brandDisplay)} <span style="font-weight:400;color:var(--muted);">—</span> ${esc(productDisplay)}
              </h2>
            </div>
            
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn btn-dark btn-sm" id="ss-copy-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy Showcase Link
              </button>
              ${
                !isPublicShowcase
                  ? `<a class="btn btn-secondary btn-sm" href="/showcase/${esc(showcase.id)}" target="_blank">
                      Open Prospect Page ↗
                    </a>`
                  : ''
              }
            </div>
          </div>

          <!-- Split: Before/After Slider on Left, Complete Ad Pack on Right -->
          <div class="split-2">
            <!-- Left: Interactive Comparison -->
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span class="small muted" style="font-weight:800;letter-spacing:0.04em;">INTERACTIVE BEFORE / AFTER SLIDER</span>
                <span class="small muted" style="font-size:11.5px;">Drag handle or tap presets</span>
              </div>

              <!-- Slider Container -->
              <div id="ss-slider-container">
                <div class="ba-wrap" id="ss-ba-slider">
                  <img src="${rawUrl}" alt="Raw Phone Photo - Before" loading="eager" />
                  <img src="${studioUrl}" alt="SnapStudio AI - After" class="ba-after" loading="eager" />
                  <div class="ba-divider"></div>
                  <div class="ba-handle">↔</div>
                  <div class="ba-label left">📷 BEFORE (PHONE)</div>
                  <div class="ba-label right">✨ AFTER (STUDIO)</div>
                </div>
              </div>

              <!-- Side-by-side Container (Hidden by default) -->
              <div id="ss-side-container" class="ba-side-grid" style="display:none;">
                <div class="ba-side-item">
                  <img src="${rawUrl}" alt="Raw Phone Photo - Before" />
                  <div class="ba-label left" style="top:10px;left:10px;">BEFORE</div>
                </div>
                <div class="ba-side-item">
                  <img src="${studioUrl}" alt="SnapStudio AI - After" />
                  <div class="ba-label right" style="top:10px;right:10px;">AFTER</div>
                </div>
              </div>

              <!-- Slider Controls Toolbar -->
              <div class="ba-toolbar mt-12">
                <div class="ba-toolbar-left">
                  <span>Preset Snaps:</span>
                  <div class="ba-toolbar-presets">
                    <button type="button" class="ba-preset-btn" data-snap="25">25%</button>
                    <button type="button" class="ba-preset-btn" data-snap="50">50%</button>
                    <button type="button" class="ba-preset-btn" data-snap="75">75%</button>
                  </div>
                </div>
                <div>
                  <button type="button" class="ba-preset-btn" id="ss-toggle-view" style="font-size:11px;">
                    Switch to Side-by-Side ◫
                  </button>
                </div>
              </div>
            </div>

            <!-- Right: 4-Asset Seller Ad-Pack Grid -->
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h3 style="margin:0;font-size:18px;font-weight:800;letter-spacing:-0.02em;">Complete 4-Asset Seller Ad-Pack</h3>
                <span class="badge badge-neutral" style="font-size:10.5px;">READY TO POST</span>
              </div>
              <p class="small muted" style="margin:0 0 16px;line-height:1.5;">
                Every upload automatically composites 4 high-converting commercial formats: 1:1 Feed Ad, 9:16 Full Screen Story Ad, Amazon/Meesho White Listing, and Cold-DM Proof Card.
              </p>

              <div class="adpack-grid">
                <!-- 1:1 IG Feed Ad -->
                <div class="asset-card">
                  <div class="asset-badge">1:1 FEED • 1080×1080</div>
                  <div class="asset-img-wrap">
                    <img src="${sqUrl}" alt="Instagram Feed Ad" loading="lazy" />
                  </div>
                  <div class="asset-meta">
                    <div class="asset-info">
                      <strong class="asset-title">IG / FB Feed Ad</strong>
                      <span class="asset-sub">Sponsored &amp; Organic</span>
                    </div>
                    <a class="btn btn-sm btn-secondary" href="${sqUrl}" download="${esc(brandDisplay)}-feed-ad.png">Download</a>
                  </div>
                </div>

                <!-- 9:16 Story Ad with Phone Bezel -->
                <div class="asset-card">
                  <div class="asset-badge">9:16 STORY • 1080×1920</div>
                  <div class="asset-img-wrap" style="padding:10px 0;">
                    <img src="${stUrl}" class="story-bezel" alt="Instagram Story Ad" loading="lazy" />
                  </div>
                  <div class="asset-meta">
                    <div class="asset-info">
                      <strong class="asset-title">9:16 Story / Reel Ad</strong>
                      <span class="asset-sub">IG &amp; WhatsApp Status</span>
                    </div>
                    <a class="btn btn-sm btn-secondary" href="${stUrl}" download="${esc(brandDisplay)}-story-ad.png">Download</a>
                  </div>
                </div>

                <!-- 1:1 Marketplace Pure White -->
                <div class="asset-card">
                  <div class="asset-badge">MARKETPLACE • 1080×1080</div>
                  <div class="asset-img-wrap">
                    <img src="${mkUrl}" alt="Marketplace White Shot" loading="lazy" />
                  </div>
                  <div class="asset-meta">
                    <div class="asset-info">
                      <strong class="asset-title">Amazon / Meesho</strong>
                      <span class="asset-sub">Pure White Compliant</span>
                    </div>
                    <a class="btn btn-sm btn-secondary" href="${mkUrl}" download="${esc(brandDisplay)}-marketplace-white.png">Download</a>
                  </div>
                </div>

                <!-- 16:9 Before/After Comparison Card -->
                <div class="asset-card">
                  <div class="asset-badge">VIRAL PROOF • 1400×760</div>
                  <div class="asset-img-wrap">
                    <img src="${baUrl}" alt="Before After Proof Card" loading="lazy" />
                  </div>
                  <div class="asset-meta">
                    <div class="asset-info">
                      <strong class="asset-title">Cold-DM Proof Card</strong>
                      <span class="asset-sub">Before vs After Proof</span>
                    </div>
                    <a class="btn btn-sm btn-dark" href="${baUrl}" download="${esc(brandDisplay)}-proof-card.png">Download Card</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Copyable Outreach & DM Script Box -->
        <div class="script-card">
          <div class="script-header">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="badge" style="background:rgba(20,184,166,0.2);color:#5eead4;border:1px solid rgba(20,184,166,0.4);">
                  ⚡ READY-TO-SEND SCRIPTS
                </span>
                <strong style="font-size:15px;color:#ffffff;">Personalized Outreach &amp; Ad Pitch</strong>
              </div>
              <p class="small muted" style="margin:4px 0 0;color:#94a3b8;">
                Send this cold DM to prospective buyers or use as your live campaign caption.
              </p>
            </div>

            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <div class="script-tabs" id="ss-script-tabs">
                <button type="button" class="script-tab-btn active" data-script="instagram">Instagram DM</button>
                <button type="button" class="script-tab-btn" data-script="whatsapp">WhatsApp Pitch</button>
                <button type="button" class="script-tab-btn" data-script="caption">Ad Caption</button>
              </div>
              <button type="button" class="btn btn-sm btn-primary" id="ss-copy-script-btn">
                Copy Script
              </button>
            </div>
          </div>

          <div class="script-box" id="ss-script-content">${esc(scriptInstagram)}</div>
        </div>

        <!-- Offer Box / Unlock HD Pack Section -->
        ${
          !showcase.unlocked
            ? `
          <div class="offer-box">
            <div>
              <span class="badge" style="background:rgba(16,185,129,0.2);color:#a7f3d0;border:1px solid rgba(16,185,129,0.35);">
                Instant Unwatermarked HD
              </span>
              <h3 style="margin:12px 0 8px;font-size:26px;">Unlock 20 Studio + Ad-Pack Photos Now</h3>
              <p>
                Remove all preview watermarks, unlock all 10 luxury Studio &amp; AI Model presets, and download high-resolution commercial assets ready for Meesho, Amazon, Etsy, and Meta Ads.
              </p>
              
              <div class="feature-list">
                <div class="feature-item"><span class="check">✓</span> <span>20 High-Resolution Renders with Watermark Removed</span></div>
                <div class="feature-item"><span class="check">✓</span> <span>Complete 4-Format Ad Pack with every shot (1:1, 9:16, White, Card)</span></div>
                <div class="feature-item"><span class="check">✓</span> <span>Full Commercial License for Paid Meta &amp; Marketplace Listings</span></div>
              </div>

              <div class="mt-16 small" style="color:#cbd5e1;background:rgba(255,255,255,0.06);padding:10px 14px;border-radius:10px;">
                <strong>Self-Serve 20-Photo Pack:</strong> ${packInr} (India) • ${packUsd} (Global)<br/>
                <strong>Done-For-You 50-Photo Catalog:</strong> ${dfyInr} (India) • ${dfyUsd} (Global)
              </div>
            </div>

            <div class="pay-panel">
              ${
                payBtns.length > 0
                  ? payBtns.join('')
                  : `<div class="small" style="color:#cbd5e1;">Configure your UPI ID, Razorpay, Dodo Payments, and WhatsApp in <a href="/studio" style="color:#5eead4;">Founder Studio → Settings</a>.</div>`
              }
              ${
                offer?.upiQrDataUrl
                  ? `<div style="display:flex;align-items:center;gap:12px;background:#ffffff;color:#090d16;padding:12px;border-radius:12px;">
                      <img src="${esc(offer.upiQrDataUrl)}" alt="UPI QR Code" style="width:78px;height:78px;border-radius:6px;border:1px solid #e2e8f0;" />
                      <div style="font-size:12px;line-height:1.4;">
                        <strong>Scan &amp; Pay ${packInr} via UPI</strong><br/>
                        <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px;">${esc(offer.upiId)}</code><br/>
                        <span class="muted" style="font-size:11px;">Send screenshot on WhatsApp to receive your instant Credit Code!</span>
                      </div>
                    </div>`
                  : ''
              }
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;

    // Attach Interactive Slider
    const sliderWrap = container.querySelector('#ss-ba-slider');
    attachSlider(sliderWrap);

    // Preset Snaps
    container.querySelectorAll('.ba-preset-btn[data-snap]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const snapPct = Number(btn.dataset.snap || 50);
        if (sliderWrap && sliderWrap._setSliderPos) {
          sliderWrap._setSliderPos(snapPct);
        }
      });
    });

    // Toggle Slider vs Side-by-Side
    const toggleViewBtn = container.querySelector('#ss-toggle-view');
    const sliderContainer = container.querySelector('#ss-slider-container');
    const sideContainer = container.querySelector('#ss-side-container');
    let isSideBySide = false;

    if (toggleViewBtn && sliderContainer && sideContainer) {
      toggleViewBtn.addEventListener('click', () => {
        isSideBySide = !isSideBySide;
        if (isSideBySide) {
          sliderContainer.style.display = 'none';
          sideContainer.style.display = 'grid';
          toggleViewBtn.textContent = 'Switch to Slider ↔';
        } else {
          sliderContainer.style.display = 'block';
          sideContainer.style.display = 'none';
          toggleViewBtn.textContent = 'Switch to Side-by-Side ◫';
        }
      });
    }

    // Copy Showcase Link
    const copyLinkBtn = container.querySelector('#ss-copy-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        copyText(shareLink, copyLinkBtn, 'Copied Link ✓');
      });
    }

    // Script Tabs Switcher & Copy
    const scriptBox = container.querySelector('#ss-script-content');
    const copyScriptBtn = container.querySelector('#ss-copy-script-btn');
    const scripts = {
      instagram: scriptInstagram,
      whatsapp: scriptWhatsApp,
      caption: scriptAdCaption
    };
    let activeScript = 'instagram';

    container.querySelectorAll('#ss-script-tabs .script-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#ss-script-tabs .script-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeScript = btn.dataset.script;
        if (scriptBox) {
          scriptBox.textContent = scripts[activeScript] || '';
        }
      });
    });

    if (copyScriptBtn) {
      copyScriptBtn.addEventListener('click', () => {
        const textToCopy = scripts[activeScript] || '';
        copyText(textToCopy, copyScriptBtn, 'Script Copied ✓');
      });
    }
  }

  global.SnapStudioView = {
    renderShowcase,
    attachSlider,
    esc,
    showToast,
    copyText
  };
})(typeof window !== 'undefined' ? window : this);
