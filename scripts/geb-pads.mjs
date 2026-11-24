import fs from "node:fs";
import path from "node:path";

const USER = process.env.GITHUB_REPOSITORY_OWNER || "KrishnTundia";
const TOKEN = process.env.GITHUB_TOKEN || "";
const OUT_DIR = path.resolve("pads");
const SIZE = 46;

const COLS = 15;
const ROWS = 4;
const NUM_SCENES = 20;
const STEPS_PER_SCENE = 8; // 160 total steps (~8 KB per pad, 100% pure CSS fill + opacity)
const TOTAL_STEPS = NUM_SCENES * STEPS_PER_SCENE;

// Exact 30 pad coordinates matching README.md's 15x4 checkerboard (pad-1 .. pad-30)
const PADS = [];
for (let r = 0, id = 1; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    if ((r + c) % 2 === 1) {
      PADS.push({ id: id++, r, c });
    }
  }
}

// 8 Vivid Backlit DJ Controller RGB Palette Colors (Serato / Reloop Neon)
const PALETTE = [
  "#ff3b7a", // Coral Pink
  "#fb923c", // Sunset Orange
  "#facc15", // Electric Yellow
  "#84cc16", // Acid Lime
  "#2dd4bf", // Aqua Mint
  "#38bdf8", // Sky Cyan
  "#3b82f6", // Cobalt Blue
  "#d946ef", // Orchid Magenta
];

const PAL_RGB = PALETTE.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

const mod1 = (x) => ((x % 1) + 1) % 1;
const gauss = (dist, w = 0.22) => Math.exp(-((dist / w) ** 2));
const circDist = (a, b) => {
  const d = mod1(a - b);
  return Math.min(d, 1 - d);
};

function samplePalette(u, shift = 0) {
  const x = mod1(u + shift) * PALETTE.length;
  const i0 = Math.floor(x) % PALETTE.length;
  const i1 = (i0 + 1) % PALETTE.length;
  const f = x - Math.floor(x);
  const r = Math.round(PAL_RGB[i0][0] + (PAL_RGB[i1][0] - PAL_RGB[i0][0]) * f);
  const g = Math.round(PAL_RGB[i0][1] + (PAL_RGB[i1][1] - PAL_RGB[i0][1]) * f);
  const b = Math.round(PAL_RGB[i0][2] + (PAL_RGB[i1][2] - PAL_RGB[i0][2]) * f);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
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
    "User-Agent": "krishntundia-rgb-array",
    Accept: "application/vnd.github+json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };

  let loadScore = 0.5;
  let eventSeed = hashStr(`${username}:${Math.floor(Date.now() / 3600000)}`);

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
    console.log(`GitHub load -> events(7d): ${recentEvents}, pushes: ${pushes}, repos: ${repos}, loadScore: ${loadScore.toFixed(2)}`);
  } catch (err) {
    console.warn("Telemetry fallback:", err.message);
  }

  return { loadScore, eventSeed };
}

// Map normalized energy [0..1] into 3 crisp DJ pad brightness stages + peak flicker
function energyToStage(energy, tick, loadScore) {
  const peakCut = loadScore > 0.65 ? 0.72 : 0.78;
  if (energy < 0.14) return { dim: "0.84", flr: "0" };      // Off / Ultra-dim well
  if (energy < 0.45) return { dim: "0.56", flr: "0" };      // Stage 1: Standby low glow
  if (energy < peakCut) return { dim: "0.22", flr: "0" };   // Stage 2: Active mid groove
  // Stage 3: Peak white-hot LED bloom with electrical micro-flicker on alternating ticks
  if (energy > 0.89 && tick % 2 === 1) return { dim: "0.12", flr: "0.45" };
  return { dim: "0", flr: "0.9" };
}

