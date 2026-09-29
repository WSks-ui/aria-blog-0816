// 每帧由 CPU 写入的实心图形（机体、舰船、地面单位）。多边形以内部点做扇形三角化，
// aEdge 在外缘为 0、内部点为 1，片元里按屏幕导数做约 1 像素的边缘抗锯齿。
attribute vec4 aColor;
attribute float aEdge;
varying vec4 vColor;
varying float vEdge;
void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	vColor = aColor;
	vEdge = aEdge;
}
