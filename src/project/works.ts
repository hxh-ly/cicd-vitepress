export type WorkLink = {
  label: string
  url: string
}

export type WorkItem = {
  id: string
  title: string
  summary: string
  /** 封面图：相对路径 /portfolio/xxx.png，或完整 OSS/CDN URL */
  cover?: string
  /** 演示视频：大文件建议用 OSS 直链，避免进 Git；也支持 /portfolio/xxx.mp4 */
  video?: string
  /** 为 true 时不在作品集页展示 */
  hidden?: boolean
  tags: string[]
  links?: WorkLink[]
  highlights?: string[]
}

const OSS_PORTFOLIO =
  'https://axuaxu-blog.oss-cn-shanghai.aliyuncs.com/blog/portfolio'

/**
 * 作品集数据：新增作品只需往数组里加一项。
 * 小图可放 src/public/portfolio/，路径 /portfolio/xxx.png（withBase 自动加 /blog）。
 * 大视频请直接上传 OSS，这里填完整 URL，勿提交进仓库。
 */
export const works: WorkItem[] = [
  {
    id: 'ai-video',
    title: 'AI 讲题视频',
    summary:
      '作业工具场景下的 AI 讲题 H5：结合题目与视频讲解，支持灰度环境调试与多种讲题页形态，面向移动端学习体验。',
    video: `${OSS_PORTFOLIO}/three-teach.mp4`,
    tags: ['H5', 'AI', '教育'],
    links: [
      {
        label: '在线预览',
        url: 'https://test-h5.eebbk.net/homework-tools-h5/ai-video/index.html#/?questionId=2338109601&env=gray&videoId=13127556&pageType=2&videoType=1',
      },
    ],
    highlights: ['题目驱动的讲题视频页', '支持灰度环境与多种页类型'],
  },
  {
    id: 'three-teach',
    title: '三维教学演示',
    summary:
      '三维教学相关演示录屏，展示交互讲解与页面效果，可直接在本页播放。',
    video: `${OSS_PORTFOLIO}/ai-teacher.mp4`,
    tags: ['H5', '教学', '演示'],
    highlights: ['本页可直接播放演示视频'],
  },
  {
    id: 'english-animation',
    title: '英语分词动画',
    hidden: true,
    summary:
      '英语单词拆分 / 分词学习 H5，用动画呈现单词结构与学习流程，适合移动端英语学习场景。',
    tags: ['H5', '动画', '英语学习'],
    links: [
      {
        label: '在线预览',
        url: 'https://h5cdn-dn.eebbk.net/english-word-h5/split-word/index.html#/',
      },
    ],
    highlights: ['分词可视化动画', '移动端 H5 学习体验'],
  },
  {
    id: 'leda-fund',
    title: '乐道选基',
    summary:
      '基金选基数据中心 H5：面向选基决策的数据展示与交互，承载基金相关信息浏览与筛选体验。',
    cover: '/portfolio/leda-fund.png',
    tags: ['H5', '数据可视化', '金融'],
    links: [
      {
        label: '在线预览',
        url: 'https://dlfundcdn.cdollar.cn/data_center/index.html#/',
      },
    ],
    highlights: ['选基数据中心页面', '线上可访问演示'],
  },
  {
    id: 'react-resume',
    title: '个人简历站点',
    hidden: true,
    summary:
      '基于 Next.js 的个人简历 / 作品展示站，偏重信息结构与阅读体验，适合对外分享给面试官快速了解背景。',
    tags: ['Next.js', 'TypeScript', '简历'],
    links: [
      { label: '在线预览', url: 'https://react-resume-chi-mauve.vercel.app' },
      { label: 'GitHub', url: 'https://github.com/hxh-ly/react-resume' },
    ],
    highlights: ['静态站点生成，访问快', '信息分区清晰，便于扫读'],
  },
  {
    id: 'mbti-test',
    title: 'MBTI 问卷测试',
    summary:
      '问卷交互型前端应用：题目流转、结果计算与结果页展示，覆盖表单状态管理与结果可视化。',
    cover: '/portfolio/mbti-test.png',
    tags: ['HTML', '问卷', '交互'],
    links: [
      { label: '在线预览', url: 'https://mbti-test-iota-mauve.vercel.app/' },
      { label: 'GitHub', url: 'https://github.com/hxh-ly/mbti_test' },
    ],
    highlights: ['多步骤问卷流程', '结果页独立展示'],
  },
  {
    id: 'lowcode-editor',
    title: '低代码编辑器',
    hidden: true,
    summary:
      '基于 Vite + React 的低代码编辑器实验项目，探索组件拖拽、画布编排与属性面板等编辑器核心能力。',
    tags: ['Vite', 'React', '低代码'],
    links: [
      {
        label: 'GitHub',
        url: 'https://github.com/hxh-ly/vite-react-lowcode-editor',
      },
    ],
    highlights: ['编辑器画布与组件编排', '属性配置面板'],
  },
  {
    id: 'taro-color-picker',
    title: 'Taro 颜色选择器',
    hidden: true,
    summary:
      '适用于 Taro 跨端场景的颜色选择器组件，封装常用取色交互，可在小程序 / H5 等端复用。',
    tags: ['Taro', '组件', '跨端'],
    links: [
      {
        label: 'GitHub',
        url: 'https://github.com/hxh-ly/taro-color-picker',
      },
    ],
    highlights: ['跨端组件封装', '可复用取色交互'],
  },
  {
    id: 'webpack-use',
    title: 'Webpack + React 工程脚手架',
    hidden: true,
    summary:
      '从零配置 Webpack + React 脚手架，覆盖 loader、code splitting、Tree Shaking、ESLint 等工程化能力。',
    tags: ['Webpack', 'React', '工程化'],
    links: [
      { label: 'GitHub', url: 'https://github.com/hxh-ly/webpack-use' },
    ],
    highlights: ['脚手架可落地复用', '工程化配置完整'],
  },
  {
    id: 'plusecube-nest',
    title: 'Plusecube Nest 服务端',
    hidden: true,
    summary:
      '基于 Nest.js 的后端项目，实践模块化接口、鉴权与业务分层，配合前端 / 跨端应用使用。',
    tags: ['Nest.js', 'Node.js', '后端'],
    links: [
      { label: 'GitHub', url: 'https://github.com/hxh-ly/plusecube_nest' },
    ],
    highlights: ['Nest 模块化架构', '服务端接口实践'],
  },
]
