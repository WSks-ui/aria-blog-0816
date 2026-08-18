/**
 * 指南页的工具目录独立于文章集合：工具没有发布日期、天气、RSS 等文章语义，
 * 因而不能为了展示目录而伪装成 posts。所有链接均为构建期静态数据，避免 Cloudflare
 * 构建或访客浏览时依赖外部站点的可用性。
 */
export const TUTORIAL_TOOL_STAGES = [
	{ id: 'environment', index: '01', code: 'ENVIRONMENT', label: '环境与编辑', accent: '#4f9ead' },
	{ id: 'collaboration', index: '02', code: 'COLLABORATION', label: '版本与协作', accent: '#c98775' },
	{ id: 'engineering', index: '03', code: 'ENGINEERING', label: '构建与运行', accent: '#84a56d' },
	{ id: 'research', index: '04', code: 'RESEARCH', label: '写作与研究', accent: '#9b8ec1' },
	{ id: 'workflow', index: '05', code: 'WORKFLOW', label: '工作方法', accent: '#b9829f' },
] as const;

export type TutorialToolStage = (typeof TUTORIAL_TOOL_STAGES)[number]['id'];

export interface TutorialTool {
	id: string;
	code: string;
	name: string;
	stage: TutorialToolStage;
	summary: string;
	status: 'FOUNDATION' | 'ALTERNATIVE' | 'PRACTICE';
	actionLabel: string;
	href: string;
	csdiyHref: string;
}

export const TUTORIAL_TOOLS: readonly TutorialTool[] = [
	{
		id: 'scoop',
		code: 'SCP',
		name: 'Scoop',
		stage: 'environment',
		summary: '在 Windows 中用命令管理开发软件、版本与可重复安装的环境。',
		status: 'FOUNDATION',
		actionLabel: '打开官网',
		href: 'https://scoop.sh/',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/Scoop/',
	},
	{
		id: 'vim',
		code: 'VIM',
		name: 'Vim',
		stage: 'environment',
		summary: '建立在终端中快速阅读、修改和组织文本的基础操作感。',
		status: 'FOUNDATION',
		actionLabel: '打开官网',
		href: 'https://www.vim.org/',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/Vim/',
	},
	{
		id: 'emacs',
		code: 'EMC',
		name: 'Emacs',
		stage: 'environment',
		summary: '把编辑、笔记和自动化放进同一个可编程工作空间的另一条路线。',
		status: 'ALTERNATIVE',
		actionLabel: '查看项目',
		href: 'https://www.gnu.org/software/emacs/',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/Emacs/',
	},
	{
		id: 'git',
		code: 'GIT',
		name: 'Git',
		stage: 'collaboration',
		summary: '用提交、分支和回退把每一次修改变成可追溯的工作记录。',
		status: 'FOUNDATION',
		actionLabel: '阅读手册',
		href: 'https://git-scm.com/book/zh/v2',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/Git/',
	},
	{
		id: 'github',
		code: 'GH',
		name: 'GitHub',
		stage: 'collaboration',
		summary: '让代码、议题、发布与协作过程拥有可公开讨论的远程坐标。',
		status: 'FOUNDATION',
		actionLabel: '打开文档',
		href: 'https://docs.github.com/zh',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/GitHub/',
	},
	{
		id: 'make',
		code: 'MK',
		name: 'GNU Make',
		stage: 'engineering',
		summary: '把重复命令收进明确的任务目标，让构建与检查可以重复执行。',
		status: 'FOUNDATION',
		actionLabel: '阅读手册',
		href: 'https://www.gnu.org/software/make/manual/make.html',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/Make/',
	},
	{
		id: 'cmake',
		code: 'CML',
		name: 'CMake',
		stage: 'engineering',
		summary: '为跨平台项目生成稳定的构建配置，而不是把命令散落在笔记里。',
		status: 'FOUNDATION',
		actionLabel: '打开文档',
		href: 'https://cmake.org/documentation/',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/CMake/',
	},
	{
		id: 'docker',
		code: 'DKR',
		name: 'Docker',
		stage: 'engineering',
		summary: '把运行环境连同依赖、服务与启动方式一并封装和交付。',
		status: 'FOUNDATION',
		actionLabel: '开始使用',
		href: 'https://docs.docker.com/get-started/',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/Docker/',
	},
	{
		id: 'latex',
		code: 'TEX',
		name: 'LaTeX',
		stage: 'research',
		summary: '用可版本化的源文件组织公式、图表、引文和长篇技术写作。',
		status: 'FOUNDATION',
		actionLabel: '查看指南',
		href: 'https://www.overleaf.com/learn',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/LaTeX/',
	},
	{
		id: 'information-retrieval',
		code: 'IRS',
		name: '信息检索',
		stage: 'research',
		summary: '从关键词、引用链与官方文档中建立可验证的资料来源。',
		status: 'PRACTICE',
		actionLabel: '阅读路线',
		href: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/%E4%BF%A1%E6%81%AF%E6%A3%80%E7%B4%A2/',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/%E4%BF%A1%E6%81%AF%E6%A3%80%E7%B4%A2/',
	},
	{
		id: 'thesis',
		code: 'THS',
		name: '毕业论文',
		stage: 'research',
		summary: '把选题、阅读、实验、引文与写作节奏组织成可持续推进的项目。',
		status: 'PRACTICE',
		actionLabel: '阅读路线',
		href: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/%E6%AF%95%E4%B8%9A%E8%AE%BA%E6%96%87/',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/%E6%AF%95%E4%B8%9A%E8%AE%BA%E6%96%87/',
	},
	{
		id: 'daily-workflow',
		code: 'FLW',
		name: '日常学习工作流',
		stage: 'workflow',
		summary: '将输入、实验、笔记、复盘和公开输出串成稳定的学习循环。',
		status: 'PRACTICE',
		actionLabel: '查看路线',
		href: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/%E6%97%A5%E5%B8%B8%E5%AD%A6%E4%B9%A0%E5%B7%A5%E4%BD%9C%E6%B5%81/',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/%E6%97%A5%E5%B8%B8%E5%AD%A6%E4%B9%A0%E5%B7%A5%E4%BD%9C%E6%B5%81/',
	},
	{
		id: 'toolbox',
		code: 'BOX',
		name: '实用工具箱',
		stage: 'workflow',
		summary: '按任务收纳终端、排版、图表、调试与协作中的高频工具。',
		status: 'PRACTICE',
		actionLabel: '打开工具箱',
		href: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/%E5%B7%A5%E5%85%B7%E7%AE%B1/',
		csdiyHref: 'https://csdiy.wiki/%E5%BF%85%E5%AD%A6%E5%B7%A5%E5%85%B7/%E5%B7%A5%E5%85%B7%E7%AE%B1/',
	},
];

/** 工具卡与详情页共享稳定的站内地址，避免在组件里散落路由字符串。 */
export function getTutorialToolPath(tool: Pick<TutorialTool, 'id'> | string): string {
	const id = typeof tool === 'string' ? tool : tool.id;
	return `/toolkit/${id}/`;
}

export function getTutorialToolById(id: string): TutorialTool | undefined {
	return TUTORIAL_TOOLS.find((tool) => tool.id === id);
}
