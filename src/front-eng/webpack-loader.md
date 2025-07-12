## Loader 开发基础

为什么需要 loader？
计算机事件资源格式太多了，webpack 只提供标准 js 代码解析/处理能力，设计 loader 可由第三方开发者以 loader 方式补充对特定资源的解析逻辑。
实现上，Loader 通常是一种 mapping 函数的形式，接受原始代码内容，返回翻译结果

```js
module.exports = function (source) {
  return modifySource;
};
```

loader 的函数签名

```js
function(source,sourceMap?,data?) {
  return source;
}
```

loader 执行的资源翻译内容通常是 CPU 密集型，很容易导致整个加载器链条的执行时间过程。
wp 默认会缓存 loader 的执行结果，必要时可以使用`this.cacheable(false)`显示声明不缓存

### 总结

Loader 主要负责将资源内容转化为 Webpack 能够理解的 Javascript 代码形式，开发时我们可以借助 Loader Context 提供丰富接口实现各种各样的诉求。此外，也需要结合 Loader 的链式调用模式，尽可能设计出复用性更强，更简洁的资源加载器。

## vue-loader

预处理阶段：
vue-loder 插件在 apply 函数动态修改 webpack 的配置

```js
class VueLoaderPlugin {
  apply(compiler) {
    const rules = compiler.options.module.rules;
    const cloneRules = rules.filer((r) => r !== rawVueRules).map((rawRule) => cloneRule(rawRules, refs));

    const pitcher = {
      loader: require.resolve("./loader/pitcher"),
      resourceQuery: (query) => {
        if (!query) {
          return false;
        }
        const parsed = qs.parse(query.slice(1))
        return parsed.vue!=null
      }
    };

    compiler.options.module.rules = [
      pitcher
      ...cloneRules,
      ...rules,
    ]
  }
}
```

插件主要完成二个任务：1.初始化并注册 Pitch Loader，将 pitch 注入到首位 2.负责 rules 配置
举例，感受 VueloaderPlugin 之后的 rules 配置

```js
module.exports = {
  module: {
    rules: [
      {
        test: /.vue$/i,
        use: [{ loader: "vue-loader" }],
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.js$/i,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [["@babel/preset-env", { targets: "defaults" }]],
          },
        },
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({ filename: "[name].css" }),
  ],
};
```

```js
module.exports = {
  module: {
    rules: [
      {
        loader: "/node_modules/vue-loader/lib/loaders/pitcher.js",
        resourceQuery: () => {},
        options: {},
      },
      {
        resource: () => {},
        resourceQuery: () => {},
        use: [
          {
            loader: "/node_modules/mini-css-extract-plugin/dist/loader.js",
          },
          { loader: "css-loader" },
        ],
      },
      {
        resource: () => {},
        resourceQuery: () => {},
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults" }]],
            },
            ident: "clonedRuleSet-2[0].rules[0].use",
          },
        ],
      },
      {
        test: /\.vue$/i,
        use: [
          { loader: "vue-loader", options: {}, ident: "vue-loader-options" },
        ],
      },
      {
        test: /\.css$/i,
        use: [
          {
            loader: "/node_modules/mini-css-extract-plugin/dist/loader.js",
          },
          { loader: "css-loader" },
        ],
      },
      {
        test: /\.vue$/i,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults" }]],
            },
            ident: "clonedRuleSet-2[0].rules[0].use",
          },
        ],
      },
    ],
  },
};
```

6 个 rule

1.针对`xx.vue&vue`格式路径生效的规则，只用 vue-loader 的 pitch 作为 Loader

2.被复制的 CSS 处理规则，use 数组和开发者定义的规则相同；

3.被复制的 JS 处理规则，use 数组也和开发者定义的规则相同；

4.开发者定义的 vue-loader 规则

5.开发者定义的 css 规则，用到 css-loader,mini-css-extract-plugin-loader

6.开发者定义的 js 规则

介绍 cloneRule 函数，
内部定义 `resourceQuery`，用于判断资源路径是否适用这个 rule，核心是取路径的 lang 参数，传入 rule 的 condition 测试路径是否对该 rule 生效，举例
`import script from './index.vue?vue&type=script&lang=js&' `

内容处理阶段

1.路径命中 /.vue$/i ,调用 vue-loader 生成中间结果 A；

2.结果 A 命中 xxx.vue?vue, 调用 vue-loader Pitcher Loader 生成中间结果 B

3.结果 B 命中具体 Loader，直接调用 Loader 做处理；
例子：

