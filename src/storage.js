const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const DEFAULT_SETTINGS = {
  brandName: 'SnapStudio',
  founderName: 'Founder',
  whatsappNumber: '',
  upiId: '',
  razorpayLink: '',
  dodoLink: '',
  packIndiaPrice: 299,
  packGlobalPrice: 12,
  dfyIndiaPrice: 2499,
  dfyGlobalPrice: 49,
  geminiApiKey: '',
  falApiKey: '',
  defaultEngine: 'auto',
  apiBudgetInr: 1300,
  whatsappVerifyToken: 'snapstudio_verify',
  whatsappPhoneNumberId: '',
  whatsappAccessToken: '',
  studioPin: ''
};

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      settings: { ...DEFAULT_SETTINGS },
      credits: [],
      showcases: [],
      prospects: [],
      apiLogs: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDirs();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      credits: Array.isArray(parsed.credits) ? parsed.credits : [],
      showcases: Array.isArray(parsed.showcases) ? parsed.showcases : [],
      prospects: Array.isArray(parsed.prospects) ? parsed.prospects : [],
      apiLogs: Array.isArray(parsed.apiLogs) ? parsed.apiLogs : []
    };
  } catch {
    return {
      settings: { ...DEFAULT_SETTINGS },
      credits: [],
      showcases: [],
      prospects: [],
      apiLogs: []
    };
  }
}

function writeDb(data) {
  ensureDirs();
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

function makeId(prefix = '') {
  return prefix + crypto.randomBytes(4).toString('hex');
}

function saveAssetBuffer(filename, buffer) {
  ensureDirs();
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const fullPath = path.join(ASSETS_DIR, safeName);
  fs.writeFileSync(fullPath, buffer);
  return safeName;
}

function getAssetPath(filename) {
  ensureDirs();
  const safeName = path.basename(String(filename || ''));
  return path.join(ASSETS_DIR, safeName);
}

function getSettings() {
  const s = readDb().settings;
  return {
    ...s,
    geminiApiKey: s.geminiApiKey || (process.env.GEMINI_API_KEY || '').trim(),
    falApiKey: s.falApiKey || (process.env.FAL_KEY || '').trim(),
    whatsappVerifyToken: (process.env.WHATSAPP_VERIFY_TOKEN || '').trim() || s.whatsappVerifyToken || 'snapstudio_verify',
    whatsappPhoneNumberId: (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim() || s.whatsappPhoneNumberId,
    whatsappAccessToken: (process.env.WHATSAPP_ACCESS_TOKEN || '').trim() || s.whatsappAccessToken
  };
}

function updateSettings(patch) {
  const db = readDb();
  const numericKeys = ['packIndiaPrice', 'packGlobalPrice', 'dfyIndiaPrice', 'dfyGlobalPrice', 'apiBudgetInr'];
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (patch[key] !== undefined) {
      if (numericKeys.includes(key)) {
        const n = Number(patch[key]);
        if (Number.isFinite(n) && n >= 0) db.settings[key] = n;
      } else {
        db.settings[key] = String(patch[key]).trim();
      }
    }
  }
  writeDb(db);
  return getSettings();
}

// Credit Codes
function createCreditCode({ label = '20-Photo Pack', totalCredits = 20, market = 'india', pricePaid = 299, currency = 'INR', customCode = '' }) {
  const db = readDb();
  const code = (customCode || `SNAP-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${totalCredits}`).toUpperCase();
  const entry = {
    id: makeId('crd_'),
    code,
    label: String(label || 'Studio Credit Pack').trim(),
    totalCredits: Math.max(1, Number(totalCredits) || 20),
    remainingCredits: Math.max(1, Number(totalCredits) || 20),
    market: market === 'global' ? 'global' : 'india',
    pricePaid: Number(pricePaid) || 0,
    currency: currency === 'USD' ? 'USD' : 'INR',
    active: true,
    createdAt: new Date().toISOString()
  };
  db.credits.unshift(entry);
  writeDb(db);
  return entry;
}

function getCreditByCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const db = readDb();
  return db.credits.find((c) => c.code === clean && c.active && c.remainingCredits > 0) || null;
}

function consumeCredit(code, amount = 1) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const db = readDb();
  const idx = db.credits.findIndex((c) => c.code === clean && c.active && c.remainingCredits >= amount);
  if (idx === -1) return null;
  db.credits[idx].remainingCredits -= amount;
  db.credits[idx].lastUsedAt = new Date().toISOString();
  writeDb(db);
  return db.credits[idx];
}

function listCredits() {
  return readDb().credits;
}

function toggleCredit(id, active) {
  const db = readDb();
  const idx = db.credits.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  db.credits[idx].active = Boolean(active);
  writeDb(db);
  return db.credits[idx];
}

// Showcases
function saveShowcase(payload) {
  const db = readDb();
  const item = {
    id: makeId('sh_'),
    createdAt: new Date().toISOString(),
    viewCount: 0,
    unlocked: Boolean(payload.unlocked),
    ...payload
  };
  db.showcases.unshift(item);
  if (db.showcases.length > 250) db.showcases = db.showcases.slice(0, 250);
  writeDb(db);
  return item;
}

function getShowcase(id, incrementViews = false) {
  const db = readDb();
  const idx = db.showcases.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  if (incrementViews) {
    db.showcases[idx].viewCount = (db.showcases[idx].viewCount || 0) + 1;
    writeDb(db);
  }
  return db.showcases[idx];
}

