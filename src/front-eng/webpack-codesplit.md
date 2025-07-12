## Code Spliting

三种模式

- 多入口，多出口
- 动态引入
- 抽离代码 splitChunk
  学习 optimization 的配置

```js
module.exports = {
  optimization: {
    splitChunk: {
      chunks: "async",
      minSize: 20000, // KB
      minRemainingSize: 0,
      minChunks: 1,
      masAsyncRequests: 30,
      maxInitialRequests: 30,
      enforceSizeThreshold: 50000,
      cacheGroups: {
        defaultVendor: {
          test: /[\/]node_modules[\/]/,
          priority: -10,
          reuseExistingChunk: true
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  }
};
```

属性讲解：
[chunks]

- async（默认值）处理【异步】导入的代码
- inital 处理【同步】导入的代码（注意：webpack 默认支持异步导入代码）
- all【同步+异步】代码都会进行处理
  [minSize]
  抽离出来的包最小的大小（抽离出来的包特别特别小，比给定的值还小就没有意义了，还要浪费一次 http 请求）
  [minChunks]:
  被多个入口引用的次数
  [cacheGroups]:
  缓存组，是代码分割的核心配置，用于定义不同的分割策略，某个模块在满足缓存组的规则之后不会立即抽离，而是等其他也满足该规则等模块打包到一组；（注意缓存组的属性优先级比外部 splitChunks 下的属性值优先级高）
  [priorty]
  缓存组的权重，相同规则下权重高的命中
  [reuseExistingChunk]:
  某个模块已经被抽离出来，直接复用不再打包

initial 模式
抽离公共模块

```js
optimization:{
  splitChunks:{
    chunks:'initial',
    minSize:0,
    minChunks:2, // home index都用了
    cacheGroups:{
      defaultVendors:false,
      default:false
    }
  }
}
```

### 默认缓存组配置

1.defaultVendors

- 作用 自动将来自 node_modules.模块提取名为`vendors~[name].js`的 chunk 中
- 默认配置

```js
defaultVendors:{
  test:/[\\/]node_modules[\\/]/,
  priority:-10,
  chunks:'async'
}
```

2.default

- 作用：将多个 chunk 共享的模块提取到公共 chunk 中。
- 默认配置：
  default:{
  minChunks:2,
  priority:-20,
  reuseExistingChunk:true
  }

### 常见自定义场景

```js
cacheGroups:{
  vendor:{
    test:/[\\/]node_modules[\\/]/,
    name:"vendor",
    chunks:'all',
    priority:-5
  },
  common:{
    minChunks:3,
    name:'common',
    priority:-15
  },
  style:{
    test:/.css$/,
    name:'style',
    chunks:'all',
    enforce:true // 强制忽略minSize minChunks
  }
}
```

### 总结

- webpack 本身就是天然对异步导入的代码进行独立分割的
- 对于 splitChunks.cacheGroups 会满足匹配条件的模块按照该组的方式进行分割，如果想把所有满足该组条件的模块全打成一个包，要给该组设置一个固定的 name
- initial 只匹配同步导入代码，满足条件的同步代码进行分割，不影响天然分割的异步代码块。
- async 只匹配异步导入代码，满足条件的异步代码进行分割，不满足的异步代码依然会被天然分割。
- all 匹配（同步+异步），如果想把满足该组所有的 chunk 打成一个包，可以设置一个固定 name
