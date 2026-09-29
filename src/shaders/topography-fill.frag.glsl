varying vec4 vColor;
varying float vEdge;
void main() {
	float coverage = clamp(vEdge / max(fwidth(vEdge), 1e-5), 0.0, 1.0);
	gl_FragColor = vec4(vColor.rgb, vColor.a * coverage);
}
