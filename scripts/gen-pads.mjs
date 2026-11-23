import fs from "node:fs";
import path from "node:path";

const USER = process.env.GITHUB_REPOSITORY_OWNER || "KrishnTundia";
const TOKEN = process.env.GITHUB_TOKEN || "";
const DEPS_DIR = process.env.FA_DEPS_DIR || "/tmp/fa-tools/node_modules";

const FA_BRANDS_DIR = path.join(DEPS_DIR, "@fortawesome", "fontawesome-free", "svgs", "brands");
const SI_DATA_PATHS = [
  path.join(DEPS_DIR, "simple-icons", "data", "simple-icons.json"),
  path.join(DEPS_DIR, "simple-icons", "_data", "simple-icons.json"),
];

const ICONS_OUT = path.resolve("fa-icons");
const PADS_OUT = path.resolve("pads");
const README_PATH = path.resolve("README.md");

const COLS = 15;         // 15-column checkerboard: 8 icons + 7 pads, then 7 icons + 8 pads
const SIZE = 46;         // 46x46 px uniform tiles
const PAD_POOL = 30;     // 30 independent flickering RGB pads recycled across the mesh
const MAX_ICONS = 0;     // 0 = ALL Font Awesome Brands Solid icons (~572+); set e.g. 60 to cap

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

