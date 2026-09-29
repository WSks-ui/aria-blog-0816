import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/topography-settings.ts', import.meta.url), 'utf8');
const compiled = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { normalizeTopographyParameter, topographyRenderSize, topographyFraming, TOPOGRAPHY_DEFAULTS, TOPOGRAPHY_REFERENCE_CELL } =
	await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('俯视图参数限制与非有限值回退', () => {
	assert.equal(normalizeTopographyParameter('glow', -1), 0);
	assert.equal(normalizeTopographyParameter('density', 5), 1.45);
	assert.equal(normalizeTopographyParameter('zoom', 0), .7);
	for (const [key, value] of Object.entries(TOPOGRAPHY_DEFAULTS)) {
		assert.equal(normalizeTopographyParameter(key, NaN), value);
		assert.equal(normalizeTopographyParameter(key, Infinity), value);
		assert.equal(normalizeTopographyParameter(key, value), value);
	}
});
test('缓冲按设备像素原生渲染，只受 GPU 尺寸上限约束', () => {
	assert.deepEqual(topographyRenderSize(), { width: 1920, height: 1080, scale: 1 });
	assert.deepEqual(topographyRenderSize(1707, 1067, 1.5), { width: 2561, height: 1601, scale: 1.5 });
	assert.deepEqual(topographyRenderSize(390, 844, 3), { width: 1170, height: 2532, scale: 3 });
	const capped = topographyRenderSize(3840, 2160, 3, 8192);
	assert.equal(capped.width, 8192);
	assert.ok(Math.abs(capped.width / capped.height - 16 / 9) < .01);
});
test('正交相机保持显示比例，16:9 与参考视频的网格尺寸一致', () => {
	assert.equal(topographyFraming(1920, 1080).cell, TOPOGRAPHY_REFERENCE_CELL);
	assert.ok(Math.abs(topographyFraming(2560, 1440).cell - TOPOGRAPHY_REFERENCE_CELL * 4 / 3) < 1e-9);
	for (const [w, h] of [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [320, 667], [3840, 2160]]) {
		const f = topographyFraming(w, h);
		assert.ok(Math.abs(f.spanX / f.spanY - w / h) < 1e-8);
		// 任何比例显示的地图面积都与参考画面相同。
		assert.ok(Math.abs(f.spanX * f.spanY - (1920 / 92) * (1080 / 92)) < 1e-6);
		const zoomed = topographyFraming(w, h, 1.5);
		assert.ok(Math.abs(zoomed.spanY * 1.5 - f.spanY) < 1e-8);
	}
});
