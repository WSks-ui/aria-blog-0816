import {
	Color, HalfFloatType, LinearFilter, Mesh, NoToneMapping, OrthographicCamera, PlaneGeometry, RedFormat,
	RepeatWrapping, Scene, ShaderMaterial, SRGBColorSpace, Vector2, Vector4, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import vertexShader from '@/shaders/ocean.vert.glsl?raw';
import heightShader from '@/shaders/topography-height.frag.glsl?raw';
import mapShader from '@/shaders/topography-map.frag.glsl?raw';
import finishShader from '@/shaders/topography-finish.frag.glsl?raw';
import introShader from '@/shaders/topography-intro.frag.glsl?raw';
import { createBattle } from './topography-battle';
import { nearest, SEA_BAND, TERRAIN_FEATURES } from './topography-terrain';
import {
	normalizeTopographyParameter, TOPOGRAPHY_DEFAULTS, TOPOGRAPHY_DRIFT, TOPOGRAPHY_TILE,
	topographyFraming, topographyRenderSize, type TopographyParameter, type TopographyView,
} from './topography-settings';

export interface TopographyState {
	status: 'live' | 'lost' | 'error';
	paused: boolean;
	time: number;
	frames: number;
	width: number;
	height: number;
	view: TopographyView;
	parameters: Record<TopographyParameter, number>;
}
export interface TopographyOptions {
	/** 背景模式：不响应拖动。 */
	interactive?: boolean;
	/** 首帧起播放面板入场动画；减少动态偏好下总是跳过。 */
	intro?: boolean;
}

/** 默认从第一轮空袭即将开火的时刻开始。 */
const START_TIME = 8;
/** 入场面板动画时长（秒，真实时间，与动画速度参数无关）。 */
const INTRO = 1.95;

/** 原创实时重建：构图与交战逻辑参考 MUSYNX RETURN Dark_2D，未加载游戏视频、贴图或代码。 */
export function createTopographyScene(canvas: HTMLCanvasElement, notify: (state: TopographyState) => void, options: TopographyOptions = {}) {
	const interactive = options.interactive ?? true;
	const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
	renderer.setPixelRatio(1);
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = NoToneMapping;
	const scene = new Scene();
	const camera = new OrthographicCamera(-10, 10, 6, -6, -10, 10);
	const events = new AbortController();
	const reduced = matchMedia('(prefers-reduced-motion: reduce)');
	const state: TopographyState = {
		status: 'live', paused: reduced.matches, time: START_TIME, frames: 0, width: 1920, height: 1080, view: 'final',
		parameters: { ...TOPOGRAPHY_DEFAULTS },
	};
	let disposed = false, dirty = true, frame = 0, lastDraw: number | null = null, lastNotify = 0;
	let introStart: number | null = null, introDone = reduced.matches || options.intro === false;
	let pan = new Vector2();
	const span = new Vector2(21, 12);
	const listen = (target: EventTarget, name: string, handler: EventListener) =>
		target.addEventListener(name, handler, { signal: events.signal });
	const emit = () => notify({ ...state, parameters: { ...state.parameters } });

	// 高度场一次烘焙成可平铺的单通道半浮点纹理（约 18 MB），每帧只采样。
	const HEIGHT_SIZE = 3072;
	const heightTarget = new WebGLRenderTarget(HEIGHT_SIZE, HEIGHT_SIZE, {
		type: HalfFloatType, format: RedFormat, depthBuffer: false,
		wrapS: RepeatWrapping, wrapT: RepeatWrapping, minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false,
	});
	const heightMaterial = new ShaderMaterial({
		vertexShader, fragmentShader: heightShader, depthTest: false, depthWrite: false,
		defines: { FEATURES: TERRAIN_FEATURES.length },
		uniforms: {
			uTile: { value: TOPOGRAPHY_TILE },
			uFeatures: { value: TERRAIN_FEATURES.map(([x, y, r, a]) => new Vector4(x, y, r, a)) },
			uSea: { value: SEA_BAND.slice() },
		},
	});
	const heightQuad = new FullScreenQuad(heightMaterial);
	const bakeHeight = () => {
		renderer.setRenderTarget(heightTarget);
		heightQuad.render(renderer);
		renderer.setRenderTarget(null);
	};
	const mapMaterial = new ShaderMaterial({
		vertexShader, fragmentShader: mapShader, depthTest: false, depthWrite: false,
		uniforms: {
			tHeight: { value: heightTarget.texture }, uTile: { value: TOPOGRAPHY_TILE }, uTexel: { value: TOPOGRAPHY_TILE / HEIGHT_SIZE },
			uCenter: { value: new Vector2() }, uSpan: { value: span }, uResolution: { value: new Vector2(1920, 1080) },
			uDensity: { value: 1 }, uGrid: { value: 1 }, uLineScale: { value: 1 },
		},
	});
	const map = new Mesh(new PlaneGeometry(2, 2), mapMaterial);
	map.frustumCulled = false;
	map.renderOrder = -10;
	scene.add(map);

	const worldPixel = { value: .01 };
	const lineScale = { value: 1 };
	const battle = createBattle({ worldPixel, lineScale });
	scene.add(battle.group);

	const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false }));
	// 只保留最近两级模糊：线条外只有几像素的窄光晕，海面保持黑色，不被宽泛光抬成灰雾。
	const bloom = new UnrealBloomPass(new Vector2(960, 540), state.parameters.glow, 0, .62);
	bloom.compositeMaterial.uniforms.bloomFactors.value = [1, .45, .12, .02, 0];
	const finish = new ShaderPass({
		vertexShader, fragmentShader: finishShader,
		uniforms: { tDiffuse: { value: null }, uResolution: { value: new Vector2(1920, 1080) }, uAberration: { value: 1 } },
	});
	// 入场面板叠在泛光之后：面板本身不发光，镂空处透出的是已带光晕的地图。
	const intro = new ShaderPass({
		vertexShader, fragmentShader: introShader,
		uniforms: { tDiffuse: { value: null }, uCenter: { value: new Vector2() }, uSpan: { value: span }, uTime: { value: 0 } },
	});
	intro.enabled = !introDone;
	const output = new OutputPass();
	composer.addPass(new RenderPass(scene, camera)); composer.addPass(bloom); composer.addPass(intro); composer.addPass(finish); composer.addPass(output);
	const skipIntro = () => { introDone = true; intro.enabled = false; };

	/** 镜头只做正北匀速推进，与参考视频一致；不跟随交战横移。拖动平移叠加在上面。 */
	function cameraCenter() {
		return [nearest(pan.x), nearest(state.time * TOPOGRAPHY_DRIFT + pan.y)] as const;
	}
	// 只受 GPU 单张缓冲的尺寸上限约束，不设画质预算。
	const gl = renderer.getContext();
	const maxSize = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array);
	function resize() {
		if (disposed || state.status !== 'live') return;
		const rect = canvas.getBoundingClientRect();
		const framing = topographyFraming(rect.width, rect.height, state.parameters.zoom);
		const size = topographyRenderSize(rect.width, rect.height, devicePixelRatio, maxSize);
		state.width = size.width; state.height = size.height;
		if (canvas.width !== size.width || canvas.height !== size.height) {
			renderer.setSize(size.width, size.height, false);
			composer.setSize(size.width, size.height);
		}
		span.set(framing.spanX, framing.spanY);
		mapMaterial.uniforms.uResolution.value.set(size.width, size.height);
		mapMaterial.uniforms.uLineScale.value = lineScale.value = size.scale;
		camera.left = -framing.spanX / 2; camera.right = framing.spanX / 2;
		camera.top = framing.spanY / 2; camera.bottom = -framing.spanY / 2;
		camera.updateProjectionMatrix();
		worldPixel.value = framing.spanY / size.height;
		finish.uniforms.uResolution.value.set(size.width, size.height);
		dirty = true;
		emit();
	}
	function applySettings() {
		map.visible = state.view !== 'routes';
		battle.group.visible = state.view !== 'contours';
		mapMaterial.uniforms.uDensity.value = state.parameters.density;
		mapMaterial.uniforms.uGrid.value = state.view === 'contours' ? 0 : 1;
		bloom.strength = state.view === 'final' ? state.parameters.glow : 0;
		bloom.enabled = bloom.strength > 0;
		finish.uniforms.uAberration.value = state.view === 'final' ? 1 : 0;
		scene.background = state.view === 'routes' ? new Color('#020304') : null;
		dirty = true; emit();
	}
	function update() {
		const [cx, cy] = cameraCenter();
		mapMaterial.uniforms.uCenter.value.set(cx, cy);
		intro.uniforms.uCenter.value.set(cx, cy);
		battle.update(state.time, cx, cy, span.x, span.y);
	}
	/** 跟随显示器刷新率逐帧绘制，不限帧率；时间按真实间隔推进，速度与刷新率无关。 */
	function draw(now: number) {
		frame = 0;
		if (disposed || state.status !== 'live' || document.hidden) return;
		const dt = lastDraw === null ? 0 : Math.min(.1, (now - lastDraw) / 1000);
		lastDraw = now;
		if (!introDone) {
			introStart ??= now;
			intro.uniforms.uTime.value = (now - introStart) / 1000;
			if (intro.uniforms.uTime.value > INTRO) skipIntro();
			else dirty = true;
		}
		if (!state.paused || dirty) {
			if (!state.paused) state.time += dt * state.parameters.speed;
			update(); composer.render(); state.frames++; dirty = false;
			if (now - lastNotify > 500) { lastNotify = now; emit(); }
		}
		if (!state.paused || dirty || !introDone) frame = requestAnimationFrame(draw);
	}
	function wake() {
		if (!frame && !disposed && state.status === 'live' && !document.hidden) frame = requestAnimationFrame(draw);
	}
	function setPaused(paused: boolean) {
		state.paused = paused; lastDraw = null; dirty = true; emit(); wake();
	}
	const observer = new ResizeObserver(() => { resize(); wake(); });
	observer.observe(canvas);
	// 浏览器缩放或换到不同缩放比例的显示器时，设备像素比变化不一定改变 CSS 尺寸。
	listen(window, 'resize', () => { resize(); wake(); });
	listen(document, 'visibilitychange', () => {
		lastDraw = null;
		if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { dirty = true; wake(); }
	});
	listen(window, 'pageshow', () => { lastDraw = null; dirty = true; wake(); });
	listen(reduced, 'change', () => setPaused(reduced.matches));
	listen(canvas, 'webglcontextlost', (event) => {
		event.preventDefault(); state.status = 'lost'; cancelAnimationFrame(frame); frame = 0; emit();
	});
	listen(canvas, 'webglcontextrestored', () => {
		state.status = 'live'; lastDraw = null;
		bakeHeight(); resize(); dirty = true; wake();
	});
	if (interactive) {
		let pointer: { id: number; x: number; y: number; pan: Vector2 } | undefined;
		listen(canvas, 'pointerdown', ((e: PointerEvent) => {
			if (e.button !== 0) return;
			pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: pan.clone() };
			canvas.setPointerCapture(e.pointerId); canvas.dataset.dragging = 'true';
		}) as EventListener);
		listen(canvas, 'pointermove', ((e: PointerEvent) => {
			if (!pointer || e.pointerId !== pointer.id) return;
			const rect = canvas.getBoundingClientRect();
			pan.set(pointer.pan.x - (e.clientX - pointer.x) / rect.width * span.x, pointer.pan.y + (e.clientY - pointer.y) / rect.height * span.y);
			dirty = true; wake();
		}) as EventListener);
		const endPointer = () => { pointer = undefined; canvas.dataset.dragging = 'false'; };
		listen(canvas, 'pointerup', endPointer); listen(canvas, 'pointercancel', endPointer); listen(canvas, 'lostpointercapture', endPointer);
	}

	bakeHeight(); resize(); applySettings(); wake();
	return {
		setPaused,
		// 仅在开发页挂接此接口，用于固定时刻的画布像素检查和导出真实后备图。
		// 不使用 preserveDrawingBuffer，避免正常运行持续保存整个帧缓冲。
		captureAt(time?: number, introTime?: number) {
			if (time !== undefined && Number.isFinite(time)) { state.time = Math.max(0, time); state.paused = true; }
			skipIntro();
			// 页面隐藏时 ResizeObserver 不回调，导出前按当前布局重新取一次尺寸。
			resize(); update();
			// 传入 introTime 时叠加入场面板的那一刻，用于检查入场动画。
			if (introTime !== undefined) { intro.enabled = true; intro.uniforms.uTime.value = introTime; }
			composer.render(); intro.enabled = false; emit();
			return canvas.toDataURL('image/png');
		},
		/** 开发用：连续渲染若干帧并读回一个像素等待 GPU 完成，返回每帧毫秒数（含 CPU 编排与后期）。 */
		benchmark(frames = 60) {
			skipIntro();
			const pixel = new Uint8Array(4), start = performance.now();
			for (let i = 0; i < frames; i++) { state.time += 1 / 30; update(); composer.render(); }
			gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
			return (performance.now() - start) / frames;
		},
		setParameter(key: TopographyParameter, value: number) {
			state.parameters[key] = normalizeTopographyParameter(key, value);
			if (key === 'zoom') resize();
			applySettings(); wake();
		},
		setView(value: TopographyView) { state.view = value; applySettings(); wake(); },
		reset() {
			state.parameters = { ...TOPOGRAPHY_DEFAULTS }; state.view = 'final'; state.time = START_TIME; pan = new Vector2();
			resize(); applySettings(); wake();
		},
		dispose() {
			disposed = true; cancelAnimationFrame(frame); observer.disconnect(); events.abort();
			heightTarget.dispose(); heightMaterial.dispose(); heightQuad.dispose();
			map.geometry.dispose(); mapMaterial.dispose(); battle.dispose();
			bloom.dispose(); intro.dispose(); finish.dispose(); output.dispose(); composer.dispose(); renderer.dispose();
		},
	};
}
