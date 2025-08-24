## 优化思路
- 减少体积
- 优化加载
- 加速渲染
- 利用缓存

## 谈谈在项目上的优化

### 体积
1. 按需引入、懒加载
- 场景： 业务依赖三方库`echarts`展示曲线，`loadash`处理数据、`vant`实现UI。
- 优化策略： 
- - 第三库按需引入 `import {LineChart,Tooltip} from 'echarts/core'` `lodash-es` `import {Button} from 'vant' `
- - 路由懒加载配合 `splitchunks` ，切分`Vue`、`Pinia`独立Chunk
- 效果：首屏体积减少`40%`

2. 静态资源优化
- 场景：基金logo、宣传图片、引导图等静态资源
- 策略：
- - 图片格式与压缩: 将图片转为`WebP`格式
- - 图表字体化：（涨跌箭头、操作按钮）转为`iconFont`
压缩代码、css，js压缩，图片优化（svg、小图标）

### 加载顺序
- style内联
- 预加载、预连接
- 延迟加载非关键js
- 非必要js，动态`import`
懒加载 （加载chart），按需加载
代码分割，异步组件，

### 渲染
1. 长列表性能滚动（核心提升交互流畅度）
- 场景：基金列表页、交易记录
- 策略：使用vue-virtual-scroller或vue3-virtual-list实现虚拟滚动，只渲染可视区域内的基金项。
- 效果：减少dom节点，滚动流程无卡顿。


### 用户交互体验
1. 交易场景防抖，避免重复提交
2. 搜索查询防抖，避免大量请求


### 缓存
- 使用cdn加载相关图片资源
- 利用浏览器缓存策略

### 工程化
- 打包
- cicd
- 脚手架怎么做


## 虚拟滚动
1. 动态测量和缓存项目高度
2. 使用预估高度进行初始计算
3. 通过二分查找高效确定可见区域
4. 实施性能优化策略减少布局计算和重渲染



### 复杂项目：

- 微前端
- 混合开发 sdk封装
- 前端监控？打包部署自动流程化
- 大屏适配 `scale` `px2vh`

`postcss-to-viewport`存在一些问题：`内联样式 js-dom-style echarts-options` 自己实现函数 

### 性能优化细化
- echart按需引入，按需加载的具象化
- 代码压缩 `compressPlugin` `gz br对比`
- cdn外联优化 `<script onerror  src="cdn.xxx.com/js/xx.js"> </script>`
- 拆包分包 （文件多大进行拆包分包）


## 前端监控
### 数据埋点
用于统计用户行为-并上报
#### 上报方式
- xhr
- image gif
- sendBeacon

#### 上报时机
- requestIdleCallback
- setTimeout
- beforeUpload
- 缓存批量 

#### SDK封装


问题：
- 怎么传，什么时候传，传什么

### js错误 行号列号


### 性能指标：fp fcp lcp 白屏 