precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform sampler2D tBloom3;
uniform int uView;
uniform float uBloom;

void main() {
	vec3 scene = texture2D(tScene, vUv).rgb;
	vec3 glow = texture2D(tBloom0, vUv).rgb * 0.12
		+ texture2D(tBloom1, vUv).rgb * 0.22
		+ texture2D(tBloom2, vUv).rgb * 0.30
		+ texture2D(tBloom3, vUv).rgb * 0.36;
	// 场景本身已有暖色光谱；仅粗光晕略偏暖，不对整屏套橙色滤镜。
	glow *= vec3(1.5, 1.2, 1.0) * uBloom;
	vec3 color = scene;
	if (uView == 0) color += glow;
	if (uView == 4) color = glow;
	if (uView != 1 && uView != 2) {
		// 曝光后用连续肩部压缩 HDR，白核周围仍保留金色过渡。
		color = 1.0 - exp(-max(color, vec3(0.0)) * 0.82);
	}
	// 本通道是唯一输出变换；不再叠加 OutputPass 或 renderer 色调映射。
	vec3 low = color * 12.92;
	vec3 high = 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
	color = mix(low, high, step(vec3(0.0031308), color));
	gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
