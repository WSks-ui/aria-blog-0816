import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import path from 'node:path';

/**
 * 这个脚本是“人工同步”入口，不会被 Astro 构建过程调用。
 *
 * CSDIY 的中文必学工具页面来自 PKUFlyingPig/cs-self-learning，仓库使用 MIT
 * 许可证。同步时固定到 master 当前 commit，而不是把 master 当作永久版本号，
 * 这样每次生成的 frontmatter 都能精确追溯到实际抓取的源码版本；构建阶段只读取
 * 已生成的本地 Markdown，不会因为网络不可用而失败。
 */

const REPOSITORY = 'PKUFlyingPig/cs-self-learning';
const BRANCH = 'master';
const SOURCE_ROOT = 'docs/必学工具';
const GITHUB_API_ROOT = `https://api.github.com/repos/${REPOSITORY}`;
const GITHUB_BLOB_ROOT = `https://github.com/${REPOSITORY}/blob`;
const GITHUB_RAW_ROOT = `https://raw.githubusercontent.com/${REPOSITORY}`;
const OUTPUT_DIRECTORY = fileURLToPath(new URL('../src/content/tool-guides/', import.meta.url));
const LICENSE_OUTPUT = fileURLToPath(new URL('../LICENSES/cs-self-learning-MIT.txt', import.meta.url));
const PUBLIC_LICENSE_OUTPUT = fileURLToPath(new URL('../public/licenses/cs-self-learning-MIT.txt', import.meta.url));
const REVISION_PATTERN = /^[0-9a-f]{40}$/i;
const execFileAsync = promisify(execFile);

/**
 * id 与上游文件名保持显式映射，避免把中文文件名或英文别名的推断逻辑散落到
 * 页面组件中。顺序也与教程页的工具阶段顺序一致，便于生成结果稳定可审查。
 */
const TOOL_SOURCES = [
	{ id: 'scoop', title: 'Scoop', file: 'Scoop.md' },
	{ id: 'vim', title: 'Vim', file: 'Vim.md' },
	{ id: 'emacs', title: 'Emacs', file: 'Emacs.md' },
	{ id: 'git', title: 'Git', file: 'Git.md' },
	{ id: 'github', title: 'GitHub', file: 'GitHub.md' },
	{ id: 'make', title: 'GNU Make', file: 'GNU_Make.md' },
	{ id: 'cmake', title: 'CMake', file: 'CMake.md' },
	{ id: 'docker', title: 'Docker', file: 'Docker.md' },
	{ id: 'latex', title: 'LaTeX', file: 'LaTeX.md' },
	{ id: 'information-retrieval', title: '信息检索', file: '信息检索.md' },
	{ id: 'thesis', title: '毕业论文', file: 'thesis.md' },
	{ id: 'toolbox', title: '实用工具箱', file: 'tools.md' },
	{ id: 'daily-workflow', title: '日常学习工作流', file: 'workflow.md' },
];

const REQUEST_HEADERS = {
	Accept: 'application/vnd.github+json',
	'User-Agent': 'aria7-blog-csdiy-tool-sync',
};

function encodePath(pathname) {
	return pathname
		.split('/')
		.map((segment) => {
			try {
				return encodeURIComponent(decodeURIComponent(segment));
			} catch {
				return encodeURIComponent(segment);
			}
		})
		.join('/');
}

function githubBlobUrl(revision, repositoryPath) {
	return `${GITHUB_BLOB_ROOT}/${revision}/${encodePath(repositoryPath)}`;
}

function githubRawUrl(revision, repositoryPath) {
	return `${GITHUB_RAW_ROOT}/${revision}/${encodePath(repositoryPath)}`;
}

async function runGit(args, cwd) {
	return execFileAsync('git', args, {
		...(cwd ? { cwd } : {}),
		timeout: 60_000,
		maxBuffer: 16 * 1024 * 1024,
	});
}

