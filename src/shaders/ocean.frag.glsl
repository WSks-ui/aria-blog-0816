precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uWave;
uniform float uLight;
uniform int uOctaves;
uniform int uView;

// 程序化水体研究，视觉参考用户提供的 Submerge / XorDev 拆解截图。
// 独立实现高度场与光学近似，不使用原作品素材，也不把方向性透光称为完整焦散求解。
float hash21(vec2 p) {
	vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	q += dot(q, q.yzx + 33.33);
	return fract((q.x + q.y) * q.z);
}

float noise2(vec2 p) {
	vec2 cell = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), f.x),
		mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), f.x),
		f.y
	);
}

float water(vec2 p, int octaves, float footprint) {
	// 按参考拆解的倍率与权重构建高度场。截图未提供 value()，
	// 此处采用上方独立实现的三次插值值噪声，不声称逐像素复刻原作。
	p = p * 0.6 + 1.0;
	float height = 0.0;
	float amplitude = 0.30;
	float speed = 0.30;
	float frequency = 0.6;
	mat2 octaveRotation = mat2(0.675, -0.737, 0.737, 0.675) * 2.0;
	for (int i = 0; i < 10; i++) {
		if (i >= octaves) break;
		float wave = smoothstep(0.1, 0.9, noise2(p + speed * uTime));
		float resolved = 1.0 - smoothstep(0.25, 0.8, frequency * footprint);
		height += mix(0.5, wave, resolved) * amplitude;
		p = octaveRotation * p;
		amplitude *= 0.45;
		speed *= 1.3;
		frequency *= 2.0;
	}
	return 0.5 + height * uWave;
}

// 高度场不是精确 SDF：先在有界高度带内找符号变化，再二分交点，
// 波高上界为 0.3 / (1 - 0.45)。所有画质共享六层求交，不随档位改变大波形。
float intersectWater(vec3 origin, vec3 ray) {
	float lower = max(0.0, (0.5 - origin.y) / ray.y);
	float upper = min(45.0, (0.5 + 0.546 * uWave - origin.y) / ray.y);
	if (lower >= upper) return 45.0;
	float last = lower;
	float hit = upper;
	for (int i = 1; i <= 16; i++) {
		float distance = mix(lower, upper, float(i) / 16.0);
		vec3 p = origin + ray * distance;
		if (p.y - water(p.xz, 6, 0.0) >= 0.0) { hit = distance; break; }
		last = distance;
	}
	for (int i = 0; i < 8; i++) {
		float middle = (last + hit) * 0.5;
		vec3 p = origin + ray * middle;
		if (p.y - water(p.xz, 6, 0.0) > 0.0) hit = middle;
		else last = middle;
	}
	return (last + hit) * 0.5;
}

float waterDistance(vec3 p, float footprint) {
	return water(p.xz, uOctaves, footprint) - p.y;
}

vec3 waterNormal(vec3 p, float distance, float lens) {
	// 四面体差分对应参考中的法线估计；像素足迹同时滤除不可解析的高频，
	// 差分间距不再人为放大斜率。高度函数梯度朝水下，适用于水到空气的折射。
	float footprint = distance * 2.0 * lens / uResolution.y;
	vec2 e = vec2(1.0, -1.0) * max(0.001, footprint * 0.5);
	return normalize(
		e.yxx * waterDistance(p + e.yxx, footprint) +
		e.xyx * waterDistance(p + e.xyx, footprint) +
		e.xxy * waterDistance(p + e.xxy, footprint) +
		e.yyy * waterDistance(p + e.yyy, footprint)
	);
}

void main() {
	vec2 screen = vUv * 2.0 - 1.0;
	screen.x *= uResolution.x / uResolution.y;
	// 参考的 yz 旋转展开为正交基，保持固定机位。这里的向上屏幕射线
	// 接近头顶水面，向下射线走向远处；手机独立俯仰将透光移到标题上方。
	float aspect = uResolution.x / uResolution.y;
	float portrait = 1.0 - smoothstep(0.8, 1.25, aspect);
	float pitch = mix(0.72, 0.42, portrait) + uPointer.y * 0.012;
	vec3 forward = vec3(0.0, sin(pitch), cos(pitch));
	vec3 right = vec3(1.0, 0.0, 0.0);
	vec3 up = vec3(0.0, cos(pitch), -sin(pitch));
	float lens = mix(0.65, 0.95, portrait);
	screen.x -= mix(0.20, 0.10, portrait) * aspect;
	vec3 ray = normalize(forward + (right * screen.x + up * screen.y) * lens);
	ray.x += uPointer.x * 0.012;
	ray = normalize(ray);
	vec3 origin = vec3(0.0, -0.65, 0.0);
	vec3 color = vec3(0.0);

	if (ray.y > 0.025) {
		float distance = intersectWater(origin, ray);
		vec3 position = origin + ray * distance;
		vec3 normal = waterNormal(position, distance, lens);
		normal = faceforward(normal, ray, normal);
		vec3 transmitted = refract(ray, normal, 1.333);
		vec3 sunDirection = normalize(vec3(0.0, -1.0, 9.0));
		// 参考中的 exp(dot(ref, sun) * 9 - 9) 与 sqrt(spec)：
		// 不再另加窄光核、黑色噪声遮罩或额外菲涅耳乘数。全内反射由 refract 产生。
		float spec = exp(dot(transmitted, sunDirection) * 9.0 - 9.0);
		float fog = max(1.0 - distance / 45.0, 0.0);
		float light = sqrt(spec) * fog;
		// 截图没有给出全部中间缓冲。这里单独标明艺术性 HDR 映射：
		// 保留同一折射信号的细节，以不同通道响应形成暖亮部，不添加第二个光斑。
		vec3 direct = 18.0 * vec3(pow(light, 4.0), pow(light, 5.0), pow(light, 6.0)) * uLight;
		color = direct;

		if (uView == 1) {
			float height = water(position.xz, 6, 0.0);
			float relief = 0.35 + 0.4 * dot(normal, normalize(vec3(-0.5, -1.0, 0.3)));
			color = vec3(relief * (0.8 + height * 0.3));
		} else if (uView == 2) {
			color = normal * 0.5 + 0.5;
		} else if (uView == 3) {
			color = vec3(light) * uLight;
		}
	}
	gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
