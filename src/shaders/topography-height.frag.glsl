varying vec2 vUv;
uniform float uTile;
uniform vec4 uFeatures[FEATURES];
uniform vec3 uSea;

// 与 src/lib/topography-terrain.ts 的 terrainHeight 逐行对应；修改时两边同步。
// 周期梯度噪声：格点坐标按 period 取模，整幅高度场在两个方向上首尾相接。
float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * .1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
vec2 grad(vec2 cell, float period) {
	float a = hash(mod(cell, period) + period * 7.0) * 6.2831853;
	return vec2(cos(a), sin(a));
}
float noise(vec2 p, float period) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	float a = dot(grad(i, period), f);
	float b = dot(grad(i + vec2(1, 0), period), f - vec2(1, 0));
	float c = dot(grad(i + vec2(0, 1), period), f - vec2(0, 1));
	float d = dot(grad(i + vec2(1, 1), period), f - vec2(1, 1));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.414;
}
float fbm(vec2 uv, float period, int octaves) {
	float n = 0.0, amp = .5;
	for (int i = 0; i < 6; i++) {
		if (i >= octaves) break;
		n += noise(uv * period + float(i) * 17.0, period) * amp;
		period *= 2.0;
		amp *= .5;
	}
	return n;
}
float wrapped(float d) { return d - uTile * floor(d / uTile + .5); }
void main() {
	// 低频决定陆海分布，域扭曲让海岸线弯折；手工特征保证编排中的陆地、海面位置，
	// 它们也在扭曲后的坐标上求值，边界同样被噪声打碎。
	vec2 uv = vUv;
	vec2 w = uv + vec2(fbm(uv, 4.0, 3), fbm(uv + .5, 4.0, 3)) * .05;
	float continent = fbm(w, 4.0, 3);
	float detail = fbm(w + .25, 16.0, 4);
	vec2 q = w * uTile;
	float f = 0.0;
	for (int i = 0; i < FEATURES; i++) {
		vec2 d = vec2(wrapped(q.x - uFeatures[i].x), wrapped(q.y - uFeatures[i].y));
		f += uFeatures[i].w * exp(-dot(d, d) / (uFeatures[i].z * uFeatures[i].z));
	}
	float dy = wrapped(q.y - uSea.x);
	f -= uSea.z * exp(-dy * dy / (uSea.y * uSea.y));
	gl_FragColor = vec4(continent * .8 + detail * .36 + f + .04, 0.0, 0.0, 1.0);
}
