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
];
const reactConfig = [
  { text: "开始", link: "react/index" },
  { text: "React原理", link: "react/react-core" },
  { text: "Mini-React", link: "react/mini-react" },
  { text: "ReactPlayground", link: "react/playground" },
];
const leetdCode = [
  { text: "链表", link: "leetcode/link/index" },
  { text: "二叉树", link: "leetcode/tree/recursion" },
  { text: "回溯", link: "leetcode/backTracking/index" },
];
const backEndConfig = [{ text: "后端", link: "back-end/index" }, { text: "redis", link: "back-end/redis" }];
export default withMermaid(
  defineConfig({
    base: process.env.BASE_PATH || "",
    title: "axuaxu",
    description: "知识体系，技能树",
    srcDir: "./src",

    themeConfig: {
      logo: "./logo.png",
      // https://vitepress.dev/reference/default-theme-config
      search: {
        provider: "local",
      },
      nav: [
        {
          text: "前端基础",
          items: [{ text: "React", link: "/react" }],
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
      ],
      socialLinks: [{ icon: "github", link: "https://github.com/hxh-ly/" }],
      footer: {
        message: "Released under the MIT License.",
        copyright: "Copyright © 2022-present axuaxu",
      },
    },
  })
);
