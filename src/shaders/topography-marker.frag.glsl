uniform float uWorldPixel;
uniform float uLineScale;
varying vec2 vLocal;
varying vec4 vShape; // radius, widthPx, kind, dash
varying vec4 vArc;   // from, sweep, halfLength, 0
varying vec4 vColor;
void main() {
	vec2 p = vLocal;
	float r = vShape.x;
	float px = uWorldPixel;
	float w = vShape.y * uLineScale * px;
	int kind = int(vShape.z + .5);
	float d;
	if (kind == 0) d = abs(length(p) - r) - w * .5;
	else if (kind == 1) d = length(p) - r;
	else if (kind == 2) d = abs(max(abs(p.x), abs(p.y)) - r) - w * .5;
	else if (kind == 3) d = max(abs(p.x), abs(p.y)) - r;
	else if (kind == 4) {
		// 角框：方框只保留四个角。
		d = abs(max(abs(p.x), abs(p.y)) - r) - w * .5;
		if (min(abs(p.x), abs(p.y)) < r * .45) discard;
	} else if (kind == 5) {
		d = length(vec2(max(abs(p.x) - vArc.z, 0.0), p.y)) - w * .5;
		if (vShape.w > 0.0 && fract((p.x + vArc.z) / vShape.w) > .55) discard;
	} else {
		d = min(max(abs(p.x) - r, abs(p.y)), max(abs(p.y) - r, abs(p.x))) - w * .5;
	}
	if (kind == 0 && vArc.y < 1.0) {
		float a = mod(atan(p.y, p.x) - vArc.x, 6.2831853) / 6.2831853;
		if (a > vArc.y) discard;
	}
	if ((kind == 0 || kind == 2) && vShape.w > 0.0) {
		// 虚线沿轮廓计长：圆环用弧长，方框用所在边的平行坐标。
		float s = kind == 0 ? atan(p.y, p.x) * r : (abs(p.x) > abs(p.y) ? p.y : p.x);
		if (fract(s / vShape.w) > .55) discard;
	}
	float coverage = 1.0 - smoothstep(-.5 * px, .5 * px, d);
	if (coverage <= 0.0) discard;
	gl_FragColor = vec4(vColor.rgb, vColor.a * coverage);
}
