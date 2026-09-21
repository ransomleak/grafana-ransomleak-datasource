#!/usr/bin/env node
/*
 * RansomLeak API — DEVELOPMENT MOCK.
 *
 * A zero-dependency stand-in for the real `scorm-controller` Grafana query
 * endpoints, implementing the SimpleJSON contract documented in the landing
 * repo so the data-source plugin can be exercised end-to-end without the real
 * backend. This file is dev tooling only — it is NOT part of the published
 * plugin (webpack bundles from `src/` only).
 *
 * Endpoints, all under /api/integration/grafana and guarded by a Bearer key:
 *   GET  /health  -> 200 when the partner key is valid (Save & test probe)
 *   POST /search  -> the selectable metric names for the query editor
 *   POST /query   -> SimpleJSON time-series or table for one metric
 *
 * Run:  MOCK_PORT=4000 RL_DEV_KEY=rl_dev_partner_key_demo node dev/mock-ransomleak/server.js
 */
'use strict';

const http = require('http');

const PORT = Number.parseInt(process.env.MOCK_PORT, 10) || 4000;
const DEV_KEY = process.env.RL_DEV_KEY || 'rl_dev_partner_key_demo';
const BASE = '/api/integration/grafana';

const METRICS = [
  'human_risk_score',
  'training_completion_rate',
  'assignments_overdue',
  'phishing_click_rate',
  'phishing_report_rate',
  'overdue_users',
  'assignments_by_category',
  'auto_assigned_via_grafana',
];

const TEAMS = ['Engineering', 'Sales', 'Support', 'Finance', 'Marketing'];
const CATEGORIES = ['Phishing', 'Passwords', 'Data handling', 'Physical security', 'Social engineering'];
const FIRST = ['Alex', 'Priya', 'Jordan', 'Mei', 'Sam', 'Noor', 'Diego', 'Lena', 'Tariq', 'Yuki', 'Omar', 'Ada'];
const LAST = ['Chen', 'Patel', 'Rivera', 'Okafor', 'Nguyen', 'Garcia', 'Haddad', 'Kowalski', 'Silva', 'Park'];

// --- deterministic PRNG so a given query yields stable-ish data ---------------
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function timeAxis(range, intervalMs) {
  const now = Date.now();
  // Use NaN checks (not `||`) so a legitimately-parsed epoch 0 isn't discarded.
  const parsedTo = Date.parse(range && range.to);
  const parsedFrom = Date.parse(range && range.from);
  let to = Number.isNaN(parsedTo) ? now : parsedTo;
  let from = Number.isNaN(parsedFrom) ? to - 30 * 86400000 : parsedFrom;
  if (from >= to) {
    from = to - 30 * 86400000;
  }
  const span = to - from;
  const step = Math.max(Number(intervalMs) || 0, Math.ceil(span / 120), 3600000); // ≥1h, ≤~120 pts
  const points = [];
  for (let t = from; t <= to; t += step) {
    points.push(t);
  }
  if (points.length === 0) {
    points.push(to);
  }
  return points;
}

// A smooth random walk clamped to [min, max].
function walk(rng, points, opts) {
  const { min, max, start } = opts;
  let v = start != null ? start : min + rng() * (max - min);
  return points.map((t) => {
    v += (rng() - 0.5) * (max - min) * 0.12;
    v = Math.max(min, Math.min(max, v));
    const value = opts.integer ? Math.round(v) : Math.round(v * 10) / 10;
    return [value, t];
  });
}

function teamsFor(filter) {
  const f = (filter || '').trim().toLowerCase();
  if (!f) {
    return TEAMS;
  }
  const match = TEAMS.find((t) => t.toLowerCase() === f);
  return [match || filter.trim()];
}

// --- per-metric data ----------------------------------------------------------
// Single-series metrics: each maps the request body to one { target, seed, opts }.
// (human_risk_score and assignments_by_category fan out and are handled inline.)

/**
 * Suffix appended to a series label + seed when the campaign facet is set, so a developer can
 * see the facet actually reaching the API (the numbers shift with it) instead of wondering
 * whether the field is wired up. The real backend filters; this only has to be visibly distinct.
 */
