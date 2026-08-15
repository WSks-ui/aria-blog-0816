import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

import { SITE } from '../data/site';
import { getPostPath, getPosts } from '../lib/content';

export const prerender = true;

export async function GET(context: APIContext) {
	const posts = await getPosts();

	return rss({
		title: SITE.title,
		description: SITE.description,
		site: context.site ?? SITE.url,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.summary,
			pubDate: post.data.publishedAt,
			link: getPostPath(post),
			categories: [post.data.kind, ...post.data.tags],
		})),
		customData: `<language>${SITE.locale}</language>`,
	});
}
