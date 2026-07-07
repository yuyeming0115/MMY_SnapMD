from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]
ROOT = Path(__file__).resolve().parents[1]


def find_font(candidates: list[str], fallback_size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, fallback_size)
    return ImageFont.load_default()


def save_icon_set(source: Path) -> None:
    icon_dir = ROOT / "src-tauri" / "icons"
    brand_dir = ROOT / "assets" / "brand"
    generated_dir = brand_dir / "generated"

    icon_dir.mkdir(parents=True, exist_ok=True)
    generated_dir.mkdir(parents=True, exist_ok=True)

    image = Image.open(source).convert("RGBA")
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side))

    image.save(generated_dir / "snapmd-icon-source.png")

    ico_frames = []
    for size in ICON_SIZES:
        resized = image.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(icon_dir / f"{size}x{size}.png")
        ico_frames.append(resized)

    ico_frames[-1].save(
        icon_dir / "icon.ico",
        format="ICO",
        sizes=[(size, size) for size in ICON_SIZES if size <= 256],
    )
    image.resize((512, 512), Image.Resampling.LANCZOS).save(brand_dir / "snapmd-icon-512.png")


def logo_svg() -> str:
    return """<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="420" viewBox="0 0 1440 420" role="img" aria-label="SnapMD 闪阅">
  <defs>
    <linearGradient id="paper" x1="130" y1="68" x2="348" y2="330" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ffffff"/>
      <stop offset="1" stop-color="#dfe5f2"/>
    </linearGradient>
    <linearGradient id="bolt" x1="190" y1="260" x2="366" y2="158" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2638ff"/>
      <stop offset="0.56" stop-color="#3378ff"/>
      <stop offset="1" stop-color="#4df4df"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#10151d" flood-opacity="0.24"/>
    </filter>
  </defs>
  <rect width="1440" height="420" rx="48" fill="#f7f9fc"/>
  <g filter="url(#softShadow)">
    <rect x="92" y="70" width="278" height="278" rx="64" fill="#151a23"/>
    <path d="M160 112h138l50 50v146c0 18-14 32-32 32H160c-18 0-32-14-32-32V144c0-18 14-32 32-32Z" fill="url(#paper)"/>
    <path d="M298 112v38c0 18 14 32 32 32h38l-70-70Z" fill="#cdd6ea"/>
    <path d="M252 154 206 210h55l-50 82 128-112h-61l39-26h-65Z" fill="url(#bolt)"/>
    <path d="M178 184 154 210l24 26M326 184l24 26-24 26" fill="none" stroke="#8d95a5" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M382 167l13 31 31 13-31 13-13 31-13-31-31-13 31-13 13-31Z" fill="#4df4df"/>
  </g>
  <text x="430" y="238" fill="#171c25" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="126" font-weight="800" letter-spacing="0">Snap<tspan fill="#315cff">MD</tspan></text>
  <text x="1010" y="238" fill="#171c25" font-family="Microsoft YaHei UI, PingFang SC, Noto Sans CJK SC, sans-serif" font-size="112" font-weight="800" letter-spacing="0">闪阅</text>
  <text x="438" y="300" fill="#697386" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="34" font-weight="600" letter-spacing="0">Markdown preview, instantly.</text>
</svg>
"""


def save_logo() -> None:
    brand_dir = ROOT / "assets" / "brand"
    brand_dir.mkdir(parents=True, exist_ok=True)

    svg_path = brand_dir / "snapmd-logo.svg"
    svg_path.write_text(logo_svg(), encoding="utf-8")

    # Pillow does not render SVG, so compose a PNG lockup with the generated icon source.
    canvas = Image.new("RGBA", (1440, 420), "#f7f9fc")
    icon = Image.open(brand_dir / "snapmd-icon-512.png").convert("RGBA")
    icon = icon.resize((300, 300), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, (74, 60))

    draw = ImageDraw.Draw(canvas)
    latin_font = find_font(
        [
            "C:/Windows/Fonts/segoeuib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        ],
        126,
    )
    chinese_font = find_font(
        [
            "C:/Windows/Fonts/msyhbd.ttc",
            "C:/Windows/Fonts/simhei.ttf",
        ],
        112,
    )
    subtitle_font = find_font(
        [
            "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ],
        34,
    )

    draw.text((430, 112), "Snap", fill="#171c25", font=latin_font)
    snap_width = draw.textlength("Snap", font=latin_font)
    draw.text((430 + snap_width, 112), "MD", fill="#315cff", font=latin_font)
    draw.text((1010, 120), "闪阅", fill="#171c25", font=chinese_font)
    draw.text((438, 274), "Markdown preview, instantly.", fill="#697386", font=subtitle_font)

    canvas.convert("RGB").save(brand_dir / "snapmd-logo.png", quality=95)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--icon-source", required=True, type=Path)
    args = parser.parse_args()

    save_icon_set(args.icon_source)
    save_logo()


if __name__ == "__main__":
    main()