// Curated official homepage URLs for popular & tricky Font Awesome brand slugs
const OFFICIAL_URLS = {
  "42-group": "https://42.fr",
  "500px": "https://500px.com",
  "accessible-icon": "https://accessibleicon.org",
  "airbnb": "https://www.airbnb.com",
  "algolia": "https://www.algolia.com",
  "alipay": "https://www.alipay.com",
  "amazon": "https://www.amazon.com",
  "amazon-pay": "https://pay.amazon.com",
  "android": "https://www.android.com",
  "angular": "https://angular.dev",
  "app-store": "https://www.apple.com/app-store",
  "app-store-ios": "https://www.apple.com/app-store",
  "apple": "https://www.apple.com",
  "apple-pay": "https://www.apple.com/apple-pay",
  "artstation": "https://www.artstation.com",
  "atlassian": "https://www.atlassian.com",
  "aws": "https://aws.amazon.com",
  "bandcamp": "https://bandcamp.com",
  "battle-net": "https://www.blizzard.com",
  "behance": "https://www.behance.net",
  "bitbucket": "https://bitbucket.org",
  "bitcoin": "https://bitcoin.org",
  "bluesky": "https://bsky.app",
  "bootstrap": "https://getbootstrap.com",
  "brave": "https://brave.com",
  "btc": "https://bitcoin.org",
  "centos": "https://www.centos.org",
  "chrome": "https://www.google.com/chrome",
  "claude": "https://claude.ai",
  "cloudflare": "https://www.cloudflare.com",
  "codepen": "https://codepen.io",
  "confluence": "https://www.atlassian.com/software/confluence",
  "creative-commons": "https://creativecommons.org",
  "css": "https://developer.mozilla.org/en-US/docs/Web/CSS",
  "css3": "https://developer.mozilla.org/en-US/docs/Web/CSS",
  "css3-alt": "https://developer.mozilla.org/en-US/docs/Web/CSS",
  "dart-lang": "https://dart.dev",
  "debian": "https://www.debian.org",
  "dev": "https://dev.to",
  "deviantart": "https://www.deviantart.com",
  "digital-ocean": "https://www.digitalocean.com",
  "discord": "https://discord.com",
  "docker": "https://www.docker.com",
  "dribbble": "https://dribbble.com",
  "dropbox": "https://www.dropbox.com",
  "drupal": "https://www.drupal.org",
  "ebay": "https://www.ebay.com",
  "edge": "https://www.microsoft.com/edge",
  "elementor": "https://elementor.com",
  "ethereum": "https://ethereum.org",
  "etsy": "https://www.etsy.com",
  "facebook": "https://www.facebook.com",
  "fedora": "https://fedoraproject.org",
  "figma": "https://www.figma.com",
  "firefox": "https://www.mozilla.org/firefox",
  "firefox-browser": "https://www.mozilla.org/firefox",
  "flickr": "https://www.flickr.com",
  "flutter": "https://flutter.dev",
  "font-awesome": "https://fontawesome.com",
  "free-code-camp": "https://www.freecodecamp.org",
  "git": "https://git-scm.com",
  "github": "https://github.com",
  "gitlab": "https://gitlab.com",
  "golang": "https://go.dev",
  "goodreads": "https://www.goodreads.com",
  "google": "https://www.google.com",
  "google-drive": "https://drive.google.com",
  "google-pay": "https://pay.google.com",
  "google-play": "https://play.google.com",
  "google-scholar": "https://scholar.google.com",
  "gulp": "https://gulpjs.com",
  "hacker-news": "https://news.ycombinator.com",
  "hackerrank": "https://www.hackerrank.com",
  "hashnode": "https://hashnode.com",
  "html5": "https://developer.mozilla.org/en-US/docs/Web/HTML",
  "hubspot": "https://www.hubspot.com",
  "hugging-face": "https://huggingface.co",
  "imdb": "https://www.imdb.com",
  "instagram": "https://www.instagram.com",
  "intercom": "https://www.intercom.com",
  "itch-io": "https://itch.io",
  "java": "https://www.java.com",
  "jenkins": "https://www.jenkins.io",
  "jira": "https://www.atlassian.com/software/jira",
  "joomla": "https://www.joomla.org",
  "js": "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  "kaggle": "https://www.kaggle.com",
  "kickstarter": "https://www.kickstarter.com",
  "laravel": "https://laravel.com",
  "less": "https://lesscss.org",
  "letterboxd": "https://letterboxd.com",
  "line": "https://line.me",
  "linkedin": "https://www.linkedin.com",
  "linux": "https://www.kernel.org",
  "lyft": "https://www.lyft.com",
  "magento": "https://business.adobe.com/products/magento/magento-commerce.html",
  "mailchimp": "https://mailchimp.com",
  "markdown": "https://daringfireball.net/projects/markdown",
  "mastercard": "https://www.mastercard.com",
  "mastodon": "https://joinmastodon.org",
  "mdb": "https://mdbootstrap.com",
  "medium": "https://medium.com",
  "meetup": "https://www.meetup.com",
  "meta": "https://www.meta.com",
  "microsoft": "https://www.microsoft.com",
  "node": "https://nodejs.org",
  "node-js": "https://nodejs.org",
  "notion": "https://www.notion.so",
  "npm": "https://www.npmjs.com",
  "openai": "https://openai.com",
  "opensuse": "https://www.opensuse.org",
  "opera": "https://www.opera.com",
  "orcid": "https://orcid.org",
  "patreon": "https://www.patreon.com",
  "paypal": "https://www.paypal.com",
  "php": "https://www.php.net",
  "pinterest": "https://www.pinterest.com",
  "pixiv": "https://www.pixiv.net",
  "playstation": "https://www.playstation.com",
  "product-hunt": "https://www.producthunt.com",
  "python": "https://www.python.org",
  "qq": "https://im.qq.com",
  "quora": "https://www.quora.com",
  "r-project": "https://www.r-project.org",
  "raspberry-pi": "https://www.raspberrypi.com",
  "react": "https://react.dev",
  "reacteurope": "https://www.react-europe.org",
  "reddit": "https://www.reddit.com",
  "redhat": "https://www.redhat.com",
  "rust": "https://www.rust-lang.org",
  "safari": "https://www.apple.com/safari",
  "salesforce": "https://www.salesforce.com",
  "sass": "https://sass-lang.com",
  "shopify": "https://www.shopify.com",
  "signal-messenger": "https://signal.org",
  "sketch": "https://www.sketch.com",
  "skype": "https://www.skype.com",
  "slack": "https://slack.com",
  "snapchat": "https://www.snapchat.com",
  "soundcloud": "https://soundcloud.com",
  "spotify": "https://open.spotify.com",
  "squarespace": "https://www.squarespace.com",
  "stack-exchange": "https://stackexchange.com",
  "stack-overflow": "https://stackoverflow.com",
  "steam": "https://store.steampowered.com",
  "strava": "https://www.strava.com",
  "stripe": "https://stripe.com",
  "suse": "https://www.suse.com",
  "swift": "https://www.swift.org",
  "symfony": "https://symfony.com",
  "telegram": "https://telegram.org",
  "threads": "https://www.threads.net",
  "tiktok": "https://www.tiktok.com",
  "trello": "https://trello.com",
  "tumblr": "https://www.tumblr.com",
  "twitch": "https://www.twitch.tv",
  "twitter": "https://x.com",
  "uber": "https://www.uber.com",
  "ubuntu": "https://ubuntu.com",
  "unity": "https://unity.com",
  "unsplash": "https://unsplash.com",
  "upwork": "https://www.upwork.com",
  "viber": "https://www.viber.com",
  "vimeo": "https://vimeo.com",
  "visa": "https://www.visa.com",
  "vk": "https://vk.com",
  "vuejs": "https://vuejs.org",
  "waze": "https://www.waze.com",
  "web-awesome": "https://webawesome.com",
  "webflow": "https://webflow.com",
  "weibo": "https://weibo.com",
  "weixin": "https://www.wechat.com",
  "whatsapp": "https://www.whatsapp.com",
  "wikipedia-w": "https://www.wikipedia.org",
  "windows": "https://www.microsoft.com/windows",
  "wix": "https://www.wix.com",
  "wordpress": "https://wordpress.org",
  "x-twitter": "https://x.com",
  "xbox": "https://www.xbox.com",
  "xing": "https://www.xing.com",
  "yahoo": "https://www.yahoo.com",
  "yandex": "https://yandex.com",
  "yarn": "https://yarnpkg.com",
  "yelp": "https://www.yelp.com",
  "youtube": "https://www.youtube.com",
};

