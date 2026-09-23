"""
Generate a pixel-art animated GIF header for QQQuan2's GitHub profile README.

Art:
  - An orange pixel cat running to the right
  - An electric guitar bouncing behind it
  - "Welcome to my homepage!" text
  - Dark starry background + ground
"""

from PIL import Image, ImageDraw
import os

# ── Palette ──────────────────────────────────────────────────
BG       = (13, 17, 23)   # #0d1117
STAR_C   = (60,  80, 100)
GROUND1  = (30,  40, 55)
GROUND2  = (40,  52, 68)
GROUND3  = (22,  30, 42)

CAT_MAIN = (245, 158, 11)  # #f59e0b
CAT_DARK = (190, 116,  0)  # darker orange (shadows)
CAT_LITE = (255, 195, 65)  # lighter orange (highlights)
CAT_EAR  = (255, 170, 140) # inner ear pink
CAT_EYE  = (219,  39,119)  # #db2777 rose
CAT_NOSE = (219,  39,119)
CAT_PAW  = (255, 210, 120)
CAT_WHISK= (180, 180, 180)

GUITAR_B = (6, 182, 212)  # #06b6d4 cyan body
GUITAR_N = (160, 170, 180) # neck / fretboard
GUITAR_S = (219,  39,119)  # #db2777 strings
GUITAR_D = (0,   140, 170) # darker cyan edge

TEXT_C   = (240, 240, 255)
TEXT_G   = (245, 158, 11)  # #f59e0b glow accent

# ── Canvas ───────────────────────────────────────────────────
W = 820
H = 220
FPS = 180  # ms per frame

# ── Cat pixel sprite (14w × 15h) ────────────────────────────
# Chars:  O = main orange  D = dark orange  L = light orange
#         e = eye          n = nose          p = paw pad
#         i = inner ear    w = whisker
#         . = transparent
CAT_FIXED = [
    "              ",   # 0
    "    O  O      ",   # 1  ears tips
    "   OOO OOO    ",   # 2  ears base
    "  OOOOOOOOOO  ",   # 3  head top
    " OeOOOOOOOeOO ",   # 4  eyes
    " OOOOOOnOOOOO ",   # 5  nose
    " OOOOOOOOOOOO ",   # 6  head bottom
    "  OOOOOOOOOO  ",   # 7  neck
    " OOOOOOOOOOOO ",   # 8  body top
    " OOOOOOOOOOOO ",   # 9  body
    " OOOOOOOOOOOO ",   # 10 body bottom
    "  OO      OO  ",   # 11
    "              ",   # 12 leg anchor row
    "              ",   # 13 leg lower row
    "              ",   # 14 paw row
]

# Leg frames: 4 rows per frame: (row12, row13, row14_left, row14_right)
# Using distinct step positions per frame.
LEG_FRAMES = [
    # 0: left leg back, right leg forward
    (" O           O", "O            O", "O             ", "             O"),
    # 1: both under body (push off)
    (" OO        OO ", " OO        OO ", " O           O", " O           O"),
    # 2: left leg forward, right leg back
    ("O           O ", "O            O", "             O", "O             "),
    # 3: together again
    (" OO        OO ", " OO        OO ", " O           O", " O           O"),
]

CAT_BOUNCE_Y = [0, -4, 0, -4]  # bounce per frame

# ── Electric guitar sprite (8w × 14h) ───────────────────────
# Chars: B = cyan body  D = dark cyan edge  N = neck wood  S = string/rosegold
GUITAR_SPRITE = [
    "      SSSS    ",   # 0  strings peeking above
    "   NNNNNNNN   ",   # 1  headstock top
    "  NNNNNNNNNN  ",   # 2
    "  NNNNNNNNNN  ",   # 3
    "    NNNNNN    ",   # 4  neck meets body
    "   DBBBBBBD   ",   # 5  upper horn
    "  DBBBBBBBBD  ",   # 6
    " DBBBBBBBBBBD ",   # 7  body widest
    " BBBBBBBBBBBB ",   # 8
    " BBBBBBBBBBBB ",   # 9
    "  DBBBBBBBBD  ",   # 10 lower body
    "   DBBBBBBD   ",   # 11
    "    DDDDDD    ",   # 12
    "      SS      ",   # 13 strings peeking below
]

