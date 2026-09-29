precision highp float;
varying vec2 vUv;
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform float uRadius;
uniform int uMode;
uniform bool uPrefilter;

vec3 extractLight(vec3 color) {
	// 软阈值在 0.35 到 1.05 之间连续接入，避免微亮斑跳变。
	float brightness = max(color.r, max(color.g, color.b));
	float soft = clamp(brightness - 0.35, 0.0, 0.70);
	soft = soft * soft / 1.40;
	float contribution = max(soft, brightness - 0.70) / max(brightness, 0.00001);
	return color * contribution;
}

void main() {
	vec3 color;
	if (uMode == 0) {
		// 四点降采样先合并细碎高光，后续层复用前一层的线性 HDR 结果。
		vec2 offset = uTexel * 0.5;
		color = texture2D(tInput, vUv + offset).rgb;
		color += texture2D(tInput, vUv - offset).rgb;
		color += texture2D(tInput, vUv + vec2(offset.x, -offset.y)).rgb;
		color += texture2D(tInput, vUv + vec2(-offset.x, offset.y)).rgb;
		color *= 0.25;
		if (uPrefilter) color = extractLight(color);
	} else {
		// 参考拆解的 Fibonacci 旋转核与 1/(1+i) 权重。
		// 固定单位起点避免逐像素随机半径导致光晕噪点；不随时间改变采样核。
		vec2 point = vec2(uRadius / 8.0, 0.0);
		mat2 rotation = mat2(-0.737, -0.675, 0.675, -0.737);
		float radius = 1.0;
		float total = 0.0;
		color = vec3(0.0);
		for (int i = 0; i < 64; i++) {
			point = rotation * point;
			radius += 1.0 / radius;
			float weight = 1.0 / (1.0 + float(i));
			color += texture2D(tInput, vUv + point * (radius - 1.0) * uTexel).rgb * weight;
			total += weight;
		}
		color /= total;
	}
	gl_FragColor = vec4(color, 1.0);
}
