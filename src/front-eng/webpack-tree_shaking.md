## Tree Shaking

介绍：本质是一种基于 ES Module 规范的 Dead Code Elimination 技术。它会在运行过程中静态分析模块之间的导入导出，确认 ESM 模块中哪些导出值未曾被其他模块，并将其删除，以此实现打包产物的优化。

### 使用

满足 3 个条件

- 使用 ESM 规范编写
- 配置 optimization.useExports 为`true`
- 启动代码优化功能，可以通过如下方式实现：
  - 配置 mode = production;
  - 配置 optimization.minimize = true;
  - 提供 optimization.minimizer 树组

### 核心原理

一是先标记哪些模块导出值没有被使用过；二使用代码压缩插件--如 Terser 删掉这些没被用到的导出变量
`标记功能需要配置optimizaton.usedExports = true 开启`

源码分析
Tree Shaking 的实现大致上可以分为三个步骤：

- 【构建】阶段【收集】模块导出变量并记录模块依赖关系图 ModuleGraph 对象中；
- 【封装】阶段，遍历所有模块，【标记】模块导出变量有没有被使用；
- 使用代码优化插件 - 如 terser，删除无效导出代码。

### 最佳实践

- 始终使用 ESM
- 避免无意义的赋值

```js
// index.js
import { foo, bar } from "./bar";
console.log(bar);
const f = foo; // unuse
```

webpack 的 tree shaking 操作没有生效，产物中依然保留 foo，造成这一结果，浅层原因是 Webpack 的 Tree Shaking 逻辑停留在代码静态分析层面，只是浅显地判断： 1.模块导出变量是否被其他模块引用 2.引用模块的主题代码中有米有出现这个变量。

- 实践：使用`#pure`标准纯函数的使用
  与赋值语句类似，JavaScript 中的函数调用语句也可能产生副作用，因此默认情况下 Webpack 并不会对函数调用做 Tree Shaking 操作。不过，开发者在调用语句前面添加`/*#__PURE__*/` 备注，明确告诉 Webpack 该次函数调用并不会对上下文环境产生副作用，例如：

```js
// 标记为纯函数调用 - production会被去除，不使用
/*#__PURE__*/ console.log("This is a pure call");

// 未使用的导出（应该被Tree Shaking移除）
export const unusedFunction = () => {
  console.log("This function is never used");
};

// 使用的导出
export const usedFunction = () => {
  console.log("This function is used");
};

// 调用使用的函数
usedFunction();
```

- 实践：禁止 babel 转译模块的导入导出语句

```js
{
  test:'',
  loader:'babel-loader',
  options:{
    presets:[
      ['@babel/preset-env', {modules:'commonjs'} ] //❌
    ]
  }
}
```

- 实践：优化导出值的粒度
  即使实际上只用到 default 导出值的其中一个属性,整个 default 对象依然会被完整的保留。所以实际开发中，应该尽量保持导出值颗粒度和原子性。

```js
const bar = 'bar'
cosnt foo = 'foo'
// 推荐使用
export {
  bar,
  foo
}
// 不要使用
export default {
  bar,
  foo
}

// index.js
import {bar,foo} from './bar'
console.log(bar);
```

- 实践：使用支持 tree shaking 的包
  例如使用`lodash-es`替代`lodash`

- 实践：在异步模块中使用 Tree-Shaking
  实例中，通过`/* webpackExports:[''] */`备注语句，显示声明即将消费异步模块的那些导出内容，Webpack 即可借此判断此模块的依赖，实现 Tree Shaking

```js
import(/* webpackExports:['foo',[default'] */ "./foo").then((module) => {
  console.log(module.foo);
});
```

思考题：假设你准备着手开发一个开源 JavaScript 库，你应该如何编写对 Tree-Shaking 友好的包代码？有哪些需要注意的开发准则。

1.使用 esm 编写

2.除去非必要的赋值

3.主动使用 /pure/纯函数声明

4.细颗粒度的导出。

5.动态 chunk 的主动导出

6.如果依赖三方库，尽可能使用可以 tree shaking 的三分库。
