import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

import { SITE, type PostKind } from '../data/site';
import { getPostPath, getPosts } from '../lib/content';

export const prerender = true;

// 分类输出中文标签，与站内 KindLabel 保持同一套说法。
const KIND_LABELS: Record<PostKind, string> = {
	essay: '随笔',
	note: '学习笔记',
	project: '项目',
	photo: '摄影与插画',
	code: '代码笔记',
	tutorial: '指南',
};

export async function GET(context: APIContext) {
	const posts = await getPosts();
	const feedUrl = new URL(SITE.feedPath, context.site ?? SITE.url).toString();

	return rss({
		title: SITE.title,
		description: SITE.description,
		site: context.site ?? SITE.url,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.summary,
			pubDate: post.data.publishedAt,
			link: getPostPath(post),
			categories: [KIND_LABELS[post.data.kind] ?? post.data.kind, ...post.data.tags],
		})),
		customData: [
			`<language>${SITE.locale}</language>`,
			// 频道级更新时间取最新文章日期；阅读器以此判断新鲜度。
			`<lastBuildDate>${(posts[0]?.data.publishedAt ?? new Date()).toUTCString()}</lastBuildDate>`,
			// RSS 校验器推荐的自引用；href 必须是 feed 自身的绝对地址。
			`<atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />`,
		].join(''),
		xmlns: { atom: 'http://www.w3.org/2005/Atom' },
	});
}