// 20 Synchronized Launchpad Array Scenes
function evalScene(s, r, c, p, palShift, seed) {
  const nx = c / 14;
  const ny = r / 3;
  const dx = (c - 7) / 7;
  const dy = (r - 1.5) / 1.5;
  const rad = Math.hypot(dx, dy) / Math.SQRT2;                 // 0 at center -> 1 at corners
  const ang = mod1((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)); // 0..1 clockwise
  const isOuter = r === 0 || r === 3 || c === 0 || c === 14;

  switch (s) {
    case 0: // 1. Horizontal Gradient Wave (Left -> Right)
      return [samplePalette(nx * 0.85 + p * 0.3, palShift), 0.12 + 0.88 * gauss(nx - (p * 1.5 - 0.25), 0.24)];

    case 1: // 2. Horizontal Gradient Wave (Right -> Left)
      return [samplePalette((1 - nx) * 0.85 + 0.5, palShift), 0.12 + 0.88 * gauss((1 - nx) - (p * 1.5 - 0.25), 0.24)];

    case 2: { // 3. Vertical Waterfall (Up -> Down)
      const pos = mod1(p * 2);
      return [samplePalette(ny * 0.55 + nx * 0.25 + p, palShift), 0.1 + 0.9 * gauss(ny - (pos * 1.6 - 0.3), 0.28)];
    }

    case 3: { // 4. Vertical Bass Rise (Down -> Up)
      const pos = mod1(p * 2);
      return [samplePalette((1 - ny) * 0.6 + 0.35 + p, palShift), 0.1 + 0.9 * gauss((1 - ny) - (pos * 1.6 - 0.3), 0.28)];
    }

    case 4: { // 5. Diagonal Sweep (Top-Left -> Bottom-Right)
      const d = (nx + ny) / 2;
      return [samplePalette(d + p * 0.4, palShift), 0.12 + 0.88 * gauss(d - (p * 1.5 - 0.25), 0.24)];
    }

    case 5: { // 6. Diagonal Sweep (Top-Right -> Bottom-Left)
      const d = (1 - nx + ny) / 2;
      return [samplePalette(d + 0.45 + p * 0.4, palShift), 0.12 + 0.88 * gauss(d - (p * 1.5 - 0.25), 0.24)];
    }

    case 6: { // 7. Twin Upward Diagonals (BL -> TR & BR -> TL)
      const d1 = (nx + (1 - ny)) / 2;
      const d2 = (1 - nx + (1 - ny)) / 2;
      const w = Math.max(gauss(d1 - (p * 1.5 - 0.25), 0.2), gauss(d2 - (p * 1.5 - 0.25), 0.2));
      return [samplePalette(Math.abs(dx) * 0.7 + ny * 0.3 + p, palShift), 0.1 + 0.9 * w];
    }

    case 7: { // 8. Around All (Clockwise Perimeter Border Chase)
      if (isOuter) {
        const h1 = mod1(p * 2);
        const h2 = mod1(h1 + 0.5);
        const w = Math.max(gauss(circDist(ang, h1), 0.13), gauss(circDist(ang, h2), 0.13));
        return [samplePalette(ang + p, palShift), 0.22 + 0.78 * w];
      }
      return [samplePalette(ang + 0.5, palShift), 0.26 * (0.5 + 0.5 * Math.sin(p * 4 * Math.PI))];
    }

    case 8: { // 9. Going In a Round -> Into an Inside Round (Inward Vortex Spiral)
      const targetR = 1.1 - p * 1.25;
      const ringW = gauss(rad - targetR, 0.24);
      const spiral = 0.5 + 0.5 * Math.cos((ang * 2 - rad * 1.5 - p * 4) * Math.PI);
      return [samplePalette(rad * 0.8 + ang * 0.4 + p, palShift), Math.min(1, ringW * (0.65 + 0.45 * spiral))];
    }

    case 9: { // 10. Outward Burst -> Re-emerge From Outside Round
      const w = p < 0.5
        ? gauss(rad - (p * 2.5 - 0.1), 0.22)
        : gauss(rad - (1.15 - (p - 0.5) * 2.5), 0.22);
      return [samplePalette(rad + p * 0.8 + 0.2, palShift), 0.08 + 0.92 * w];
    }

    case 10: { // 11. Row-by-Row Blinking Cascade
      const step = Math.floor(p * 8) % 4;
      return [samplePalette(r * 0.25 + (p < 0.5 ? 0 : 0.5), palShift), r === step ? 0.95 : 0.1];
    }

    case 11: { // 12. Alternating Rows Strobe (Even vs Odd Rows)
      const beat = Math.floor(p * 6) % 2;
      return [samplePalette((r % 2 === 0 ? 0.05 : 0.55) + p * 0.3, palShift), r % 2 === beat ? 0.95 : 0.18];
    }

    case 12: { // 13. Serpentine Zig-Zag Snake across all 4 rows
      const serp = (r * 15 + (r % 2 === 0 ? c : 14 - c)) / 59;
      return [samplePalette(serp * 1.4 + p * 0.3, palShift), 0.1 + 0.9 * gauss(serp - (p * 1.35 - 0.18), 0.14)];
    }

    case 13: { // 14. Dual Opposing Comets Collide at Center -> Shockwave
      if (p < 0.55) {
        const lp = p / 0.55;
        const wL = gauss(nx - lp * 0.5, 0.15);
        const wR = gauss(1 - nx - lp * 0.5, 0.15);
        return [wL >= wR ? "#38bdf8" : "#ff3b7a", 0.1 + 0.9 * Math.max(wL, wR)];
      }
      const lp = (p - 0.55) / 0.45;
      return [samplePalette(0.15 + rad * 0.6, palShift), 0.12 + 0.88 * gauss(rad - lp * 1.2, 0.26)];
    }

    case 14: { // 15. Center Split Curtains -> Slam Impact
      const front = p < 0.5 ? p * 2.3 : (1 - (p - 0.5) * 2) * 1.15;
      return [samplePalette(Math.abs(dx) * 0.7 + (p < 0.5 ? 0.1 : 0.6), palShift), 0.1 + 0.9 * gauss(Math.abs(dx) - front, 0.22)];
    }

    case 15: { // 16. Live Audio Equalizer / VU Meter Bars
      const beat = Math.floor(p * 6);
      const barH = 0.25 + 0.75 * Math.abs(Math.sin(c * 1.37 + beat * 1.9 + seed * 0.1));
      const lit = 1 - ny <= barH;
      const eqCol = r === 3 ? "#84cc16" : r === 2 ? "#facc15" : r === 1 ? "#fb923c" : "#ff3b7a";
      return [eqCol, lit && r <= 1 ? 0.94 : lit ? 0.72 : 0.08];
    }

    case 16: { // 17. 360-Degree Spinning DJ Rainbow Radar Beam
      const beam = mod1(p * 2);
      return [samplePalette(ang + p * 1.2, palShift), 0.14 + 0.86 * gauss(circDist(ang, beam), 0.14)];
    }

    case 17: { // 18. X-Cross Diamond Laser Pulse
      const xDist = Math.min(Math.abs(dx - dy), Math.abs(dx + dy));
      const pulse = 0.5 + 0.5 * Math.sin(p * 4 * Math.PI - rad * 3);
      return [samplePalette(rad * 0.6 + 0.75 + p * 0.5, palShift), 0.1 + 0.9 * gauss(xDist, 0.26) * (0.45 + 0.55 * pulse)];
    }

    case 18: { // 19. Club Beat-Drop Random Strobe Sparkle
      const tick = Math.floor(p * 8);
      const h = (Math.imul(r, 73856093) ^ Math.imul(c, 19349663) ^ Math.imul(tick + (seed & 0xffff), 83492791)) & 0xffff;
      return [PALETTE[(h >> 4) % PALETTE.length], (h % 100) / 100];
    }

    default: { // 20. 2D Sine Plasma Swirl Finale -> seamless wrap to Scene 1
      const v = (
        Math.sin(nx * 5 + p * 2 * Math.PI) +
        Math.sin(ny * 4 - p * 2 * Math.PI) +
        Math.sin((nx + ny) * 4 + p * 2 * Math.PI)
      ) / 3;
      return [samplePalette(0.5 + 0.5 * v + p * 0.5, palShift), 0.25 + 0.75 * (0.5 + 0.5 * v)];
    }
  }
}

