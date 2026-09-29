varying vec2 vUv;
uniform sampler2D tHeight;
uniform float uTile;
uniform float uTexel;
uniform vec2 uCenter;
uniform vec2 uSpan;
uniform vec2 uResolution;
uniform float uDensity;
uniform float uGrid;
uniform float uLineScale;

float heightAt(vec2 p) { return texture2D(tHeight, p / uTile).r; }
// d 与 w 都以 CSS 像素计：解析抗锯齿，线宽不随缩放或画质档位变化。
float lineScale;
float stroke(float d, float w) { w *= lineScale; return 1.0 - smoothstep(w * .5 - .5, w * .5 + .5, d); }

void main() {
	// 世界坐标以网格单元为单位；uCenter 已按 TILE 取模，长时间漂移也不损失精度。
	vec2 p = uCenter + (vUv - .5) * uSpan;
	float px = uSpan.y / uResolution.y;
	lineScale = uLineScale;
	float h = heightAt(p);
	float e = uTexel;
	vec2 g = vec2(heightAt(p + vec2(e, 0)) - heightAt(p - vec2(e, 0)),
		heightAt(p + vec2(0, e)) - heightAt(p - vec2(0, e))) / (2.0 * e);
	// 每像素的高度变化；距离 = 高度差 / 斜率，得到到等值线的像素距离。
	float slope = max(length(g) * px, 1e-6);

	// 海岸线与陆地内部等高线亮度接近，只是略粗略亮一档；海面保持纯黑。
	float coast = stroke(abs(h) / slope, 1.25);
	float interval = .042 / uDensity;
	float q = h / interval;
	float level = floor(q + .5);
	float dq = abs(q - level) * interval / slope;
	float major = 1.0 - step(.5, mod(level, 5.0));
	// 像素覆盖多个间隔时淡出，防止陡坡挤成摩尔纹。
	float fade = 1.0 - smoothstep(.3, .7, slope / interval);
	float contour = stroke(dq, 1.0 + .3 * major) * step(.5, level) * fade;

	// 网格线细而清楚，交点是小亮点。
	vec2 f = abs(fract(p + .5) - .5);
	vec2 gd = f / px;
	float grid = max(stroke(gd.x, 1.0), stroke(gd.y, 1.0));
	float dots = 1.0 - smoothstep(.9, 2.1 * lineScale, length(f) / px);

	vec3 col = vec3(.0016, .0017, .002);
	col += uGrid * (vec3(.13, .135, .145) * grid + vec3(.85) * dots);
	col += vec3(.31, .32, .335) * contour * (1.0 + .6 * major);
	col += vec3(.64, .66, .68) * coast;
	gl_FragColor = vec4(col, 1.0);
}
