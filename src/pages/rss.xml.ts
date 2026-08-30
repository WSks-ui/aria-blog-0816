import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

import { POST_KIND_META, SITE } from '@/data/site';
import { getPostPath, getPosts } from '@/lib/content';

export const prerender = true;

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
			// 分类用栏目全名（与站内 KindLabel 的中文段同源）；与栏目同名
			// 的标签不再重复输出一份 category。
			categories: [
				POST_KIND_META[post.data.kind].longLabel,
				...post.data.tags.filter((tag) => tag !== POST_KIND_META[post.data.kind].longLabel),
			],
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
