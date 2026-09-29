import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// 纯配置模块不依赖浏览器；通过项目已有 TypeScript 编译器运行，避免额外测试运行时。
const source = readFileSync(new URL('../src/lib/ocean-settings.ts', import.meta.url), 'utf8');
const compiled = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { normalizeParameter, initialTier, renderSize, bloomSizes, FrameBudget, QUALITY_TIERS, DEFAULT_OCEAN_PARAMETERS, OCEAN_FRAME_MS, shouldDrawFrame } =
	await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('参数限制与非有限值回退', () => {
	assert.equal(normalizeParameter('wave', -4), .5);
	assert.equal(normalizeParameter('light', 30), 1.8);
	assert.equal(normalizeParameter('bloom', NaN), DEFAULT_OCEAN_PARAMETERS.bloom);
	assert.equal(normalizeParameter('bloom', Infinity), DEFAULT_OCEAN_PARAMETERS.bloom);
});
test('手动高画质固定1080p，自动与节能保留自适应', () => {
	for (const [w, h, dpr] of [[1920, 1080, 1], [390, 844, 3], [3840, 2160, 2]]) {
		assert.deepEqual(renderSize(w, h, dpr, 2, 'high'), { width: 1920, height: 1080 });
	}
	assert.deepEqual(renderSize(390, 844, 1, 0, 'economy'), { width: 390, height: 844 });
});
test('所有档位共用30FPS严格间隔，首次与延迟帧可渲染', () => {
	assert.equal(OCEAN_FRAME_MS, 1000 / 30);
	assert.equal(shouldDrawFrame(0, null), true);
	assert.equal(shouldDrawFrame(16.67, 0), false);
	assert.equal(shouldDrawFrame(33, 0), false);
	assert.equal(shouldDrawFrame(OCEAN_FRAME_MS, 0), true);
	assert.equal(shouldDrawFrame(100, 0), true);
});
test('桌面、手机与手动画质分级', () => {
	assert.equal(initialTier('auto', false), 2);
	assert.equal(initialTier('auto', true), 0);
	assert.equal(initialTier('high', true), 2);
	assert.equal(initialTier('economy', false), 0);
});
test('像素预算与纵横比', () => {
	for (const [w, h] of [[1920, 1080], [390, 844], [768, 1024], [8192, 8192]]) {
		for (const tier of [0, 1, 2]) {
			const size = renderSize(w, h, 3, tier);
			assert.ok(size.width * size.height <= QUALITY_TIERS[tier].pixels);
			assert.ok(Math.abs(size.width / size.height - w / h) < .01);
		}
	}
	assert.deepEqual(renderSize(NaN, 0, Infinity, 0), { width: 1, height: 1 });
});
test('连续超预算才降档，恢复与重置清空计数', () => {
	const budget = new FrameBudget();
	assert.equal(budget.consider(30, 16.67, 2), 2);
	assert.equal(budget.consider(30, 16.67, 2), 1);
	assert.equal(budget.consider(33.34, 33.34, 1), 1);
	assert.equal(budget.consider(60, 33.34, 1), 1);
	budget.reset();
	assert.equal(budget.consider(60, 33.34, 1), 1);
	assert.equal(budget.consider(60, 33.34, 1), 0);
	assert.equal(budget.consider(60, 33.34, 0), 0);
});

test('泛光四级尺寸处理奇数尺寸与最小帧缓冲', () => {
	assert.deepEqual(bloomSizes(1440, 900), [
		{ width: 720, height: 450 }, { width: 360, height: 225 },
		{ width: 180, height: 112 }, { width: 90, height: 56 },
	]);
	assert.deepEqual(bloomSizes(1, 1), Array.from({ length: 4 }, () => ({ width: 1, height: 1 })));
	assert.deepEqual(bloomSizes(375, 797)[3], { width: 23, height: 49 });
});

test('默认参数处于合法区间且每档保留基础波形采样', () => {
	for (const [key, value] of Object.entries(DEFAULT_OCEAN_PARAMETERS)) {
		assert.equal(normalizeParameter(key, value), value);
	}
	// 求交共享六层低频；法线预算上限对应参考高度场的十层循环。
	assert.ok(QUALITY_TIERS.every((tier) => tier.octaves >= 6 && tier.octaves <= 10));
	assert.equal(QUALITY_TIERS[2].octaves, 10);
});
