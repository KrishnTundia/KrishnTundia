import os
import numpy as np
from PIL import Image, ImageDraw

# Hand-crafted chunky 8x8 Game Boy / 16-bit Arcade Title Pixel Font (2px bold strokes, beveled corners)
GLYPHS = {
    'K': [
        "11000110",
        "11001100",
        "11011000",
        "11110000",
        "11011000",
        "11001100",
        "11000110",
        "11000110",
    ],
    'R': [
        "11111100",
        "11000110",
        "11000110",
        "11111100",
        "11011000",
        "11001100",
        "11000110",
        "11000110",
    ],
    'I': [
        "11111100",
        "00110000",
        "00110000",
        "00110000",
        "00110000",
        "00110000",
        "00110000",
        "11111100",
    ],
    'S': [
        "01111110",
        "11000000",
        "11000000",
        "01111100",
        "00000110",
        "00000110",
        "11000110",
        "01111100",
    ],
    'H': [
        "11000110",
        "11000110",
        "11000110",
        "11111110",
        "11000110",
        "11000110",
        "11000110",
        "11000110",
    ],
    'N': [
        "11000110",
        "11100110",
        "11110110",
        "11011110",
        "11001110",
        "11000110",
        "11000110",
        "11000110",
    ],
    'T': [
        "11111110",
        "11111110",
        "00110000",
        "00110000",
        "00110000",
        "00110000",
        "00110000",
        "00110000",
    ],
    'U': [
        "11000110",
        "11000110",
        "11000110",
        "11000110",
        "11000110",
        "11000110",
        "11000110",
        "01111100",
    ],
    'D': [
        "11111000",
        "11001100",
        "11000110",
        "11000110",
        "11000110",
        "11000110",
        "11001100",
        "11111000",
    ],
    'A': [
        "01111100",
        "11000110",
        "11000110",
        "11111110",
        "11000110",
        "11000110",
        "11000110",
        "11000110",
    ],
    ' ': [
        "0000",
        "0000",
        "0000",
        "0000",
        "0000",
        "0000",
        "0000",
        "0000",
    ],
}

# Tighten trailing empty columns per glyph for authentic proportional pixel kerning
def trim_glyph(rows):
    if all(set(r) == {'0'} for r in rows):
        return rows
    max_c = 0
    for r in rows:
        for i, ch in enumerate(r):
            if ch == '1' and i > max_c:
                max_c = i
    return [r[:max_c + 1] for r in rows]

GLYPHS = {k: trim_glyph(v) for k, v in GLYPHS.items()}

TEXT = "KRISHN TUNDIA"
LETTER_GAP = 2   # 2px between letters (gives room for 3D extrusion & crisp outline!)
DEPTH = 4        # 4px diagonal 3D Game Boy pink extrusion!

# Palette (RGBA)
COL_BG         = (4, 8, 18, 255)      # #040812 abyssal cyber dark
COL_GRID       = (8, 18, 36, 255)     # subtle CRT scanline/bg tint
COL_BORDER     = (34, 211, 238, 255)  # #22d3ee neon cyan border
COL_OUTLINE    = (22, 4, 34, 255)     # #160422 deep plum-black Game Boy pixel outline
# 3D Pink extrusion gradient (near -> far)
PINK_DEPTH = [
    (255, 105, 180, 255),  # d=1: hot bubble pink #ff69b4
    (244, 63, 142, 255),   # d=2: neon pink-magenta #f43f8e
    (219, 39, 119, 255),   # d=3: deep rose pink #db2777
    (157, 23, 77, 255),    # d=4: shadow berry pink #9d174d
]
# Yellow front face gradient across rows 0..7
YEL_FACE = [
    (254, 249, 195, 255),  # row 0: glossy cream-yellow highlight #fef9c3
    (254, 240, 138, 255),  # row 1: bright lemon #fef08a
    (253, 224, 71, 255),   # row 2: Game Boy electric yellow #fde047
    (253, 224, 71, 255),   # row 3: electric yellow #fde047
    (250, 204, 21, 255),   # row 4: rich gold #facc15
    (250, 204, 21, 255),   # row 5: rich gold #facc15
    (234, 179, 8, 255),    # row 6: warm amber gold #eab308
    (217, 119, 6, 255),    # row 7: bottom bevel amber #d97706
]
COL_GLINT      = (255, 255, 255, 255) # crisp white Game Boy gleam
COL_GLINT_SOFT = (254, 249, 195, 255)
COL_SPARK_Y    = (253, 224, 71, 255)
COL_SPARK_P    = (255, 105, 180, 255)
COL_SPARK_C    = (103, 232, 249, 255)

