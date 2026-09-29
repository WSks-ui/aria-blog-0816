// 静态线带：尾迹、射程圈外的弹道、鱼雷航迹。几何只在初始化时生成，逐段出现与尾迹推进都由顶点属性驱动。
// aLine = (side, progress, distance, widthPx)；aTime = (start, duration, end, fade)；aExtra = (tail, dash, trail, lift)。
// lift 为透视抬升：参考画面是正俯视的透视相机，离地的航迹从画面中心向外放大 1 + lift 倍（镜头在原点）。
// trail ≥ 0 时线头取 uHeads[trail]（跟随移动单位），否则按 start / duration 画出。
attribute vec2 aNormal;
attribute vec4 aLine;
attribute vec4 aTime;
attribute vec4 aExtra;
attribute vec3 aColor;
uniform float uWorldPixel;
uniform float uLineScale;
uniform float uLocal;
uniform float uHeads[HEADS];
varying float vSide;
varying float vProgress;
varying float vDistance;
varying float vWidth;
varying float vHead;
varying float vAlpha;
varying vec2 vExtra;
varying vec3 vColor;
void main() {
	float width = aLine.w * uLineScale;
	vec3 p = position;
	p.xy += aNormal * aLine.x * (width * .5 + 1.0) * uWorldPixel;
	vec4 world = modelMatrix * vec4(p, 1.0);
	world.xy *= 1.0 + aExtra.w;
	gl_Position = projectionMatrix * viewMatrix * world;
	int trail = int(aExtra.z + .5);
	vHead = aExtra.z >= 0.0 ? uHeads[trail] : clamp((uLocal - aTime.x) / max(aTime.y, .001), 0.0, 1.0);
	vAlpha = 1.0 - clamp((uLocal - aTime.z) / max(aTime.w, .001), 0.0, 1.0);
	vSide = aLine.x;
	vProgress = aLine.y;
	vDistance = aLine.z;
	vWidth = width;
	vExtra = aExtra.xy;
	vColor = aColor;
}
