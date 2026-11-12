# SnapStudio — AI Product Photo, Virtual Model & Seller Ad-Pack Engine

Turn raw smartphone product photos into luxury studio scenes, AI virtual-model try-on shots, and ready-to-post Instagram & Marketplace Ad Packs (`1080×1080`, `1080×1920` Stories, Amazon/Meesho white background, and Before/After DM proof cards).

## Integrated Workflows
1. **E-Commerce Scene Studio:** Luxury Marble, Golden Hour Sunlight, Marketplace Pure White, Studio Podium, Festive Boutique, Dark Editorial.
2. **AI Virtual Model & Try-On:** Indian Boutique Model (Sarees/Kurtis), Modern Lifestyle Model, Jewelry & Watch Close-up, Creator Hand-Hold UGC.
3. **Complete Seller Ad-Pack (`₹0` Local Sharp Compositor):** Automatically overlays brand name, product title, price tag, discount badge, and WhatsApp CTA onto 1:1 Feed & 9:16 Story creatives.
4. **Before/After DM Engine & WhatsApp Concierge:** Generates clean unwatermarked samples + `/showcase/:id` link + copy-paste Instagram/WhatsApp/Etsy DMs + Credit Code unlock system + Meta WhatsApp Cloud API webhook (`/api/whatsapp/webhook`).
5. **Dual AI Image Engine:** Supports **Google Gemini Free Tier (`gemini-2.5-flash-image`)**, **Fal.ai (`fal-ai/bria/product-shot` & `fal-ai/flux-pro/kontext`)**, and an instant **`₹0` Local Studio Compositor** fallback.

## Run Locally Right Now
```bash
npm install
npm start
```
- **Public Storefront:** `http://localhost:3000/`
- **Founder Studio & Outreach CRM:** `http://localhost:3000/studio`
- **Run Automated Tests:** `npm test`

## Deployment (₹0 Hosting Options)

### Option A: Render Free Tier (Recommended — Permanent Public HTTPS URL)
1. Push this repository to a private or public GitHub repo.
2. On [render.com](https://render.com), click **New + → Blueprint** (uses `render.yaml`) or **Web Service**.
3. Add environment variables: `STUDIO_PIN` (e.g. `4829`), `GEMINI_API_KEY` (free from `aistudio.google.com`), and optionally `FAL_KEY`.
4. Deploy — you get an instant `https://snapstudio-ai.onrender.com` URL ready for Instagram DMs, WhatsApp links, Reddit, and Product Hunt.

### Option B: Instant Temporary HTTPS URL From Your Laptop (Zero Accounts Needed)
Start the server (`npm start`) and run Cloudflare Quick Tunnel in another terminal:
```bash
npx cloudflared tunnel --url http://localhost:3000
```
*(Gives a live `https://....trycloudflare.com` URL immediately to test WhatsApp or send live showcase links today.)*

### Option C: Google Cloud Run
A production `Dockerfile` is included on port `8080`. Authenticate with `gcloud auth login` and deploy directly from `d:\B2C`.

See [PLAYBOOK.md](./PLAYBOOK.md) for the ₹2,000 budget plan and 7-day customer acquisition playbook, and [IDEAS_BACKLOG.md](./IDEAS_BACKLOG.md) for your saved later ventures (`CODGuard`, `ClauseGuard`, `BuyerRadar`, `SlotSaver`, `HookDeck`).