# Compute character x positions
char_positions = []
cur_x = 0
for ch in TEXT:
    g = GLYPHS[ch]
    char_positions.append((ch, cur_x, len(g[0])))
    cur_x += len(g[0]) + (0 if ch == ' ' else LETTER_GAP)
total_text_w = cur_x - LETTER_GAP
print(f"Base text width: {total_text_w}px, height: 8px (+{DEPTH}px 3D depth)")

# Base pixel canvas size
PAD_X = 10
PAD_Y = 9
BASE_W = total_text_w + DEPTH + PAD_X * 2   # ~124
BASE_H = 8 + DEPTH + PAD_Y * 2              # 30
SCALE = 3  # 3x nearest-neighbor -> ~372 x 90 px (super small, ultra crisp!)
print(f"Base canvas: {BASE_W}x{BASE_H} -> Scaled ({SCALE}x): {BASE_W*SCALE}x{BASE_H*SCALE}")

def render_gb_frame(frame_idx, total_frames, transparent=False):
    canvas = np.zeros((BASE_H, BASE_W, 4), dtype=np.uint8)
    if not transparent:
        canvas[:, :] = COL_BG
        # Subtle Game Boy/CRT alternating horizontal scanlines
        canvas[1::2, :] = (6, 12, 25, 255)

    # First collect all letter pixels (with subtle 1px classic Game Boy wave per letter!)
    # Wave only on animated frames; static transparent PNG uses wave=0
    face_mask = np.zeros((BASE_H, BASE_W), dtype=bool)
    face_row_map = np.full((BASE_H, BASE_W), -1, dtype=np.int16)

    for idx, (ch, cx, cw) in enumerate(char_positions):
        if ch == ' ':
            continue
        g = GLYPHS[ch]
        # Subtle 1px retro wave ripple
        if frame_idx is not None:
            phase = (frame_idx / total_frames) * 2 * np.pi - idx * 0.55
            dy = -1 if np.sin(phase) > 0.65 else 0
        else:
            dy = 0
        ox = PAD_X + cx
        oy = PAD_Y + dy
        for r in range(8):
            for c in range(cw):
                if g[r][c] == '1':
                    face_mask[oy + r, ox + c] = True
                    face_row_map[oy + r, ox + c] = r

    # Build combined silhouette of face + 3D extrusion for crisp 1px outer pixel outline
    sil = face_mask.copy()
    for d in range(1, DEPTH + 1):
        shifted = np.zeros_like(face_mask)
        shifted[d:, d:] = face_mask[:-d, :-d]
        sil |= shifted

    # Dilate silhouette by 1px (8-connected) for crisp Game Boy dark outline
    outline = np.zeros_like(sil)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            ys = slice(max(0, dy), BASE_H + min(0, dy))
            xs = slice(max(0, dx), BASE_W + min(0, dx))
            ys_src = slice(max(0, -dy), BASE_H + min(0, -dy))
            xs_src = slice(max(0, -dx), BASE_W + min(0, -dx))
            outline[ys, xs] |= sil[ys_src, xs_src]
    outline &= ~sil

    # 1. Paint outline
    canvas[outline] = COL_OUTLINE

    # 2. Paint 3D Pink Extrusion from farthest (d=DEPTH) to nearest (d=1)
    for d in range(DEPTH, 0, -1):
        shifted = np.zeros_like(face_mask)
        shifted[d:, d:] = face_mask[:-d, :-d]
        # Classic Game Boy 3D lighting: bottom-side pixels slightly deeper pink than right-side pixels!
        canvas[shifted] = PINK_DEPTH[d - 1]
        # Add subtle hot-pink rim highlight on top-right corner edges of d=1
        if d == 1:
            # Pixels in d=1 that are directly right of face (not below) get extra bright pink
            right_only = np.zeros_like(face_mask)
            right_only[:, 1:] = face_mask[:, :-1]
            bright_pink = shifted & right_only & (~face_mask)
            canvas[bright_pink] = (255, 128, 196, 255)

    # 3. Paint Yellow Front Face (with Game Boy vertical gradient)
    ys, xs = np.where(face_mask)
    for y, x in zip(ys, xs):
        r = face_row_map[y, x]
        canvas[y, x] = YEL_FACE[r]

    # 4. Animated Diagonal Specular Glint Sweep across yellow front face!
    if frame_idx is not None:
        glint_pos = -18 + (frame_idx / total_frames) * (BASE_W + 44)
        for y, x in zip(ys, xs):
            diag = (x + y * 1.1) - glint_pos
            if -1.4 <= diag <= 1.4:
                canvas[y, x] = COL_GLINT
            elif -3.2 <= diag <= 3.2:
                canvas[y, x] = COL_GLINT_SOFT

    # 5. Subtle Pixel Sparkles around the logo (Game Boy Title Screen magic!)
    if frame_idx is not None:
        sparks = [
            (7, 5, 0, COL_SPARK_Y),
            (BASE_W - 8, 5, 6, COL_SPARK_P),
            (54, 4, 12, COL_SPARK_C),
            (BASE_W - 14, BASE_H - 6, 18, COL_SPARK_Y),
            (22, BASE_H - 5, 9, COL_SPARK_P),
        ]
        for sx, sy, offset, scol in sparks:
            st = (frame_idx + offset) % total_frames
            if st in (0, 3):
                canvas[sy, sx] = scol
            elif st in (1, 2):
                canvas[sy, sx] = COL_GLINT
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    if 0 <= sy + dy < BASE_H and 0 <= sx + dx < BASE_W:
                        canvas[sy + dy, sx + dx] = scol

    # 6. Sleek 1px Neon Pixel Border on dark card version
    if not transparent:
        # Outer 1px border inset by 1px with chamfered pixel corners
        canvas[1, 2:-2] = COL_BORDER
        canvas[-2, 2:-2] = COL_BORDER
        canvas[2:-2, 1] = COL_BORDER
        canvas[2:-2, -2] = COL_BORDER
        # Corner pink accents
        for cy, cx in [(2, 2), (2, BASE_W - 3), (BASE_H - 3, 2), (BASE_H - 3, BASE_W - 3)]:
            canvas[cy, cx] = PINK_DEPTH[1]

    img = Image.fromarray(canvas, mode="RGBA")
    img = img.resize((BASE_W * SCALE, BASE_H * SCALE), Image.NEAREST)
    return img

