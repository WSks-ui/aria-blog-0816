import {
	AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, DoubleSide,
	DynamicDrawUsage, Group, Mesh, ShaderMaterial, Sphere, SRGBColorSpace, Vector3,
} from 'three';
import lineVertex from '@/shaders/topography-line.vert.glsl?raw';
import lineFragment from '@/shaders/topography-line.frag.glsl?raw';
import fillVertex from '@/shaders/topography-fill.vert.glsl?raw';
import fillFragment from '@/shaders/topography-fill.frag.glsl?raw';
import markerVertex from '@/shaders/topography-marker.vert.glsl?raw';
import markerFragment from '@/shaders/topography-marker.frag.glsl?raw';
import labelVertex from '@/shaders/topography-label.vert.glsl?raw';
import labelFragment from '@/shaders/topography-label.frag.glsl?raw';
import { TOPOGRAPHY_DRIFT as DRIFT, TOPOGRAPHY_LOOP as LOOP, TOPOGRAPHY_TILE as TILE } from './topography-settings';
import { nearest, random, scatter, SITES, terrainHeight, type Site } from './topography-terrain';

// 战斗层：一条 120 秒的编排时间轴，与镜头北移同周期循环。每个交战事件在世界坐标上固定，
// 画面完全由循环时间决定（可任意定位、暂停、导出），不依赖逐帧累积的状态。
// 行为参考 MUSYNX RETURN Dark_2D 背景的交战逻辑：目标出现 → 射程圈 → 进入 → 开火 → 命中 → 目标消失 → 攻击方离开画面。
// 全部单位、标注与编排为原创几何和文字，不含游戏素材。

type V2 = [number, number];
type RGB = readonly [number, number, number];
/** hull：舰船用色，刚好压在泛光阈值附近，只有受光的一侧微微晕开，两色分面看得清。 */
interface Side { main: RGB; hot: RGB; dim: RGB; hull: RGB; ink: string }

const linear = (hex: string, k = 1): RGB => { const c = new Color(hex); return [c.r * k, c.g * k, c.b * k]; };
const tint = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: V2, b: V2, k: number): V2 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = (deg: number): V2 => [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
const noise1 = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const code = (seed: number, i: number, digits = 3) => String((seed * 37 + i * 53) % (digits === 4 ? 9000 : 900) + (digits === 4 ? 1000 : 100));

// 线性 HDR 颜色：hot 超过泛光阈值，只让机体、爆点与线头晕开；main 为射程圈与尾迹；dim 为弹道细线。
const CYAN: Side = { main: linear('#5fd8e6', .9), hot: linear('#79e6f0', 1.15), dim: linear('#4cc6d4', .45), hull: linear('#6ad9e6', .95), ink: '#74dde9' };
const PINK: Side = { main: linear('#f06cc6', .9), hot: linear('#fb86d2', 1.15), dim: linear('#e86bc0', .45), hull: linear('#f47ccb', .95), ink: '#f486d4' };
const WHITE = linear('#f1f5f6', 1.2);

// 图形朝 +x，单位为格。rim 为外缘（逆时针），以 center 做扇形三角化；shade 为每个扇形的明暗，表现俯视下的受光面。
interface Glyph { rim: readonly V2[]; center: V2; shade: readonly number[] }
const glyph = (rim: V2[], shade: number[], center: V2 = [0, 0]): Glyph => ({ rim, center, shade });
/** 大型攻击机：后掠飞翼。机头短，两翼细长、后掠约 30°，翼展约 1 格，尾部深凹。
 *  左翼受光、右翼背光，像折起的纸飞机；翼尖收成尖角。 */
const WING = glyph([[.16, 0], [-.15, .5], [-.075, .2], [-.03, 0], [-.075, -.2], [-.15, -.5]], [1.2, 1.05, .95, .68, .62, .72], [.06, 0]);
/** 舰船与登陆艇：叶形船体，中部最宽、两端收尖；沿中轴一侧略亮。 */
const HULL = glyph([[.2, 0], [.1, .052], [-.02, .058], [-.13, .036], [-.19, 0], [-.13, -.036], [-.02, -.058], [.1, -.052]],
	[1.1, 1.1, 1.1, 1.1, .72, .72, .72, .72]);
/** 战斗机：对称箭头，长 0.2 格，尾部内凹；凹口接在粗尾迹的前端，整体读作一支矢量箭头。 */
const ARROW = glyph([[.12, 0], [-.08, .07], [-.035, 0], [-.08, -.07]], [1.1, 1, .9, .95]);
/** 箭头凹口到原点的距离：绘制时前移这一段，让凹口正好落在尾迹线头上。 */
const ARROW_NOTCH = .035;
/** 透视抬升系数：参考画面是正俯视的透视相机，离地物体从画面中心向外偏移 k × 到中心的距离。
 *  实测参考视频中大型飞翼约 0.13、战斗机约 0.1；地面立方体取 0.012，画面中部也能看出一点侧面。 */
const K_WING = .13, K_FIGHTER = .1, K_CUBE = .012;
/** 步兵：细长胶囊。 */
const CAPSULE = glyph([[.075, 0], [.06, .026], [-.06, .026], [-.075, 0], [-.06, -.026], [.06, -.026]], [1.1, 1.1, 1.1, .8, .8, .8]);

/** 按弧长参数化的折线路径。 */
class Path {
	readonly acc: number[] = [0];
	readonly length: number;
	constructor(readonly pts: V2[]) {
		for (let i = 1; i < pts.length; i++) this.acc.push(this.acc[i - 1] + dist(pts[i], pts[i - 1]));
		this.length = this.acc[this.acc.length - 1];
	}
	static smooth(control: V2[], samples = 200) {
		const curve = new CatmullRomCurve3(control.map(([x, y]) => new Vector3(x, y, 0)), false, 'centripetal');
		return new Path(curve.getSpacedPoints(samples).map((v): V2 => [v.x, v.y]));
	}
	at(d: number) {
		const s = clamp(d, 0, this.length);
		let lo = 0, hi = this.acc.length - 1;
		while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.acc[m] <= s) lo = m; else hi = m; }
		const a = this.pts[lo], b = this.pts[hi], k = (s - this.acc[lo]) / (this.acc[hi] - this.acc[lo] || 1);
		return { p: lerp(a, b, k), angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
	}
	/** 横向平移整条路径，用于编队中的僚机。 */
	offset(k: number) {
		return new Path(this.pts.map((p, i): V2 => {
			const a = this.pts[Math.max(0, i - 1)], b = this.pts[Math.min(this.pts.length - 1, i + 1)];
			const l = dist(a, b) || 1;
			return [p[0] - (b[1] - a[1]) / l * k, p[1] + (b[0] - a[0]) / l * k];
		}));
	}
	/** 截到 from 之后第一次由海入陆的位置，即登陆艇的靠岸点；途中擦过的小岛与起点所在的岸不算。 */
	until(stop: (p: V2) => boolean, from = 0) {
		let atSea = false;
		for (let i = 1; i < this.pts.length; i++) {
			if (!stop(this.pts[i])) atSea = true;
			else if (atSea && this.acc[i] >= from) return new Path(this.pts.slice(0, i + 1));
		}
		return this;
	}
	/** 第一次满足条件时走过的弧长。 */
	find(test: (p: V2) => boolean) {
		for (let i = 0; i < this.pts.length; i++) if (test(this.pts[i])) return this.acc[i];
		return this.length;
	}
}

// ---- 每帧写入的动态缓冲 ----

function upload(geometry: BufferGeometry, vertices: number, draw: number) {
	for (const attribute of Object.values(geometry.attributes) as BufferAttribute[]) {
		attribute.clearUpdateRanges();
		if (vertices > 0) attribute.addUpdateRange(0, vertices * attribute.itemSize);
		attribute.needsUpdate = true;
	}
	geometry.setDrawRange(0, draw);
}
function dynamic(geometry: BufferGeometry, name: string, size: number, count: number) {
	// position 为二维，three 按三维求包围球会读出 NaN；这些网格不做视锥剔除，给一个固定的包围球即可。
	if (name === 'position') geometry.boundingSphere = new Sphere(new Vector3(), Infinity);
	const array = new Float32Array(count * size);
	geometry.setAttribute(name, new BufferAttribute(array, size).setUsage(DynamicDrawUsage));
	return array;
}
function quadIndex(quads: number) {
	const index = new Uint16Array(quads * 6);
	for (let q = 0; q < quads; q++) index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
	return new BufferAttribute(index, 1);
}

class FillBuffer {
	readonly geometry = new BufferGeometry();
	private readonly pos; private readonly col; private readonly edge;
	count = 0;
	constructor(private readonly capacity: number) {
		this.pos = dynamic(this.geometry, 'position', 2, capacity);
		this.col = dynamic(this.geometry, 'aColor', 4, capacity);
		this.edge = dynamic(this.geometry, 'aEdge', 1, capacity);
	}
	vertex(x: number, y: number, e: number, c: RGB, a: number) {
		if (this.count >= this.capacity) return;
		const i = this.count++;
		this.pos[i * 2] = x; this.pos[i * 2 + 1] = y; this.edge[i] = e;
		this.col[i * 4] = c[0]; this.col[i * 4 + 1] = c[1]; this.col[i * 4 + 2] = c[2]; this.col[i * 4 + 3] = a;
	}
	flush() { upload(this.geometry, this.count, this.count); this.count = 0; }
}

class MarkBuffer {
	readonly geometry = new BufferGeometry();
	private readonly pos; private readonly local; private readonly shape; private readonly arc; private readonly col;
	count = 0;
	constructor(private readonly capacity: number) {
		this.pos = dynamic(this.geometry, 'position', 2, capacity * 4);
		this.local = dynamic(this.geometry, 'aLocal', 2, capacity * 4);
		this.shape = dynamic(this.geometry, 'aShape', 4, capacity * 4);
		this.arc = dynamic(this.geometry, 'aArc', 4, capacity * 4);
		this.col = dynamic(this.geometry, 'aColor', 4, capacity * 4);
		this.geometry.setIndex(quadIndex(capacity));
	}
	/** 中心 (cx, cy)，局部坐标轴 u / v，半宽 hu / hv。 */
	quad(cx: number, cy: number, ux: number, uy: number, hu: number, hv: number,
		shape: readonly [number, number, number, number], arc: readonly [number, number, number], c: RGB, a: number) {
		if (this.count >= this.capacity) return;
		const vx = -uy, vy = ux;
		for (let k = 0; k < 4; k++) {
			const su = k === 0 || k === 3 ? -hu : hu, sv = k < 2 ? -hv : hv;
			const i = this.count * 4 + k;
			this.pos[i * 2] = cx + ux * su + vx * sv; this.pos[i * 2 + 1] = cy + uy * su + vy * sv;
			this.local[i * 2] = su; this.local[i * 2 + 1] = sv;
			this.shape.set(shape, i * 4);
			this.arc[i * 4] = arc[0]; this.arc[i * 4 + 1] = arc[1]; this.arc[i * 4 + 2] = arc[2]; this.arc[i * 4 + 3] = 0;
			this.col[i * 4] = c[0]; this.col[i * 4 + 1] = c[1]; this.col[i * 4 + 2] = c[2]; this.col[i * 4 + 3] = a;
		}
		this.count++;
	}
	flush() { upload(this.geometry, this.count * 4, this.count * 6); this.count = 0; }
}

