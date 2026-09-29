varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uAberration;
void main() {
	// 边缘色散：中心线芯保持干净，越靠画面左右两侧红蓝分离越明显（1080p 边缘约 3–4 像素）。
	vec2 p = vUv - .5;
	p.x *= uResolution.x / uResolution.y;
	float r2 = dot(p, p);
	vec2 offset = (vUv - .5) * r2 * 4.0 / uResolution.y * uAberration;
	vec3 color;
	color.r = texture2D(tDiffuse, vUv + offset).r;
	color.g = texture2D(tDiffuse, vUv).g;
	color.b = texture2D(tDiffuse, vUv - offset).b;
	color *= 1.0 - .16 * smoothstep(.3, 1.1, r2) * uAberration;
	gl_FragColor = vec4(color, 1.0);
}
