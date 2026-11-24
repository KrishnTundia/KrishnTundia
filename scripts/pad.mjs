// api/pad.js — Dynamic GitHub-Data-Driven 3-Stage RGB Mixer Pad Generator
// Deploy to Vercel -> call /api/pad?id=1&user=KrishnTundia

const PAD_COLORS = {
  pink:   ["#ff9ebb", "#ff3b7a", "#b8114b"],
  yellow: ["#fef9c3", "#facc15", "#b47b04"],
  sky:    ["#bae6fd", "#38bdf8", "#0369a1"],
  lime:   ["#d9f99d", "#84cc16", "#3f6212"],
  purple: ["#f5d0fe", "#d946ef", "#7e22ce"],
  aqua:   ["#99f6e4", "#2dd4bf", "#0f766e"],
  cobalt: ["#bfdbfe", "#3b82f6", "#1d4ed8"],
  orange: ["#fed7aa", "#fb923c", "#c2410c"],
};

const COLOR_KEYS = Object.keys(PAD_COLORS);

// In-memory cache (5 min) so 30 pads per README load share 1 GitHub API call
const telemetryCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function getGitHubLoad(username) {
  const key = username.toLowerCase();
  const cached = telemetryCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const headers = {
    "User-Agent": "rgb-pad-api",
    Accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let loadScore = 0.45; // fallback mid-groove if rate-limited
  let eventHash = 1337;

  try {
    const [eventsRes, userRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=30`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
    ]);

    let recentEvents = 0;
    let pushCount = 0;
    let latestId = "0";

    if (eventsRes.ok) {
      const events = await eventsRes.json();
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (Array.isArray(events) && events.length > 0) {
        latestId = String(events[0].id || "0");
        for (const ev of events) {
          const ts = Date.parse(ev.created_at || 0);
          if (ts >= weekAgo) {
            recentEvents++;
            if (ev.type === "PushEvent") pushCount++;
          }
        }
      }
    }

    let publicRepos = 2;
    if (userRes.ok) {
      const profile = await userRes.json();
      publicRepos = Number(profile.public_repos || 2);
    }

    // Normalize live GitHub load into 0.10 .. 1.00
    const activitySignal = Math.min(1, (recentEvents * 0.045) + (pushCount * 0.07) + Math.min(0.25, publicRepos * 0.02));
    loadScore = Math.max(0.12, Math.min(1, activitySignal));
    eventHash = hashString(`${username}:${latestId}:${recentEvents}:${publicRepos}`);
  } catch {
    // Graceful fallback to time-seeded groove
    eventHash = hashString(`${username}:${Math.floor(Date.now() / CACHE_TTL_MS)}`);
  }

  const data = { loadScore, eventHash };
  telemetryCache.set(key, { ts: Date.now(), data });
  return data;
}

function buildBrightnessKeyframes(loadScore, rng) {
  // Faster tempo + more frequent Stage-3 peak flickers under higher GitHub load
  const speedMin = loadScore > 0.65 ? 2.4 : loadScore > 0.3 ? 3.8 : 5.4;
  const speedSpan = loadScore > 0.65 ? 1.8 : loadScore > 0.3 ? 2.4 : 2.8;
  const cycleSec = +(speedMin + rng() * speedSpan).toFixed(2);
  const delaySec = +(-(rng() * cycleSec)).toFixed(2);

  // Variant A (High Load / Rapid Double-Flicker Peak)
  if (loadScore > 0.65 || rng() < loadScore) {
    return {
      cycleSec,
      delaySec,
      // Dimmer overlay opacity: 0.72 = Stage 1 (Dim), 0.28 = Stage 2 (Mid), 0.00 = Stage 3 (Peak)
      dimKf: `
        0%, 100% { opacity: 0.72; }
        14%      { opacity: 0.28; }
        28%      { opacity: 0.30; }
        32%      { opacity: 0.00; }
        35%      { opacity: 0.36; }
        38%      { opacity: 0.00; }
        45%      { opacity: 0.28; }
        62%      { opacity: 0.72; }
        76%      { opacity: 0.26; }
        80%      { opacity: 0.00; }
        84%      { opacity: 0.34; }
        87%      { opacity: 0.02; }
        94%      { opacity: 0.68; }
      `,
      // White-hot center LED bloom synchronized with Stage 3 peak hits
      flareKf: `
        0%, 29%, 44%, 77%, 93%, 100% { opacity: 0; }
        32%, 38% { opacity: 0.95; }
        35%      { opacity: 0.32; }
        80%, 87% { opacity: 0.90; }
        84%      { opacity: 0.28; }
      `,
    };
  }

  // Variant B (Chill / Mid Load — Stage 1 Dim -> Stage 2 Pulse -> Occasional Stage 3 Hit)
  return {
    cycleSec,
    delaySec,
    dimKf: `
      0%, 100% { opacity: 0.75; }
      22%      { opacity: 0.30; }
      46%      { opacity: 0.32; }
      52%      { opacity: 0.00; }
      56%      { opacity: 0.38; }
      60%      { opacity: 0.00; }
      70%      { opacity: 0.32; }
      86%      { opacity: 0.74; }
    `,
    flareKf: `
      0%, 48%, 68%, 100% { opacity: 0; }
      52%, 60%           { opacity: 0.92; }
      56%                { opacity: 0.25; }
    `,
  };
}

export default async function handler(req, res) {
  const id = Math.max(1, Math.min(999, parseInt(req.query.id || "1", 10) || 1));
  const user = String(req.query.user || "KrishnTundia").replace(/[^a-zA-Z0-9-]/g, "");
  const size = Math.max(24, Math.min(128, parseInt(req.query.size || "46", 10) || 46));

  const { loadScore, eventHash } = await getGitHubLoad(user);

  // Rolling 5-minute time bucket + pad ID + live GitHub event hash -> unique pattern per pad & reload
  const timeBucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const seed = (id * 2654435761) ^ eventHash ^ (timeBucket * 1597334677);
  const rng = mulberry32(seed);

  // Shuffle 8 RGB mixer pad colors and pick 5 or 6 for this pad
  const pool = [...COLOR_KEYS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = 5 + (rng() > 0.5 ? 1 : 0);
  const seq = pool.slice(0, count);

  // Random 1s, 2s, or 3s hold per color step
  const holds = seq.map(() => 1 + Math.floor(rng() * 3));
  const totalSec = holds.reduce((a, b) => a + b, 0);
  const fade = 0.2;

  const starts = [0];
  for (let i = 0; i < holds.length - 1; i++) {
    starts.push(starts[i] + holds[i]);
  }
  const pct = (sec) => `${Math.max(0, Math.min(100, (sec / totalSec) * 100)).toFixed(2)}%`;

  // Color gradients & stacked crossfade layers
  const gradDefs = seq.map((cname, i) => {
    const [tint, mid, edge] = PAD_COLORS[cname];
    return `
    <radialGradient id="g${i}" cx="50%" cy="48%" r="64%" fx="50%" fy="46%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="22%" stop-color="${tint}"/>
      <stop offset="62%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${edge}"/>
    </radialGradient>`;
  }).join("");

  const colorDelay = +(-(rng() * totalSec)).toFixed(2);
  const colorCss = [];
  const colorRects = [
    `<rect x="14" y="14" width="228" height="228" rx="32" fill="url(#g0)"/>`,
  ];

  for (let j = 1; j < count; j++) {
    const tStart = starts[j];
    const tInEnd = tStart + fade;
    let kf;
    if (j < count - 1) {
      const tNextInEnd = starts[j + 1] + fade;
      const tDrop = Math.min(totalSec - 0.01, tNextInEnd + 0.02);
      kf = `0%,${pct(tStart)}{opacity:0}${pct(tInEnd)},${pct(tNextInEnd)}{opacity:1}${pct(tDrop)},100%{opacity:0}`;
    } else {
      const tOutStart = totalSec - fade;
      kf = `0%,${pct(tStart)}{opacity:0}${pct(tInEnd)},${pct(tOutStart)}{opacity:1}100%{opacity:0}`;
    }
    colorCss.push(`.l${j}{opacity:0;animation:c${j} ${totalSec}s linear ${colorDelay}s infinite}@keyframes c${j}{${kf}}`);
    colorRects.push(`<rect class="l${j}" x="14" y="14" width="228" height="228" rx="32" fill="url(#g${j})"/>`);
  }

  // 3-Stage Light Intensity + Micro-Flicker Layer
  const { cycleSec, delaySec, dimKf, flareKf } = buildBrightnessKeyframes(loadScore, rng);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" role="img" aria-label="Dynamic RGB Pad #${id}">
  <defs>
    <linearGradient id="case" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#222733"/>
      <stop offset="100%" stop-color="#0b0e14"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="28%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="76%" stop-color="#000000" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.28"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="50%" r="58%">
      <stop offset="68%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.32"/>
    </radialGradient>
    <radialGradient id="flare" cx="50%" cy="48%" r="56%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>${gradDefs}
  </defs>
  <style>
    ${colorCss.join("\n    ")}
    .dim { animation: dimAnim ${cycleSec}s ease-in-out ${delaySec}s infinite; }
    @keyframes dimAnim { ${dimKf} }
    .flr { opacity: 0; animation: flrAnim ${cycleSec}s ease-in-out ${delaySec}s infinite; }
    @keyframes flrAnim { ${flareKf} }
    @media (prefers-reduced-motion: reduce) {
      .dim { animation: none; opacity: 0.25; }
      .flr, rect[class^="l"] { animation: none; opacity: 0; }
    }
  </style>
  <rect x="2" y="2" width="252" height="252" rx="40" fill="url(#case)" stroke="#2e3545" stroke-width="4"/>
  <rect x="10" y="10" width="236" height="236" rx="35" fill="#06080c"/>
  <g>${colorRects.join("")}</g>
  <!-- 3-Stage PWM Brightness Dimmer + Peak White-Hot Flicker Flare -->
  <rect class="dim" x="14" y="14" width="228" height="228" rx="32" fill="#050810"/>
  <rect class="flr" x="14" y="14" width="228" height="228" rx="32" fill="url(#flare)"/>
  <rect x="14" y="14" width="228" height="228" rx="32" fill="url(#sheen)"/>
  <rect x="14" y="14" width="228" height="228" rx="32" fill="url(#vig)"/>
  <rect x="16" y="16" width="224" height="224" rx="30" fill="none" stroke="#ffffff" stroke-opacity="0.32" stroke-width="3"/>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, must-revalidate");
  res.status(200).send(svg);
}