async function fetchText(url) {
	let response;
	try {
		response = await fetch(url, { headers: REQUEST_HEADERS });
	} catch (error) {
		const cause = error?.cause;
		const detail = cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : String(error));
		throw new Error(`网络请求异常（${detail}）: ${url}`, { cause: error });
	}
	if (!response.ok) {
		throw new Error(`请求失败 ${response.status} ${response.statusText}: ${url}`);
	}
	return response.text();
}

async function fetchJson(url) {
	return JSON.parse(await fetchText(url));
}

function validateRevision(revision, source) {
	if (typeof revision !== 'string' || !REVISION_PATTERN.test(revision)) {
		throw new Error(`${source} 返回的 commit SHA 无效: ${JSON.stringify(revision)}`);
	}
	return revision;
}

async function fetchRevisionFromGit() {
	// Git 智能协议不消耗 GitHub REST API 的匿名请求额度。API 临时限流时，仍可得到
	// master 的精确 SHA，随后所有正文均从该 SHA 对应的 raw 文件拉取。
	const { stdout } = await runGit(['ls-remote', `https://github.com/${REPOSITORY}.git`, `refs/heads/${BRANCH}`]);
	const revision = stdout.trim().split(/\s+/)[0];
	return validateRevision(revision, 'git ls-remote');
}