# Generate static transparent PNG (4x scale for extra crispness, still tiny!)
static_trans = render_gb_frame(None, 24, transparent=True)
# Re-render static transparent at 4x for crisp hi-DPI usage
static_trans_4x = render_gb_frame(None, 24, transparent=True).resize((BASE_W * 4, BASE_H * 4), Image.NEAREST)
static_trans_4x.save("krishn-tundia-3d-gb-transparent.png", optimize=True)

# Generate animated 24-frame loop (100ms/frame = 2.4s smooth loop!)
N_FRAMES = 24
anim_frames = [render_gb_frame(i, N_FRAMES, transparent=False).convert("RGB") for i in range(N_FRAMES)]

# Build global optimized palette for tiny GIF
p_frames = [f.quantize(colors=32, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE) for f in anim_frames]
gif_path = "krishn-tundia-3d-gb.gif"
p_frames[0].save(
    gif_path,
    save_all=True,
    append_images=p_frames[1:],
    duration=95,
    loop=0,
    optimize=True,
)

# Save ultra-tiny lossless Animated WebP
webp_path = "krishn-tundia-3d-gb.webp"
anim_frames[0].save(
    webp_path,
    save_all=True,
    append_images=anim_frames[1:],
    duration=95,
    loop=0,
    lossless=True,
    method=6,
    quality=85,
)