function listShowcases(limit = 40) {
  return readDb().showcases.slice(0, limit);
}

// API Usage tracking
function logApiUsage({ engine, estimatedCostInr = 0, mode = 'scene' }) {
  const db = readDb();
  db.apiLogs.unshift({
    id: makeId('log_'),
    createdAt: new Date().toISOString(),
    engine,
    estimatedCostInr: Number(estimatedCostInr) || 0,
    mode
  });
  if (db.apiLogs.length > 1000) db.apiLogs = db.apiLogs.slice(0, 1000);
  writeDb(db);
}

// Prospect CRM
function listProspects() {
  return readDb().prospects;
}

function addProspect(payload) {
  const db = readDb();
  const market = payload.market === 'global' ? 'global' : 'india';
  const entry = {
    id: makeId('pro_'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    businessName: String(payload.businessName || '').trim() || 'Seller Prospect',
    productName: String(payload.productName || '').trim(),
    sellerHandle: String(payload.sellerHandle || '').trim(),
    channel: String(payload.channel || 'Instagram DM').trim(),
    market,
    stage: ['found', 'sample_ready', 'dm_sent', 'replied', 'paid', 'delivered'].includes(payload.stage)
      ? payload.stage
      : 'sample_ready',
    dealValue: Number(payload.dealValue) || (market === 'india' ? db.settings.packIndiaPrice : db.settings.packGlobalPrice),
    currency: market === 'india' ? 'INR' : 'USD',
    showcaseId: payload.showcaseId ? String(payload.showcaseId) : '',
    notes: String(payload.notes || '').trim()
  };
  db.prospects.unshift(entry);
  writeDb(db);
  return entry;
}

function updateProspect(id, patch) {
  const db = readDb();
  const idx = db.prospects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const validStages = ['found', 'sample_ready', 'dm_sent', 'replied', 'paid', 'delivered'];
  const cur = db.prospects[idx];
  db.prospects[idx] = {
    ...cur,
    ...(patch.businessName !== undefined ? { businessName: String(patch.businessName).trim() } : {}),
    ...(patch.sellerHandle !== undefined ? { sellerHandle: String(patch.sellerHandle).trim() } : {}),
    ...(patch.channel !== undefined ? { channel: String(patch.channel).trim() } : {}),
    ...(patch.stage !== undefined && validStages.includes(patch.stage) ? { stage: patch.stage } : {}),
    ...(patch.dealValue !== undefined && Number.isFinite(Number(patch.dealValue)) ? { dealValue: Number(patch.dealValue) } : {}),
    ...(patch.currency !== undefined && ['INR', 'USD'].includes(patch.currency) ? { currency: patch.currency } : {}),
    ...(patch.notes !== undefined ? { notes: String(patch.notes).trim() } : {}),
    updatedAt: new Date().toISOString()
  };
  writeDb(db);
  return db.prospects[idx];
}

function deleteProspect(id) {
  const db = readDb();
  const before = db.prospects.length;
  db.prospects = db.prospects.filter((p) => p.id !== id);
  if (db.prospects.length === before) return false;
  writeDb(db);
  return true;
}

function getStats() {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const prospects = db.prospects;
  const sentToday = prospects.filter(
    (p) => ['dm_sent', 'replied', 'paid', 'delivered'].includes(p.stage) && (p.updatedAt || p.createdAt).startsWith(today)
  ).length;
  const outreachTotal = prospects.filter((p) => ['dm_sent', 'replied', 'paid', 'delivered'].includes(p.stage)).length;
  const repliedTotal = prospects.filter((p) => ['replied', 'paid', 'delivered'].includes(p.stage)).length;
  const paidProspects = prospects.filter((p) => ['paid', 'delivered'].includes(p.stage));

  const crmInr = paidProspects.filter((p) => p.currency === 'INR').reduce((s, p) => s + (Number(p.dealValue) || 0), 0);
  const crmUsd = paidProspects.filter((p) => p.currency === 'USD').reduce((s, p) => s + (Number(p.dealValue) || 0), 0);
  const creditInr = db.credits.filter((c) => c.currency === 'INR').reduce((s, c) => s + (Number(c.pricePaid) || 0), 0);
  const creditUsd = db.credits.filter((c) => c.currency === 'USD').reduce((s, c) => s + (Number(c.pricePaid) || 0), 0);

  const apiSpendInr = Math.round(db.apiLogs.reduce((s, l) => s + (Number(l.estimatedCostInr) || 0), 0) * 100) / 100;

  return {
    totalShowcases: db.showcases.length,
    totalCreditsIssued: db.credits.length,
    sentToday,
    outreachTotal,
    repliedTotal,
    replyRate: outreachTotal > 0 ? Math.round((repliedTotal / outreachTotal) * 100) : 0,
    revenueInr: crmInr + creditInr,
    revenueUsd: crmUsd + creditUsd,
    apiSpendInr,
    apiBudgetInr: db.settings.apiBudgetInr ?? 1300
  };
}

module.exports = {
  ASSETS_DIR,
  saveAssetBuffer,
  getAssetPath,
  getSettings,
  updateSettings,
  createCreditCode,
  getCreditByCode,
  consumeCredit,
  listCredits,
  toggleCredit,
  saveShowcase,
  getShowcase,
  listShowcases,
  logApiUsage,
  listProspects,
  addProspect,
  updateProspect,
  deleteProspect,
  getStats
};
