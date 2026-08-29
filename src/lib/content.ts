import { getCollection, type CollectionEntry } from 'astro:content';

import type { PostKind } from '../data/site';

export type PostEntry = CollectionEntry<'posts'>;

export interface PostFilters {
	kind?: PostKind | readonly PostKind[];
	tag?: string;
	tags?: readonly string[];
	featured?: boolean;
	includeDrafts?: boolean;
	publishedFrom?: Date;
	publishedTo?: Date;
}

export interface RelatedPost {
	post: PostEntry;
	score: number;
}

const normalizeTag = (tag: string) => tag.trim().toLocaleLowerCase();

const asArray = <T>(value: T | readonly T[] | undefined): readonly T[] => {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value as T];
};

/**
 * 统一文章顺序：首次发布时间倒序；时间相同则按更新时间、标题和 id 保证构建结果稳定。
 * 返回新数组，调用方可以安全复用传入的集合。
 */
export function sortPosts(posts: readonly PostEntry[]): PostEntry[] {
	return [...posts].sort((left, right) => {
		const publishedDelta = right.data.publishedAt.getTime() - left.data.publishedAt.getTime();
		if (publishedDelta !== 0) return publishedDelta;

		const leftUpdated = left.data.updatedAt?.getTime() ?? left.data.publishedAt.getTime();
		const rightUpdated = right.data.updatedAt?.getTime() ?? right.data.publishedAt.getTime();
		const updatedDelta = rightUpdated - leftUpdated;
		if (updatedDelta !== 0) return updatedDelta;

		const titleDelta = left.data.title.localeCompare(right.data.title, 'zh-CN');
		return titleDelta !== 0 ? titleDelta : left.id.localeCompare(right.id);
	});
}

/**
 * 所有面向访客的查询默认剔除草稿。只有预览页或编辑工具应显式传入 includeDrafts。
 * 多个 tags 采用“命中任一标签”的语义，便于标签聚合页复用。
 */
export function filterPosts(posts: readonly PostEntry[], filters: PostFilters = {}): PostEntry[] {
	const kinds = asArray(filters.kind);
	const requestedTags = [filters.tag, ...(filters.tags ?? [])]
		.filter((tag): tag is string => Boolean(tag?.trim()))
		.map(normalizeTag);

	return posts.filter((post) => {
		if (!filters.includeDrafts && post.data.draft) return false;
		if (filters.featured !== undefined && post.data.featured !== filters.featured) return false;
		if (kinds.length > 0 && !kinds.includes(post.data.kind)) return false;

		if (requestedTags.length > 0) {
			const postTags = new Set(post.data.tags.map(normalizeTag));
			if (!requestedTags.some((tag) => postTags.has(tag))) return false;
		}

		const publishedAt = post.data.publishedAt.getTime();
		if (filters.publishedFrom && publishedAt < filters.publishedFrom.getTime()) return false;
		if (filters.publishedTo && publishedAt > filters.publishedTo.getTime()) return false;

		return true;
	});
}

export async function getPosts(filters: PostFilters = {}): Promise<PostEntry[]> {
	const posts = await getCollection('posts');
	return sortPosts(filterPosts(posts, filters));
}

export function getPostSlug(post: PostEntry): string {
  return post.id.replace(/\.(?:md|mdx)$/i, '').replaceAll('\\', '/');
}

/*
 * 文章共享元素转场名：列表行标题与文章页 H1 各持同一名字，ClientRouter
 * 换页时浏览器据此对插值位置完成标题飞行。view-transition-name 要求合法
 * 的 CSS custom-ident；标识符允许非 ASCII 字母，因此中日文 slug 原样保留
 * （只剔除空白与符号），避免多篇中文标题塌缩成同一个名字。前后缀保证
 * 不以数字或连字符开头。
 */
export function getPostTransitionName(post: PostEntry): string {
  const slug = getPostSlug(post)
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `aria7-post-${slug || 'untitled'}`;
}

/**
 * 全站统一的阅读时长估算：中文按单字、拉丁按词计数（与 SceneGuide 的运行时
 * 算法一致），围栏与行内代码不计入。列表页与正文侧栏显示同一篇文章的分钟数
 * 必须一致，因此构建侧与运行时都以此为唯一口径。
 */
export function estimateReadingMinutes(body: string, unitsPerMinute = 300): number {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
  const cjkUnits = (plain.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const latinUnits = (plain
    .replace(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    .match(/[\p{Letter}\p{Number}]+/gu) ?? []).length;
  return Math.max(1, Math.ceil((cjkUnits + latinUnits) / Math.max(100, unitsPerMinute)));
}

export function getPostPath(post: PostEntry): string {
	return `/posts/${getPostSlug(post)}/`;
}

export async function getPostsByKind(kind: PostKind, filters: Omit<PostFilters, 'kind'> = {}) {
	return getPosts({ ...filters, kind });
}

/**
 * 同栏目内的上一篇/下一篇：沿用 sortPosts 的全站时间排序，previous 指向更早
 * 发布的一篇，next 指向更新的一篇。草稿已被 getPosts 过滤；当前文章不存在于
 * 列表（例如预览态）时返回空对象，页脚续读区随之整体隐藏。
 */
export async function getAdjacentPosts(
	current: PostEntry,
): Promise<{ previous?: PostEntry; next?: PostEntry }> {
	const posts = await getPosts({ kind: current.data.kind });
	const index = posts.findIndex((post) => post.id === current.id);
	if (index === -1) return {};
	return {
		previous: index + 1 < posts.length ? posts[index + 1] : undefined,
		next: index > 0 ? posts[index - 1] : undefined,
	};
}

export async function getPostsByTag(tag: string, filters: Omit<PostFilters, 'tag' | 'tags'> = {}) {
	return getPosts({ ...filters, tag });
}

/**
 * 相关文章优先级由共同标签决定，其次考虑内容类型和精选状态。
 * 分值相同时沿用全站文章时间顺序，避免每次构建出现随机跳动。
 */
export function rankRelatedPosts(
	current: PostEntry,
	candidates: readonly PostEntry[],
	limit = 3,
): RelatedPost[] {
	const currentTags = new Set(current.data.tags.map(normalizeTag));
	const ranked = candidates
		.filter((candidate) => candidate.id !== current.id && !candidate.data.draft)
		.map((candidate) => {
			const sharedTags = candidate.data.tags.reduce(
				(count, tag) => count + Number(currentTags.has(normalizeTag(tag))),
				0,
			);
			const sameKind = candidate.data.kind === current.data.kind ? 1 : 0;
			const score = sharedTags * 4 + sameKind * 2 + Number(candidate.data.featured) * 0.25;
			return { post: candidate, score };
		})
		.filter((candidate) => candidate.score > 0)
		.sort((left, right) => {
			const scoreDelta = right.score - left.score;
			if (scoreDelta !== 0) return scoreDelta;
			return sortPosts([left.post, right.post])[0]?.id === left.post.id ? -1 : 1;
		});

	return ranked.slice(0, Math.max(0, Math.floor(limit)));
}

export async function getRelatedPosts(current: PostEntry, limit = 3): Promise<PostEntry[]> {
	const posts = await getCollection('posts');
	return rankRelatedPosts(current, posts, limit).map(({ post }) => post);
}

export function collectTagCounts(posts: readonly PostEntry[]) {
	const tags = new Map<string, { label: string; count: number }>();

	for (const post of posts) {
		if (post.data.draft) continue;
		for (const label of post.data.tags) {
			const key = normalizeTag(label);
			const current = tags.get(key);
			tags.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
		}
	}

	return [...tags.values()].sort(
		(left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'),
	);
}