interface LabelEntry { u0: number; v0: number; u1: number; v1: number; w: number; h: number; anchor: number }
class LabelBuffer {
	readonly geometry = new BufferGeometry();
	private readonly pos; private readonly uv; private readonly alpha;
	count = 0;
	constructor(private readonly capacity: number) {
		this.pos = dynamic(this.geometry, 'position', 2, capacity * 4);
		this.uv = dynamic(this.geometry, 'aUv', 2, capacity * 4);
		this.alpha = dynamic(this.geometry, 'aAlpha', 1, capacity * 4);
		this.geometry.setIndex(quadIndex(capacity));
	}
	quad(e: LabelEntry, left: number, top: number, a: number) {
		if (this.count >= this.capacity) return;
		const i = this.count++ * 4;
		const x = [left, left + e.w, left + e.w, left], y = [top - e.h, top - e.h, top, top];
		const u = [e.u0, e.u1, e.u1, e.u0], v = [e.v1, e.v1, e.v0, e.v0];
		for (let k = 0; k < 4; k++) {
			this.pos[(i + k) * 2] = x[k]; this.pos[(i + k) * 2 + 1] = y[k];
			this.uv[(i + k) * 2] = u[k]; this.uv[(i + k) * 2 + 1] = v[k];
			this.alpha[i + k] = a;
		}
	}
	flush() { upload(this.geometry, this.count * 4, this.count * 6); this.count = 0; }
}

// ---- 标注图集 ----

type LabelStyle = 'arrow' | 'twin' | 'tag' | 'land';
/** 图集像素 / 格。20px 字高约 0.09 格，1080p 下约 9 个屏幕像素，与参考画面的细小标注一致。 */
const LABEL_PX = 215;
const LABEL_FONT = '"Bahnschrift SemiCondensed", "Bahnschrift", "DIN Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';

class LabelAtlas {
	readonly canvas = document.createElement('canvas');
	readonly texture: CanvasTexture;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly cache = new Map<string, LabelEntry>();
	private x = 4; private y = 4; private row = 0;
	constructor() {
		this.canvas.width = 2048; this.canvas.height = 1024;
		this.ctx = this.canvas.getContext('2d')!;
		this.texture = new CanvasTexture(this.canvas);
		this.texture.colorSpace = SRGBColorSpace;
	}
	get(style: LabelStyle, ink: string, text: string): LabelEntry {
		const key = `${style}|${ink}|${text}`;
		const hit = this.cache.get(key);
		if (hit) return hit;
		const ctx = this.ctx, size = style === 'arrow' || style === 'twin' ? 20 : 16;
		const font = `600 ${size}px ${LABEL_FONT}`;
		ctx.font = font;
		const tw = Math.ceil(ctx.measureText(text).width);
		const decorated = style === 'arrow' || style === 'twin';
		const left = decorated ? 26 : 2;
		const width = left + tw + (decorated ? 18 : 6), height = decorated ? 46 : 28, mid = decorated ? 17 : 12;
		if (this.x + width > this.canvas.width) { this.x = 4; this.y += this.row + 8; this.row = 0; }
		if (this.y + height > this.canvas.height) return this.cache.values().next().value!;
		const x0 = this.x, y0 = this.y;
		ctx.save();
		ctx.translate(x0, y0);
		ctx.font = font; ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.textBaseline = 'middle';
		if (style === 'arrow') {
			ctx.beginPath(); ctx.moveTo(4, mid); ctx.lineTo(16, mid - 7); ctx.lineTo(16, mid + 7); ctx.closePath(); ctx.fill();
		} else if (style === 'twin') {
			ctx.strokeRect(3, mid - 8, 7, 16); ctx.strokeRect(13, mid - 8, 7, 16);
		}
		ctx.fillText(text, left, mid + 1);
		if (decorated) {
			// 方括号竖条、下划线、斜纹条与三个小块：机载 HUD 标注的质感，排布为原创组合。
			const end = left + tw + 6;
			ctx.fillRect(end, mid - 11, 4, 22);
			ctx.fillRect(left - 2, mid + 14, end - left + 6, 2);
			ctx.save(); ctx.beginPath(); ctx.rect(left + 2, mid + 17, 36, 7); ctx.clip();
			for (let x = left - 6; x < left + 42; x += 5) { ctx.beginPath(); ctx.moveTo(x, mid + 25); ctx.lineTo(x + 7, mid + 16); ctx.stroke(); }
			ctx.restore();
			for (let k = 0; k < 3; k++) ctx.fillRect(end - 26 + k * 8, mid + 18, 5, 5);
		} else if (style === 'tag') {
			ctx.fillRect(2, mid + 10, Math.min(tw, 28), 2);
		}
		ctx.restore();
		const W = this.canvas.width, H = this.canvas.height;
		const entry = { u0: x0 / W, u1: (x0 + width) / W, v0: 1 - y0 / H, v1: 1 - (y0 + height) / H,
			w: width / LABEL_PX, h: height / LABEL_PX, anchor: mid / LABEL_PX };
		this.x += width + 8; this.row = Math.max(this.row, height);
		this.cache.set(key, entry);
		this.texture.needsUpdate = true;
		return entry;
	}
}

// ---- 立即模式绘制接口：事件在自己的局部坐标里描述当下的画面 ----

class Frame {
	ox = 0; oy = 0; px = .01; scale = 1; opacity = 1;
	constructor(readonly fills: FillBuffer, readonly marks: MarkBuffer, readonly labels: LabelBuffer) {}
	glyph(g: Glyph, x: number, y: number, angle: number, size: number, color: RGB, alpha = 1) {
		const a = alpha * this.opacity;
		if (a <= .004) return;
		const cos = Math.cos(angle) * size, sin = Math.sin(angle) * size, X = this.ox + x, Y = this.oy + y;
		const cx = X + g.center[0] * cos - g.center[1] * sin, cy = Y + g.center[0] * sin + g.center[1] * cos;
		for (let i = 0; i < g.rim.length; i++) {
			const p = g.rim[i], q = g.rim[(i + 1) % g.rim.length], c = tint(color, g.shade[i]);
			this.fills.vertex(cx, cy, 1, c, a);
			this.fills.vertex(X + p[0] * cos - p[1] * sin, Y + p[0] * sin + p[1] * cos, 0, c, a);
			this.fills.vertex(X + q[0] * cos - q[1] * sin, Y + q[0] * sin + q[1] * cos, 0, c, a);
		}
	}
	private radial(kind: number, x: number, y: number, r: number, width: number, color: RGB, alpha: number,
		sweep = 1, from = 0, dash = 0) {
		const a = alpha * this.opacity;
		if (a <= .004 || r <= 0) return;
		const e = r + (width * this.scale + 2) * this.px;
		this.marks.quad(this.ox + x, this.oy + y, 1, 0, e, e, [r, width, kind, dash], [from, sweep, 0], color, a);
	}
	ring(x: number, y: number, r: number, width: number, color: RGB, alpha = 1, sweep = 1, from = 0, dash = 0) {
		this.radial(0, x, y, r, width, color, alpha, sweep, from, dash);
	}
	disc(x: number, y: number, r: number, color: RGB, alpha = 1) { this.radial(1, x, y, r, 0, color, alpha); }
	box(x: number, y: number, half: number, width: number, color: RGB, alpha = 1, dash = 0) {
		this.radial(2, x, y, half, width, color, alpha, 1, 0, dash);
	}
	block(x: number, y: number, half: number, color: RGB, alpha = 1) { this.radial(3, x, y, half, 0, color, alpha); }
	corners(x: number, y: number, half: number, width: number, color: RGB, alpha = 1) { this.radial(4, x, y, half, width, color, alpha); }
	cross(x: number, y: number, r: number, width: number, color: RGB, alpha = 1) { this.radial(6, x, y, r, width, color, alpha); }
	segment(ax: number, ay: number, bx: number, by: number, width: number, color: RGB, alpha = 1, dash = 0) {
		const a = alpha * this.opacity, l = Math.hypot(bx - ax, by - ay);
		if (a <= .004 || l < 1e-4) return;
		const pad = (width * this.scale + 2) * this.px;
		this.marks.quad(this.ox + (ax + bx) / 2, this.oy + (ay + by) / 2, (bx - ax) / l, (by - ay) / l, l / 2 + pad, pad,
			[0, width, 5, dash], [0, 1, l / 2], color, a);
	}
	label(e: LabelEntry, x: number, y: number, alpha = 1) {
		const a = alpha * this.opacity;
		if (a > .004) this.labels.quad(e, this.ox + x, this.oy + y + e.anchor, a);
	}
	/** 单位标注：虚线引线从单位斜向右上，末端一个小折角，标注从折角处挂出。 */
	tag(e: LabelEntry, x: number, y: number, side: Side, alpha = 1, dx = .2, dy = .16, dash = .035) {
		const c = tint(side.main, .75);
		this.segment(x + dx * .3, y + dy * .3, x + dx - .02, y + dy, .8, c, alpha * .85, dash);
		this.segment(x + dx - .05, y + dy - .045, x + dx + .005, y + dy + .01, 1.1, c, alpha);
		this.label(e, x + dx, y + dy, alpha);
	}
	/** 局部坐标 (x, y) 在透视抬升 k 后的画面位置；画面中心为 (-ox, -oy)。静态线在顶点着色器里做同样的变换。 */
	lift(x: number, y: number, k: number): V2 { return [x + (this.ox + x) * k, y + (this.oy + y) * k]; }
	/** 离地飞机：机体画在抬升后的位置；地面投影点画准星（战斗机为圆环、大型机为方框，都带实心内核），
	 *  两者之间一段细虚线。偏移方向永远背离画面中心、越靠边越长，随镜头推进自然产生视差。返回机体的画面位置。 */
	aloft(g: Glyph, x: number, y: number, angle: number, size: number, side: Side, k: number, mark: 'ring' | 'box', alpha = 1, forward = 0): V2 {
		const [ax, ay] = this.lift(x, y, k), l = Math.hypot(ax - x, ay - y);
		if (mark === 'ring') { this.ring(x, y, .068, 1.2, side.main, .85 * alpha); this.disc(x, y, .026, side.main, .9 * alpha); }
		else { this.box(x, y, .064, 1.2, side.main, .85 * alpha); this.block(x, y, .028, side.main, .9 * alpha); }
		if (l > .2) {
			const ux = (ax - x) / l, uy = (ay - y) / l;
			this.segment(x + ux * .09, y + uy * .09, ax - ux * .07, ay - uy * .07, .8, side.main, .6 * alpha, .045);
		}
		const c = Math.cos(angle) * forward * size, s = Math.sin(angle) * forward * size;
		// 大型飞翼面积大，用略低的亮度，机身保持饱和的本色而不被泛光冲成白色。
		this.glyph(g, ax + c, ay + s, angle, size * (1 + k), g === WING ? tint(side.hot, .82) : side.hot, alpha);
		return [ax, ay];
	}
	/** 以质心为扇心填充凸多边形（局部坐标）。 */
	private fan(pts: readonly V2[], color: RGB, a: number) {
		const cx = pts.reduce((v, p) => v + p[0], 0) / pts.length, cy = pts.reduce((v, p) => v + p[1], 0) / pts.length;
		for (let i = 0; i < pts.length; i++) {
			const p = pts[i], q = pts[(i + 1) % pts.length];
			this.fills.vertex(this.ox + cx, this.oy + cy, 1, color, a);
			this.fills.vertex(this.ox + p[0], this.oy + p[1], 0, color, a);
			this.fills.vertex(this.ox + q[0], this.oy + q[1], 0, color, a);
		}
	}
	/** 地面立方体：透视下顶面略向外偏，露出朝画面中心一侧的侧面；画面中心附近几乎只看到顶面。
	 *  加法混合下顶面叠在侧面之上，所以顶面颜色取目标亮度减去侧面亮度。 */
	cube(x: number, y: number, angle: number, half: number, color: RGB, alpha = 1) {
		const a = alpha * this.opacity;
		if (a <= .004) return;
		const c = Math.cos(angle) * half, s = Math.sin(angle) * half;
		const base: V2[] = [[x + c, y + s], [x - s, y + c], [x - c, y - s], [x + s, y - c]];
		const top = base.map(([px, py]) => this.lift(px, py, K_CUBE));
		this.fan(hull([...base, ...top]), tint(color, .5), a);
		this.fan(top, tint(color, .72), a);
	}
	/** 锁定：目标四角的方括号，出现时从大收拢到位。 */
	lock(x: number, y: number, side: Side, k: number, alpha = 1, half = .15) {
		if (k <= 0) return;
		const e = 1 - (1 - Math.min(1, k)) ** 3;
		this.corners(x, y, half * (1.6 - .6 * e), 1.1, side.main, alpha * e);
	}
}

