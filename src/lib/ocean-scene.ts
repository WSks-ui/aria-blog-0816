import {
	HalfFloatType, NoToneMapping, ShaderMaterial, Vector2,
	WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import vertexShader from '@/shaders/ocean.vert.glsl?raw';
import fragmentShader from '@/shaders/ocean.frag.glsl?raw';
import { OceanPost } from './ocean-post';
import {
	DEFAULT_OCEAN_PARAMETERS, FrameBudget, initialTier, normalizeParameter, OCEAN_VIEWS,
	QUALITY_TIERS, renderSize, OCEAN_FRAME_MS, shouldDrawFrame,
	type OceanParameters, type OceanQuality, type OceanView, type QualityTier,
} from './ocean-settings';

export interface OceanState {
	status: 'loading' | 'live' | 'lost' | 'fallback';
	paused: boolean;
	view: OceanView;
	quality: OceanQuality;
	tier: QualityTier;
	parameters: OceanParameters;
	width: number;
	height: number;
}
export interface OceanController {
	setView(view: OceanView): void;
	setQuality(quality: OceanQuality): void;
	setParameter(key: keyof OceanParameters, value: number): void;
	setPaused(paused: boolean): void;
	reset(): void;
	dispose(): void;
}

export function createOceanScene(
	canvas: HTMLCanvasElement,
	onState: (state: OceanState) => void,
): OceanController {
	const mobileQuery = matchMedia('(max-width: 760px)');
	const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
	const state: OceanState = {
		status: 'loading', paused: motionQuery.matches, view: 'final', quality: 'auto',
		tier: initialTier('auto', mobileQuery.matches),
		parameters: { ...DEFAULT_OCEAN_PARAMETERS }, width: 1, height: 1,
	};
	const emit = () => onState({ ...state, parameters: { ...state.parameters } });
	const events = new AbortController();
	const { signal } = events;
	const budget = new FrameBudget();
	let disposed = false;
	let visible = false;
	let suspended = false;
	let frame = 0;
	let lastDraw: number | null = null;
	let elapsed = 12;
	let dirty = true;
	let samples: number[] = [];
	let shaderFailed = false;
	const targetPointer = new Vector2();
	const pointer = new Vector2();

	const renderer = new WebGLRenderer({
		canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance',
	});
	// 半浮点线性缓冲承担 HDR。设备无法提供所需能力时返回实际渲染封面，
	// 不留下一个持续报错的黑色 WebGL 窗口。
	if (!renderer.extensions.has('EXT_color_buffer_float')) {
		renderer.dispose();
		renderer.forceContextLoss();
		throw new Error('HDR render targets unavailable');
	}
	renderer.setPixelRatio(1);
	renderer.toneMapping = NoToneMapping;
	renderer.debug.onShaderError = () => { shaderFailed = true; };
	const sceneTarget = new WebGLRenderTarget(1, 1, {
		type: HalfFloatType, depthBuffer: false, stencilBuffer: false,
	});
	const material = new ShaderMaterial({
		vertexShader, fragmentShader, depthTest: false, depthWrite: false,
		uniforms: {
			uResolution: { value: new Vector2(1, 1) },
			uPointer: { value: pointer },
			uTime: { value: elapsed },
			uWave: { value: state.parameters.wave },
			uLight: { value: state.parameters.light },
			uOctaves: { value: QUALITY_TIERS[state.tier].octaves },
			uView: { value: 0 },
		},
	});
	const quad = new FullScreenQuad(material);
	const post = new OceanPost();

	const draw = () => {
		material.uniforms.uTime.value = elapsed;
		renderer.setRenderTarget(sceneTarget);
		quad.render(renderer);
		post.render(renderer, sceneTarget, OCEAN_VIEWS.indexOf(state.view), state.parameters.bloom, state.tier);
		if (import.meta.env.DEV) canvas.dataset.sceneTime = elapsed.toFixed(3);
		dirty = false;
		if (shaderFailed) {
			state.status = 'fallback';
			stop();
			emit();
		} else if (state.status !== 'live') {
			state.status = 'live';
			emit();
		}
	};
	const stop = () => {
		cancelAnimationFrame(frame);
		frame = 0;
		lastDraw = null;
		samples = [];
	};
	const canDraw = () => !disposed && !suspended && !document.hidden && visible
		&& state.status !== 'lost' && state.status !== 'fallback';
	const requestDraw = () => {
		dirty = true;
		if (canDraw() && !frame) frame = requestAnimationFrame(tick);
	};
	const tick = (time: number) => {
		frame = 0;
		if (!canDraw()) return;
		const targetMs = OCEAN_FRAME_MS;
		const delta = lastDraw === null ? targetMs : time - lastDraw;
		if (shouldDrawFrame(time, lastDraw)) {
			if (!state.paused) {
				elapsed += Math.min(delta, 80) / 1000;
				pointer.lerp(targetPointer, 1 - Math.exp(-delta * 0.003));
			}
			const hadLastFrame = lastDraw !== null;
			lastDraw = time;
			draw();
			// 排除首帧编译、主动暂停和后台恢复。适应器按实际调度目标比较帧间隔，
			// 不把手机刻意限制的 30fps 误判为性能下降。
			if (hadLastFrame && !state.paused && state.quality === 'auto') {
				samples.push(delta);
				if (samples.length >= 120) {
					const average = samples.reduce((a, b) => a + b, 0) / samples.length;
					const next = budget.consider(average, targetMs, state.tier);
					samples = [];
					if (next !== state.tier) {
						state.tier = next;
						resize();
					}
				}
			}
		}
		if ((!state.paused || dirty) && canDraw()) frame = requestAnimationFrame(tick);
	};
	const resize = () => {
		if (disposed || state.status === 'lost' || state.status === 'fallback') return;
		const bounds = canvas.getBoundingClientRect();
		if (!bounds.width || !bounds.height) return;
		const size = renderSize(bounds.width, bounds.height, devicePixelRatio, state.tier, state.quality);
		state.width = size.width;
		state.height = size.height;
		renderer.setSize(size.width, size.height, false);
		sceneTarget.setSize(size.width, size.height);
		post.resize(size.width, size.height, bounds.width / bounds.height);
		// 固定 1080p 缓冲仍按元素的显示比例构造射线，避免竖屏或非 16:9 窗口拉伸水面。
		material.uniforms.uResolution.value.set(size.height * bounds.width / bounds.height, size.height);
		material.uniforms.uOctaves.value = QUALITY_TIERS[state.tier].octaves;
		emit();
		requestDraw();
	};
	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(canvas);
	const visibility = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) requestDraw();
		else stop();
	});
	visibility.observe(canvas);
	const syncVisibility = () => {
		if (document.hidden || suspended) stop();
		else requestDraw();
	};
	document.addEventListener('visibilitychange', syncVisibility, { signal });
	mobileQuery.addEventListener('change', () => {
		if (state.quality === 'auto') {
			state.tier = initialTier('auto', mobileQuery.matches);
			budget.reset();
		}
		resize();
	}, { signal });
	motionQuery.addEventListener('change', () => {
		state.paused = motionQuery.matches;
		stop();
		targetPointer.set(0, 0);
		pointer.set(0, 0);
		emit();
		requestDraw();
	}, { signal });
	canvas.addEventListener('pointermove', (event) => {
		if (event.pointerType !== 'mouse' || motionQuery.matches || state.paused) return;
		const rect = canvas.getBoundingClientRect();
		targetPointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
	}, { signal });
	canvas.addEventListener('pointerleave', () => targetPointer.set(0, 0), { signal });
	canvas.addEventListener('webglcontextlost', (event) => {
		event.preventDefault();
		state.status = 'lost';
		stop();
		emit();
	}, { signal });
	canvas.addEventListener('webglcontextrestored', () => {
		shaderFailed = false;
		state.status = 'loading';
		material.needsUpdate = true;
		budget.reset();
		resize();
	}, { signal });

	const controller: OceanController = {
		setView(view) {
			if (!OCEAN_VIEWS.includes(view)) return;
			state.view = view;
			const index = OCEAN_VIEWS.indexOf(view);
			material.uniforms.uView.value = index === 4 ? 0 : index;
			emit();
			requestDraw();
		},
		setQuality(quality) {
			if (!['auto', 'high', 'economy'].includes(quality)) return;
			state.quality = quality;
			state.tier = initialTier(quality, mobileQuery.matches);
			budget.reset();
			resize();
		},
		setParameter(key, value) {
			state.parameters[key] = normalizeParameter(key, value);
			material.uniforms.uWave.value = state.parameters.wave;
			material.uniforms.uLight.value = state.parameters.light;
			emit();
			requestDraw();
		},
		setPaused(paused) {
			state.paused = paused;
			stop();
			emit();
			requestDraw();
		},
		reset() {
			elapsed = 12;
			targetPointer.set(0, 0);
			pointer.set(0, 0);
			state.parameters = { ...DEFAULT_OCEAN_PARAMETERS };
			for (const key of Object.keys(state.parameters) as (keyof OceanParameters)[]) {
				controller.setParameter(key, state.parameters[key]);
			}
			controller.setView('final');
			controller.setQuality('auto');
			controller.setPaused(motionQuery.matches);
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			stop();
			events.abort();
			resizeObserver.disconnect();
			visibility.disconnect();
			quad.dispose();
			material.dispose();
			sceneTarget.dispose();
			post.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
		},
	};
	if (import.meta.env.DEV) {
		// 仅开发环境提供固定时间验收。生产包不暴露测试控制或持续画布读回。
		canvas.addEventListener('ocean:seek', ((event: CustomEvent<number>) => {
			if (!Number.isFinite(event.detail) || event.detail < 0 || event.detail > 3600) return;
			elapsed = event.detail;
			controller.setPaused(true);
		}) as EventListener, { signal });
		canvas.addEventListener('ocean:capture', () => {
			if (!canDraw()) return;
			// 在绘制后、浏览器清空默认帧缓冲前导出，不为静态封面永久开启 preserveDrawingBuffer。
			draw();
			canvas.dispatchEvent(new CustomEvent('ocean:captured', { detail: canvas.toDataURL('image/webp', 0.92) }));
		}, { signal });
	}
	window.addEventListener('pagehide', (event) => {
		suspended = true;
		stop();
		if (!event.persisted) controller.dispose();
	}, { signal });
	window.addEventListener('pageshow', () => {
		suspended = false;
		syncVisibility();
	}, { signal });
	resize();
	return controller;
}
