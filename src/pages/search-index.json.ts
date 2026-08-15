import type { APIRoute } from 'astro';

import { getPostPath, getPosts } from '../lib/content';

export const prerender = true;

export const GET: APIRoute = async () => {
	const posts = await getPosts();
	const index = posts.map((post) => ({
		title: post.data.title,
		summary: post.data.summary,
		tags: post.data.tags,
		kind: post.data.kind,
		url: getPostPath(post),
		// 原始正文只参与客户端匹配，结果卡仍展示 summary；新增 Markdown 语法不会破坏索引生成。
		content: post.body ?? '',
	}));

	return new Response(JSON.stringify(index), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'public, max-age=0, must-revalidate',
		},
	});
};
