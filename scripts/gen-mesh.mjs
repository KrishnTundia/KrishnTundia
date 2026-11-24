// Append to the bottom of scripts/gen-pads.mjs
const FA_BRANDS = [
  { slug: "openai",       lightFill: "#10a37f", darkFill: "#ffffff" },
  { slug: "claude",       lightFill: "#d97757", darkFill: "#e88a68" },
  { slug: "hugging-face", lightFill: "#d97706", darkFill: "#ffd21e" },
];

async function fetchFontAwesomeBrand(slug) {
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.3.1/svgs/brands/${slug}.svg`,
    `https://raw.githubusercontent.com/FortAwesome/Font-Awesome/7.x/svgs/brands/${slug}.svg`,
  ];
  for (const url of urls) {
    const res = await fetch(url, { headers: { "User-Agent": "krishntundia-rgb-pads" } });
    if (res.ok) return await res.text();
  }
  throw new Error(`Failed to fetch Font Awesome brand SVG: ${slug}`);
}

for (const { slug, lightFill, darkFill } of FA_BRANDS) {
  const raw = await fetchFontAwesomeBrand(slug);
  const vbMatch = raw.match(/viewBox="([^"]+)"/i);
  const [vx, vy, vw, vh] = (vbMatch ? vbMatch[1] : "0 0 512 512").trim().split(/\s+/).map(Number);
  const inner = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>[\s\S]*$/i, "")
    .replace(/\sfill="[^"]*"/gi, "");

  const scale = 152 / Math.max(vw, vh);
  const tx = (256 - vw * scale) / 2 - vx * scale;
  const ty = (256 - vh * scale) / 2 - vy * scale;

  const wrappedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${SIZE}" height="${SIZE}" role="img" aria-label="${slug}">
  <style>
    .bg { fill: #242938; }
    .fg { fill: ${darkFill}; }
    @media (prefers-color-scheme: light) {
      .bg { fill: #f4f2ed; }
      .fg { fill: ${lightFill}; }
    }
  </style>
  <rect class="bg" width="256" height="256" rx="40"/>
  <g class="fg" transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${inner}</g>
</svg>`;

  fs.writeFileSync(path.join(OUT_DIR, `fa-${slug}.svg`), wrappedSvg, "utf8");
}
console.log("Generated Font Awesome v7.3.1 brand tiles in ./pads/");