function campaignSuffix(body) {
  const campaign = body.campaign && body.campaign.trim();
  return campaign ? ' · ' + campaign : '';
}
const SINGLE_SERIES = {
  training_completion_rate: (body) => {
    // Aggregate metric: a single org-wide series, or one series for a filtered team.
    const { team } = body;
    const label = (team && team.trim() ? team.trim() : 'All teams') + campaignSuffix(body);
    return { target: label, seed: 'completion|' + label, opts: { min: 62, max: 99 } };
  },
  assignments_overdue: (body) => ({
    target: (body.team ? body.team.trim() : 'All teams') + campaignSuffix(body),
    seed: 'overdue|' + (body.team || 'all') + campaignSuffix(body),
    opts: { min: 4, max: 90, integer: true },
  }),
  phishing_click_rate: ({ channel }) => ({
    target: (channel || 'email') + ' click rate',
    seed: 'click|' + (channel || 'email'),
    opts: { min: 2, max: 16 },
  }),
  phishing_report_rate: ({ channel }) => ({
    target: (channel || 'email') + ' report rate',
    seed: 'report|' + (channel || 'email'),
    opts: { min: 12, max: 48 },
  }),
  auto_assigned_via_grafana: () => ({
    target: 'Auto-assigned (Rail B)',
    seed: 'autoassign',
    opts: { min: 0, max: 14, integer: true },
  }),
  // tabular metric requested as time series — collapse to a running count
  overdue_users: (body) => ({
    target: 'Overdue users' + campaignSuffix(body),
    seed: 'overdue_users' + campaignSuffix(body),
    opts: { min: 3, max: 40, integer: true },
  }),
};

function buildSeries(metric, body) {
  const points = timeAxis(body.range, body.intervalMs);
  const seed = (suffix) => mulberry32(hashSeed(metric + '|' + suffix));

  if (metric === 'human_risk_score') {
    return teamsFor(body.team).map((t) => ({ target: t, datapoints: walk(seed(t), points, { min: 8, max: 78 }) }));
  }
  if (metric === 'assignments_by_category') {
    return CATEGORIES.map((c) => ({
      target: c,
      datapoints: walk(seed('cat|' + c + campaignSuffix(body)), points, { min: 5, max: 70, integer: true }),
    }));
  }
  const single = SINGLE_SERIES[metric];
  if (!single) {
    return [];
  }
  const { target, seed: suffix, opts } = single(body);
  return [{ target, datapoints: walk(seed(suffix), points, opts) }];
}

function buildTable(metric, body) {
  const { team } = body;
  const rng = mulberry32(hashSeed('table|' + metric + '|' + (team || 'all') + campaignSuffix(body)));

  if (metric === 'assignments_by_category') {
    return [
      {
        type: 'table',
        columns: [
          { text: 'Category', type: 'string' },
          { text: 'Assigned', type: 'number' },
          { text: 'Overdue', type: 'number' },
        ],
        rows: CATEGORIES.map((c) => {
          const assigned = 20 + Math.round(rng() * 120);
          return [c, assigned, Math.round(assigned * (0.05 + rng() * 0.3))];
        }),
      },
    ];
  }

  // default tabular metric: overdue_users
  const teams = teamsFor(team);
  const count = 8 + Math.round(rng() * 8);
  const rows = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST[Math.floor(rng() * FIRST.length)];
    const last = LAST[Math.floor(rng() * LAST.length)];
    const t = teams[Math.floor(rng() * teams.length)];
    rows.push([
      `${first} ${last}`,
      `${first.toLowerCase()}.${last.toLowerCase()}@acme.example`,
      t,
      ['Phishing 101', 'Password hygiene', 'Data handling', 'MFA basics'][Math.floor(rng() * 4)],
      1 + Math.floor(rng() * 45),
    ]);
  }
  rows.sort((a, b) => b[4] - a[4]);
  return [
    {
      type: 'table',
      columns: [
        { text: 'Employee', type: 'string' },
        { text: 'Email', type: 'string' },
        { text: 'Team', type: 'string' },
        { text: 'Assignment', type: 'string' },
        { text: 'Days overdue', type: 'number' },
      ],
      rows,
    },
  ];
}

// --- HTTP plumbing ------------------------------------------------------------
function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
}

function authorized(req) {
  const header = req.headers['authorization'] || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return Boolean(m && m[1] === DEV_KEY);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0].replace(/\/+$/, '');
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    return send(res, 204, {});
  }
  if (!url.startsWith(BASE)) {
    return send(res, 404, { message: 'not found' });
  }
  if (!authorized(req)) {
    return send(res, 401, { message: 'invalid or missing partner API key' });
  }

  const path = url.slice(BASE.length);

  if (path === '/health' && method === 'GET') {
    return send(res, 200, { status: 'ok', message: 'RansomLeak dev mock — partner key accepted.' });
  }
  if (path === '/search' && method === 'POST') {
    return send(res, 200, METRICS);
  }
  if (path === '/query' && method === 'POST') {
    const body = await readBody(req);
    const metric = body.metric;
    if (!metric || METRICS.indexOf(metric) === -1) {
      return send(res, 400, { message: `unknown metric: ${metric}` });
    }
    const format = body.format === 'table' ? 'table' : 'time_series';
    const payload = format === 'table' ? buildTable(metric, body) : buildSeries(metric, body);
    return send(res, 200, payload);
  }

  return send(res, 404, { message: `no route for ${method} ${path}` });
});

server.listen(PORT, () => {
  console.log(`[mock-ransomleak] listening on http://localhost:${PORT}${BASE}  (key: ${DEV_KEY})`);
});
