## rollup 优缺点

| 优点                 | 缺点                                     |
| -------------------- | ---------------------------------------- |
| 输出结果更加扁平     | 加载非 ESM 的第三方模块比较复杂          |
| 自动移除为引用代码   | 模块最终被打包道一个函数中，无法实现 HMR |
| 打包结果依旧完全可读 | 浏览器环境，代码拆分功能依赖 AMD 库      |

## 开发生产环境的 React 组件库的实践

一、核心目标

1. 多模块格式输出 `ESM` `Cjs`.适配不同构建工具`Webpack` `Vite` `Node`
2. 类型支持：生成 TypeScript 类型定义(`.d.ts`)
3. 兼容性：转换现代语法（ES6+）至 ES5，兼容低版本浏览器；处理 React JSX 语法。
4. 精简输出：剔除冗余代码，支持 Tree-shaking，不打包 React 等 peer 依赖。
5. 样式处理：支持 CSS/SCSS 及 CSS Modules，单独提取样式文件（避免样式污染）。

二、必备依赖

```shell
# 核心工具
npm install rollup -D

# 解析与转换
npm install @rollup/plugin-node-resolve @rollup/plugin-commonjs @rollup/plugin-babel @rollup/plugin-typescript -D

# 样式处理
npm install @rollup/plugin-postcss postcss autoprefixer sass -D

# 优化与辅助
npm install @rollup/plugin-terser rollup-plugin-dts rollup-plugin-delete -D

# React 相关（运行时依赖）
npm install react react-dom -P
npm install @types/react @types/react-dom @babel/preset-react -D
```

三、完整配置

```js
// 1.rollup.config.js
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";
import typescript from "@rollup/plugin-typescript";
import postcss from "@rollup/plugin-postcss";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";
import del from "rollup-plugin-delete";
import autoprefixer from "autoprefixer";
import sass from "sass";

// 公共插件配置（排除输出相关插件）
const commonPlugins = [
  // 解析 node_modules 中的依赖
  resolve({
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    browser: true, // 针对浏览器环境优化
  }),
  // 将 CommonJS 转换为 ESM
  commonjs(),
  // 处理 TypeScript
  typescript({
    tsconfig: "./tsconfig.json",
    declaration: true, // 生成 .d.ts
    declarationDir: "dist/types", // 临时存放类型文件
  }),
  // 处理 JSX 和语法转换
  babel({
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    exclude: "node_modules/**", // 排除第三方依赖
    babelHelpers: "runtime", // 复用辅助代码，减小体积
  }),
  // 处理样式（CSS/SCSS + CSS Modules）
  postcss({
    preprocessor: (content, id) => {
      // 处理 SCSS，并支持 CSS Modules（文件名含 .module. 时启用）
      const isModule = id.includes(".module.");
      const result = sass.compileString(content, {
        file: id,
        sourceMap: true,
      });
      return { code: result.css };
    },
    modules: {
      // 生成 hash 类名，避免样式冲突
      generateScopedName: "[name]__[local]___[hash:base64:5]",
    },
    plugins: [autoprefixer()], // 自动添加浏览器前缀
    extract: "styles/index.css", // 提取样式到单独文件
    sourceMap: true,
    minimize: true, // 压缩 CSS
  }),
];

export default [
  // 1. 打包 ESM 和 CommonJS 代码
  {
    input: "src/index.ts", // 入口文件
    output: [
      // ESM 输出（现代构建工具使用）
      {
        dir: "dist/es",
        format: "esm",
        sourcemap: true,
        preserveModules: true, // 保留模块结构，支持 Tree-shaking
        preserveModulesRoot: "src",
      },
      // CommonJS 输出（Node 或旧工具使用）
      {
        dir: "dist/cjs",
        format: "cjs",
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: "src",
      },
    ],
    plugins: [
      del({ targets: "dist/*" }), // 先清理 dist 目录
      ...commonPlugins,
      terser(), // 压缩代码（生产环境）
    ],
    // 排除 peer 依赖（让用户自行安装 React 等）
    external: ["react", "react-dom", "react/jsx-runtime"],
  },
  // 2. 合并类型定义为单个 .d.ts 文件
  {
    input: "dist/types/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "esm" }],
    plugins: [dts()], // 合并分散的 .d.ts
  },
];
```

```js
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES5",
    "module": "ESNext",
    "lib": ["DOM", "ESNext"],
    "jsx": "react-jsx", // 支持 React 17+ JSX 转换
    "declaration": true, // 生成类型定义
    "declarationDir": "dist/types",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true, // 严格模式
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.tsx"]
}
```

```js
{
  "name": "your-react-components",
  "version": "1.0.0",
  "main": "dist/cjs/index.js", // CommonJS 入口
  "module": "dist/es/index.js", // ESM 入口
  "types": "dist/index.d.ts", // 类型定义入口
  "files": ["dist"], // 发布到 npm 的文件
  "scripts": {
    "build": "rollup -c", // 构建命令
    "prepublishOnly": "npm run build" // 发布前自动构建
  },
  // 声明 peer 依赖（用户必须安装，避免版本冲突）
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0"
  },
  "dependencies": {
    "@babel/runtime-corejs3": "^7.22.15",
    "core-js": "^3.32.1"
  }
}
```
