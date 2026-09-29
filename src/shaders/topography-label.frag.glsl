uniform sampler2D tAtlas;
varying vec2 vUv;
varying float vAlpha;
void main() {
	vec4 c = texture2D(tAtlas, vUv);
	gl_FragColor = vec4(c.rgb, c.a * vAlpha);
}
