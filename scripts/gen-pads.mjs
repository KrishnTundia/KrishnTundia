import fs from "node:fs";
import path from "node:path";

const USER = process.env.GITHUB_REPOSITORY_OWNER || "KrishnTundia";
const TOKEN = process.env.GITHUB_TOKEN || "";
const OUT_DIR = path.resolve("pads");
const PAD_COUNT = 30;
const SIZE = 46;

// 8 Backlit DJ Controller Silicone Pad RGB Gradients (center tint, mid glow, outer edge)
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

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function fetchGitHubLoad(username) {
  const headers = {
    "User-Agent": "krishntundia-rgb-pads",
    Accept: "application/vnd.github+json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };

  let loadScore = 0.45;
  let eventSeed = hashStr(`${username}:${Date.now()}`);

  try {
    const [evRes, userRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=30`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
    ]);

    let recentEvents = 0;
    let pushes = 0;
    let latestId = "0";

    if (evRes.ok) {
      const events = await evRes.json();
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (Array.isArray(events) && events.length > 0) {
        latestId = String(events[0].id || "0");
        for (const ev of events) {
          if (Date.parse(ev.created_at || 0) >= weekAgo) {
            recentEvents++;
            if (ev.type === "PushEvent") pushes++;
          }
        }
      }
    }

    let repos = 2;
    if (userRes.ok) {
      const profile = await userRes.json();
      repos = Number(profile.public_repos || 2);
    }

    const raw = recentEvents * 0.045 + pushes * 0.07 + Math.min(0.25, repos * 0.02);
    loadScore = Math.max(0.15, Math.min(1.0, raw));
    eventSeed = hashStr(`${username}:${latestId}:${recentEvents}:${repos}:${Math.floor(Date.now() / 3600000)}`);
    console.log(`GitHub telemetry -> events(7d): ${recentEvents}, pushes: ${pushes}, repos: ${repos}, loadScore: ${loadScore.toFixed(2)}`);
  } catch (err) {
    console.warn("Telemetry fallback:", err.message);
  }

  return { loadScore, eventSeed };
}

function buildIntensity(loadScore, rng) {
  const baseMin = loadScore > 0.65 ? 2.4 : loadScore > 0.32 ? 3.6 : 5.0;
  const span = loadScore > 0.65 ? 1.8 : 2.5;
  const cycle = +(baseMin + rng() * span).toFixed(2);
  const delay = +(-(rng() * cycle)).toFixed(2);

  // High-load double peak flicker vs chill 3-stage groove
  if (loadScore > 0.62 || rng() < loadScore) {
    return {
      cycle,
      delay,
      dimKf: `
        0%,100%{opacity:.74} 14%{opacity:.30} 28%{opacity:.32}
        32%{opacity:0} 35%{opacity:.38} 38%{opacity:0}
        46%{opacity:.30} 62%{opacity:.74} 76%{opacity:.28}
        80%{opacity:0} 83%{opacity:.36} 86%{opacity:.02} 94%{opacity:.70}`,
      flareKf: `
        0%,29%,44%,77%,92%,100%{opacity:0}
        32%,38%{opacity:.95} 35%{opacity:.30}
        80%,86%{opacity:.90} 83%{opacity:.26}`,
    };
  }

  return {
    cycle,
    delay,
    dimKf: `
      0%,100%{opacity:.76} 22%{opacity:.32} 46%{opacity:.34}
      52%{opacity:0} 56%{opacity:.40} 60%{opacity:0}
      70%{opacity:.32} 86%{opacity:.74}`,
    flareKf: `
      0%,48%,68%,100%{opacity:0}
      52%,60%{opacity:.92} 56%{opacity:.24}`,
  };
}

function generatePadSvg(id, loadScore, eventSeed) {
  const rng = mulberry32((id * 2654435761) ^ eventSeed);

  // Pick 5 or 6 shuffled RGB colors
  const pool = [...COLOR_KEYS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = 5 + (rng() > 0.5 ? 1 : 0);
  const seq = pool.slice(0, count);

  // Random 1s, 2s, or 3s hold per color
  const holds = seq.map(() => 1 + Math.floor(rng() * 3));
  const totalSec = holds.reduce((a, b) => a + b, 0);
  const fade = 0.2;

  const starts = [0];
  for (let i = 0; i < holds.length - 1; i++) starts.push(starts[i] + holds[i]);
  const pct = (s) => `${Math.max(0, Math.min(100, (s / totalSec) * 100)).toFixed(2)}%`;

  const gradDefs = seq.map((cname, i) => {
    const [tint, mid, edge] = PAD_COLORS[cname];
    return `    <radialGradient id="g${i}" cx="50%" cy="48%" r="64%" fx="50%" fy="46%"><stop offset="0%" stop-color="#fff"/><stop offset="22%" stop-color="${tint}"/><stop offset="62%" stop-color="${mid}"/><stop offset="100%" stop-color="${edge}"/></radialGradient>`;
  }).join("\n");

  const colorDelay = +(-(rng() * totalSec)).toFixed(2);
  const colorCss = [];
  const colorRects = [`    <rect x="14" y="14" width="228" height="228" rx="32" fill="url(#g0)"/>`];

  for (let j = 1; j < count; j++) {
    const tStart = starts[j];
    const tIn = tStart + fade;
    let kf;
    if (j < count - 1) {
      const tNextIn = starts[j + 1] + fade;
      const tDrop = Math.min(totalSec - 0.01, tNextIn + 0.02);
      kf = `0%,${pct(tStart)}{opacity:0}${pct(tIn)},${pct(tNextIn)}{opacity:1}${pct(tDrop)},100%{opacity:0}`;
    } else {
      const tOut = totalSec - fade;
      kf = `0%,${pct(tStart)}{opacity:0}${pct(tIn)},${pct(tOut)}{opacity:1}100%{opacity:0}`;
    }
    colorCss.push(`    .l${j}{opacity:0;animation:c${j} ${totalSec}s linear ${colorDelay}s infinite}@keyframes c${j}{${kf}}`);
    colorRects.push(`    <rect class="l${j}" x="14" y="14" width="228" height="228" rx="32" fill="url(#g${j})"/>`);
  }

  const { cycle, delay, dimKf, flareKf } = buildIntensity(loadScore, rng);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${SIZE}" height="${SIZE}" role="img" aria-label="RGB Pad ${id}">
  <defs>
    <linearGradient id="case" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#222733"/><stop offset="100%" stop-color="#0b0e14"/></linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity=".34"/><stop offset="28%" stop-color="#fff" stop-opacity=".06"/><stop offset="76%" stop-color="#000" stop-opacity=".04"/><stop offset="100%" stop-color="#000" stop-opacity=".28"/></linearGradient>
    <radialGradient id="vig" cx="50%" cy="50%" r="58%"><stop offset="68%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".32"/></radialGradient>
    <radialGradient id="flare" cx="50%" cy="48%" r="56%"><stop offset="0%" stop-color="#fff" stop-opacity=".95"/><stop offset="45%" stop-color="#fff" stop-opacity=".35"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
${gradDefs}
  </defs>
  <style>
${colorCss.join("\n")}
    .dim{animation:dA ${cycle}s ease-in-out ${delay}s infinite}@keyframes dA{${dimKf}}
    .flr{opacity:0;animation:fA ${cycle}s ease-in-out ${delay}s infinite}@keyframes fA{${flareKf}}
    @media(prefers-reduced-motion:reduce){.dim{animation:none;opacity:.25}.flr,rect[class^="l"]{animation:none;opacity:0}}
  </style>
  <rect x="2" y="2" width="252" height="252" rx="40" fill="url(#case)" stroke="#2e3545" stroke-width="4"/>
  <rect x="10" y="10" width="236" height="236" rx="35" fill="#06080c"/>
  <g>
${colorRects.join("\n")}
  </g>
  <rect class="dim" x="14" y="14" width="228" height="228" rx="32" fill="#050810"/>
  <rect class="flr" x="14" y="14" width="228" height="228" rx="32" fill="url(#flare)"/>
  <rect x="14" y="14" width="228" height="228" rx="32" fill="url(#sheen)"/>
  <rect x="14" y="14" width="228" height="228" rx="32" fill="url(#vig)"/>
  <rect x="16" y="16" width="224" height="224" rx="30" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="3"/>
</svg>`;
}

const { loadScore, eventSeed } = await fetchGitHubLoad(USER);
fs.mkdirSync(OUT_DIR, { recursive: true });

for (let id = 1; id <= PAD_COUNT; id++) {
  fs.writeFileSync(path.join(OUT_DIR, `pad-${id}.svg`), generatePadSvg(id, loadScore, eventSeed), "utf8");
}
console.log(`Generated ${PAD_COUNT} dynamic RGB pads in ./pads/`);