// Run-length keyframe compression (skips unchanged middle ticks to keep SVGs ~8 KB)
function compressKeyframes(samples, prop) {
  const n = samples.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1 || samples[i] !== samples[i - 1] || samples[i] !== samples[i + 1]) {
      const pct = ((i / (n - 1)) * 100).toFixed(2);
      out.push(`${pct}%{${prop}:${samples[i]}}`);
    }
  }
  return out.join("");
}

function buildPadSvg(pad, totalDuration, loadScore, palShift, seed) {
  const fills = [];
  const dims = [];
  const flares = [];

  for (let step = 0; step <= TOTAL_STEPS; step++) {
    const sIdx = step === TOTAL_STEPS ? 0 : Math.floor(step / STEPS_PER_SCENE);
    const lp = step === TOTAL_STEPS ? 0 : (step % STEPS_PER_SCENE) / STEPS_PER_SCENE;
    const [col, energy] = evalScene(sIdx, pad.r, pad.c, lp, palShift, seed);
    const { dim, flr } = energyToStage(energy, step, loadScore);
    fills.push(col);
    dims.push(dim);
    flares.push(flr);
  }

  const kfFill = compressKeyframes(fills, "fill");
  const kfDim = compressKeyframes(dims, "opacity");
  const kfFlr = compressKeyframes(flares, "opacity");
  const dur = `${totalDuration}s`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${SIZE}" height="${SIZE}" role="img" aria-label="RGB Pad ${pad.id}">
  <defs>
    <linearGradient id="case" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#222733"/><stop offset="100%" stop-color="#0b0e14"/></linearGradient>
    <radialGradient id="core" cx="50%" cy="48%" r="64%" fx="50%" fy="46%"><stop offset="0%" stop-color="#fff" stop-opacity=".92"/><stop offset="24%" stop-color="#fff" stop-opacity=".38"/><stop offset="58%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".48"/></radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity=".32"/><stop offset="28%" stop-color="#fff" stop-opacity=".05"/><stop offset="100%" stop-color="#000" stop-opacity=".26"/></linearGradient>
    <radialGradient id="flare" cx="50%" cy="48%" r="56%"><stop offset="0%" stop-color="#fff" stop-opacity=".92"/><stop offset="45%" stop-color="#fff" stop-opacity=".30"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <style>
    .rgb{animation:r ${dur} linear infinite}@keyframes r{${kfFill}}
    .dim{animation:d ${dur} linear infinite}@keyframes d{${kfDim}}
    .flr{animation:f ${dur} linear infinite}@keyframes f{${kfFlr}}
    @media(prefers-reduced-motion:reduce){.rgb,.dim,.flr{animation:none}.dim{opacity:.25}.flr{opacity:0}}
  </style>
  <rect x="2" y="2" width="252" height="252" rx="40" fill="url(#case)" stroke="#2e3545" stroke-width="4"/>
  <rect x="10" y="10" width="236" height="236" rx="35" fill="#06080c"/>
  <rect class="rgb" x="14" y="14" width="228" height="228" rx="32" fill="${fills[0]}"/>
  <rect x="14" y="14" width="228" height="228" rx="32" fill="url(#core)"/>
  <rect class="dim" x="14" y="14" width="228" height="228" rx="32" fill="#050810"/>
  <rect class="flr" x="14" y="14" width="228" height="228" rx="32" fill="url(#flare)"/>
  <rect x="14" y="14" width="228" height="228" rx="32" fill="url(#sheen)"/>
  <rect x="16" y="16" width="224" height="224" rx="30" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="3"/>
</svg>`;
}

const { loadScore, eventSeed } = await fetchGitHubLoad(USER);

// Live GitHub load controls master lightshow speed (40s hype -> 58s chill) & color phase
const totalDuration = Math.round(58 - loadScore * 18);
const palShift = (eventSeed % 1000) / 1000;

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const pad of PADS) {
  const svg = buildPadSvg(pad, totalDuration, loadScore, palShift, eventSeed);
  fs.writeFileSync(path.join(OUT_DIR, `pad-${pad.id}.svg`), svg, "utf8");
}

console.log(`Generated 30 synchronized 20-scene RGB pads (${totalDuration}s loop, load=${loadScore.toFixed(2)}) in ./pads/`);