import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));
app.use(express.static(__dirname));

function requireMetaConfig(res) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET || !process.env.APP_BASE_URL) {
    res.status(500).json({
      error: 'Meta integration is not configured. Add META_APP_ID, META_APP_SECRET and APP_BASE_URL to .env.'
    });
    return false;
  }
  return true;
}

function redirectUri() {
  return `${process.env.APP_BASE_URL.replace(/\/$/, '')}/auth/meta/callback`;
}

async function graph(pathname, params = {}, method = 'GET') {
  const url = new URL(`${GRAPH_BASE}${pathname}`);
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) body.set(key, String(value));
  }

  const options = { method, headers: { Accept: 'application/json' } };
  if (method === 'POST') {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = body;
  } else {
    for (const [key, value] of body.entries()) url.searchParams.set(key, value);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const message = data?.error?.message || `Meta API request failed (${response.status})`;
    const err = new Error(message);
    err.meta = data?.error;
    err.status = response.status;
    throw err;
  }
  return data;
}

app.get('/api/meta/status', (req, res) => {
  res.json({
    configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.APP_BASE_URL),
    connected: Boolean(req.session.metaAccessToken),
    redirectUri: process.env.APP_BASE_URL ? redirectUri() : null
  });
});

app.get('/auth/meta', (req, res) => {
  if (!requireMetaConfig(res)) return;
  const state = crypto.randomBytes(24).toString('hex');
  req.session.metaOAuthState = state;
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: redirectUri(),
    state,
    response_type: 'code',
    scope: 'ads_read,ads_management'
  });
  res.redirect(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`);
});

app.get('/auth/meta/callback', async (req, res) => {
  try {
    if (!requireMetaConfig(res)) return;
    if (!req.query.code || !req.query.state || req.query.state !== req.session.metaOAuthState) {
      return res.status(400).send('Invalid Meta OAuth response. Please start the connection again.');
    }
    delete req.session.metaOAuthState;

    const tokenResponse = await graph('/oauth/access_token', {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: redirectUri(),
      code: req.query.code
    });

    let accessToken = tokenResponse.access_token;
    // Exchange for a longer-lived user token when possible.
    try {
      const longLived = await graph('/oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: accessToken
      });
      if (longLived.access_token) accessToken = longLived.access_token;
    } catch {
      // Keep the valid short-lived token if the exchange is unavailable.
    }

    req.session.metaAccessToken = accessToken;
    res.redirect('/?meta=connected');
  } catch (error) {
    res.status(error.status || 500).send(`Meta connection failed: ${error.message}`);
  }
});

app.post('/auth/meta/logout', (req, res) => {
  delete req.session.metaAccessToken;
  res.json({ connected: false });
});

app.get('/api/meta/adaccounts', async (req, res) => {
  if (!req.session.metaAccessToken) return res.status(401).json({ error: 'Connect Meta first.' });
  try {
    const data = await graph('/me/adaccounts', {
      fields: 'id,name,account_status,currency,timezone_name',
      limit: 100,
      access_token: req.session.metaAccessToken
    });
    res.json({ accounts: data.data || [] });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

const objectiveMap = {
  'WhatsApp messages': 'OUTCOME_ENGAGEMENT',
  'Leads': 'OUTCOME_LEADS',
  'Website visits': 'OUTCOME_TRAFFIC',
  'Brand awareness': 'OUTCOME_AWARENESS'
};

app.post('/api/meta/campaigns', async (req, res) => {
  if (!req.session.metaAccessToken) return res.status(401).json({ error: 'Connect Meta first.' });

  const { adAccountId, name, budget, goal } = req.body || {};
  if (!adAccountId || !name) return res.status(400).json({ error: 'Ad account and campaign name are required.' });

  const objective = objectiveMap[goal] || 'OUTCOME_ENGAGEMENT';
  const dailyBudget = Math.round(Number(budget || 0) * 100);
  if (!Number.isFinite(dailyBudget) || dailyBudget < 100) {
    return res.status(400).json({ error: 'Daily budget must be at least R1.00.' });
  }

  try {
    const data = await graph(`/${encodeURIComponent(adAccountId)}/campaigns`, {
      name,
      objective,
      status: 'PAUSED',
      special_ad_categories: '[]',
      access_token: req.session.metaAccessToken
    }, 'POST');

    res.json({
      campaignId: data.id,
      objective,
      status: 'PAUSED',
      dailyBudgetCents: dailyBudget,
      message: 'Campaign object created in Meta. It is paused until an ad set and ad/creative are configured.'
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message,
      meta: error.meta || undefined
    });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`MarketAI running on port ${PORT}`);
  console.log(`Meta OAuth callback: ${process.env.APP_BASE_URL ? redirectUri() : '(configure APP_BASE_URL)'}`);
});
