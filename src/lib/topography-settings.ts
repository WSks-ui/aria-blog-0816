export type TopographyView = 'final' | 'contours' | 'routes';
export const TOPOGRAPHY_DEFAULTS = { density: 1, glow: .5, speed: 1, zoom: 1 } as const;
export type TopographyParameter = keyof typeof TOPOGRAPHY_DEFAULTS;
export const TOPOGRAPHY_LIMITS = {
	density: [.65, 1.45], glow: [0, 1.2], speed: [0, 1.6], zoom: [.7, 1.8],
} as const;

/** 世界以网格单元为长度单位；地形在 TILE × TILE 的环面上无缝重复。 */
export const TOPOGRAPHY_TILE = 48;
/** 编排时间轴的周期（秒）。镜头每个周期正北走完一个 TILE，地图与交战同步循环。 */
export const TOPOGRAPHY_LOOP = 120;
/** 镜头北移速度：0.4 格/秒，1080p 下约 37 像素/秒，与参考视频实测的 37.3 像素/秒一致。 */
export const TOPOGRAPHY_DRIFT = TOPOGRAPHY_TILE / TOPOGRAPHY_LOOP;
/** 参考视频 1080p 下网格间距 92 像素，一屏约 20.9 × 11.7 格。 */
export const TOPOGRAPHY_REFERENCE_CELL = 92;

export function normalizeTopographyParameter(key: TopographyParameter, value: number) {
	const [min, max] = TOPOGRAPHY_LIMITS[key];
	return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : TOPOGRAPHY_DEFAULTS[key];
}

/** 按设备像素原生渲染，不设画质预算；只在超过 GPU 单张缓冲上限时等比缩小。
 *  scale = 缓冲像素 / CSS 像素，着色器用它把 CSS 线宽换算成缓冲像素。 */
export function topographyRenderSize(cssWidth = 1920, cssHeight = 1080, dpr = 1, maxSize = Infinity) {
	const w = Math.max(1, cssWidth), h = Math.max(1, cssHeight);
	const scale = Math.min(Math.max(dpr, .25), maxSize / w, maxSize / h);
	return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale };
}

// 正交俯视。网格单元的 CSS 尺寸与屏幕面积成正比：16:9 下与参考视频完全一致（1080p 为 92 像素一格），
// 其它比例显示同样面积的地图，不设上下限。
export function topographyFraming(width: number, height: number, zoom = 1) {
	const w = Math.max(1, width), h = Math.max(1, height);
	const cell = Math.sqrt(w * h) / Math.sqrt(1920 * 1080) * TOPOGRAPHY_REFERENCE_CELL * zoom;
	return { spanX: w / cell, spanY: h / cell, cell };
}