# ── Drawing helpers ──────────────────────────────────────────

def draw_pixel_sprite(draw, x0, y0, sprite, color_map, cell):
    """Draw each char in a sprite grid as a solid-colour rectangle."""
    for row_idx, row_str in enumerate(sprite):
        for col_idx, ch in enumerate(row_str):
            col = color_map.get(ch)
            if col is None:
                continue
            rx = x0 + col_idx * cell
            ry = y0 + row_idx * cell
            draw.rectangle([rx, ry, rx + cell - 1, ry + cell - 1], fill=col)


def draw_cat(draw, cx, cy, frame_idx, cell):
    """Draw the full pixel cat centred at (cx, cy) = centre-bottom of feet."""
    sprite_w = 14  # sprite width in pixels
    # Rows actually used: CAT_FIXED rows 1-11 (11 visible rows) + 3 leg rows = 14 rows
    used_rows = 14
    x0 = cx - (sprite_w * cell) // 2
    y0 = cy - used_rows * cell

    bounce = CAT_BOUNCE_Y[frame_idx]
    y0 += bounce

    body_colors = {
        'O': CAT_MAIN, 'D': CAT_DARK, 'L': CAT_LITE,
        'e': CAT_EYE,  'n': CAT_NOSE, 'i': CAT_EAR,
        'w': CAT_WHISK, 'p': CAT_PAW,
    }
    # Draw fixed body
    draw_pixel_sprite(draw, x0, y0, CAT_FIXED, body_colors, cell)

    # ── Legs from frame data ──
    leg_r12, leg_r13, leg_r14_left, leg_r14_right = LEG_FRAMES[frame_idx]
    # row 12 leg pixels
    for ci, ch in enumerate(leg_r12):
        if ch == 'O':
            rx = x0 + ci * cell
            ry = y0 + 11 * cell
            draw.rectangle([rx, ry, rx + cell - 1, ry + cell - 1], fill=CAT_MAIN)
    # row 13 leg pixels
    for ci, ch in enumerate(leg_r13):
        if ch == 'O':
            rx = x0 + ci * cell
            ry = y0 + 12 * cell
            draw.rectangle([rx, ry, rx + cell - 1, ry + cell - 1], fill=CAT_MAIN)
    # row 14 paw pixels (left)
    for ci, ch in enumerate(leg_r14_left):
        if ch == 'O':
            rx = x0 + ci * cell
            ry = y0 + 13 * cell
            draw.rectangle([rx, ry, rx + cell - 1, ry + cell - 1], fill=CAT_PAW)
    # row 14 paw pixels (right)
    for ci, ch in enumerate(leg_r14_right):
        if ch == 'O':
            rx = x0 + ci * cell
            ry = y0 + 13 * cell
            draw.rectangle([rx, ry, rx + cell - 1, ry + cell - 1], fill=CAT_PAW)

    # ── Tail ──
    tail_x = x0 + 14 * cell + 4
    tail_y = y0 + 9 * cell
    tail_offsets = [
        [(0,0), (6,-6), (14,-3), (18,4)],
        [(0,0), (6,-3), (12,0),  (16,6)],
        [(0,0), (6,-6), (14,-3), (18,4)],
        [(0,0), (6,-3), (12,0),  (16,6)],
    ]
    pts = [(tail_x + dx, tail_y + dy) for dx, dy in tail_offsets[frame_idx]]
    draw.line(pts, fill=CAT_MAIN, width=cell - 1)


def draw_guitar(draw, cx, ground_y, frame_idx, cell):
    """Draw electric guitar sprite standing on the ground."""
    w = 14  # sprite width
    h = 14  # sprite height
    x0 = cx - (w * cell) // 2
    # bottom of guitar touches ground_y
    y0 = ground_y - h * cell

    bounce = CAT_BOUNCE_Y[frame_idx]
    y0 += bounce

    guitar_colors = {
        'B': GUITAR_B, 'D': GUITAR_D,
        'N': GUITAR_N, 'S': GUITAR_S,
    }
    draw_pixel_sprite(draw, x0, y0, GUITAR_SPRITE, guitar_colors, cell)


