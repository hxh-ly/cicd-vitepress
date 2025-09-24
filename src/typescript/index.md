## tsconfig.json
`tsconfig.json`告诉Typescript编辑器：
1. 哪些文件需要编译`include/exclude/files`
2. 编译成什么样子`compilerOptions` 如输出JS版本、是否生成类型文件等
3. 类型检查的严格程度（是否允许隐式`any` 是否严格检查`null`）
可分为5大类，重点掌握`compilerOptions`
|配置项|作用|常用值|	典型场景|
|---|---|---|---|
|target|制定编译后生成的js版本（语法标准）|`ES3/ES5/ES6/ES2020/ESNext`推荐 ES6+|兼容旧浏览器用 ES5；现代项目用 ES2020 或 ESNext|
|module|指定生成的模块系统（模块化规范）|`CommonJS/ES6/ESNext/UMD/None`|Node.js 项目用 CommonJS；前端工程化项目（Webpack/Vite）用 ES6/ESNext|
|lib|指定编译时需要包含的库文件（如 DOM API、ES 库）|`["DOM","ES2020"]/["ESNext","DOM.Iterable"]`|前端项目需包含 DOM；纯 Node 项目可省略（默认包含 Node 相关库）|
|allowJs|是否允许编译js|true/false（默认 false）|逐步将 JS 项目迁移到 TS 时设为 true|
|checkJs|是否对 JS 文件进行类型检查（需配合 allowJs: true）|true/false（默认 false）|迁移 JS 项目时，希望对 JS 也进行类型检查|
|jsx|指定 JSX 语法的处理方式（React 项目必配）|`preserve/react/reac-jsx`（React 17+ 推荐 react-jsx）|React 项目用 react-jsx；保留 JSX 不转换用 preserve|
|declaration|是否生成类型声明文件（.d.ts，供其他项目引用）|true/false（默认 false）|开发组件库 / 工具库时设为 true，方便用户获取类型提示|
|declarationDir|指定类型声明文件的输出目录|`./dist/types`|配合 declaration: true 使用，集中管理类型文件|
|outDir|指定编译后 JS 文件的输出目录|./dist|避免编译产物与源码混合，统一输出到 dist 目录|
|rootDir|指定源码根目录（TypeScript 会以该目录为基准解析文件结构）|`./src`|确保 outDir 输出的目录结构与源码一致|
|strict|是否开启「严格模式」（启用所有严格类型检查选项的快捷方式）|true/false（推荐 true）|新项目尽量开启，减少隐式类型错误；旧项目可先设 false 逐步迁移|
|stricNullChecks|是否严格检查`null/undefined`|true/false（strict: true 时默认 true）|避免因 null 导致的运行时错误（如 Cannot read property 'x' of null）|
|noImplicitAny|是否禁止隐式 any 类型（strict 模式的子选项）|true/false（strict: true 时默认 true）|强制为所有变量 / 参数指定类型，避免类型信息丢失|
|esModuleInterop|是否允许 CommonJS 和 ESM 模块互操作（解决 import CommonJS 包的问题）|true/false（推荐 true）|混合使用 ESM（import）和 CommonJS（require）时必开|
|skipLibCheck|是否跳过对 .d.ts 类型文件的检查（提高编译速度）|true/false（推荐 true）|第三方库的类型文件可能有冲突，跳过检查可减少编译报错和时间|
|forceConsistentCasingInFileNames|是否强制文件名大小写一致（避免跨系统问题）|true/false（推荐 true）|防止 Windows/macOS 大小写敏感差异导致的文件引用错误|

2. 项目范围类 `files/include/exclude`
- files
```js
"files":['./src/index.ts','./src/utils.ts']
```
- include：数组，指定文件匹配模式（支持通配符 */**），推荐用于大多数项目。
- - *：匹配当前目录下的文件；
- - **：匹配所有子目录（递归）。
```js
"include":["./src/**/*"]
```
- exclude 数组，指定需要排除的文件（优先级低于 include，默认排除 node_modules）。
```js
"exclude":['./src/test/**/*',"*.config.ts"]
```

3. 扩展配置（`extends`）
- `@tsconfig/node18`:Node 18环境的标准配置
- `@tsconfig/react-native`:React Native项目配置
- `@tsconfig/strictest`:最严格的类型检查配置

### 最佳实践
- 1. 有限使用`extends`：继承社区预设
- 2. 开启`strict:true`
- 3. 明确`outDir`和`rootDir`
- 4. 根据目标环境设置`target`和`module`
- 5. 忽略不必要的文件：用`exclude`排除测试文件、配置文件，提高编译速度

## 解释 TS 中静态类型的概念和好处

概念：提供变量、函数参数、返回值的数据类型
好处：开发早期能捕获类型相关的错误，提升代码质量和可维护性。

## TS 的接口是什么？举个例子

定义对象结构的契约，指定属性和方法

```ts
interface Person {
  say: () => void;
}
```

## 类型断言

无法自动推断类型的时候，允许告诉编辑器变量的类型

## 泛型

允许您创建可与各种类型一起使用的可重用组件或者函数。支持强类型、同时报吹不同数据类型的灵活性

```ts
function identify<T>(args: T): T {
  return T;
}
const a = identify<number>(1);
```

## keyof

是一个类型运算符，它返回表示对象键的文字类型的联合

```ts
interface Person {
  name: string;
  age: number;
}
type PersonKeys = keyof Person; // "name"|'age'
```