# Also save a crisp preview strip showing 3 phases + transparent PNG on checkerboard so we can inspect!
preview = Image.new("RGB", (BASE_W * SCALE, BASE_H * SCALE * 3 + 12), (20, 26, 40))
preview.paste(anim_frames[0], (0, 0))
preview.paste(anim_frames[8], (0, BASE_H * SCALE + 4))
preview.paste(anim_frames[16], (0, (BASE_H * SCALE + 4) * 2))
preview.save("preview_check.png")

print(f"GIF size:  {os.path.getsize(gif_path)/1024:.1f} KB ({BASE_W*SCALE}x{BASE_H*SCALE})")
print(f"WebP size: {os.path.getsize(webp_path)/1024:.1f} KB ({BASE_W*SCALE}x{BASE_H*SCALE})")
print(f"Transparent PNG size: {os.path.getsize('krishn-tundia-3d-gb-transparent.png')/1024:.1f} KB ({BASE_W*4}x{BASE_H*4})")

<p align="center">
  <a href="https://github.com/syvixor/skills-icons">
    <img src="https://skills.syvixor.com/api/icons?i=chatgpt,claudeai,claudecode,deepseek,googlegemini,grok,huggingface,minimax,upstageai" alt="Core AI & LLM Providers" />
  </a>
