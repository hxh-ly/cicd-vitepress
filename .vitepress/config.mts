import test from "node:test";
import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
// https://vitepress.dev/reference/site-config

const webpackCofig = [
  { text: "Webpack+React脚手架", link: "front-eng/webpack-react" },
  {
    text: "Webpack+ESlint工程配置",
    link: "front-eng/webpack-eslint",
  },
  { text: "Webpack+核心流程", link: "front-eng/webpack-core" },
  {
    text: "Webpack+code_Spliting",
    link: "front-eng/webpack-codesplit",
  },
  {
    text: "Webpack+Tree_Shaking",
    link: "front-eng/webpack-tree_shaking",
  },
  {
    text: "Webpack+loader基础",
    link: "front-eng/webpack-loader",
  },
  {
    text: "CI/CD",
    link: "front-eng/CICD",
  },
  {
    text: "性能优化",
    link: "front-eng/Optimization",
  },
  {
    text: "Vite",
    link: "front-eng/vite-index",
  },
];
const reactConfig = [
  { text: "开始", link: "react/index" },
  { text: "React原理", link: "react/react-core" },
  { text: "React-Fiber", link: "react/fiber" },
  { text: "Mini-React", link: "react/mini-react" },
  { text: "ReactPlayground", link: "react/playground" },
  { text: "React+KeepAlive", link: "react/react-keepAlive" },
];
const vueConfig = [
  {
    text: "Vue",
    link: "vue/index.md",
  },
  {
    text: "Vue3 Diff",
    link: "vue/vue3-diff.md",
  },
  {
    text: "Vue3 KeepAlive-LRU",
    link: "vue/keep-lru.md",
  },
];
const leetdCode = [
  { text: "链表", link: "leetcode/link/index" },
  { text: "二叉树", link: "leetcode/tree/recursion" },
  { text: "回溯", link: "leetcode/backTracking/index" },
  { text: "排序算法", link: "leetcode/sort/index" },
  { text: "滑动窗口", link: "leetcode/window/index" },
  { text: "二分查找", link: "leetcode/search/index" },
];
const backEndConfig = [
  { text: "后端", link: "back-end/index" },
  { text: "redis", link: "back-end/redis" },
  { text: "nest文件上传", link: "back-end/nest_upload" },
   { text: "nest", link: "back-end/nest" },
];
const mobileConfig = [
  { text: "web-适配", link: "mobile/rem.md" },
  { text: "小程序", link: "mobile/mini-app.md" },
];
const htmlConfig = [{ text: "html", link: "interview/html-interview" }];
const microFrontend = [
  { text: "微前端", link: "micro-frontend/index" },
  { text: "微前端JS隔离", link: "micro-frontend/js-micro-front" },
  { text: "微前端css隔离", link: "micro-frontend/css-micro-front" },
  { text: "微前端乾坤方案", link: "micro-frontend/qiankun" },
  { text: "微前端无界方案", link: "micro-frontend/wujie" },
];
const browserConfig = [
  {
    text: "浏览器原理",
    link: "browser/index",
  },
];
const cssConfig = [
  {
    text: "CSS",
    link: "css/index",
  },
];
export default withMermaid(
  defineConfig({
    vite: {
      assetsInclude: ["**/*.awebp"],
    },
    base: process.env.BASE_PATH || "",
    title: "axuaxu",
    description: "知识体系，技能树",
    srcDir: "./src",
    themeConfig: {
      logo: "/logo.png",
      // https://vitepress.dev/reference/default-theme-config
      search: {
        provider: "local",
      },
      nav: [
        {
          text: "前端基础",
          items: [
            { text: "React", link: "/react" },
            { text: "Vue", link: "/vue" },
            {
              text: "JS基础",
              link: "/base-js",
            },
          ],
        },
        {
          text: "前端工程化",
          items: webpackCofig,
        },
        {
          text: "算法",
          items: leetdCode,
        },
        {
          text: "后端",
          items: backEndConfig,
        },
      ],
      sidebar: [
        {
          text: "前端工程化",
          items: webpackCofig,
        },
        {
          text: "React",
          items: reactConfig,
        },
        {
          text: "算法",
          items: leetdCode,
        },
        {
          text: "后端",
          items: backEndConfig,
        },
        {
          text: "跨端",
          items: mobileConfig,
        },
        {
          text: "HTML",
          items: htmlConfig,
        },
        {
          text: "微前端",
          items: microFrontend,
        },
        {
          text: "浏览器原理",
          items: browserConfig,
        },
        {
          text: "css",
          items: cssConfig,
        },
        {
          text: "Vue",
          items: vueConfig,
        },
      ],
      socialLinks: [{ icon: "github", link: "https://github.com/hxh-ly/" }],
      footer: {
        message: "Released under the MIT License.",
        copyright: "Copyright © 2022-present axuaxu",
      },
    },
  })
);