```js
// 原始代码
import xx from "./index.vue";
// 1步
import {
  render,
  staticRenderFns,
} from "./index.vue?vue&type=template&id=2964abc9&scope=true&";
import script from "./index.vue?vue&type=script&lang=js&";
export * from "./index.vue?vue&type=script&lang=js&";
import style0 from "./index.vue?vue&type=style&index=0&id=2964abc9&scope=true&lang=css&";
// 2步
export * from "";

// 3步 调用各自具体loader
```

```js
// main.js
import xx from 'index.vue';

// index.vue 代码
<template>
  <div class="root">hello world</div>
</template>

<script>
export default {
  data() {},
  mounted() {
    console.log("hello world");
  },
};
</script>

<style scoped>
.root {
  font-size: 12px;
}
</style>
```

第一次执行 loader

1.调用@vue/component-compiler-utils 包的 parse 函数，转成 ast 对象

2.遍历 ast 属性，转位特殊引用路径

3.返回引入结果

第二次执行 picth Loader
pitch Loader 做的事转换 import 路径。

```js
// 正常的loader阶段，直接返回结果
module.exports = (code) => code;
```

核心是遍历用户定义的 rule 树组，拼接出完整的行内引用路径

```js
// 开发代码：
import xx from "index.vue";
// 第一步，通过vue-loader转换成带参数的路径
import script from "./index.vue?vue&type=script&lang=js&";
// 第二步，在 pitcher 中解读loader数组的配置，并将路径转换成完整的行内路径格式
import mod from "-!../../node_modules/babel-loader/lib/index.js??clonedRuleSet-2[0].rules[0].use!../../node_modules/vue-loader/lib/index.js??vue-loader-options!./index.vue?vue&type=script&lang=js&";
```

解读

```js
-! [loader1]??[参数1] ! [loader2]??[参数2] ! [资源路径]?[查询参数]
-! Webpack 的特殊前缀，表示跳过配置中的 preLoaders 和 normalLoaders，只执行显式指定的 loader。

```

为什么要这样子处理？

- 拆分组件：将.vue 文件拆分成多个模块（模版、脚本、样式）
- 独立处理：每个模块应用不同的 loader 链（如模版 用 vue-template-compiler 脚本用 babel-loader)
- 参数传递：通过参数参数 type=script 告诉 loader 具体处理那一部分内容

vue-loader 代码

```js
module.exports = function (source) {
  // ...

  const {
    target,
    request,
    minimize,
    sourceMap,
    rootContext,
    resourcePath,
    resourceQuery = "",
  } = loaderContext;
  // ...

  const descriptor = parse({
    source,
    compiler: options.compiler || loadTemplateCompiler(loaderContext),
    filename,
    sourceRoot,
    needMap: sourceMap,
  });

  // if the query has a type field, this is a language block request
  // e.g. foo.vue?type=template&id=xxxxx
  // and we will return early
  if (incomingQuery.type) {
    return selectBlock(
      descriptor,
      loaderContext,
      incomingQuery,
      !!options.appendExtension
    );
  }
  //...
  return code;
};

module.exports.VueLoaderPlugin = plugin;
```

第二次运行由于路径以及带上 type 参数，会命中 26 行判断，进入 selectBlock

```js
module.exports = function selectBlock(
  descriptor,
  loaderContext,
  query,
  appendExtension
) {
  // template
  if (query.type === `template`) {
    if (appendExtension) {
      loaderContext.resourcePath += "." + (descriptor.template.lang || "html");
    }
    loaderContext.callback(
      null,
      descriptor.template.content,
      descriptor.template.map
    );
    return;
  }

  // script
  if (query.type === `script`) {
    if (appendExtension) {
      loaderContext.resourcePath += "." + (descriptor.script.lang || "js");
    }
    loaderContext.callback(
      null,
      descriptor.script.content,
      descriptor.script.map
    );
    return;
  }

  // styles
  if (query.type === `style` && query.index != null) {
    const style = descriptor.styles[query.index];
    if (appendExtension) {
      loaderContext.resourcePath += "." + (style.lang || "css");
    }
    loaderContext.callback(null, style.content, style.map);
    return;
  }

  // custom
  if (query.type === "custom" && query.index != null) {
    const block = descriptor.customBlocks[query.index];
    loaderContext.callback(null, block.content, block.map);
    return;
  }
};
```

至此就完成 Vue SFC 文件中抽取特定 block 内容，并复用用户定义的其他 loader 加载这些 block
