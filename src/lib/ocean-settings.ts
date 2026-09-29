export const OCEAN_VIEWS = ['final', 'surface', 'normal', 'transmission', 'bloom'] as const;
export type OceanView = (typeof OCEAN_VIEWS)[number];
export type OceanQuality = 'auto' | 'high' | 'economy';
export type QualityTier = 0 | 1 | 2;
export const OCEAN_FRAME_MS = 1000 / 30;
export const HIGH_RENDER_SIZE = { width: 1920, height: 1080 } as const;

// 不允许脏标记绕过帧间隔；滑块拖动也共用同一个 30 FPS 上限。
export function shouldDrawFrame(now: number, last: number | null) {
	return last === null || now - last >= OCEAN_FRAME_MS;
}
export interface OceanParameters {
	wave: number;
	light: number;
	bloom: number;
}

export const DEFAULT_OCEAN_PARAMETERS: Readonly<OceanParameters> = { wave: 1, light: 1, bloom: 0.85 };
export const PARAMETER_LIMITS = {
	wave: [0.5, 1.5],
	light: [0.35, 1.8],
	bloom: [0, 1.5],
} as const;

// 画质改变采样预算而非镜头构图；基础波形相同，仅减少微表面细节与像素数。
export const QUALITY_TIERS = [
	{ pixels: 550_000, octaves: 7, dpr: 1, label: '低' },
	{ pixels: 1_100_000, octaves: 8, dpr: 1.25, label: '中' },
	{ pixels: 1920 * 1080, octaves: 10, dpr: 1.5, label: '高' },
] as const;

export function normalizeParameter(key: keyof OceanParameters, value: number): number {
	const [min, max] = PARAMETER_LIMITS[key];
	return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : DEFAULT_OCEAN_PARAMETERS[key];
}

export function initialTier(quality: OceanQuality, mobile: boolean): QualityTier {
	return quality === 'high' ? 2 : quality === 'economy' || mobile ? 0 : 2;
}

export function bloomSizes(width: number, height: number) {
	return [2, 4, 8, 16].map((divisor) => ({
		width: Math.max(1, Math.floor(width / divisor)),
		height: Math.max(1, Math.floor(height / divisor)),
	}));
}

export function renderSize(width: number, height: number, dpr: number, tier: QualityTier, quality: OceanQuality = 'auto') {
	// 手动高画质固定内部缓冲，不受窗口尺寸或 DPR 影响；相机比例在场景中单独补偿。
	if (quality === 'high') return { ...HIGH_RENDER_SIZE };
	const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
	const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
	const budget = QUALITY_TIERS[tier];
	const scale = Math.min(
		Math.max(0.5, Number.isFinite(dpr) ? dpr : 1),
		budget.dpr,
		Math.sqrt(budget.pixels / (safeWidth * safeHeight)),
	);
	return {
		width: Math.max(1, Math.floor(safeWidth * scale)),
		height: Math.max(1, Math.floor(safeHeight * scale)),
	};
}

/** 连续两组测量超预算才降档；不自动升档，避免画面来回变清晰/模糊。 */
export class FrameBudget {
	private slowWindows = 0;
	consider(frameMs: number, targetMs: number, tier: QualityTier): QualityTier {
		if (!Number.isFinite(frameMs)) return tier;
		this.slowWindows = frameMs > targetMs * 1.4 ? this.slowWindows + 1 : 0;
		if (this.slowWindows < 2 || tier === 0) return tier;
		this.slowWindows = 0;
		return (tier - 1) as QualityTier;
	}
	reset() { this.slowWindows = 0; }
}
