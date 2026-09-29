// 每帧由 CPU 写入的矢量标记：圆环、实心点、方框、角框、线段、十字。
// aLocal 是片元相对标记中心的世界坐标（线段为沿线 / 垂线坐标）；距离场在片元里求，线宽以 CSS 像素计。
attribute vec2 aLocal;
attribute vec4 aShape;
attribute vec4 aArc;
attribute vec4 aColor;
varying vec2 vLocal;
varying vec4 vShape;
varying vec4 vArc;
varying vec4 vColor;
void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	vLocal = aLocal;
	vShape = aShape;
	vArc = aArc;
	vColor = aColor;
}
