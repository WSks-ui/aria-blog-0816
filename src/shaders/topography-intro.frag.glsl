varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uCenter;
uniform vec2 uSpan;
uniform float uTime;

// 入场：一道斜向擦除先铺开与地图网格对齐的面板（2 × 2 格），面板在黑、深灰、浅灰、白之间闪动，
// 随后按随机先后镂空成粗边框、边框变细后消失，露出底下已在运行的地图。约 1.9 秒，结束后整个通道关闭。
float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * .1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
// 线性亮度：黑、深灰、中灰、白（对应 sRGB 约 0、.25、.5、.8）。
float level(float h) { return h < .22 ? 0.0 : h < .47 ? .05 : h < .7 ? .21 : .6; }
// 方形距离场的覆盖率：d 以面板为单位，aa 为一个像素对应的面板长度。
float inside(float d, float aa) { return 1.0 - smoothstep(-aa, aa, d); }

void main() {
	vec3 scene = texture2D(tDiffuse, vUv).rgb;
	vec2 world = uCenter + (vUv - .5) * uSpan;
	vec2 cell = floor(world / 2.0);
	vec2 q = world / 2.0 - cell - .5;          // 面板内坐标，-.5 … .5
	float box = max(abs(q.x), abs(q.y));
	float aa = fwidth(box) * .75;
	float h1 = hash(cell + 7.1), h2 = hash(cell + 19.7);

	// 斜向擦除：左侧先到，斜边上端领先；擦除线之前保持黑屏。
	float sweep = (vUv.x - (vUv.y - .5) * .35) * 1.15;
	if (uTime * 3.2 < sweep) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

	// 每块面板何时开始镂空：大体随机，略带自上而下的先后。按面板中心取屏幕高度，整块同时变化。
	float tileY = clamp(((cell.y + .5) * 2.0 - uCenter.y) / uSpan.y + .5, 0.0, 1.0);
	float start = .5 + .95 * mix(h1, 1.0 - tileY, .3);
	float k = (uTime - start) / .42;
	if (k >= 1.0) { gl_FragColor = vec4(scene, 1.0); return; }

	float outer = .47;                          // 面板外轮廓（留出与邻块之间的黑缝）
	float edge = .5 - .012;                     // 细描边位置
	vec3 color;
	if (k < 0.0) {
		// 闪动：每 1/14 秒重新抽一次灰阶，多数时间停在面板自己的底色上。
		float flick = hash(cell + floor(uTime * 14.0) * 3.7);
		float g = level(flick < .7 ? h2 : flick);
		float fill = inside(box - outer + .045, aa);
		float line = inside(abs(box - edge) - .006, aa);
		color = vec3(g) * fill + vec3(.09) * line * (1.0 - fill);
	} else {
		// 镂空：内孔从中心长到接近外轮廓，留下的粗框逐渐变细，最后淡出。
		float grow = smoothstep(0.0, .6, k);
		float hole = mix(0.0, outer - .02, grow);
		float frame = inside(box - outer, aa) * (1.0 - inside(box - hole, aa));
		float fade = 1.0 - smoothstep(.65, 1.0, k);
		float line = inside(abs(box - edge) - .006, aa) * (1.0 - k);
		color = mix(scene, vec3(.55), frame * fade);
		color = mix(color, vec3(.09), line * .5 * (1.0 - frame * fade));
		gl_FragColor = vec4(color, 1.0);
		return;
	}
	gl_FragColor = vec4(color, 1.0);
}