</p>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 408 232" width="408" height="232" role="img" aria-label="KrishnTundia Sub-Sea AI Cyberden ASCII Animation">
  <defs>
    <clipPath id="vp"><rect x="6" y="17" width="396" height="198" /></clipPath>
    <clipPath id="lens">
      <rect x="48" y="72" width="132" height="55" />
      <rect x="228" y="72" width="132" height="55" />
    </clipPath>
  </defs>
  <style>
    .t{font-family:"JetBrains Mono","Fira Code","Cascadia Mono",Consolas,"Liberation Mono",Menlo,monospace;font-size:10px;font-weight:700;white-space:pre}
    .wm{fill:#0d2542}.tl{fill:#164e63}.cy{fill:#22d3ee}.ic{fill:#67e8f9}
    .mg{fill:#f43f8e}.pk{fill:#fb7185}.gd{fill:#facc15}.yl{fill:#fde047}
    .gn{fill:#34d399}.mn{fill:#6ee7b7}.vl{fill:#a78bfa}.sl{fill:#94a3b8}
    .sv{fill:#cbd5e1}.w{fill:#f8fafc}
    .glow{filter:drop-shadow(0 0 2px #22d3ee)}

    .s1{animation:v1 15s linear infinite}
    .s2{opacity:0;animation:v2 15s linear infinite}
    .s3{opacity:0;animation:v3 15s linear infinite}
    .s4{opacity:0;animation:v4 15s linear infinite}
    .s5{opacity:0;animation:v5 15s linear infinite}

    @keyframes v1{0%,47.9%{opacity:1}48%,100%{opacity:0}}
    @keyframes v2{0%,47.9%{opacity:0}48%,59.9%{opacity:1}60%,100%{opacity:0}}
    @keyframes v3{0%,59.9%{opacity:0}60%,75.9%{opacity:1}76%,100%{opacity:0}}
    @keyframes v4{0%,75.9%{opacity:0}76%,82.9%{opacity:1}83%,100%{opacity:0}}
    @keyframes v5{0%,82.9%{opacity:0}83%,100%{opacity:1}}

    .pan{animation:panUp 15s ease-in-out infinite}
    @keyframes panUp{0%{transform:translateY(-154px)}28%,100%{transform:translateY(0)}}

    .pbar{opacity:0;animation:pBar 15s steps(1) infinite}
    @keyframes pBar{0%,28%{opacity:0}28.5%,38.5%{opacity:1}39%,100%{opacity:0}}

    .si{animation:sI 15s steps(1) infinite}
    .sp{opacity:0;animation:sP 15s steps(1) infinite}
    .sr{opacity:0;animation:sR 15s steps(1) infinite}
    @keyframes sI{0%,28%{opacity:1}28.5%,100%{opacity:0}}
    @keyframes sP{0%,28%{opacity:0}28.5%,38.5%{opacity:1}39%,100%{opacity:0}}
    @keyframes sR{0%,38.5%{opacity:0}39%,45.5%{opacity:1}46%,100%{opacity:0}}

    .sup{animation:sDash 15s ease-in infinite}
    @keyframes sDash{0%,38.5%{transform:translateX(0)}45.5%,100%{transform:translateX(var(--dx))}}

    .lift{animation:lDrop 15s ease-in infinite}
    @keyframes lDrop{0%,44.5%{transform:translateY(0)}48%,100%{transform:translateY(165px)}}

    .bub{animation:bUp 2.6s linear infinite}
    @keyframes bUp{0%{transform:translateY(22px);opacity:.9}100%{transform:translateY(-130px);opacity:.2}}
    .spk{animation:bk .35s steps(2) infinite}
    @keyframes bk{0%{opacity:1}100%{opacity:0}}
    .f1{animation:sw 3s ease-in-out infinite alternate}
    .f2{animation:sw 3.4s ease-in-out infinite alternate-reverse}
    @keyframes sw{0%{transform:translateY(0)}100%{transform:translateY(14px)}}

    .pscroll{animation:pS .28s linear infinite}
    @keyframes pS{0%{transform:translateY(0)}100%{transform:translateY(-44px)}}
    .pcar{animation:sh .12s steps(2) infinite}
    @keyframes sh{0%{transform:translateX(-1.5px)}100%{transform:translateX(1.5px)}}

    .jelly{animation:jb 1.8s ease-in-out infinite alternate}
    @keyframes jb{0%{transform:translateY(0)}100%{transform:translateY(10px)}}
    .cdin{animation:cI 15s ease-out infinite}
    @keyframes cI{0%,60%{transform:translateX(-48px);opacity:0}65%,100%{transform:translateX(0);opacity:1}}

    .ret{transform-origin:204px 112px;animation:rL 15s ease-in infinite}
    @keyframes rL{0%,76%{transform:scale(1.15);opacity:.4}82.5%{transform:scale(.62);opacity:1}100%{opacity:0}}
    .glint{animation:gl 2.2s linear infinite}
    @keyframes gl{0%{transform:translateX(0) skewX(-20deg)}100%{transform:translateX(440px) skewX(-20deg)}}
  </style>

  
  <rect width="408" height="232" rx="6" fill="#040812" />
  <rect x="3" y="3" width="402" height="226" rx="4" fill="none" stroke="#22d3ee" stroke-width="1.2" opacity="0.85" />

  <g class="t">
    
    <g class="s1" clip-path="url(#vp)">
      <rect x="12" y="17" width="30" height="198" fill="#081428" />
      <rect x="366" y="17" width="30" height="198" fill="#081428" />
      <text x="12" y="59" class="cy f1">&gt;&lt;&gt;</text>
      <text x="372" y="125" class="cy f2">&lt;&gt;&lt;</text>
      <text x="18" y="169" class="gn">(</text><text x="18" y="180" class="gn">)</text>
      <text x="18" y="191" class="gn">(</text><text x="18" y="202" class="gn">)</text>
      <text x="384" y="169" class="gn">)</text><text x="384" y="180" class="gn">(</text>
      <text x="384" y="191" class="gn">)</text><text x="384" y="202" class="gn">(</text>
      <g class="bub">
        <text x="18" y="191" class="ic">o</text><text x="30" y="125" class="cy">°</text>
        <text x="378" y="158" class="ic">o</text><text x="384" y="81" class="cy">°</text>
      </g>

      <g class="pan">
        
        <text x="42" y="26" class="cy">╔═════════════════════════════════════════════╤══════╗</text>
        <text x="126" y="26" class="ic">[ SUB-SEA AI TOWER ]</text>
        <line x1="45" y1="28" x2="45" y2="365" stroke="#164e63" stroke-width="1.5" />
        <line x1="321" y1="28" x2="321" y2="365" stroke="#164e63" stroke-width="1" />
        <line x1="339" y1="28" x2="339" y2="365" stroke="#0d2542" stroke-width="1" stroke-dasharray="3 3" />
        <line x1="363" y1="28" x2="363" y2="365" stroke="#164e63" stroke-width="1.5" />

        
        <text x="42" y="92" class="tl">╠═════════════════════════════════════════════┼──────╣</text>
        <text x="48" y="92" class="sl">FL-05</text>
        <text x="54" y="48" class="cy">GROQ</text><text x="54" y="70" class="sv">[o_o]</text><text x="84" y="70" class="mn">_=</text><text x="60" y="81" class="sl">d b</text>
        <text x="168" y="48" class="cy">CEREBRAS</text><text x="210" y="59" class="yl spk">*</text><text x="180" y="70" class="sv">[o_o]</text><text x="210" y="70" class="yl">~*</text><text x="186" y="81" class="sl">d b</text>
        <g class="sup" style="--dx:204px">
          <g class="si"><text x="108" y="48" class="pk">OPENAI</text><text x="114" y="59" class="mg">[◉_◉]</text><text x="114" y="70" class="mg">/|≡|\</text><text x="120" y="81" class="pk">/ \</text></g>
          <g class="sp"><text x="114" y="48" class="gd">[PING]</text><text x="114" y="59" class="w">[◉_◉]</text><text x="114" y="70" class="gd">/|_[▪]</text><text x="120" y="81" class="pk">/ \</text></g>
          <g class="sr"><text x="108" y="48" class="gd">OPENAI</text><text x="114" y="59" class="pk">[*_*]</text><text x="114" y="70" class="mg">=/|\&gt;</text><text x="120" y="81" class="gd">/&gt;</text></g>
        </g>
        <g class="sup" style="--dx:60px">
          <g class="si"><text x="246" y="48" class="pk">ANTHROPIC</text><text x="258" y="59" class="mg">[◉_◉]</text><text x="258" y="70" class="mg">/|≡|\</text><text x="264" y="81" class="pk">/ \</text></g>
          <g class="sp"><text x="258" y="48" class="gd">[PING]</text><text x="258" y="59" class="w">[◉_◉]</text><text x="258" y="70" class="gd">/|_[▪]</text><text x="264" y="81" class="pk">/ \</text></g>
          <g class="sr"><text x="246" y="48" class="gd">ANTHROPIC</text><text x="258" y="59" class="pk">[*_*]</text><text x="258" y="70" class="mg">=/|\&gt;</text><text x="264" y="81" class="gd">/&gt;</text></g>
        </g>

        
        <text x="42" y="158" class="tl">╠═════════════════════════════════════════════┼──────╣</text>
        <text x="48" y="158" class="sl">FL-04</text>
        <text x="48" y="114" class="cy">TOGETHER</text><text x="60" y="136" class="sv">[o_o]</text><text x="90" y="136" class="gd">[#]</text><text x="66" y="147" class="sl">d b</text>
        <text x="180" y="114" class="cy">FIREWORKS</text><text x="222" y="125" class="yl spk">*</text><text x="192" y="136" class="sv">[o_o]</text><text x="222" y="136" class="yl">~*</text><text x="198" y="147" class="sl">d b</text>
        <g class="sup" style="--dx:192px">
          <g class="si"><text x="120" y="114" class="pk">GOOGLE</text><text x="126" y="125" class="mg">[◉_◉]</text><text x="126" y="136" class="mg">/|≡|\</text><text x="132" y="147" class="pk">/ \</text></g>
          <g class="sp"><text x="126" y="114" class="gd">[PING]</text><text x="126" y="125" class="w">[◉_◉]</text><text x="126" y="136" class="gd">/|_[▪]</text><text x="132" y="147" class="pk">/ \</text></g>
          <g class="sr"><text x="120" y="114" class="gd">GOOGLE</text><text x="126" y="125" class="pk">[*_*]</text><text x="126" y="136" class="mg">=/|\&gt;</text><text x="132" y="147" class="gd">/&gt;</text></g>
        </g>
        <g class="sup" style="--dx:54px">
          <g class="si"><text x="270" y="114" class="pk">xAI</text><text x="264" y="125" class="mg">[◉_◉]</text><text x="264" y="136" class="mg">/|≡|\</text><text x="270" y="147" class="pk">/ \</text></g>
          <g class="sp"><text x="264" y="114" class="gd">[PING]</text><text x="264" y="125" class="w">[◉_◉]</text><text x="264" y="136" class="gd">/|_[▪]</text><text x="270" y="147" class="pk">/ \</text></g>
          <g class="sr"><text x="270" y="114" class="gd">xAI</text><text x="264" y="125" class="pk">[*_*]</text><text x="264" y="136" class="mg">=/|\&gt;</text><text x="270" y="147" class="gd">/&gt;</text></g>
        </g>

        
        <text x="42" y="224" class="tl">╠═════════════════════════════════════════════┼──────╣</text>
        <text x="48" y="224" class="sl">FL-03</text>
        <text x="48" y="180" class="cy">OLLAMA</text><text x="54" y="202" class="sv">[o_o]</text><text x="84" y="202" class="mn">_=</text><text x="60" y="213" class="sl">d b</text>
        <text x="174" y="180" class="cy">OPENROUTER</text><text x="192" y="202" class="sv">[o_o]</text><text x="222" y="202" class="gd">[#]</text><text x="198" y="213" class="sl">d b</text>
        <g class="sup" style="--dx:198px">
          <g class="si"><text x="108" y="180" class="pk">DEEPSEEK</text><text x="120" y="191" class="mg">[◉_◉]</text><text x="120" y="202" class="mg">/|≡|\</text><text x="126" y="213" class="pk">/ \</text></g>
          <g class="sp"><text x="120" y="180" class="gd">[PING]</text><text x="120" y="191" class="w">[◉_◉]</text><text x="120" y="202" class="gd">/|_[▪]</text><text x="126" y="213" class="pk">/ \</text></g>
          <g class="sr"><text x="108" y="180" class="gd">DEEPSEEK</text><text x="120" y="191" class="pk">[*_*]</text><text x="120" y="202" class="mg">=/|\&gt;</text><text x="126" y="213" class="gd">/&gt;</text></g>
        </g>
        <g class="sup" style="--dx:54px">
          <g class="si"><text x="264" y="180" class="pk">META</text><text x="264" y="191" class="mg">[◉_◉]</text><text x="264" y="202" class="mg">/|≡|\</text><text x="270" y="213" class="pk">/ \</text></g>
          <g class="sp"><text x="264" y="180" class="gd">[PING]</text><text x="264" y="191" class="w">[◉_◉]</text><text x="264" y="202" class="gd">/|_[▪]</text><text x="270" y="213" class="pk">/ \</text></g>
          <g class="sr"><text x="264" y="180" class="gd">META</text><text x="264" y="191" class="pk">[*_*]</text><text x="264" y="202" class="mg">=/|\&gt;</text><text x="270" y="213" class="gd">/&gt;</text></g>
        </g>

        
        <text x="42" y="290" class="tl">╠═════════════════════════════════════════════┼──────╣</text>
        <text x="48" y="290" class="sl">FL-02</text>
        <text x="60" y="246" class="cy">AWS</text><text x="54" y="268" class="sv">[o_o]</text><text x="84" y="268" class="yl">~*</text><text x="60" y="279" class="sl">d b</text>
        <text x="102" y="246" class="pk">MISTRAL</text><text x="108" y="257" class="mg">[◉_◉]</text><text x="108" y="268" class="mg">/|≡|\</text><text x="114" y="279" class="pk">/ \</text>
        <text x="162" y="246" class="cy">PERPLEXITY</text><text x="180" y="268" class="sv">[o_o]</text><text x="210" y="268" class="mn">_=</text><text x="186" y="279" class="sl">d b</text>
        <text x="258" y="246" class="pk">QWEN</text><text x="258" y="257" class="mg">[◉_◉]</text><text x="258" y="268" class="mg">/|≡|\</text><text x="264" y="279" class="pk">/ \</text>

        
        