const AGGREGATOR_HOSTS = new Set([
  "wikipedia.org", "wikimedia.org", "worldvectorlogo.com", "seeklogo.com",
  "brandfetch.com", "vectorlogo.zone", "cdnlogo.com", "fontawesome.com",
  "simpleicons.org", "githubusercontent.com", "jsdelivr.net", "unpkg.com",
  "cloudfront.net", "s3.amazonaws.com", "storage.googleapis.com",
]);

const STRIP_SUBDOMAINS = new Set([
  "brand", "press", "about", "design", "docs", "developer", "developers",
  "media", "assets", "images", "img", "cdn", "static", "help", "support",
  "blog", "news", "newsroom", "marketing", "identity", "logos", "en",
]);

const MULTI_PART_TLDS = new Set([
  "co.uk", "org.uk", "com.au", "co.jp", "com.br", "co.in", "co.nz", "co.kr",
]);

function normalizeSlug(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/^fa-/, "")
    .replace(/[^a-z0-9]/g, "");
}

function stripVariant(slug) {
  return slug
    .replace(/^square-/, "")
    .replace(/^cc-/, "")
    .replace(/-(square|alt|f|in|p|v|b|h|w|g|s|horizontal|vertical|symbol|simple|browser|messenger|lang|ios)$/, "");
}

function cleanOriginUrl(rawUrl, slug) {
  if (!rawUrl || !rawUrl.startsWith("http")) return null;
  try {
    const u = new URL(rawUrl);
    let host = u.hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".");
    const lastTwo = parts.slice(-2).join(".");
    const rootDomain = MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3
      ? parts.slice(-3).join(".")
      : lastTwo;

    if (AGGREGATOR_HOSTS.has(rootDomain)) return null;
    if (rootDomain === "github.com" && !slug.includes("github")) {
      // Keep direct OSS org/repo URL only if it's a real repo path
      const segs = u.pathname.split("/").filter(Boolean);
      return segs.length >= 2 ? `https://github.com/${segs[0]}/${segs[1]}` : null;
    }

    if (parts.length > 2 && STRIP_SUBDOMAINS.has(parts[0])) {
      host = rootDomain;
    }
    return `https://${host}`;
  } catch {
    return null;
  }
}

function loadSimpleIconsIndex() {
  const bySlug = new Map();
  const dataFile = SI_DATA_PATHS.find((p) => fs.existsSync(p));
  if (!dataFile) return bySlug;

  const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const list = Array.isArray(parsed) ? parsed : (parsed.icons || []);

  for (const item of list) {
    const entry = {
      hex: item.hex ? `#${item.hex}` : null,
      source: item.source || null,
      guidelines: item.guidelines || null,
      title: item.title || "",
    };
    const keys = [
      item.slug,
      normalizeSlug(item.title),
      ...(item.aliases?.aka || []).map(normalizeSlug),
      ...(item.aliases?.old || []).map(normalizeSlug),
    ].filter(Boolean);

    for (const k of keys) {
      if (!bySlug.has(k)) bySlug.set(k, entry);
    }
  }
  return bySlug;
}

