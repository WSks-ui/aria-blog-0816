uniform float uOpacity;
varying float vSide;
varying float vProgress;
varying float vDistance;
varying float vWidth;
varying float vHead;
varying float vAlpha;
varying vec2 vExtra;
varying vec3 vColor;
void main() {
	if (vHead <= 0.0 || vProgress > vHead + .0005 || vAlpha <= 0.0) discard;
	if (vExtra.y > 0.0 && fract(vDistance / vExtra.y) > .55) discard;
	float d = abs(vSide) * (vWidth * .5 + 1.0);
	float coverage = 1.0 - smoothstep(vWidth * .5 - .5, vWidth * .5 + .5, d);
	// tail > 0：线头附近更亮，表示正在推进的尾迹或弹头。
	float glow = vExtra.x > 0.0 ? .55 + 1.1 * exp(-(vHead - vProgress) / vExtra.x) : 1.0;
	gl_FragColor = vec4(vColor * glow, coverage * vAlpha * uOpacity);
}