def create_frame(frame_idx):
    """Render a single frame as a PIL Image."""
    img = Image.new('RGBA', (W, H), BG)
    draw = ImageDraw.Draw(img)

    cell = 8  # pixel block size for cat

    # ── Ground ──
    draw.rectangle([0, H - 30, W, H], fill=GROUND1)
    draw.rectangle([0, H - 32, W, H - 30], fill=GROUND2)
    for gx in range(0, W, 20):
        draw.rectangle([gx, H - 33, gx + 10, H - 32], fill=GROUND3)

    # ── Stars ──
    stars = [(40, 25), (90, 45), (155, 15), (250, 50), (310, 20),
             (400, 40), (470, 10), (530, 35), (610, 18), (690, 48),
             (740, 22), (790, 38)]
    for sx, sy in stars:
        size = 2 if (frame_idx + sx + sy) % 3 == 0 else 1
        draw.rectangle([sx, sy, sx + size, sy + size], fill=STAR_C)

    # ── Guitar (drawn first, behind cat) ──
    guitar_cx = 250   # to the left of the cat
    ground_y = H - 32
    draw_guitar(draw, guitar_cx, ground_y, frame_idx, cell=6)

    # ── Cat ──
    cat_cx = 400
    cat_cy = 196   # paws land at y=188 (top of ground)
    draw_cat(draw, cat_cx, cat_cy, frame_idx, cell)

    # ── Text: "Welcome to my homepage!" ──
    try:
        from PIL import ImageFont
        font_paths = [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
        ]
        font = None
        for fp in font_paths:
            if os.path.exists(fp):
                font = ImageFont.truetype(fp, 24)
                break
        if font is None:
            font = ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()

    text = "Welcome to my homepage!"
    # Shadow glow
    for ox in range(-1, 2):
        for oy in range(-1, 2):
            if ox == 0 and oy == 0:
                continue
            draw.text((W // 2 + ox, 18 + oy), text,
                      fill=(0, 0, 0, 160), font=font, anchor="mm")
    # Main text
    draw.text((W // 2, 18), text, fill=TEXT_C, font=font, anchor="mm")
    # Orange underline
    tw = draw.textlength(text, font=font) if hasattr(draw, 'textlength') else len(text) * 14
    uy = 18 + 16
    draw.rectangle([W//2 - tw//2, uy, W//2 + tw//2, uy + 3], fill=CAT_MAIN)

    # ── Small badge ──
    try:
        small_font = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 13) \
            if os.path.exists("C:/Windows/Fonts/consola.ttf") else ImageFont.load_default()
    except Exception:
        small_font = ImageFont.load_default()
    # Rounded badge behind text
    badge_text = "~ github.com/QQQuan2 ~"
    if hasattr(draw, 'textlength'):
        tw2 = draw.textlength(badge_text, font=small_font)
    else:
        tw2 = len(badge_text) * 8
    badge_x = cat_cx - tw2 // 2 - 10
    badge_y = H - 30 - 38  # above the cat, at y=152
    draw.rounded_rectangle([badge_x, badge_y, badge_x + tw2 + 20, badge_y + 22],
                            radius=6, fill=(219, 39, 119, 60))
    draw.text((cat_cx, H - 30 - 18), badge_text,
              fill=CAT_LITE, font=small_font, anchor="mm")

    return img


# ── Main ─────────────────────────────────────────────────────
def main():
    frames = []
    for i in range(4):
        print(f"Rendering frame {i + 1}/4...")
        frame = create_frame(i)
        frames.append(frame)

    out_path = os.path.join(os.path.dirname(__file__), "assets", "header.gif")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    # Save as GIF with transparency kept, loop forever
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=FPS,
        loop=0,
        disposal=2,  # clear each frame before drawing next
        optimize=False,
    )
    print(f"[OK] GIF saved to {out_path}")
    print(f"  Dimensions: {W}x{H}")
    print(f"  Frames: {len(frames)} @ {FPS}ms each")


if __name__ == "__main__":
    main()