function isReadableOnDark(hex) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum >= 0.14;
}

function resolveBrandMeta(slug, siIndex) {
  const base = stripVariant(slug);
  const si =
    siIndex.get(normalizeSlug(slug)) ||
    siIndex.get(normalizeSlug(base)) ||
    siIndex.get(normalizeSlug(slug.replace(/-/g, "")));

  const officialUrl =
    OFFICIAL_URLS[slug] ||
    OFFICIAL_URLS[base] ||
    cleanOriginUrl(si?.guidelines, slug) ||
    cleanOriginUrl(si?.source, slug) ||
    `https://fontawesome.com/icons/brands/solid/${slug}`;

  const rawHex = si?.hex || "#e2e8f0";
  const iconColor = isReadableOnDark(rawHex) ? rawHex : "#f1f5f9";
  const borderColor = isReadableOnDark(rawHex) ? rawHex : "#38bdf8";
  const title = si?.title || slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

  return { officialUrl, iconColor, borderColor, title };
}

function wrapBrandSvg(rawSvg, iconColor, borderColor, title) {
  const vbMatch = rawSvg.match(/viewBox="([^"]+)"/i);
  const [vx, vy, vw, vh] = (vbMatch ? vbMatch[1] : "0 0 512 512")
    .trim()
    .split(/\s+/)
    .map(Number);

  // Extract inner SVG shapes, preserving multiple paths if present
  const inner = rawSvg
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>[\s\S]*$/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\sfill="[^"]*"/gi, "")
    .trim();

  // Fit cleanly inside a 146x146 centered safe box inside our 256x256 dark rounded tile
  const target = 146;
  const scale = target / Math.max(vw || 512, vh || 512);
  const tx = (256 - vw * scale) / 2 - vx * scale;
  const ty = (256 - vh * scale) / 2 - vy * scale;

  return `<!-- Font Awesome Free Brands (CC BY 4.0) -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${SIZE}" height="${SIZE}" role="img" aria-label="${title.replace(/"/g, "&quot;")}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a2234"/>
      <stop offset="100%" stop-color="#0b101b"/>
    </linearGradient>
    <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity=".16"/>
      <stop offset="50%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="248" height="248" rx="40" fill="url(#bg)" stroke="${borderColor}" stroke-opacity=".55" stroke-width="5"/>
  <rect x="10" y="10" width="236" height="236" rx="34" fill="url(#gl)"/>
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(5)})" fill="${iconColor}">${inner}</g>
</svg>`;
}

// ============================================================================
// 3-STAGE GITHUB-LOAD RGB MIXER PAD GENERATOR
// ============================================================================
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
    "User-Agent": "krishntundia-fa-rgb-mesh",
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
    console.log(`GitHub load -> events(7d): ${recentEvents}, pushes: ${pushes}, repos: ${repos}, score: ${loadScore.toFixed(2)}`);
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

  if (loadScore > 0.62 || rng() < loadScore) {
    return {
      cycle,
      delay,
      dimKf: `0%,100%{opacity:.74}14%{opacity:.30}28%{opacity:.32}32%{opacity:0}35%{opacity:.38}38%{opacity:0}46%{opacity:.30}62%{opacity:.74}76%{opacity:.28}80%{opacity:0}83%{opacity:.36}86%{opacity:.02}94%{opacity:.70}`,
      flareKf: `0%,29%,44%,77%,92%,100%{opacity:0}32%,38%{opacity:.95}35%{opacity:.30}80%,86%{opacity:.90}83%{opacity:.26}`,
    };
  }

  return {
    cycle,
    delay,
    dimKf: `0%,100%{opacity:.76}22%{opacity:.32}46%{opacity:.34}52%{opacity:0}56%{opacity:.40}60%{opacity:0}70%{opacity:.32}86%{opacity:.74}`,
    flareKf: `0%,48%,68%,100%{opacity:0}52%,60%{opacity:.92}56%{opacity:.24}`,
  };
}