async function fetchExistingSnapshotRevision() {
	try {
		const existingGuide = await readFile(path.join(OUTPUT_DIRECTORY, 'git.md'), 'utf8');
		const revision = existingGuide.match(/^sourceRevision:\s*["']?([0-9a-f]{40})["']?\s*$/im)?.[1];
		return revision ? validateRevision(revision, '现有工具快照') : undefined;
	} catch (error) {
		if (error?.code === 'ENOENT') {
			return undefined;
		}
		throw error;
	}
}

async function fetchRevision() {
	const configuredRevision = process.env.CSDIY_REVISION?.trim();
	if (configuredRevision) {
		return validateRevision(configuredRevision, 'CSDIY_REVISION');
	}

	try {
		return await fetchRevisionFromGit();
	} catch (gitError) {
		console.warn(`无法通过 git 获取上游版本，将尝试 GitHub API：${gitError instanceof Error ? gitError.message : String(gitError)}`);
	}

	try {
		const payload = await fetchJson(`${GITHUB_API_ROOT}/commits/${BRANCH}`);
		return validateRevision(payload.sha, 'GitHub API');
	} catch (apiError) {
		const snapshotRevision = await fetchExistingSnapshotRevision();
		if (snapshotRevision) {
			// 最后一层回退只复现当前工作树已经审查过的固定版本，绝不静默切换到未记录的
			// branch 内容。维护者可在网络恢复后再次运行脚本来获取新的上游版本。
			console.warn(`无法获取最新上游版本，复用现有快照 ${snapshotRevision.slice(0, 12)}：${apiError instanceof Error ? apiError.message : String(apiError)}`);
			return snapshotRevision;
		}
		throw new Error(`无法获取 CSDIY 上游版本：${apiError instanceof Error ? apiError.message : String(apiError)}`, { cause: apiError });
	}
}

function decodeContentsPayload(payload, sourcePath) {
	if (payload.encoding !== 'base64' || typeof payload.content !== 'string') {
		throw new Error(`GitHub Contents API 未返回可解码的 base64 内容: ${sourcePath}`);
	}
	return Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

async function fetchSourceMarkdown(revision, sourcePath) {
	try {
		// 正文优先走固定 SHA 的 raw 地址：请求少、内容就是 CSDIY 构建前的原始 Markdown，
		// 并且不会因匿名 REST API 限流而中断整次同步。
		return await fetchText(githubRawUrl(revision, sourcePath));
	} catch (rawError) {
		console.warn(`raw 文件拉取失败，改用 Contents API：${sourcePath}`);
		const endpoint = `${GITHUB_API_ROOT}/contents/${encodePath(sourcePath)}?ref=${revision}`;
		try {
			return decodeContentsPayload(await fetchJson(endpoint), sourcePath);
		} catch (apiError) {
			throw new Error(`无法拉取上游正文 ${sourcePath}；raw 错误：${rawError instanceof Error ? rawError.message : String(rawError)}；API 错误：${apiError instanceof Error ? apiError.message : String(apiError)}`, { cause: apiError });
		}
	}
}

async function fetchSourceLicense(revision) {
	try {
		return (await fetchText(githubRawUrl(revision, 'LICENSE'))).trimEnd();
	} catch (rawError) {
		console.warn('raw 许可证拉取失败，改用 Contents API。');
		const endpoint = `${GITHUB_API_ROOT}/contents/LICENSE?ref=${revision}`;
		try {
			return decodeContentsPayload(await fetchJson(endpoint), 'LICENSE').trimEnd();
		} catch (apiError) {
			throw new Error(`无法拉取上游 MIT 许可证；raw 错误：${rawError instanceof Error ? rawError.message : String(rawError)}；API 错误：${apiError instanceof Error ? apiError.message : String(apiError)}`, { cause: apiError });
		}
	}
}

async function fetchUpstreamSourcesFromGit(revision) {
	const temporaryRepository = await mkdtemp(path.join(tmpdir(), 'aria7-csdiy-tools-'));
	try {
		// 一个临时的裸工作目录只拉取目标提交及其树对象。相比逐份下载 raw 文件，
		// 它只建立一次网络连接，也不会受到 GitHub REST API 匿名限流影响。
		await runGit(['init', '--quiet'], temporaryRepository);
		await runGit(['remote', 'add', 'origin', `https://github.com/${REPOSITORY}.git`], temporaryRepository);
		await runGit(['fetch', '--quiet', '--no-tags', '--depth=1', 'origin', revision], temporaryRepository);

		const { stdout: license } = await runGit(['show', `${revision}:LICENSE`], temporaryRepository);
		const markdownByPath = new Map();
		for (const tool of TOOL_SOURCES) {
			const sourcePath = `${SOURCE_ROOT}/${tool.file}`;
			const { stdout } = await runGit(['show', `${revision}:${sourcePath}`], temporaryRepository);
			markdownByPath.set(sourcePath, stdout);
		}

		return { license: license.trimEnd(), markdownByPath };
	} finally {
		// 只删除本函数通过 mkdtemp 创建的系统临时目录；不接触工作树或任何用户文件。
		await rm(temporaryRepository, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
	}
}

async function fetchUpstreamSources(revision) {
	try {
		return await fetchUpstreamSourcesFromGit(revision);
	} catch (gitError) {
		console.warn(`无法通过 Git 拉取完整上游快照，改为顺序下载固定版本文件：${gitError instanceof Error ? gitError.message : String(gitError)}`);
	}

	// Git 环境缺失或网络策略阻断 Git 协议时，按顺序而非并发请求 raw 文件，避免 Windows
	// 环境对同一主机建立过多连接导致超时。单文件仍会在 raw 失败后回退 Contents API。
	const markdownByPath = new Map();
	const license = await fetchSourceLicense(revision);
	for (const tool of TOOL_SOURCES) {
		const sourcePath = `${SOURCE_ROOT}/${tool.file}`;
		markdownByPath.set(sourcePath, await fetchSourceMarkdown(revision, sourcePath));
	}
	return { license, markdownByPath };
}

function stripExistingFrontmatter(markdown) {
	const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
	const lines = normalized.split('\n');
	if (lines[0]?.trim() !== '---') {
		return normalized;
	}

	const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
	if (end === -1) {
		throw new Error('检测到 frontmatter 起始标记，但没有找到结束标记 ---');
	}

	// 上游 frontmatter 属于元数据，不是正文；统一移除后由本脚本写入可追溯字段，
	// 这样 Astro 内容集合不会遇到重复字段，也不会把上游的发布日期误当作本站数据。
	return lines.slice(end + 1).join('\n').replace(/^\n+/, '');
}

function splitDestination(rawDestination) {
	const value = rawDestination.trim();
	if (value.startsWith('<')) {
		const end = value.indexOf('>');
		if (end !== -1) {
			return { target: value.slice(1, end), suffix: value.slice(end + 1) };
		}
	}
	const match = value.match(/^(\S+)([\s\S]*)$/);
	return match ? { target: match[1], suffix: match[2] } : { target: value, suffix: '' };
}

function splitQueryAndFragment(target) {
	const index = target.search(/[?#]/);
	return index === -1
		? { pathname: target, suffix: '' }
		: { pathname: target.slice(0, index), suffix: target.slice(index) };
}

function isExternalDestination(target) {
	return (
		target === '' ||
		target.startsWith('#') ||
		target.startsWith('/') ||
		target.startsWith('//') ||
		/^(?:[a-z][a-z\d+.-]*:)/i.test(target)
	);
}

function resolveRepositoryPath(sourcePath, relativePath) {
	const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), relativePath));
	return resolved.startsWith('./') ? resolved.slice(2) : resolved;
}

function transformDestination(rawDestination, sourcePath, revision, isImage) {
	const { target, suffix } = splitDestination(rawDestination);
	if (isExternalDestination(target)) {
		return rawDestination;
	}

	const { pathname, suffix: pathSuffix } = splitQueryAndFragment(target);
	if (!pathname || pathname.startsWith('/')) {
		return rawDestination;
	}

	const repositoryPath = resolveRepositoryPath(sourcePath, pathname);
	const converted = isImage
		? githubRawUrl(revision, repositoryPath)
		: githubBlobUrl(revision, repositoryPath);

	// 保留 Markdown 链接原有的标题、查询参数与锚点；只替换相对路径本身。
	return `${converted}${pathSuffix}${suffix}`;
}

function transformMarkdownLinks(markdown, sourcePath, revision) {
	const lines = markdown.split('\n');
	let fenced = false;

	return lines
		.map((line) => {
			if (/^\s{0,3}(```+|~~~+)/.test(line)) {
				fenced = !fenced;
				return line;
			}
			if (fenced) {
				return line;
			}

			let transformed = line.replace(/(!?\[[^\]]*\]\()([^\n)]+)(\))/g, (_match, prefix, destination, suffix) => {
				const isImage = prefix.startsWith('!');
				return `${prefix}${transformDestination(destination, sourcePath, revision, isImage)}${suffix}`;
			});

			// Markdown 引用式链接和少量内嵌 HTML 不会被上面的 inline 规则覆盖，
			// 这里一并转换相对地址；代码块已经在上面跳过，不会篡改示例命令。
			transformed = transformed.replace(/^(\s*\[[^\]]+\]:\s+)(\S+)(.*)$/g, (_match, prefix, destination, suffix) => {
				return `${prefix}${transformDestination(destination, sourcePath, revision, false)}${suffix}`;
			});
			transformed = transformed.replace(/(\b(?:src|href)=['"])([^'"]+)(['"])/gi, (_match, prefix, destination, suffix) => {
				return `${prefix}${transformDestination(destination, sourcePath, revision, prefix.toLowerCase().includes('src='))}${suffix}`;
			});
			return transformed;
		})
		.join('\n');
}

/**
 * 上游历史 Markdown 中有一条脚注定义把标签写成了 `[^ 1]`，并把一个失效的
 * GitHub 路径和知乎链接拼成了嵌套链接。这个形态不会被 Markdown 解析器识别为
 * 脚注，最终会以普通文本和错误嵌套的 `<a>` 标签输出。同步时统一修正标签空格，
 * 并在检测到该类嵌套链接时保留真正可访问的目标链接，避免手工修改快照后再次复发。
 */
function normalizeFootnoteDefinitions(markdown) {
	return markdown
		.split('\n')
		.map((line) => {
			const label = line.match(/^(\s*)\[\^\s+(\d+)\]:\s*(.*)$/);
			if (!label) {
				return line;
			}

			const [, indentation, number, definition] = label;
			const nestedLink = definition.match(/^https?:\/\/[^\s]+\]\((https?:\/\/[^)]+)\)$/);
			return nestedLink
				? `${indentation}[^${number}]: ${nestedLink[1]}`
				: `${indentation}[^${number}]: ${definition}`;
		})
		.join('\n');
}

function yamlString(value) {
	return JSON.stringify(value);
}

function makeDocument(tool, revision, body) {
	const sourcePath = `${SOURCE_ROOT}/${tool.file}`;
	const sourceUrl = githubBlobUrl(revision, sourcePath);
	const frontmatter = [
		'---',
		`toolId: ${yamlString(tool.id)}`,
		`title: ${yamlString(tool.title)}`,
		`sourceUrl: ${yamlString(sourceUrl)}`,
		`sourceRevision: ${yamlString(revision)}`,
		`license: ${yamlString('MIT')}`,
		`sourceRepository: ${yamlString(`https://github.com/${REPOSITORY}/`)}`,
		'---',
		'',
	].join('\n');
	return `${frontmatter}${body.trimEnd()}\n`;
}

async function sync() {
	const revision = await fetchRevision();
	// 先把许可证和全部正文完整拉取到内存。任一上游文件失败时不会留下“只更新了一半”的
	// 内容目录，下一次同步仍能从上一次完整快照恢复。
	const upstream = await fetchUpstreamSources(revision);
	const documents = TOOL_SOURCES.map((tool) => {
		const sourcePath = `${SOURCE_ROOT}/${tool.file}`;
		const upstreamMarkdown = upstream.markdownByPath.get(sourcePath);
		if (typeof upstreamMarkdown !== 'string') {
			throw new Error(`上游快照缺少工具正文：${sourcePath}`);
		}
		const body = normalizeFootnoteDefinitions(
			transformMarkdownLinks(stripExistingFrontmatter(upstreamMarkdown), sourcePath, revision),
		);
		return { tool, sourcePath, output: makeDocument(tool, revision, body) };
	});
	const upstreamLicense = upstream.license;
	const licenseNotice = `${upstreamLicense}\n\nUpstream source: ${githubBlobUrl(revision, 'LICENSE')}\nSynchronized from commit: ${revision}\n`;

	// LICENSES 保留在源码仓库中，public/licenses 则随静态站点发布。两份内容必须来自
	// 同一个上游 revision，才能同时满足源代码审计与访客查看许可文本这两种分发场景。
	await mkdir(path.dirname(LICENSE_OUTPUT), { recursive: true });
	await mkdir(path.dirname(PUBLIC_LICENSE_OUTPUT), { recursive: true });
	await Promise.all([
		writeFile(LICENSE_OUTPUT, licenseNotice, 'utf8'),
		writeFile(PUBLIC_LICENSE_OUTPUT, licenseNotice, 'utf8'),
		...documents.map(({ tool, output }) => writeFile(path.join(OUTPUT_DIRECTORY, `${tool.id}.md`), output, 'utf8')),
	]);

	for (const { tool, sourcePath } of documents) {
		console.log(`已同步 ${tool.id.padEnd(20)} ${revision.slice(0, 12)}  ${sourcePath}`);
	}

	console.log(`\n同步完成：${TOOL_SOURCES.length} 份工具讲义 -> ${OUTPUT_DIRECTORY}`);
	console.log('正文来源：PKUFlyingPig/cs-self-learning（MIT）；构建阶段不会发起网络请求。');
}

sync().catch((error) => {
	console.error(`同步失败：${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
