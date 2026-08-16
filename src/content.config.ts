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

export const collections = { posts };
