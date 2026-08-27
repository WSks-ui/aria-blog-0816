# -*- coding: utf-8 -*-
"""
HarmonyOS Sans SC 自托管分片脚本。

沿用 fonts.css 中 Noto Serif SC 的 Google 式 unicode-range 分片布局，把
HarmonyOS Sans SC 可变字体（wght 40-900）切成同区间的小 woff2 分片，
浏览器只下载页面实际用到的字形区间。生成产物：

  public/fonts/harmonyos-sans-sc/HarmonyOS_Sans_SC.<n>.woff2
  src/styles/harmonyos-sans.css（@font-face 清单，import 进 global.css）

用法：python scripts/build_harmonyos_sans.py [HarmonyOS_Sans_SC.ttf 路径]
缺省路径为本机下载目录；源字体更换后重跑一次即可。
"""
import re
import sys
from pathlib import Path

from fontTools.subset import Options, Subsetter, load_font, save_font

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TTF = Path(r"C:\Users\v2383\Downloads\HarmonyOS+Sans\HarmonyOS Sans\HarmonyOS_Sans_SC.ttf")
OUT_DIR = ROOT / "public" / "fonts" / "harmonyos-sans-sc"
CSS_OUT = ROOT / "src" / "styles" / "harmonyos-sans.css"
FONTS_CSS = ROOT / "src" / "styles" / "fonts.css"

# 源字体的 wght 轴范围，写入每条 @font-face 的 font-weight 描述符。
WEIGHT_RANGE = "40 900"


def parse_unicode_range(text: str) -> list[int]:
	"""展开 'U+4e00-4eaa, U+30??' 这类区间清单为码点列表（支持 ? 通配）。"""
	codes: list[int] = []
	for part in text.split(","):
		part = part.strip()
		if not part:
			continue
		m = re.match(r"^[Uu]\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f?]+))?$", part)
		if not m:
			continue
		lo_s, hi_s = m.group(1), m.group(2)
		lo = int(lo_s.replace("?", "0"), 16)
		hi = int((hi_s or lo_s).replace("?", "F"), 16)
		codes.extend(range(lo, hi + 1))
	return codes


def main() -> None:
	src_ttf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TTF
	if not src_ttf.is_file():
		sys.exit(f"源字体不存在：{src_ttf}")

	css = FONTS_CSS.read_text(encoding="utf-8")
	slices: list[tuple[int, str]] = []
	for body in re.findall(r"@font-face\s*\{([^}]*)\}", css):
		if "Noto Serif SC" not in body:
			continue
		n = re.search(r"url\([^)]*?\.(\d+)\.woff2\)", body)
		ur = re.search(r"unicode-range:\s*([^;]+);", body)
		if n and ur:
			slices.append((int(n.group(1)), ur.group(1)))
	if not slices:
		sys.exit("fonts.css 中未找到 Noto Serif SC 分片，无法沿用区间。")
	print(f"沿用 {len(slices)} 个分片区间")

	OUT_DIR.mkdir(parents=True, exist_ok=True)

	generated: list[str] = []
	skipped: list[int] = []
	for n, ur in sorted(slices):
		opts = Options()
		opts.flavor = "woff2"
		opts.desubroutinize = True
		opts.name_IDs = [0, 1, 2, 3, 4, 6]
		opts.layout_features = ["*"]
		# 站内不做竖排；连同 DSIG/STAT 一起丢掉减小体积（可变轴 gvar 保留）。
		opts.drop_tables += ["vhea", "vmtx", "DSIG", "STAT"]

		font = load_font(str(src_ttf), opts)
		subsetter = Subsetter(opts)
		subsetter.populate(unicodes=parse_unicode_range(ur))
		subsetter.subset(font)
		if not font["cmap"].getBestCmap():
			# 鸿蒙不含该区间字形（如韩文），不产出空分片，交由系统回退。
			skipped.append(n)
			continue

		out_file = OUT_DIR / f"HarmonyOS_Sans_SC.{n}.woff2"
		save_font(font, str(out_file), opts)
		generated.append(
			"@font-face {\n"
			"  font-family: 'HarmonyOS Sans SC';\n"
			"  font-style: normal;\n"
			f"  font-weight: {WEIGHT_RANGE};\n"
			"  font-display: swap;\n"
			f"  src: url(/fonts/harmonyos-sans-sc/HarmonyOS_Sans_SC.{n}.woff2) format('woff2');\n"
			f"  unicode-range: {ur.strip()};\n"
			"}\n"
		)
		font.close()

	header = (
		"/*\n"
		" * HarmonyOS Sans SC 可变字体（wght 40-900），自托管分片。\n"
		" * 本文件由 scripts/build_harmonyos_sans.py 生成，勿手改；\n"
		" * 分片区间沿用 fonts.css 里 Noto Serif SC 的布局，鸿蒙缺失字形的\n"
		" * 区间（韩文等）不产出，交由字体栈后续回退。\n"
		" */\n\n"
	)
	CSS_OUT.write_text(header + "\n".join(generated), encoding="utf-8")

	total_kb = sum(f.stat().st_size for f in OUT_DIR.glob("*.woff2")) // 1024
	print(f"生成 {len(generated)} 片，跳过 {len(skipped)} 片（无字形）：{skipped or '-'}")
	print(f"输出总量约 {total_kb} KB -> {OUT_DIR}")
	print(f"CSS 清单 -> {CSS_OUT}")


if __name__ == "__main__":
	main()
