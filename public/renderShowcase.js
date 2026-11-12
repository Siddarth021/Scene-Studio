(function (global) {
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attachSlider(wrapEl) {
    if (!wrapEl) return;
    const afterImg = wrapEl.querySelector('.ba-after');
    const divider = wrapEl.querySelector('.ba-divider');
    const handle = wrapEl.querySelector('.ba-handle');

    function updatePos(clientX) {
      const rect = wrapEl.getBoundingClientRect();
      const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
      afterImg.style.clipPath = `inset(0 0 0 ${pct}%)`;
      divider.style.left = `${pct}%`;
      handle.style.left = `${pct}%`;
    }

    let dragging = false;
    wrapEl.addEventListener('pointerdown', (e) => {
      dragging = true;
      updatePos(e.clientX);
    });
    window.addEventListener('pointermove', (e) => {
      if (dragging) updatePos(e.clientX);
    });
    window.addEventListener('pointerup', () => {
      dragging = false;
    });
  }

  function renderShowcase(container, { showcase, offer, showcaseUrl, isPublicShowcase = false }) {
    const rawUrl = `/assets/${encodeURIComponent(showcase.rawFile)}`;
    const studioUrl = `/assets/${encodeURIComponent(showcase.studioFile)}`;
    const sqUrl = `/assets/${encodeURIComponent(showcase.adPackFiles.squarePost)}`;
    const stUrl = `/assets/${encodeURIComponent(showcase.adPackFiles.storyAd)}`;
    const mkUrl = `/assets/${encodeURIComponent(showcase.adPackFiles.marketplaceClean)}`;
    const baUrl = `/assets/${encodeURIComponent(showcase.beforeAfterFile)}`;

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
      payBtns.push(`<a class="btn btn-secondary" href="${esc(offer.whatsappLink)}" target="_blank" rel="noopener">Order via WhatsApp →</a>`);
    }

    const shareLink = showcaseUrl || `${window.location.origin}/showcase/${showcase.id}`;

    container.innerHTML = `
      <div style="display:grid;gap:20px;margin:26px auto 60px;">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
            <div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <span class="badge ${showcase.unlocked ? 'badge-pass' : 'badge-warn'}">${showcase.unlocked ? 'UNLOCKED HD PACK' : 'FREE PREVIEW (WATERMARKED)'}</span>
                <span class="badge badge-neutral">${esc(showcase.presetName || showcase.presetId)}</span>
                <span class="badge badge-neutral">Engine: ${esc(showcase.engineUsed)}</span>
              </div>
              <h2 style="margin:0;font-size:24px;">${esc(showcase.businessName)} — ${esc(showcase.productName)}</h2>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-dark btn-sm" id="ss-copy-link">Copy Showcase Link</button>
              ${!isPublicShowcase ? `<a class="btn btn-secondary btn-sm" href="/showcase/${esc(showcase.id)}" target="_blank">Open Prospect Page ↗</a>` : ''}
            </div>
          </div>

          <div class="split-2">
            <div>
              <div class="small muted" style="font-weight:700;margin-bottom:8px;text-align:center;">DRAG SLIDER TO COMPARE BEFORE / AFTER</div>
              <div class="ba-wrap" id="ss-ba-slider">
                <img src="${rawUrl}" alt="Raw Phone Photo" />
                <img src="${studioUrl}" alt="SnapStudio Result" class="ba-after" />
                <div class="ba-divider"></div>
                <div class="ba-handle">↔</div>
                <div class="ba-label left">BEFORE</div>
                <div class="ba-label right">AFTER</div>
              </div>
            </div>

            <div>
              <h3 style="margin:0 0 10px;font-size:18px;">Complete Seller Ad-Pack Included</h3>
              <p class="small muted" style="margin:0 0 14px;">Every upload renders a clean studio photo, Instagram Feed Ad, 9:16 Story Ad, Amazon/Meesho White Listing, and Before/After Proof Card.</p>
              <div class="gallery-grid">
                <div class="asset-card">
                  <img src="${studioUrl}" alt="Main Studio Shot" />
                  <div class="asset-meta">
                    <strong class="small">Studio Shot</strong>
                    <a class="btn btn-sm btn-secondary" href="${studioUrl}" download="studio-shot.png">Download</a>
                  </div>
                </div>
                <div class="asset-card">
                  <img src="${sqUrl}" alt="Instagram Feed Ad" />
                  <div class="asset-meta">
                    <strong class="small">1:1 IG Feed Ad</strong>
                    <a class="btn btn-sm btn-secondary" href="${sqUrl}" download="instagram-feed-ad.png">Download</a>
                  </div>
                </div>
                <div class="asset-card">
                  <img src="${stUrl}" alt="Instagram Story Ad" />
                  <div class="asset-meta">
                    <strong class="small">9:16 Story Ad</strong>
                    <a class="btn btn-sm btn-secondary" href="${stUrl}" download="instagram-story-ad.png">Download</a>
                  </div>
                </div>
                <div class="asset-card">
                  <img src="${mkUrl}" alt="Marketplace White Shot" />
                  <div class="asset-meta">
                    <strong class="small">Amazon / Meesho</strong>
                    <a class="btn btn-sm btn-secondary" href="${mkUrl}" download="marketplace-white.png">Download</a>
                  </div>
                </div>
              </div>

              <div class="mt-16 asset-card">
                <img src="${baUrl}" alt="Before After Card" style="aspect-ratio:1400/760;" />
                <div class="asset-meta">
                  <strong class="small">Before / After Comparison Card (Great for IG/WhatsApp)</strong>
                  <a class="btn btn-sm btn-dark" href="${baUrl}" download="before-after-proof.png">Download Card</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${
          !showcase.unlocked
            ? `
          <div class="offer-box">
            <div>
              <span class="badge" style="background:rgba(16,185,129,0.2);color:#a7f3d0;">Instant Unwatermarked HD</span>
              <h3 style="margin:10px 0 6px;font-size:24px;">Unlock 20 Studio + Ad-Pack Photos Now</h3>
              <p>Remove all preview watermarks, unlock all 10 Studio &amp; AI Model presets, and download high-resolution 1080px assets ready for Meesho, Amazon, Etsy, and Meta Ads.</p>
              <div class="small" style="color:#e2e8f0;">
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
                  ? `<div style="display:flex;align-items:center;gap:12px;background:#fff;color:#0f172a;padding:10px;border-radius:10px;">
                      <img src="${esc(offer.upiQrDataUrl)}" alt="UPI QR" style="width:74px;height:74px;" />
                      <div style="font-size:12px;">
                        <strong>Scan &amp; Pay ${packInr} via UPI</strong><br/>
                        <span>${esc(offer.upiId)}</span><br/>
                        <span class="muted">Send screenshot on WhatsApp to receive your instant Credit Code!</span>
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

    attachSlider(container.querySelector('#ss-ba-slider'));
    const copyBtn = container.querySelector('#ss-copy-link');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(shareLink).then(() => {
          copyBtn.textContent = 'Copied Link ✓';
          setTimeout(() => (copyBtn.textContent = 'Copy Showcase Link'), 1500);
        });
      });
    }
  }

  global.SnapStudioView = { renderShowcase, esc };
})(window);

