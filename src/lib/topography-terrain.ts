import { TOPOGRAPHY_TILE as TILE } from './topography-settings';

// 地形高度的 CPU 版本，与 topography-height.frag.glsl 逐行对应：GPU 烘焙整幅纹理用于绘制，
// CPU 版本只在初始化时供战斗编排查询陆海（把地面单位放上陆地、找登陆点、确认舰队在海面）。
// 修改其中一边时必须同步修改另一边。

export type Site = readonly [number, number];

/** 编排用到的位置（格为单位）。镜头 y = 0.4 × 循环时间，编排时间与这里的纵坐标一一对应。 */
export const SITES = {
	strikeA: [4.8, 3.4],
	landingA: [-8.6, 7.6],
	bombing: [5.9, 10.3],
	orbit: [-5.2, 15.4],
	strikeB: [4.4, 20.6],
	torpedoBoats: [-7.6, 24.8],
	fleetA: [-5.0, 29.8],
	fleetB: [4.8, 29.8],
	fleetC: [1.5, 35.4],
	landingB: [-7.4, 42.6],
	outpost: [-1.4, 45.6],
} as const satisfies Record<string, Site>;

/** 手工特征 [x, y, 半径, 幅度]：正值抬成陆地，负值压成海面。叠加在周期噪声之上，边界仍由噪声打碎。 */
export const TERRAIN_FEATURES: readonly (readonly [number, number, number, number])[] = [
	[...SITES.strikeA, 2.2, .38],
	[...SITES.landingA, 3.0, .42],
	[-5.0, 1.4, 3.0, -.45],
	[-3.6, 5.0, 1.8, -.4],
	[SITES.bombing[0], SITES.bombing[1] - .3, 2.2, .38],
	[.6, 8.4, 2.6, -.4],
	[-1.2, 11.8, 2.4, -.35],
	[...SITES.orbit, 2.8, .55],
	[.8, 17.4, 2.4, -.35],
	[...SITES.strikeB, 2.2, .4],
	[...SITES.fleetC, 3.4, -.45],
	[...SITES.landingB, 3.0, .45],
	[...SITES.outpost, 2.0, .42],
	[-9.8, 38.6, 3.0, -.45],
	[-3.6, 40.2, 2.2, -.35],
	[3.4, 43.2, 2.2, -.3],
];
/** 中段的开阔海域：以 y 为中心的周期带状下压，对应循环 54–97 秒的海战。 */
export const SEA_BAND = [28.4, 6.2, .6] as const;

const fract = (v: number) => v - Math.floor(v);
const mod = (v: number, m: number) => v - m * Math.floor(v / m);
/** 最近的周期副本：把差值收到 [-TILE/2, TILE/2)。 */
export const nearest = (d: number) => d - TILE * Math.floor(d / TILE + .5);

function hash(px: number, py: number) {
	let x = fract(px * .1031), y = fract(py * .1031), z = fract(px * .1031);
	const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
	x += d; y += d; z += d;
	return fract((x + y) * z);
}
function gradDot(cx: number, cy: number, period: number, fx: number, fy: number) {
	const a = hash(mod(cx, period) + period * 7, mod(cy, period) + period * 7) * 6.2831853;
	return Math.cos(a) * fx + Math.sin(a) * fy;
}
function noise(px: number, py: number, period: number) {
	const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
	const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
	const a = gradDot(ix, iy, period, fx, fy), b = gradDot(ix + 1, iy, period, fx - 1, fy);
	const c = gradDot(ix, iy + 1, period, fx, fy - 1), d = gradDot(ix + 1, iy + 1, period, fx - 1, fy - 1);
	return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 1.414;
}
function fbm(u: number, v: number, period: number, octaves: number) {
	let n = 0, amp = .5;
	for (let i = 0; i < octaves; i++) {
		n += noise(u * period + i * 17, v * period + i * 17, period) * amp;
		period *= 2; amp *= .5;
	}
	return n;
}

/** 世界坐标（格）处的高度；h > 0 为陆地，海岸线在 h = 0。 */
export function terrainHeight(x: number, y: number) {
	const u = x / TILE, v = y / TILE;
	const wu = u + fbm(u, v, 4, 3) * .05, wv = v + fbm(u + .5, v + .5, 4, 3) * .05;
	const continent = fbm(wu, wv, 4, 3);
	const detail = fbm(wu + .25, wv + .25, 16, 4);
	const qx = wu * TILE, qy = wv * TILE;
	let f = 0;
	for (const [cx, cy, r, amp] of TERRAIN_FEATURES) {
		const dx = nearest(qx - cx), dy = nearest(qy - cy);
		f += amp * Math.exp(-(dx * dx + dy * dy) / (r * r));
	}
	const dy = nearest(qy - SEA_BAND[0]);
	f -= SEA_BAND[2] * Math.exp(-dy * dy / (SEA_BAND[1] * SEA_BAND[1]));
	return continent * .8 + detail * .36 + f + .04;
}

/** 以 seed 决定的伪随机序列（mulberry32），编排在每次加载时完全一致。 */
export function random(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 在圆内撒点，只保留满足地形条件且彼此间隔足够的点。 */
export function scatter(center: Site, radius: number, count: number, spacing: number, seed: number,
	accept: (h: number) => boolean) {
	const rnd = random(seed);
	const points: [number, number][] = [];
	for (let tries = 0; points.length < count && tries < count * 80; tries++) {
		const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * radius;
		const p: [number, number] = [center[0] + Math.cos(a) * d, center[1] + Math.sin(a) * d];
		if (!accept(terrainHeight(p[0], p[1]))) continue;
		if (points.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= spacing)) points.push(p);
	}
	return points;
}
