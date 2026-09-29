import { HalfFloatType, ShaderMaterial, Vector2, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import vertexShader from '@/shaders/ocean.vert.glsl?raw';
import blurShader from '@/shaders/ocean-blur.frag.glsl?raw';
import compositeShader from '@/shaders/ocean-composite.frag.glsl?raw';
import { bloomSizes, type QualityTier } from './ocean-settings';

/** 专用四尺度泛光。所有中间缓冲都是线性 HDR，最后一遍才曝光并转为 sRGB。 */
export class OceanPost {
	private blurAspect = 1;
	// 合成完成后对显示空间图像做 FXAA，处理 Shader 内部亮纹边缘；
	// 单纯启用几何 MSAA 无法覆盖全屏片元着色器生成的这些边缘。
	private readonly aaTarget = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
	private readonly aa = new ShaderMaterial({
		vertexShader: FXAAShader.vertexShader, fragmentShader: FXAAShader.fragmentShader,
		depthTest: false, depthWrite: false,
		uniforms: { tDiffuse: { value: null }, resolution: { value: new Vector2() } },
	});
	private readonly levels = Array.from({ length: 4 }, () => ({
		image: new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false, stencilBuffer: false }),
		scratch: new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false, stencilBuffer: false }),
	}));
	private readonly blur = new ShaderMaterial({
		vertexShader, fragmentShader: blurShader, depthTest: false, depthWrite: false,
		uniforms: {
			tInput: { value: null }, uTexel: { value: new Vector2() },
			uRadius: { value: 1 }, uMode: { value: 0 }, uPrefilter: { value: false },
		},
	});
	private readonly composite = new ShaderMaterial({
		vertexShader, fragmentShader: compositeShader, depthTest: false, depthWrite: false,
		uniforms: {
			tScene: { value: null }, tBloom0: { value: null }, tBloom1: { value: null },
			tBloom2: { value: null }, tBloom3: { value: null }, uView: { value: 0 }, uBloom: { value: 0 },
		},
	});
	private readonly quad = new FullScreenQuad(this.blur);

	resize(width: number, height: number, displayAspect = width / height) {
		// 非方形显示像素需要补偿模糊核，否则手机固定1080p会把光晕拉成长条。
		this.blurAspect = width / height / displayAspect;
		this.aaTarget.setSize(width, height);
		this.aa.uniforms.resolution.value.set(1 / width, 1 / height);
		bloomSizes(width, height).forEach((size, i) => {
			this.levels[i].image.setSize(size.width, size.height);
			this.levels[i].scratch.setSize(size.width, size.height);
		});
	}

	render(renderer: WebGLRenderer, scene: WebGLRenderTarget, view: number, strength: number, tier: QualityTier) {
		const count = tier === 0 ? 3 : 4;
		const uniforms = this.blur.uniforms;
		this.quad.material = this.blur;
		if ((view === 0 || view === 4) && strength > 0) {
			let input = scene;
			for (let i = 0; i < count; i++) {
				const { image, scratch } = this.levels[i];
				uniforms.tInput.value = input.texture;
				uniforms.uTexel.value.set(1 / input.width, 1 / input.height);
				uniforms.uMode.value = 0;
				uniforms.uPrefilter.value = i === 0;
				renderer.setRenderTarget(scratch);
				this.quad.render(renderer);
				uniforms.uMode.value = 1;
				uniforms.uTexel.value.set(this.blurAspect / image.width, 1 / image.height);
				// 每层一次 64 点旋转核。半径以该层像素计，粗层形成连续的暖扩散。
				uniforms.uRadius.value = [3, 6, 12, 16][i];
				uniforms.tInput.value = scratch.texture;
				renderer.setRenderTarget(image);
				this.quad.render(renderer);
				input = image;
			}
		}
		this.composite.uniforms.tScene.value = scene.texture;
		for (let i = 0; i < 4; i++) {
			// 节能档仍有粗光晕，只复用最后一级，不改变基础光形或主光位置。
			this.composite.uniforms[`tBloom${i}`].value = this.levels[Math.min(i, count - 1)].image.texture;
		}
		this.composite.uniforms.uBloom.value = strength;
		this.composite.uniforms.uView.value = view;
		this.quad.material = this.composite;
		renderer.setRenderTarget(this.aaTarget);
		this.quad.render(renderer);
		this.aa.uniforms.tDiffuse.value = this.aaTarget.texture;
		this.quad.material = this.aa;
		renderer.setRenderTarget(null);
		this.quad.render(renderer);
	}

	dispose() {
		for (const { image, scratch } of this.levels) { image.dispose(); scratch.dispose(); }
		this.blur.dispose();
		this.composite.dispose();
		this.aa.dispose();
		this.aaTarget.dispose();
		this.quad.dispose();
	}
}
