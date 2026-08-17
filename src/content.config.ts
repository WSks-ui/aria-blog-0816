import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { POST_KINDS } from './data/site';

const readingWeatherSchema = z.object({
	condition: z.string().trim().min(1),
	temperature: z.number().int().min(-50).max(60).nullable(),
	location: z.string().trim().min(1),
});

const posts = defineCollection({
	loader: glob({
		base: './src/content/posts',
		pattern: '**/*.{md,mdx}',
	}),
	schema: z.object({
		title: z.string().trim().min(1).max(80),
		summary: z.string().trim().min(1).max(220),
		publishedAt: z.coerce.date(),
		updatedAt: z.coerce.date().nullable(),
		tags: z
			.array(z.string().trim().min(1).max(24))
			.min(1)
			.max(8)
			.transform((tags) => [...new Set(tags)]),
		kind: z.enum(POST_KINDS),
		featured: z.boolean(),
		draft: z.boolean(),
		github: z.url().nullable(),
		cover: z.string().trim().min(1).nullable(),
		// 迁移的历史文章没有可核验的天气记录；null 表示未知，避免编造元数据。
		readingWeather: readingWeatherSchema.nullable().default(null),
	}),
});

/**
 * 工具讲义由同步脚本从 CSDIY 上游 Markdown 生成。
 * 这里仅校验来源元数据，不在 schema 或组件中重新组织正文，保证构建结果始终对应
 * 工作树中那份可审计的上游快照。仓库字段兼容几种命名，便于未来同步脚本调整字段名时
 * 不需要改动渲染层；缺失字段不会影响 CSDIY 原文链接，但会在页面中回退到总仓库地址。
 */
const toolGuides = defineCollection({
	loader: glob({
		base: './src/content/tool-guides',
		pattern: '**/*.md',
	}),
	schema: z.object({
		toolId: z.string().trim().min(1),
		title: z.string().trim().min(1),
		sourceUrl: z.url(),
		sourceRevision: z.coerce.string().trim().min(1),
		license: z.coerce.string().trim().min(1),
		sourceRepository: z.url().nullable().optional(),
		sourceRepoUrl: z.url().nullable().optional(),
		upstreamRepository: z.url().nullable().optional(),
		upstreamRepoUrl: z.url().nullable().optional(),
		repositoryUrl: z.url().nullable().optional(),
	}),
});

export const collections = { posts, toolGuides };
