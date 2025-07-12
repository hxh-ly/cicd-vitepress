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
          items: [
            { text: "Item A", link: "" },
            { text: "Item A", link: "" },
          ],
        },
        {
          text: "前端工程化",
          items: webpackCofig,
        },
        { text: "Examples", link: "/markdown-examples" },
      ],

      sidebar: [
        {
          text: "前端工程化",
          items: webpackCofig,
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
