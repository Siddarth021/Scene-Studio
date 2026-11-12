const QRCode = require('qrcode');

function generateSellerDmScripts({ showcase, showcaseUrl, market = 'india', settings = {} }) {
  const brand = showcase?.businessName || 'there';
  const product = showcase?.productName || 'product';
  const packPrice = market === 'india' ? `₹${settings.packIndiaPrice ?? 299}` : `$${settings.packGlobalPrice ?? 12}`;
  const dfyPrice = market === 'india' ? `₹${settings.dfyIndiaPrice ?? 2499}` : `$${settings.dfyGlobalPrice ?? 49}`;
  const founder = settings.founderName || 'Alex';
  const studioBrand = settings.brandName || 'SnapStudio';

  const instagramDm = `Hey ${brand}! Love your ${product} 👋
I took one of your photos and ran it through ${studioBrand} to turn it into studio & Instagram Story creatives in 30 seconds — uploaded your free Before/After preview here:
${showcaseUrl}

Feel free to save & test those samples on your page. If you want 20 studio + story ad variations of your catalog for ${packPrice} flat (or a full Done-For-You 50-photo refresh for ${dfyPrice}), just reply "PACK"!`;

  const whatsappConcierge = `Hi ${brand} ✨
Here is your custom Before/After Studio Preview for *${product}*:
${showcaseUrl}

You get:
• Studio, Marble & Lifestyle scenes
• Instagram Post + Story Ad cards with your price tag
• Marketplace white-background listing shot

To unlock all 20 unwatermarked HD files immediately for *${packPrice}*, pay on the link inside your preview page (UPI / Card) and I'll drop your unlock code right here! — ${founder} (${studioBrand})`;

  const etsyOrEmail = `Subject: Made 2 free studio shots for ${brand}'s ${product}

Hi ${brand},

I noticed your ${product} listing has great craftsmanship, and tested turning your existing photo into luxury studio + lifestyle shots using ${studioBrand}.

You can view the side-by-side Before/After preview here (zero signup needed):
${showcaseUrl}

Use the preview freely. If you'd like a 20-photo studio + Instagram Story pack for your catalog for a one-time ${packPrice} (or ${dfyPrice} for 50 done-for-you catalog images), just reply to this message.

Best,
${founder}`;

  return {
    instagramDm,
    whatsappConcierge,
    etsyOrEmail,
    packPrice,
    dfyPrice
  };
}

function getLaunchTemplates(baseUrl = 'https://your-app.onrender.com', settings = {}) {
  const name = settings.brandName || 'SnapStudio';
  const packUsd = settings.packGlobalPrice ?? 12;
  const packInr = settings.packIndiaPrice ?? 299;

  return [
    {
      channel: 'Reddit (r/SideProject, r/EtsySellers, r/smallbusiness, r/IndianStreetWear)',
      title: `I built a tool that turns ugly phone product photos into studio shots + Instagram Story ads in 30s`,
      body: `Small sellers shoot great products on bedsheets or kitchen tables because real studio shoots cost \$300+ (or ₹15k+).

So I built ${name}: upload 1 raw phone photo → pick a scene (Marble, Sunlight, Pure White, Podium, or AI Fashion/Jewelry Model) → get studio variations + ready-to-post 1080x1080 & 1080x1920 Story Ad cards with your price & discount badge.

Try 2 free preview generations right here (no signup wall): ${baseUrl}

Drop a link to one of your product photos in the comments and I'll generate a free Before/After pack for you!`
    },
    {
      channel: 'Product Hunt Launch Post',
      title: `${name} — Phone product photo → studio scenes, AI model & ad pack in 30s`,
      body: `Hey Product Hunt! 👋

${name} helps solo D2C brands, Etsy/Meesho sellers, and Instagram boutiques turn raw smartphone snapshots into:
1. Commercial studio & lifestyle scenes (marble, sunlight, pure marketplace white)
2. Virtual model / try-on showcases (apparel, sarees, jewelry, hand-hold UGC)
3. Ready-to-post 1080x1080 Instagram Feed & 1080x1920 Story Ad PNGs with price/offer overlays

No monthly subscription lock-in — try free previews instantly, or grab a 20-photo HD pack for \$${packUsd} (₹${packInr} in India). Would love your honest feedback!`
    },
    {
      channel: 'Indie Hackers / X (#buildinpublic)',
      title: `Launched ${name} with ₹2,000 total budget`,
      body: `Built ${name} (${baseUrl}) for small e-commerce sellers who can't afford \$300 studio shoots.

Upload 1 messy phone pic → get studio scenes + AI try-on model shots + formatted IG Story ads with price tags.

Free previews live with no login. Let me know which preset converts best for your store!`
    }
  ];
}

async function createUpiPayQr(upiId, payeeName, amountInr, note = 'SnapStudio 20-Photo Pack') {
  const clean = String(upiId || '').trim();
  if (!clean) return null;
  const upiUri = `upi://pay?pa=${encodeURIComponent(clean)}&pn=${encodeURIComponent(
    payeeName || 'SnapStudio'
  )}&am=${encodeURIComponent(String(amountInr || ''))}&cu=INR&tn=${encodeURIComponent(note)}`;
  const dataUrl = await QRCode.toDataURL(upiUri, { width: 320, margin: 2 });
  return { upiUri, dataUrl };
}

module.exports = {
  generateSellerDmScripts,
  getLaunchTemplates,
  createUpiPayQr
};