/** 凸包（单调链），逆时针。 */
function hull(points: V2[]): V2[] {
	const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const cross = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lower: V2[] = [], upper: V2[] = [];
	for (const q of p) { while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
	for (const q of p.reverse()) { while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
	return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** 爆点：两三个错位的细圆环迅速弹开并停留，最后淡出；起爆瞬间有一个亮核。 */
function burst(f: Frame, x: number, y: number, at: number, τ: number, side: Side, seed: number, size = 1) {
	const dt = τ - at;
	if (dt < 0 || dt > 4.4) return;
	const alpha = dt < 2.8 ? 1 : 1 - (dt - 2.8) / 1.6;
	for (let i = 0; i < 3; i++) {
		const k = clamp((dt - i * .08) / .3);
		if (k <= 0) continue;
		const s = .35 + .65 * (1 - (1 - k) ** 3);
		const r = [.07, .105, .05][i] * (.85 + .3 * noise1(seed + i)) * size;
		f.ring(x + (noise1(seed * 3 + i) - .5) * .1 * size, y + (noise1(seed * 7 + i) - .5) * .1 * size, r * s, 1.3, side.hot, alpha * .9);
	}
	if (dt < .22) f.disc(x, y, (.02 + .05 * (1 - dt / .22)) * size, side.hot);
}

// ---- 静态线（初始化时一次生成） ----

/** lift：透视抬升系数，数字为整条线相同，[起点, 终点] 沿线性插值（从飞机射向地面的弹道）。 */
interface LineOptions { width?: number; color?: RGB; start?: number; duration?: number; end?: number; fade?: number; tail?: number; dash?: number; trail?: number; lift?: number | readonly [number, number] }
class LineBuilder {
	private p: number[] = []; private n: number[] = []; private l: number[] = []; private t: number[] = [];
	private x: number[] = []; private c: number[] = []; private i: number[] = [];
	add(points: V2[], o: LineOptions = {}) {
		const { width = 1.2, color = CYAN.main, start = -1e3, duration = .001, end = 1e6, fade = 1.5, tail = 0, dash = 0, trail = -1, lift = 0 } = o;
		const [l0, l1] = typeof lift === 'number' ? [lift, lift] : lift;
		const n = points.length;
		if (n < 2) return;
		const lengths = [0];
		for (let k = 1; k < n; k++) lengths.push(lengths[k - 1] + dist(points[k], points[k - 1]));
		const total = lengths[n - 1] || 1, base = this.p.length / 3;
		const dir = (a: V2, b: V2): V2 => { const d = dist(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
		for (let k = 0; k < n; k++) {
			const a = k > 0 ? dir(points[k - 1], points[k]) : dir(points[k], points[k + 1]);
			const b = k < n - 1 ? dir(points[k], points[k + 1]) : a;
			let nx = -(a[1] + b[1]), ny = a[0] + b[0];
			const len = Math.hypot(nx, ny) || 1;
			nx /= len; ny /= len;
			// 斜接长度 = 1 / cos(半角)，限制在 2 以内，锐角处不至于刺出长尖。
			const miter = Math.min(2, 1 / Math.max(.5, nx * -a[1] + ny * a[0]));
			for (const side of [-1, 1]) {
				this.p.push(points[k][0], points[k][1], 0);
				this.n.push(nx * miter, ny * miter);
				this.l.push(side, lengths[k] / total, lengths[k], width);
				this.t.push(start, duration, end, fade);
				this.x.push(tail, dash, trail, l0 + (l1 - l0) * lengths[k] / total);
				this.c.push(...color);
			}
			if (k < n - 1) { const j = base + k * 2; this.i.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
		}
	}
	circle(c: V2, r: number, o: LineOptions = {}, from = 0) {
		const segments = Math.max(32, Math.round(r * 48));
		this.add(Array.from({ length: segments + 1 }, (_, k): V2 => {
			const a = from + k / segments * Math.PI * 2;
			return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
		}), o);
	}
	build() {
		if (!this.i.length) return undefined;
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(new Float32Array(this.p), 3));
		g.setAttribute('aNormal', new BufferAttribute(new Float32Array(this.n), 2));
		g.setAttribute('aLine', new BufferAttribute(new Float32Array(this.l), 4));
		g.setAttribute('aTime', new BufferAttribute(new Float32Array(this.t), 4));
		g.setAttribute('aExtra', new BufferAttribute(new Float32Array(this.x), 4));
		g.setAttribute('aColor', new BufferAttribute(new Float32Array(this.c), 3));
		g.setIndex(this.i);
		return g;
	}
}

// ---- 事件 ----

interface BattleEvent {
	/** 事件开始的循环时间与持续时长；残留的航迹、射程圈在结束前 3 秒淡出，通常早已随地图滚出画面。 */
	t0: number;
	duration: number;
	origin: Site;
	lines?: BufferGeometry;
	heads: Float32Array;
	draw(τ: number, f: Frame): void;
}

/** 循环时间 T 时镜头中心的世界 y。 */
const cam = (T: number) => DRIFT * T;
const toLocal = (origin: Site, p: Site): V2 => [nearest(p[0] - origin[0]), nearest(p[1] - origin[1])];
const heightLocal = (origin: Site) => (p: V2) => terrainHeight(p[0] + origin[0], p[1] + origin[1]);

/** 舰队：松散的两列队形，匀速航行；存活的舰船在遭袭后加速驶离画面。 */
class Fleet {
	readonly ships: { offset: V2; angle: number; death: number; label: LabelEntry }[];
	readonly dir: V2;
	escapeAt = Infinity;
	escape: V2;
	constructor(atlas: LabelAtlas, center: V2, readonly at: number, heading: number, readonly speed: number,
		count: number, spacing: number, seed: number, readonly side: Side, name: string, escape = heading) {
		const rnd = random(seed);
		this.dir = unit(heading); this.escape = unit(escape);
		const perp: V2 = [-this.dir[1], this.dir[0]];
		this.ships = Array.from({ length: count }, (_, i) => {
			const along = -i * spacing * .55 + (rnd() - .5) * .2, lateral = (i % 2 ? 1 : -1) * spacing * .5 + (rnd() - .5) * .2;
			return {
				offset: [center[0] + this.dir[0] * along + perp[0] * lateral, center[1] + this.dir[1] * along + perp[1] * lateral],
				angle: heading * Math.PI / 180 + (rnd() - .5) * .3, death: Infinity,
				label: atlas.get('twin', side.ink, `${code(seed, i)} ${name}`),
			};
		});
	}
	pos(i: number, τ: number): V2 {
		const s = this.ships[i], d = this.speed * (τ - this.at);
		const p: V2 = [s.offset[0] + this.dir[0] * d, s.offset[1] + this.dir[1] * d];
		const e = τ - this.escapeAt;
		if (e > 0) {
			// 0.14 格/秒² 加速 5 秒后保持 0.7 格/秒，足以在十几秒内驶出画面。
			const extra = e < 5 ? .07 * e * e : .7 * (e - 2.5);
			p[0] += this.escape[0] * extra; p[1] += this.escape[1] * extra;
		}
		return p;
	}
	angle(i: number, τ: number) {
		const s = this.ships[i];
		if (τ <= this.escapeAt) return s.angle;
		const target = Math.atan2(this.escape[1], this.escape[0]);
		let d = target - s.angle; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
		return s.angle + d * clamp((τ - this.escapeAt) / 3);
	}
	draw(f: Frame, τ: number, size = 1, labels = true) {
		this.ships.forEach((s, i) => {
			// 被击中的舰船在爆点下 0.8 秒内沉没。
			const alpha = τ < s.death ? 1 : 1 - (τ - s.death) / .8;
			if (alpha <= 0) return;
			const p = this.pos(i, τ);
			f.glyph(HULL, p[0], p[1], this.angle(i, τ), size, this.side.hull, alpha);
			if (labels) f.tag(s.label, p[0], p[1], this.side, alpha * .95, .24, .12, .045);
		});
	}
}

interface StrikeOptions {
	t0: number; site: Site; attacker: Side; defender: Side; seed: number;
	targets: number; spread: number; rings: 4 | 7; ringRadius: number; ringAt: number;
	/** 领队到达目标上空的时刻；进场时间按速度倒推，放慢速度不改变开火时机。 */
	heading: number; jets: number; spacing: number; arriveAt: number; speed: number; approach?: number;
	jetName: string; targetName: string;
}
/** 空袭：地面目标 → 攻击方射程圈 → 飞翼沿直线进入并发射扇形导弹 → 目标逐个消失 → 飞翼飞出画面。 */
function strike(atlas: LabelAtlas, o: StrikeOptions): BattleEvent {
	const rnd = random(o.seed), at = (T: number) => T - o.t0, origin = o.site;
	const speed = o.speed, approach = o.approach ?? 13.5;
	const units = scatter(origin, o.spread, o.targets, .42, o.seed, (h) => h > .05).map((p) => toLocal(origin, p));
	const appear = units.map((_, i) => .3 + i * .1 + rnd() * .3), angles = units.map(() => .3 + rnd() * .6);
	const labels = units.map((_, i) => i % 3 === 2 ? undefined : atlas.get('arrow', o.defender.ink, `${code(o.seed, i)} ${o.targetName}`));
	const R = o.ringRadius, base = rnd() * Math.PI;
	const rings = (o.rings === 7
		? [[0, 0] as V2, ...Array.from({ length: 6 }, (_, i): V2 => [Math.cos(base + i * Math.PI / 3) * R * .95, Math.sin(base + i * Math.PI / 3) * R * .95])]
		: Array.from({ length: 4 }, (_, i): V2 => [Math.cos(base + i * Math.PI / 2) * R * .9, Math.sin(base + i * Math.PI / 2) * R * .9]))
		.map((c, i) => ({ c, r: R * (.88 + rnd() * .24), at: at(o.ringAt) + i * .16, from: rnd() * 6.28 }));
	const dir = unit(o.heading), perp: V2 = [-dir[1], dir[0]];
	const jets = Array.from({ length: o.jets }, (_, i) => {
		const off = (i - (o.jets - 1) / 2) * o.spacing + (rnd() - .5) * .3;
		const path = new Path([[perp[0] * off - dir[0] * approach, perp[1] * off - dir[1] * approach], [perp[0] * off + dir[0] * 16, perp[1] * off + dir[1] * 16]]);
		return { path, off, start: at(o.arriveAt) - approach / speed + i * .4 + rnd() * .25, label: atlas.get('twin', o.attacker.ink, `${code(o.seed + 3, i, 4)} ${o.jetName}`) };
	});
	// 每个目标交给侧向距离最近的一架，按沿航线的先后分成两轮齐射；同一轮从同一点发射，形成扇形弹道。
	const missiles: { from: V2; to: V2; launch: number; flight: number; lock: number }[] = [];
	const fans: { from: V2; launch: number; flight: number }[] = [];
	const death = units.map(() => Infinity);
	jets.forEach((jet, j) => {
		const mine = units.map((p, i) => ({ i, along: p[0] * dir[0] + p[1] * dir[1] + approach, lateral: p[0] * perp[0] + p[1] * perp[1] }))
			.filter((m) => jets.reduce((best, other, k) => Math.abs(m.lateral - other.off) < Math.abs(m.lateral - jets[best].off) ? k : best, 0) === j)
			.sort((a, b) => a.along - b.along);
		const volleys = mine.length > 3 ? 2 : 1;
		mine.forEach(({ i }, k) => {
			const v = Math.floor(k * volleys / mine.length), first = mine[Math.floor(v * mine.length / volleys)];
			const d = first.along - 2.7 - rnd() * .2, from = jet.path.at(d).p, to = units[i];
			const launch = jet.start + d / speed, flight = .45 + dist(from, to) * .09;
			missiles.push({ from, to, launch, flight, lock: .075 + .07 * noise1(o.seed * 13 + i) });
			if (first.i === i) fans.push({ from, launch, flight });
			death[i] = Math.min(death[i], launch + flight);
		});
	});
	const lines = new LineBuilder();
	jets.forEach((jet, j) => {
		for (const s of [-.028, .028]) lines.add(jet.path.offset(s).pts, { width: 1.1, color: tint(o.attacker.main, .85), trail: j, tail: .04, lift: K_WING });
	});
	for (const m of missiles) lines.add([m.from, m.to], { width: .75, color: tint(o.attacker.main, .6), start: m.launch, duration: m.flight, tail: .3, lift: [K_WING, 0] });
	// 每轮齐射除了打向目标的弹道，还有几条扫向射程圈内其它位置的锁定线，一起组成停留在地图上的扇形网。
	for (const fan of fans) for (let n = 0; n < 5; n++) {
		const ring = rings[Math.floor(rnd() * rings.length)], a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * ring.r;
		lines.add([fan.from, [ring.c[0] + Math.cos(a) * r, ring.c[1] + Math.sin(a) * r]],
			{ width: .6, color: tint(o.attacker.main, .42), start: fan.launch + rnd() * .15, duration: fan.flight * 1.1, tail: .15, lift: [K_WING, 0] });
	}
	const heads = new Float32Array(Math.max(1, jets.length));
	return {
		t0: o.t0, duration: 44, origin, lines: lines.build(), heads,
		draw(τ, f) {
			units.forEach((p, i) => {
				const pop = clamp((τ - appear[i]) / .35);
				if (pop <= 0 || τ > death[i] + .06) return;
				f.cube(p[0], p[1], angles[i], .09 * (.7 + .3 * pop), o.defender.hot, pop);
				if (labels[i]) f.tag(labels[i]!, p[0], p[1], o.defender, pop);
			});
			for (const r of rings) {
				const s = clamp((τ - r.at) / .9);
				if (s > 0) f.ring(r.c[0], r.c[1], r.r, 1.5, o.attacker.main, .8, s, r.from);
			}
			jets.forEach((jet, j) => {
				const d = (τ - jet.start) * speed;
				heads[j] = clamp(d / jet.path.length);
				if (d <= 0 || d >= jet.path.length) return;
				const { p, angle } = jet.path.at(d);
				const q = f.aloft(WING, p[0], p[1], angle, 1, o.attacker, K_WING, 'box');
				f.label(jet.label, q[0] + .36, q[1] + .14);
			});
			for (const m of missiles) {
				const k = (τ - m.launch) / m.flight;
				if (k > 0 && k < 1) { const p = lerp(f.lift(m.from[0], m.from[1], K_WING), m.to, k); f.disc(p[0], p[1], .018, o.attacker.hot); }
				// 发射前 0.7 秒目标上出现锁定环，由大收小；命中后停留片刻。
				const lk = (τ - m.launch + .7) / .3;
				if (lk > 0 && τ < m.launch + m.flight + .9) f.ring(m.to[0], m.to[1], m.lock * (1.6 - .6 * Math.min(1, lk)), 1, o.attacker.main, .85 * Math.min(1, lk));
			}
			units.forEach((p, i) => { if (death[i] < Infinity) burst(f, p[0], p[1], death[i], τ, o.attacker, o.seed * 31 + i); });
		},
	};
}
interface LandingOptions {
	t0: number; side: Side; enemy: Side; seed: number; duration: number;
	/** 领头艇靠岸的时刻；出发时间按航程与速度倒推。 */
	route: Site[]; boats: number; spacing: number; landAt: number; speed: number;
	objective: Site; defenders: number; spread: number; perBoat: number; walk: number;
	infantry: 'dot' | 'capsule'; posts: 'post' | 'cube'; boatName: string; defenderName: string;
	/** 敌方拦截机横穿画面，击沉一艘尚未登陆的艇。 */
	intercept?: { heading: number; lane: Site; enterAt: number; jets: number; speed: number; victim: number; fireAt: number; name: string };
	/** 登陆方对目标的炮火：射程圈，随后逐个命中。 */
	barrage?: { at: number; radius: number; hits: number };
}
/** 登陆：艇队渡海、在海岸线停下 → 步兵上岸向目标推进并与守军交火 → 守军与步兵都有伤亡。 */
function landing(atlas: LabelAtlas, o: LandingOptions): BattleEvent {
	const rnd = random(o.seed), at = (T: number) => T - o.t0, origin = o.objective, land = heightLocal(origin);
	const base = Path.smooth(o.route.map((p) => toLocal(origin, p)));
	const paths = Array.from({ length: o.boats }, (_, i) => {
		const lane = base.offset((i - (o.boats - 1) / 2) * o.spacing);
		return lane.until((p) => land(p) > .02, lane.length * .65);
	});
	const lead = at(o.landAt) - paths[0].length / o.speed;
	const boats = paths.map((path, i) => {
		const start = lead + i * .45 + rnd() * .2;
		return { path, start, landed: start + path.length / o.speed, death: Infinity,
			label: i % 2 === 0 ? atlas.get('twin', o.side.ink, `${code(o.seed, i)} ${o.boatName}`) : undefined };
	});
	const posts = scatter(origin, o.spread, o.defenders, .55, o.seed + 1, (h) => h > .06).map((p, i) => ({
		p: toLocal(origin, p), angle: .3 + rnd() * .6, death: Infinity,
		label: i % 2 === 0 ? atlas.get('arrow', o.enemy.ink, `${code(o.seed + 1, i)} ${o.defenderName}`) : undefined,
	}));
	const lines = new LineBuilder();
	boats.forEach((b, i) => lines.add(b.path.pts, { width: 1.5, color: tint(o.side.main, .75), trail: i, tail: .05 }));

	const jets: { path: Path; start: number; label?: LabelEntry }[] = [];
	const shot = { from: [0, 0] as V2, to: [0, 0] as V2, launch: Infinity, flight: 1 };
	if (o.intercept) {
		const c = o.intercept, dir = unit(c.heading), perp: V2 = [-dir[1], dir[0]], lane = toLocal(origin, c.lane);
		for (let i = 0; i < c.jets; i++) {
			const off = (i - (c.jets - 1) / 2) * .42;
			// 拦截机从侧面绕一道弧线切入航道，再沿直线穿过。
			const onLane = (along: number, side: number): V2 => [lane[0] + dir[0] * along + perp[0] * (off + side), lane[1] + dir[1] * along + perp[1] * (off + side)];
			jets.push({
				path: Path.smooth([onLane(-14, 3.2), onLane(-8, 1.1), onLane(-3, 0), onLane(20, 0)]),
				start: at(c.enterAt) + i * .3, label: i === 1 ? undefined : atlas.get('twin', o.enemy.ink, `${code(o.seed + 9, i, 4)} ${c.name}`),
			});
		}
		// 预判弹着：导弹飞行期间目标艇仍在前进。
		const victim = boats[c.victim], jet = jets[0], launch = at(c.fireAt);
		const from = jet.path.at((launch - jet.start) * c.speed).p;
		let flight = .8;
		for (let k = 0; k < 4; k++) flight = .45 + dist(from, victim.path.at((launch + flight - victim.start) * o.speed).p) * .12;
		Object.assign(shot, { from, to: victim.path.at((launch + flight - victim.start) * o.speed).p, launch, flight });
		victim.death = launch + flight;
		jets.forEach((j, k) => lines.add(j.path.pts, { width: 2.4, color: tint(o.enemy.main, .8), trail: boats.length + k, tail: .04, lift: K_FIGHTER }));
		lines.add([shot.from, shot.to], { width: .8, color: tint(o.enemy.main, .6), start: launch, duration: flight, tail: .3, lift: [K_FIGHTER, 0] });
	}

	const soldiers: { start: V2; dir: V2; stop: number; speed: number; spawn: number; phase: number; death: number;
		period: number; offset: number; label?: LabelEntry }[] = [];
	boats.forEach((b, i) => {
		if (b.death < b.landed) return;
		const end = b.path.pts[b.path.pts.length - 1];
		for (let k = 0; k < o.perBoat; k++) {
			const start: V2 = [end[0] + (rnd() - .5) * .14, end[1] + (rnd() - .5) * .14];
			const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * o.spread;
			const goal: V2 = [Math.cos(a) * r, Math.sin(a) * r], l = dist(goal, start) || 1;
			soldiers.push({
				start, dir: [(goal[0] - start[0]) / l, (goal[1] - start[1]) / l], stop: Math.max(0, l - 1 - rnd() * .7),
				speed: o.walk * (.75 + rnd() * .5), spawn: b.landed + .4 + k * .32, phase: rnd() * 6.28, death: Infinity,
				period: 1.7 + rnd() * 1.2, offset: rnd(),
				label: soldiers.length % 4 === 0 ? atlas.get('tag', o.side.ink, `INF ${i + 1}-${k + 1}`) : undefined,
			});
		}
	});
	const soldierAt = (s: typeof soldiers[number], τ: number): V2 => {
		const d = clamp((τ - s.spawn) * s.speed, 0, s.stop), w = Math.sin(d * 3.1 + s.phase) * .035;
		return [s.start[0] + s.dir[0] * d - s.dir[1] * w, s.start[1] + s.dir[1] * d + s.dir[0] * w];
	};
	const lastLanding = Math.max(...boats.filter((b) => b.death > b.landed).map((b) => b.landed));
	const ringAt = o.barrage ? at(o.barrage.at) : Infinity;
	if (o.barrage) posts.slice(0, o.barrage.hits).forEach((p, i) => { p.death = ringAt + 2.4 + i * 1.5 + rnd() * .4; });
	else posts.forEach((p, i) => { if (i % 5 < 2) p.death = lastLanding + 13 + i * 3.2; });
	soldiers.forEach((s, i) => { if (i % 6 === 3) s.death = s.spawn + 7 + rnd() * 9; });
	const heads = new Float32Array(Math.max(1, boats.length + jets.length));
	const petals = o.barrage ? Array.from({ length: 3 }, (_, i): V2 => [Math.cos(i * 2.1 + .4) * o.barrage!.radius * .75, Math.sin(i * 2.1 + .4) * o.barrage!.radius * .75]) : [];

	return {
		t0: o.t0, duration: o.duration, origin, lines: lines.build(), heads,
		draw(τ, f) {
			boats.forEach((b, i) => {
				const d = (τ - b.start) * o.speed;
				heads[i] = clamp(d / b.path.length);
				if (d <= 0 || τ > b.death + .06) return;
				const { p, angle } = b.path.at(d);
				f.glyph(HULL, p[0], p[1], angle, .8, o.side.hull);
				if (b.label) f.tag(b.label, p[0], p[1], o.side, 1, .22, .12);
			});
			const alive = posts.filter((p) => τ < p.death);
			posts.forEach((p) => {
				if (τ > p.death + .06) return;
				if (o.posts === 'cube') f.cube(p.p[0], p.p[1], p.angle, .09, o.enemy.hot);
				else { f.block(p.p[0], p.p[1], .04, o.enemy.hot); f.box(p.p[0], p.p[1], .075, 1.1, o.enemy.main, .9); }
				if (p.label) f.tag(p.label, p.p[0], p.p[1], o.enemy);
			});
			const standing = soldiers.filter((s) => τ >= s.spawn && τ < s.death);
			soldiers.forEach((s) => {
				if (τ < s.spawn || τ > s.death + .05) return;
				const p = soldierAt(s, τ), pop = clamp((τ - s.spawn) / .3);
				if (o.infantry === 'capsule') f.glyph(CAPSULE, p[0], p[1], Math.atan2(s.dir[1], s.dir[0]), 1, o.side.hot, pop);
				else f.disc(p[0], p[1], .022, o.side.hot, pop);
				if (s.label) f.tag(s.label, p[0], p[1], o.side, pop * .85, .12, .1);
				// 推进过半后按各自节奏开火：一段短曳光指向最近的守军。
				const cycle = (τ - s.spawn) / s.period + s.offset;
				if (alive.length && (τ - s.spawn) * s.speed > s.stop * .5 && cycle % 1 < .12) {
					const t = alive.reduce((a, b) => dist(a.p, p) < dist(b.p, p) ? a : b).p, l = dist(t, p) || 1;
					f.segment(p[0], p[1], p[0] + (t[0] - p[0]) / l * .5, p[1] + (t[1] - p[1]) / l * .5, 1, o.side.hot, .9);
				}
			});
			// 守军还击：随机指向已上岸的步兵。
			if (standing.length) posts.forEach((p, j) => {
				if (τ >= p.death) return;
				const cycle = τ / (2.3 + j * .3) + j * .37;
				if (cycle % 1 > .1) return;
				const s = standing[(Math.floor(cycle) + j) % standing.length], q = soldierAt(s, τ), l = dist(q, p.p) || 1;
				f.segment(p.p[0], p.p[1], p.p[0] + (q[0] - p.p[0]) / l * .5, p.p[1] + (q[1] - p.p[1]) / l * .5, 1, o.enemy.hot, .85);
			});
			petals.forEach((c, i) => {
				const s = clamp((τ - ringAt - i * .2) / .9);
				if (s > 0) f.ring(c[0], c[1], o.barrage!.radius, 1.4, o.side.main, .8, s, i * 2);
			});
			jets.forEach((j, k) => {
				const d = (τ - j.start) * o.intercept!.speed;
				heads[boats.length + k] = clamp(d / j.path.length);
				if (d <= 0 || d >= j.path.length) return;
				const { p, angle } = j.path.at(d);
				const q = f.aloft(ARROW, p[0], p[1], angle, 1.15, o.enemy, K_FIGHTER, 'ring', 1, ARROW_NOTCH);
				if (j.label) f.label(j.label, q[0] + .2, q[1] + .08);
			});
			const k = (τ - shot.launch) / shot.flight;
			if (k > 0 && k < 1) { const p = lerp(f.lift(shot.from[0], shot.from[1], K_FIGHTER), shot.to, k); f.disc(p[0], p[1], .018, o.enemy.hot); }
			if (shot.launch < Infinity) burst(f, shot.to[0], shot.to[1], shot.launch + shot.flight, τ, o.enemy, o.seed + 77);
			posts.forEach((p, i) => { if (p.death < Infinity) burst(f, p.p[0], p.p[1], p.death, τ, o.side, o.seed * 13 + i); });
			soldiers.forEach((s, i) => {
				if (s.death < Infinity) { const p = soldierAt(s, s.death); burst(f, p[0], p[1], s.death, τ, o.enemy, o.seed * 17 + i, .7); }
			});
		},
	};
}

interface BombingOptions {
	t0: number; attacker: Side; defender: Side; seed: number; site: Site; targets: number; spread: number;
	markAt: number; route: Site[]; jets: number; spacing: number; enterAt: number; speed: number;
	release: [number, number]; bombs: number; jetName: string; targetName: string;
}
/** 轰炸：指定位置出现标定框 → 编队沿弧线进入 → 在目标前方投弹，炸弹斜向落到标定区 → 编队飞出画面。 */
function bombing(atlas: LabelAtlas, o: BombingOptions): BattleEvent {
	const rnd = random(o.seed), at = (T: number) => T - o.t0, origin = o.site;
	const units = scatter(origin, o.spread, o.targets, .38, o.seed, (h) => h > .04).map((p, i) => ({
		p: toLocal(origin, p), angle: rnd() * Math.PI * 2, death: Infinity,
		label: i % 2 === 0 ? atlas.get('arrow', o.defender.ink, `${code(o.seed, i)} ${o.targetName}`) : undefined,
	}));
	const base = Path.smooth(o.route.map((p) => toLocal(origin, p)));
	const jets = Array.from({ length: o.jets }, (_, i) => ({
		path: base.offset((i - (o.jets - 1) / 2) * o.spacing), start: at(o.enterAt) + i * .28,
		label: i % 2 === 0 ? atlas.get('twin', o.attacker.ink, `${code(o.seed + 7, i, 4)} ${o.jetName}`) : undefined,
	}));
	const order = units.map((_, i) => i).sort((a, b) => units[a].p[0] - units[b].p[0]);
	const x0 = o.release[0] - origin[0], x1 = o.release[1] - origin[0];
	const bombs: { from: V2; to: V2; launch: number; fall: number }[] = [];
	jets.forEach((jet, j) => {
		for (let b = 0; b < o.bombs; b++) {
			const x = x0 + (x1 - x0) * (b + (j % 2) * .5) / o.bombs;
			const d = jet.path.find((p) => p[0] >= x), from = jet.path.at(d).p;
			const u = units[order[bombs.length % order.length]];
			const to: V2 = [u.p[0] + (rnd() - .5) * .16, u.p[1] + (rnd() - .5) * .16];
			const launch = jet.start + d / o.speed, fall = 1.1 + rnd() * .3;
			bombs.push({ from, to, launch, fall });
			u.death = Math.min(u.death, launch + fall);
		}
	});
	const lastImpact = Math.max(...bombs.map((b) => b.launch + b.fall));
	const lines = new LineBuilder();
	jets.forEach((jet, j) => lines.add(jet.path.pts, { width: 2.4, color: tint(o.attacker.main, .8), trail: j, tail: .04, lift: K_FIGHTER }));
	for (const b of bombs) lines.add([b.from, b.to], { width: .7, color: tint(o.attacker.main, .5), start: b.launch, duration: b.fall, tail: .35, lift: [K_FIGHTER, 0] });
	const heads = new Float32Array(jets.length);
	return {
		t0: o.t0, duration: 46, origin, lines: lines.build(), heads,
		draw(τ, f) {
			units.forEach((u) => {
				if (τ > u.death + .06) return;
				f.glyph(HULL, u.p[0], u.p[1], u.angle, .5, o.defender.hull);
				if (u.label) f.tag(u.label, u.p[0], u.p[1], o.defender);
			});
			if (τ >= at(o.markAt) && τ < lastImpact + 1.8) {
				const a = clamp((τ - at(o.markAt)) / .6) * (.8 + .2 * Math.sin(τ * 3.5));
				f.corners(0, 0, .95, 1.4, o.attacker.main, a * .8);
				f.cross(0, 0, .06, 1, o.attacker.main, a);
				// 标定区里的每个目标依次被方括号锁住，直到被炸毁。
				units.forEach((u, i) => { if (τ < u.death + .3) f.lock(u.p[0], u.p[1], o.attacker, (τ - at(o.markAt) - .3 - i * .14) / .35, .9, .12); });
			}
			jets.forEach((jet, j) => {
				const d = (τ - jet.start) * o.speed;
				heads[j] = clamp(d / jet.path.length);
				if (d <= 0 || d >= jet.path.length) return;
				const { p, angle } = jet.path.at(d);
				const q = f.aloft(ARROW, p[0], p[1], angle, 1.15, o.attacker, K_FIGHTER, 'ring', 1, ARROW_NOTCH);
				if (jet.label) f.label(jet.label, q[0] + .2, q[1] + .08);
			});
			for (const b of bombs) {
				const k = (τ - b.launch) / b.fall;
				if (k > 0 && k < 1) { const p = lerp(f.lift(b.from[0], b.from[1], K_FIGHTER), b.to, k); f.disc(p[0], p[1], .016, o.attacker.hot); }
			}
			bombs.forEach((b, i) => burst(f, b.to[0], b.to[1], b.launch + b.fall, τ, o.attacker, o.seed * 7 + i, .85));
		},
	};
}

interface OrbitOptions {
	t0: number; attacker: Side; defender: Side; seed: number; site: Site; targets: number; spread: number;
	radius: number; ringAt: number; enter: number; sweep: number; speed: number; shotEvery: number; name: string; targetName: string;
}
/** 盘旋火力：大射程圈罩住敌方阵地 → 单机沿圆周逆时针盘旋，逐个锁定并击毁目标 → 沿切线离开。 */
function orbit(atlas: LabelAtlas, o: OrbitOptions): BattleEvent {
	const rnd = random(o.seed), at = (T: number) => T - o.t0, origin = o.site, R = o.radius;
	const units = scatter(origin, o.spread, o.targets, .45, o.seed, (h) => h > .06).map((p, i) => ({
		p: toLocal(origin, p), angle: .3 + rnd() * .6, death: Infinity,
		label: i % 3 === 2 ? undefined : atlas.get('arrow', o.defender.ink, `${code(o.seed, i)} ${o.targetName}`),
	}));
	const a0 = o.enter * Math.PI / 180, a1 = a0 + o.sweep * Math.PI / 180;
	const E: V2 = [Math.cos(a0) * R, Math.sin(a0) * R], T0: V2 = [-Math.sin(a0), Math.cos(a0)];
	const X: V2 = [Math.cos(a1) * R, Math.sin(a1) * R], T1: V2 = [-Math.sin(a1), Math.cos(a1)];
	const pts: V2[] = [];
	for (let k = 0; k <= 20; k++) pts.push([E[0] - T0[0] * 10 * (1 - k / 20), E[1] - T0[1] * 10 * (1 - k / 20)]);
	const steps = Math.ceil(o.sweep / 2);
	for (let k = 1; k <= steps; k++) { const a = a0 + (a1 - a0) * k / steps; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
	for (let k = 1; k <= 20; k++) pts.push([X[0] + T1[0] * 14 * k / 20, X[1] + T1[1] * 14 * k / 20]);
	const path = new Path(pts);
	const arrive = at(o.ringAt) + 1.4, start = arrive - 10 / o.speed, arcEnd = arrive + R * (a1 - a0) / o.speed;
	const gunship = (τ: number) => path.at((τ - start) * o.speed);
	const shots: { lock: number; fire: number; impact: number; target: number }[] = [];
	for (let ts = arrive + .8; ts < arcEnd - .4; ts += o.shotEvery) {
		const g = gunship(ts).p, alive = units.map((u, i) => ({ u, i })).filter(({ u }) => u.death === Infinity);
		if (!alive.length) break;
		const { i } = alive.reduce((a, b) => dist(a.u.p, g) < dist(b.u.p, g) ? a : b);
		shots.push({ lock: ts, fire: ts + .5, impact: ts + .72, target: i });
		units[i].death = ts + .72;
	}
	const lines = new LineBuilder();
	// 炮艇飞得比攻击机低；盘旋圈就是它的航线，和航迹一起抬升，机体始终压在圈上。
	const K = K_WING * .5;
	lines.add(path.pts, { width: 1.4, color: tint(o.attacker.main, .8), trail: 0, tail: .03, lift: K });
	const heads = new Float32Array(1), label = atlas.get('twin', o.attacker.ink, `${code(o.seed, 1, 4)} ${o.name}`);
	return {
		t0: o.t0, duration: 48, origin, lines: lines.build(), heads,
		draw(τ, f) {
			units.forEach((u) => {
				if (τ > u.death + .06) return;
				f.cube(u.p[0], u.p[1], u.angle, .09, o.defender.hot);
				if (u.label) f.tag(u.label, u.p[0], u.p[1], o.defender);
			});
			const s = clamp((τ - at(o.ringAt)) / 1.8), c = f.lift(0, 0, K);
			if (s > 0) f.ring(c[0], c[1], R * (1 + K), 1.6, o.attacker.main, .75, s, a0 - .6);
			const d = (τ - start) * o.speed;
			heads[0] = clamp(d / path.length);
			const g = gunship(τ);
			const gq = f.lift(g.p[0], g.p[1], K);
			if (d > 0 && d < path.length) {
				f.aloft(WING, g.p[0], g.p[1], g.angle, .8, o.attacker, K, 'box');
				f.label(label, gq[0] + .32, gq[1] + .12);
			}
			for (const shot of shots) {
				const u = units[shot.target].p;
				if (τ >= shot.lock && τ < shot.impact) {
					// 锁定环由大收小套住目标。
					const e = 1 - (1 - clamp((τ - shot.lock) / .3)) ** 3;
					f.ring(u[0], u[1], .13 * (1.6 - .6 * e), 1.1, o.attacker.main, .9 * e); f.disc(u[0], u[1], .02, o.attacker.hot);
				}
				if (τ >= shot.fire && τ < shot.impact + .08) f.segment(gq[0], gq[1], u[0], u[1], 1.1, o.attacker.hot, .9);
				burst(f, u[0], u[1], shot.impact, τ, o.attacker, o.seed * 11 + shot.target);
			}
		},
	};
}

interface FleetOptions { site: Site; at: number; heading: number; speed: number; count: number; spacing: number; name: string; escape?: number }
const fleet = (atlas: LabelAtlas, origin: Site, t0: number, side: Side, seed: number, o: FleetOptions) =>
	new Fleet(atlas, toLocal(origin, o.site), o.at - t0, o.heading, o.speed, o.count, o.spacing, seed, side, o.name, o.escape);
/** 迭代预判：弹体飞行期间目标仍在移动。 */
function intercept(from: V2, launch: number, speed: number, target: (τ: number) => V2) {
	let hit = launch + dist(from, target(launch)) / speed;
	for (let k = 0; k < 4; k++) hit = launch + dist(from, target(hit)) / speed;
	return { to: target(hit), hit };
}

interface NavalOptions {
	t0: number; attacker: Side; defender: Side; seed: number; fleet: FleetOptions; boats: FleetOptions;
	fireAt: number; salvo: number; torpedoSpeed: number; hits: number[];
}
/** 鱼雷战：攻击方舰艇齐射，细长航迹缓慢伸向敌方舰队 → 命中的舰船沉没 → 幸存者加速驶离画面。 */
function naval(atlas: LabelAtlas, o: NavalOptions): BattleEvent {
	const rnd = random(o.seed), at = (T: number) => T - o.t0, origin = o.fleet.site;
	const targets = fleet(atlas, origin, o.t0, o.defender, o.seed, o.fleet);
	const boats = fleet(atlas, origin, o.t0, o.attacker, o.seed + 1, o.boats);
	const torpedoes: { from: V2; to: V2; launch: number; flight: number; hit: boolean }[] = [];
	for (let k = 0; k < boats.ships.length; k++) for (let j = 0; j < o.salvo; j++) {
		const n = torpedoes.length, launch = at(o.fireAt) + k * .6 + j * .32 + rnd() * .2, from = boats.pos(k, launch);
		const hit = n % 3 !== 2, target = hit ? o.hits[n % o.hits.length] : Math.floor(rnd() * targets.ships.length);
		// 未命中的鱼雷瞄向舰船侧前方，航迹从旁边穿过。
		const miss: V2 = hit ? [0, 0] : [(rnd() - .5) * 1.4, .7];
		const r = intercept(from, launch, o.torpedoSpeed, (τ) => { const p = targets.pos(target, τ); return [p[0] + miss[0], p[1] + miss[1]]; });
		torpedoes.push({ from, to: r.to, launch, flight: r.hit - launch, hit });
		if (hit) targets.ships[target].death = Math.min(targets.ships[target].death, r.hit);
	}
	targets.escapeAt = Math.max(...targets.ships.map((s) => s.death).filter(Number.isFinite)) + 1.2;
	const lines = new LineBuilder();
	for (const t of torpedoes) lines.add([t.from, t.to], { width: .9, color: tint(o.attacker.main, .6), start: t.launch, duration: t.flight, tail: .12 });
	return {
		t0: o.t0, duration: 52, origin, lines: lines.build(), heads: new Float32Array(1),
		draw(τ, f) {
			targets.draw(f, τ);
			boats.draw(f, τ, .92);
			for (const i of new Set(o.hits)) {
				if (τ >= targets.ships[i].death) continue;
				const p = targets.pos(i, τ);
				f.lock(p[0], p[1], o.attacker, (τ - at(o.fireAt) + 1.4 - i * .12) / .4, .9);
			}
			for (const t of torpedoes) {
				const k = (τ - t.launch) / t.flight;
				if (k > 0 && k < 1) { const p = lerp(t.from, t.to, k); f.disc(p[0], p[1], .016, o.attacker.hot); }
				if (t.hit) burst(f, t.to[0], t.to[1], t.launch + t.flight, τ, o.attacker, Math.round(t.launch * 100), 1.1);
			}
		},
	};
}

interface TorpedoRunOptions {
	t0: number; attacker: Side; defender: Side; seed: number; fleet: FleetOptions;
	/** 编队横穿舰队中心的时刻；进场时间按速度倒推。 */
	heading: number; bombers: number; meetAt: number; speed: number; lane: number; release: number; torpedoSpeed: number;
	targets: number[]; name: string;
}
/** 鱼雷机：攻击机横穿海面，锁定线连到各自的目标舰 → 在近距离投下鱼雷 → 继续飞出画面，被命中的舰船沉没。 */
function torpedoRun(atlas: LabelAtlas, o: TorpedoRunOptions): BattleEvent {
	const rnd = random(o.seed), at = (T: number) => T - o.t0, origin = o.fleet.site;
	const ships = fleet(atlas, origin, o.t0, o.defender, o.seed, o.fleet);
	const dir = unit(o.heading), perp: V2 = [-dir[1], dir[0]];
	const meet = at(o.meetAt);
	const center = ships.ships.reduce<V2>((c, _, i) => { const p = ships.pos(i, meet); return [c[0] + p[0] / ships.ships.length, c[1] + p[1] / ships.ships.length]; }, [0, 0]);
	const bombers = Array.from({ length: o.bombers }, (_, i) => {
		const off = (i - (o.bombers - 1) / 2) * o.lane + .5 + (rnd() - .5) * .15;
		const a: V2 = [center[0] - dir[0] * 14 + perp[0] * off, center[1] - dir[1] * 14 + perp[1] * off];
		// 编队沿一道缓弧进场，在交汇点附近回到直线，穿过后再向另一侧略微偏出。
		const bend = 1.3 + (i - (o.bombers - 1) / 2) * .2;
		const along = (d: number, side: number): V2 => [a[0] + dir[0] * d + perp[0] * side, a[1] + dir[1] * d + perp[1] * side];
		const path = Path.smooth([along(0, bend), along(7, bend * .55), along(14, 0), along(24, -bend * .3), along(34, -bend * .5)]), start = meet - 14 / o.speed + i * .3;
		const pos = (τ: number) => path.at((τ - start) * o.speed).p, target = o.targets[i % o.targets.length];
		let lock = Infinity, release = Infinity;
		for (let τ = start; τ < start + 20; τ += .02) {
			const b = pos(τ), s = ships.pos(target, τ), d = dist(b, s);
			if (d < 5.5 && lock === Infinity) lock = τ;
			if (d <= o.release) { release = τ; break; }
		}
		const torpedo = release < Infinity ? { from: pos(release), ...intercept(pos(release), release, o.torpedoSpeed, (τ) => ships.pos(target, τ)) } : undefined;
		return { path, start, target, lock, release, torpedo,
			label: i % 3 === 0 ? atlas.get('arrow', o.attacker.ink, `${code(o.seed + 4, i)} ${o.name}`) : undefined };
	});
	for (const b of bombers) if (b.torpedo) ships.ships[b.target].death = Math.min(ships.ships[b.target].death, b.torpedo.hit);
	ships.escapeAt = Math.max(...ships.ships.map((s) => s.death).filter(Number.isFinite)) + 1;
	const lines = new LineBuilder();
	bombers.forEach((b, i) => lines.add(b.path.pts, { width: 2.4, color: tint(o.attacker.main, .8), trail: i, tail: .04, lift: K_FIGHTER }));
	for (const b of bombers) if (b.torpedo) lines.add([b.torpedo.from, b.torpedo.to], { width: 1, color: tint(o.attacker.main, .6), start: b.release, duration: b.torpedo.hit - b.release, tail: .2 });
	const heads = new Float32Array(bombers.length);
	return {
		t0: o.t0, duration: 46, origin, lines: lines.build(), heads,
		draw(τ, f) {
			ships.draw(f, τ);
			bombers.forEach((b, i) => {
				const d = (τ - b.start) * o.speed;
				heads[i] = clamp(d / b.path.length);
				if (d <= 0 || d >= b.path.length) return;
				const { p, angle } = b.path.at(d);
				const q = f.aloft(ARROW, p[0], p[1], angle, 1.15, o.attacker, K_FIGHTER, 'box', 1, ARROW_NOTCH);
				if (b.label) f.label(b.label, q[0] + .2, q[1] + .1);
			});
			for (const b of bombers) {
				if (!b.torpedo) continue;
				const k = (τ - b.release) / (b.torpedo.hit - b.release);
				if (k > 0 && k < 1) { const p = lerp(b.torpedo.from, b.torpedo.to, k); f.disc(p[0], p[1], .016, o.attacker.hot); }
				burst(f, b.torpedo.to[0], b.torpedo.to[1], b.torpedo.hit, τ, o.attacker, o.seed * 5 + b.target, 1.1);
			}
		},
	};
}

interface StandoffOptions {
	t0: number; attacker: Side; defender: Side; seed: number; fleet: FleetOptions; markAt: number;
	route: Site[]; jets: number; spacing: number; enterAt: number; speed: number; range: number; flight: number;
	assign: number[][]; jetName: string;
}
/** 远程打击：敌方舰船逐一被虚线框锁定 → 编队沿长弧线逼近，在射程边缘发射导弹 → 被击中的舰船沉没，编队不停留、继续飞出画面。 */
function standoff(atlas: LabelAtlas, o: StandoffOptions): BattleEvent {
	const rnd = random(o.seed), at = (T: number) => T - o.t0, origin = o.fleet.site;
	const ships = fleet(atlas, origin, o.t0, o.defender, o.seed, o.fleet);
	const base = Path.smooth(o.route.map((p) => toLocal(origin, p)));
	const jets = Array.from({ length: o.jets }, (_, i) => ({
		path: base.offset((i - (o.jets - 1) / 2) * o.spacing), start: at(o.enterAt) + i * .3,
		label: i % 2 === 0 ? atlas.get('twin', o.attacker.ink, `${code(o.seed + 2, i, 4)} ${o.jetName}`) : undefined,
	}));
	const missiles: { from: V2; to: V2; launch: number; flight: number; target: number }[] = [];
	jets.forEach((jet, j) => (o.assign[j] ?? []).forEach((target, k) => {
		const pos = (τ: number) => jet.path.at((τ - jet.start) * o.speed).p;
		let τ = jet.start;
		while (τ < jet.start + 40 && dist(pos(τ), ships.pos(target, τ)) > o.range) τ += .05;
		const launch = τ + k * .35 + rnd() * .15, from = pos(launch);
		missiles.push({ from, to: ships.pos(target, launch + o.flight), launch, flight: o.flight, target });
		ships.ships[target].death = Math.min(ships.ships[target].death, launch + o.flight);
	}));
	ships.escapeAt = Math.max(...ships.ships.map((s) => s.death).filter(Number.isFinite)) + 1.4;
	const lines = new LineBuilder();
	jets.forEach((jet, j) => lines.add(jet.path.pts, { width: 2.4, color: tint(o.attacker.main, .8), trail: j, tail: .04, lift: K_FIGHTER }));
	for (const m of missiles) lines.add([m.from, m.to], { width: .75, color: tint(o.attacker.main, .55), start: m.launch, duration: m.flight, tail: .3, lift: [K_FIGHTER, 0] });
	const heads = new Float32Array(jets.length);
	return {
		t0: o.t0, duration: 46, origin, lines: lines.build(), heads,
		draw(τ, f) {
			ships.draw(f, τ);
			const mark = clamp((τ - at(o.markAt)) / .5);
			if (mark > 0) ships.ships.forEach((s, i) => {
				if (τ >= s.death) return;
				const p = ships.pos(i, τ);
				f.lock(p[0], p[1], o.attacker, (τ - at(o.markAt) - i * .18) / .4, .9);
			});
			jets.forEach((jet, j) => {
				const d = (τ - jet.start) * o.speed;
				heads[j] = clamp(d / jet.path.length);
				if (d <= 0 || d >= jet.path.length) return;
				const { p, angle } = jet.path.at(d);
				const q = f.aloft(ARROW, p[0], p[1], angle, 1.15, o.attacker, K_FIGHTER, 'ring', 1, ARROW_NOTCH);
				if (jet.label) f.label(jet.label, q[0] + .2, q[1] + .08);
			});
			for (const m of missiles) {
				const k = (τ - m.launch) / m.flight;
				if (k > 0 && k < 1) { const p = lerp(f.lift(m.from[0], m.from[1], K_FIGHTER), m.to, k); f.disc(p[0], p[1], .018, o.attacker.hot); }
				burst(f, m.to[0], m.to[1], m.launch + m.flight, τ, o.attacker, o.seed * 3 + m.target, 1.1);
			}
		},
	};
}

/** 编排时间轴（循环时间，秒）。镜头 y = 0.4 × t，因此 cam(t) 给出 t 时刻画面中心所在的纬度。
 *  单位速度取自参考视频逐帧追踪（格/秒）：青色飞翼约 1.0，品红攻击机约 1.5，盘旋炮艇约 0.9，
 *  编队飞机与登陆艇 0.6–1.1；弹体更快。关键时刻（到达、靠岸、交汇）固定，进场时间由速度倒推。 */
function timeline(atlas: LabelAtlas): BattleEvent[] {
	return [
		strike(atlas, { t0: -2, site: SITES.strikeA, attacker: CYAN, defender: PINK, seed: 11, targets: 11, spread: 1.9,
			rings: 7, ringRadius: 1.05, ringAt: 4.2, heading: 200, jets: 3, spacing: 1.2, arriveAt: 11.6, speed: 1.05,
			jetName: 'ARIA HERON', targetName: 'MIRA GUARD' }),
		landing(atlas, { t0: -2.5, side: CYAN, enemy: PINK, seed: 23, duration: 62,
			route: [[-14, -.6], [-10.4, -.62], [-8.2, -.85], [-7, .6], [-6.3, 2.6], [-6, 4.4], [-6.3, 6.6]],
			boats: 4, spacing: .26, landAt: 15, speed: .8, objective: SITES.landingA, defenders: 5, spread: 1.5,
			perBoat: 6, walk: .16, infantry: 'dot', posts: 'post', boatName: 'ARIA SKIFF', defenderName: 'MIRA POST' }),
		bombing(atlas, { t0: 9, attacker: PINK, defender: CYAN, seed: 31, site: SITES.bombing, targets: 8, spread: 1.3,
			markAt: 20, route: [[-2.2, cam(18) + 8.5], [-2.0, 13.4], [-1.0, 12.0], [1.6, 11.4], [4.5, 11.6], [8, 12.2], [17, 13.6]],
			jets: 4, spacing: .3, enterAt: 16.3, speed: 1, release: [1.4, 4.2], bombs: 3, jetName: 'MIRA SWIFT', targetName: 'ARIA TRACK' }),
		orbit(atlas, { t0: 21, attacker: CYAN, defender: PINK, seed: 41, site: SITES.orbit, targets: 10, spread: 2,
			radius: 3, ringAt: 31, enter: 210, sweep: 190, speed: .9, shotEvery: 1.2, name: 'ARIA OWL', targetName: 'MIRA GUARD' }),
		strike(atlas, { t0: 38, site: SITES.strikeB, attacker: PINK, defender: CYAN, seed: 53, targets: 9, spread: 1.6,
			rings: 4, ringRadius: 1.05, ringAt: 44.6, heading: 42, jets: 2, spacing: 1.4, arriveAt: 52.9, speed: 1.5, approach: 15,
			jetName: 'MIRA KITE', targetName: 'ARIA GUARD' }),
		naval(atlas, { t0: 48, attacker: PINK, defender: CYAN, seed: 61,
			fleet: { site: SITES.fleetA, at: 64, heading: 58, speed: .1, count: 6, spacing: .6, name: 'ARIA SKIFF', escape: 65 },
			boats: { site: SITES.torpedoBoats, at: 60, heading: 75, speed: .08, count: 4, spacing: .7, name: 'MIRA LANCE' },
			fireAt: 58.5, salvo: 3, torpedoSpeed: 1, hits: [1, 3, 4] }),
		torpedoRun(atlas, { t0: 56, attacker: PINK, defender: CYAN, seed: 71,
			fleet: { site: SITES.fleetB, at: 76, heading: 95, speed: .28, count: 6, spacing: .62, name: 'ARIA SKIFF', escape: 80 },
			heading: 188, bombers: 5, meetAt: 77.6, speed: 1.2, lane: .42, release: 2.3, torpedoSpeed: 1.6,
			targets: [0, 1, 2, 2, 4], name: 'MIRA WASP' }),
		standoff(atlas, { t0: 76, attacker: PINK, defender: CYAN, seed: 83,
			fleet: { site: SITES.fleetC, at: 92, heading: 160, speed: .05, count: 6, spacing: .62, name: 'ARIA SKIFF', escape: 215 },
			markAt: 85, route: [[12.5, 43.2], [9.5, 41.2], [6.3, 39.3], [3.3, 38.1], [-1.7, 37.7], [-13.5, 37]].map(([x, y]) => [x, y] as const),
			jets: 4, spacing: .3, enterAt: 81.9, speed: .9, range: 4.4, flight: 1.5, assign: [[0], [1, 2], [3], [2, 0]], jetName: 'MIRA SWIFT' }),
		landing(atlas, { t0: 90, side: PINK, enemy: CYAN, seed: 97, duration: 46,
			route: [[-8.6, cam(95) - 7.2], [-7.4, 36.8], [-5.8, 40.0], [-4.4, 42.4], [-3.9, 44.5]],
			boats: 5, spacing: .3, landAt: 103.6, speed: 1, objective: SITES.outpost, defenders: 6, spread: 1.1,
			perBoat: 5, walk: .2, infantry: 'capsule', posts: 'cube', boatName: 'MIRA SKIFF', defenderName: 'ARIA GUARD',
			intercept: { heading: 14, lane: [-6.2, cam(99.5) - 1.6], enterAt: 91.2, jets: 3, speed: 1.2, victim: 4, fireAt: 99.4, name: 'ARIA DART' },
			barrage: { at: 108, radius: .95, hits: 4 } }),
	];
}

/** 陆地上的白色地名标记：短亮条、细引线与小字，按周期平铺。 */
function landmarks(atlas: LabelAtlas) {
	const rnd = random(907), names = ['RIDGE', 'DEPOT', 'RELAY', 'HARBOR', 'SIGNAL', 'BEACON', 'MESA', 'GATE', 'FORD', 'SPUR'];
	const sites = Object.values(SITES) as Site[];
	const out: { x: number; y: number; angle: number; label: LabelEntry }[] = [];
	for (let gy = 0; gy < TILE; gy += 3) for (let gx = -TILE / 2; gx < TILE / 2; gx += 3.4) {
		const x = gx + rnd() * 3.4, y = gy + rnd() * 3, keep = rnd() < .5, angle = (rnd() - .5) * .5 + (rnd() < .5 ? 0 : Math.PI);
		const h = terrainHeight(x, y);
		if (!keep || h < .05 || h > .6 || sites.some((s) => Math.hypot(nearest(s[0] - x), nearest(s[1] - y)) < 2.4)) continue;
		out.push({ x, y, angle, label: atlas.get('land', '#d3dcde', `${names[out.length % names.length]} ${10 + Math.floor(rnd() * 89)}`) });
	}
	return out;
}

export interface BattleUniforms { worldPixel: { value: number }; lineScale: { value: number } }

export function createBattle(shared: BattleUniforms) {
	const atlas = new LabelAtlas();
	const events = timeline(atlas), marks = landmarks(atlas);
	const fills = new FillBuffer(30000), markBuffer = new MarkBuffer(6000), labelBuffer = new LabelBuffer(2000);
	const frame = new Frame(fills, markBuffer, labelBuffer);
	const blend = { transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, toneMapped: false } as const;
	const group = new Group(), materials: ShaderMaterial[] = [];
	const lineMeshes = events.map((e) => {
		if (!e.lines) return undefined;
		const material = new ShaderMaterial({
			...blend, vertexShader: lineVertex, fragmentShader: lineFragment, defines: { HEADS: e.heads.length },
			uniforms: { uLocal: { value: 0 }, uOpacity: { value: 1 }, uHeads: { value: e.heads }, uWorldPixel: shared.worldPixel, uLineScale: shared.lineScale },
		});
		materials.push(material);
		const mesh = new Mesh(e.lines, material);
		mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.visible = false;
		group.add(mesh);
		return mesh;
	});
	const layer = (geometry: BufferGeometry, vertexShader: string, fragmentShader: string, order: number, uniforms = {}) => {
		const material = new ShaderMaterial({ ...blend, vertexShader, fragmentShader, uniforms });
		materials.push(material);
		const mesh = new Mesh(geometry, material);
		mesh.frustumCulled = false; mesh.renderOrder = order;
		group.add(mesh);
	};
	layer(markBuffer.geometry, markerVertex, markerFragment, 2, { uWorldPixel: shared.worldPixel, uLineScale: shared.lineScale });
	layer(fills.geometry, fillVertex, fillFragment, 3);
	layer(labelBuffer.geometry, labelVertex, labelFragment, 4, { tAtlas: { value: atlas.texture } });
	return {
		group,
		update(t: number, cx: number, cy: number, spanX: number, spanY: number) {
			frame.px = shared.worldPixel.value; frame.scale = shared.lineScale.value;
			events.forEach((e, i) => {
				const τ = ((t - e.t0) % LOOP + LOOP) % LOOP, mesh = lineMeshes[i];
				if (τ >= e.duration) { if (mesh) mesh.visible = false; return; }
				frame.ox = nearest(e.origin[0] - cx); frame.oy = nearest(e.origin[1] - cy);
				frame.opacity = clamp(τ / .4) * clamp((e.duration - τ) / 3);
				if (mesh) {
					mesh.visible = true; mesh.position.set(frame.ox, frame.oy, 0);
					const u = (mesh.material as ShaderMaterial).uniforms;
					u.uLocal.value = τ; u.uOpacity.value = frame.opacity;
				}
				e.draw(τ, frame);
			});
			frame.opacity = 1;
			for (const m of marks) {
				const x = nearest(m.x - cx), y = nearest(m.y - cy);
				if (Math.abs(x) > spanX / 2 + 1 || Math.abs(y) > spanY / 2 + 1) continue;
				frame.ox = x; frame.oy = y;
				const c = Math.cos(m.angle), s = Math.sin(m.angle);
				frame.segment(-c * .05, -s * .05, c * .05, s * .05, 2.4, WHITE, .95);
				frame.segment(-c * .06, -s * .06, -c * .34, -s * .34, .7, WHITE, .3);
				frame.segment(.03, .03, .19, .1, .7, WHITE, .4);
				frame.label(m.label, .2, .1, .5);
			}
			frame.ox = frame.oy = 0;
			fills.flush(); markBuffer.flush(); labelBuffer.flush();
		},
		dispose() {
			for (const mesh of lineMeshes) mesh?.geometry.dispose();
			fills.geometry.dispose(); markBuffer.geometry.dispose(); labelBuffer.geometry.dispose();
			materials.forEach((m) => m.dispose());
			atlas.texture.dispose();
		},
	};
}