function generatePadSvg(id, loadScore, eventSeed) {
  const rng = mulberry32((id * 2654435761) ^ eventSeed);

  const pool = [...COLOR_KEYS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = 5 + (rng() > 0.5 ? 1 : 0);
  const seq = pool.slice(0, count);
  const holds = seq.map(() => 1 + Math.floor(rng() * 3)); // 1s, 2s, or 3s
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

// ============================================================================
// MAIN: BUILD ./fa-icons/, ./pads/, AND AUTO-UPDATE README.md
// ============================================================================
if (!fs.existsSync(FA_BRANDS_DIR)) {
  throw new Error(`Font Awesome brands dir not found at ${FA_BRANDS_DIR}.`);
}

const siIndex = loadSimpleIconsIndex();
const { loadScore, eventSeed } = await fetchGitHubLoad(USER);

fs.mkdirSync(ICONS_OUT, { recursive: true });
fs.mkdirSync(PADS_OUT, { recursive: true });

// 1. Generate 30 live GitHub-load flickering RGB DJ pads
for (let id = 1; id <= PAD_POOL; id++) {
  fs.writeFileSync(path.join(PADS_OUT, `pad-${id}.svg`), generatePadSvg(id, loadScore, eventSeed), "utf8");
}

// 2. Wrap ALL Font Awesome Brands Solid icons into matching dark tiles + resolve official URLs
let files = fs.readdirSync(FA_BRANDS_DIR).filter((f) => f.endsWith(".svg")).sort();
if (MAX_ICONS > 0) files = files.slice(0, MAX_ICONS);

const brandEntries = [];
for (const file of files) {
  const slug = file.replace(/\.svg$/i, "");
  const rawSvg = fs.readFileSync(path.join(FA_BRANDS_DIR, file), "utf8");
  const meta = resolveBrandMeta(slug, siIndex);
  const tileSvg = wrapBrandSvg(rawSvg, meta.iconColor, meta.borderColor, meta.title);
  fs.writeFileSync(path.join(ICONS_OUT, `${slug}.svg`), tileSvg, "utf8");
  brandEntries.push({ slug, ...meta });
}

// 3. Assemble 15-column checkerboard mesh with official website hyperlinks
const htmlRows = [];
let idx = 0;
let row = 0;
let padStep = 0;

while (idx < brandEntries.length) {
  const cells = [];
  for (let c = 0; c < COLS; c++) {
    const isIconSlot = (row + c) % 2 === 0;
    if (isIconSlot && idx < brandEntries.length) {
      const b = brandEntries[idx++];
      const alt = b.title.replace(/"/g, "&quot;");
      cells.push(`  <a href="${b.officialUrl}" title="${alt}"><img src="./fa-icons/${b.slug}.svg" width="${SIZE}" height="${SIZE}" alt="${alt}" /></a>`);
    } else {
      // Prime stride (7) prevents neighboring rows/cols from syncing on the same pad ID
      const padId = ((padStep * 7 + row * 3) % PAD_POOL) + 1;
      padStep++;
      cells.push(`  <img src="./pads/pad-${padId}.svg" width="${SIZE}" height="${SIZE}" alt="" />`);
    }
  }
  htmlRows.push(cells.join("\n"));
  row++;
}

const meshBlock = `<p align="center">\n${htmlRows.join("\n  <br />\n")}\n</p>`;

// 4. Inject cleanly into README.md between <!-- MESH:START --> and <!-- MESH:END -->
const START = "<!-- MESH:START -->";
const END = "<!-- MESH:END -->";
const readme = fs.readFileSync(README_PATH, "utf8");

if (!readme.includes(START) || !readme.includes(END)) {
  throw new Error(`Add ${START} and ${END} markers to README.md where you want the mesh.`);
}

const updatedReadme = readme.replace(
  new RegExp(`${START}[\\s\\S]*?${END}`),
  `${START}\n${meshBlock}\n${END}`
);
fs.writeFileSync(README_PATH, updatedReadme, "utf8");

console.log(`Done: ${brandEntries.length} Font Awesome Brand icons (${row} rows) + ${PAD_POOL} RGB pads updated in README.md`);