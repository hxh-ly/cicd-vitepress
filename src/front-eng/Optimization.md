## 白屏原因

- 资源加载阻塞
- js 执行报错
- css 样式原因

## 性能优化的指标

- FCP（首次内容绘制）：反映用户对页面 “是否开始加载” 的感知。“非空白非背景的内容”。
- LCP（最大内容绘制）：页面加载过程，最大内容元素（如图片、文本块）完成渲染的时间，返回加载性能（目标值〈2.5s））
- FID（首次输入延迟）：用户首次与页面交互，到浏览器响应的时间，反应交互性能（目标〈100 毫秒））
- INP (交互的下一次渲染)：衡量页面响应程度（目标值（200 毫秒））
- CLS（累计布局偏移）：页面生命周期中所有意外布局偏移的总合，反应视觉稳定性
- TTFB（首字节时间、服务器响应速度）、DOMContentLoaded（DOM 加载完成时间）、Load（页面完成加载时间）

| 指标名称         | 英文全称                     | 定义                                                                       | 计算方法（基于 performance.timing）                       | 意义                                              |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| 首次字节时间     | Time to First Byte (TTFB)    | 从页面请求开始到浏览器接收第一个字节的时间（反映服务器响应速度）           | responseStart - navigationStart                           | 衡量服务器性能、网络延迟（理想 ≤ 600ms）          |
| 首次绘制         | First Paint (FP)             | 页面从空白到首次出现 “像素” 的时间（如背景色、边框，不包含内容）           | 通过 performance.getEntriesByType('paint')[0].startTime； | 标记页面 “开始渲染” 的起点                        |
| 首次内容绘制     | First Contentful Paint (FCP) | 页面首次出现 “有意义内容” 的时间（如文本、图片、图标）                     | performance.getEntriesByType('paint')[1].startTime        | 比 FP 更贴近用户 “看到内容” 的体验（理想 ≤ 1.8s） |
| 可交互时间       | Time to Interactive (TTI)    | 页面从加载到 “完全可交互” 的时间（DOM 解析完成、资源加载完毕，交互无延迟） | 现代方法：监听 first-input 事件的 processingStart；       | 衡量页面 “能正常使用” 的时间（理想 ≤ 3.8s）       |
| 页面完全加载时间 | Load Time                    | 页面所有资源（图片、脚本、样式）加载完成的时间（onload 事件触发）          | loadEventStart - navigationStart                          | 反映页面 “全量资源加载” 的终点                    |

### `performance`常见属性与方法

1. 核心属性

现代浏览器推荐使用 Performance Timeline API（基于 PerformanceEntry），而非旧的 timing 属性，以下是高频属性：
|属性/方法|类型|作用|示例|
|---|---|---|---|
|performance.now()||返回当前时间与页面加载开始（navigationStart）的差值|计算代码执行耗时：const start = performance.now(); doSomething(); const cost = performance.now() - start;|
|performance.entryList||存储所有性能条目（如 paint、largest-contentful-paint、layout-shift 等）|需通过 getEntries\* 方法获取，而非直接访问|
|performance.navigation ||提供页面导航信息（如导航类型）|performance.navigation.type：0(正常导航) 1（刷新） 2（前进 / 后退） |
|performance.memory||非标准，返回 JS 堆内存情况|memory.usedJSHeapSize（已使用内存）、memory.totalJSHeapSize（总内存）、memory.jsHeapSizeLimit（内存上限）|

2.常用方法
所有核心指标（如 LCP、FCP、CLS）均需通过以下方法获取具体数据：
|方法|作用|示例（获取 FCP）|
|---|---|---|
|getEntries()|获取所有性能条目（数组）|const allEntries = performance.getEntries();|
|getEntriesByType(type)|按 “条目类型” 筛选（如 paint、largest-contentful-paint）|const paintEntries = performance.getEntriesByType('paint'); const fcp = paintEntries.find(e => e.name === 'first-contentful-paint').startTime;|
|PerformanceObserver|监听 “动态产生的性能条目”（如 LCP、CLS 可能延迟触发）|new PerformanceObserver((entryList) => { const lcp = entryList.getEntries()[0]; console.log('LCP:', lcp.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });|

PerformanceObserver 用于 “监听延迟触发的条目”（如 LCP 可能在图片加载后才出现），记住 “动态指标用 Observer，静态条目用 getEntries”

### `DOM`加载过程等关键回调事件

1. DOMContentLoaded

- 触发时机：DOM 构建完成，所有内联脚本和同步外部脚本执行完毕后触发。
- - DOM 结构已完整
- - 不等待图片、视频、样式表、异步脚本等资源加载完成
- 用途：主要操作 dom

2. `load`事件

- 触发时机：当页面中所有资源（DOM、CSSOM、图片、视频、音频、脚本）全部加载完成后触发。

3. `readstatechange`(document 状态变化)

- 触发时机：当 document.readyState 属性值变化时触发。readyState 有 3 种状态：
- - loading：文档正在加载（初始状态）；
- - interactive：DOM 解析完成（但资源未加载完），此时触发的时机与 DOMContentLoaded 接近（但顺序可能有差异）；
- - complete：所有资源加载完成，此时触发的时机与 window.load 接近
- 用途：精细化监听加载状态时使用

```js
document.addEventListener("readystatechange", () => {
  if (document.readyState === "interactive") {
    console.log("DOM解析完成（类似DOMContentLoaded）");
  }
  if (document.readyState === "complete") {
    console.log("所有资源加载完成（类似load）");
  }
});
```

## 优化思路

- 减少体积
- 优化加载
- 加速渲染
- 利用缓存

## 谈谈在项目上的优化

### 体积

1. 按需引入、懒加载

- 场景： 业务依赖三方库`echarts`展示曲线，`loadash`处理数据、`vant`实现 UI。
- 优化策略：
- - 第三库按需引入 `import {LineChart,Tooltip} from 'echarts/core'` `lodash-es` `import {Button} from 'vant' `
- - 路由懒加载配合 `splitchunks` ，切分`Vue`、`Pinia`独立 Chunk
- 效果：首屏体积减少`40%`

2. 静态资源优化

- 场景：基金 logo、宣传图片、引导图等静态资源
- 策略：
- - 图片格式与压缩: 将图片转为`WebP`格式
- - 图表字体化：（涨跌箭头、操作按钮）转为`iconFont`
    压缩代码、css，js 压缩，图片优化（svg、小图标）

```js
// webp实践
// 使用 image-webpack-loader（Webpack）或 vite-plugin-imagemin（Vite），自动将项目中的图片转为 WebP，并保留原格式作为降级。
```

### 加载顺序

- style 内联
- 预加载、预连接
- 延迟加载非关键 js
- 非必要 js，动态`import`
  懒加载 （加载 chart），按需加载
  代码分割，异步组件，

### 渲染

1. 长列表性能滚动（核心提升交互流畅度）

- 场景：基金列表页、交易记录
- 策略：使用 vue-virtual-scroller 或 vue3-virtual-list 实现虚拟滚动，只渲染可视区域内的基金项。
- 效果：减少 dom 节点，滚动流程无卡顿。

### 用户交互体验

1. 交易场景防抖，避免重复提交
2. 搜索查询防抖，避免大量请求

### 缓存

- 使用 cdn 加载相关图片资源
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
- 混合开发 sdk 封装
- 前端监控？打包部署自动流程化
- 大屏适配 `scale` `px2vh`

`postcss-to-viewport`存在一些问题：`内联样式 js-dom-style echarts-options` 自己实现函数

### 性能优化细化

- echart 按需引入，按需加载的具象化
- 代码压缩 `compressPlugin` `gz br对比`
- cdn 外联优化 `<script onerror  src="cdn.xxx.com/js/xx.js"> </script>`
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

#### SDK 封装

问题：

- 怎么传，什么时候传，传什么

### js 错误 行号列号

### 性能指标：fp fcp lcp 白屏

## 项目亮点描述

> 我独立负责/作为核心开发者，参与了一个面向 C 端用户投顾的金融科技 SaaS 平台的前端架构与开发，该平台深度融合了基金信息披露、智能投顾分析和高实时性的模拟交易系统，对前端的苏剧处理性能、实时性和用户体验提出了极高的要求。
> 亮点关键词：`金融科技`、`数据密集应用`、`高实时性`、`复杂交互`、`SaaS平台`

### 难点和技术方案

难点 1:超大规模、高频变动的金融数据可视化与性能优化

- 描述：基金、股票数据是海量且实时变动。
- 难点亮点：
- - `高效使用echarts`：不仅停留在配置选项层面，而是深度使用。
- - 按需打包：通过`echarts/core`和官方插件系统，实现最小打包体积。
- - 数据异步渲染：使用`dataset`管理数据，通过`setOptions`增加更新图表，而不是全量重绘。
- - 性能优化：在需要渲染大量数据（如分时图大量数据点），使用`dataZoom`和`采样降噪`策略，确保流畅性。

- - `前端表格优化`:信息披露模块必然有复杂表格
- - 虚拟滚动 如使用类似`vx-table`和`ag-grid`组件，一定强调解决了万级别数据表格的渲染性能问题。
- - 前端分页与缓存：阐述如果设计分页和数据缓存策略，减少网络请求和服务端压力。

- - `Vue3`性能优化
- - Composition API 抽离：将复杂的图表逻辑、数据获取逻辑用`Compoosition API`（useChart、useFundData）封装
- - 精细化的响应式控制：对于大型数据对象，使用`shallowRef`和`shallowReactive`来避免不必要的深度响应式开销。
- - web worker： 如果数据处理计算极大（如计算夏普比率、回测等指标）可以提及使用 `Web Worker`将复杂计算与 UI 渲染线程分离，避免界面卡顿

总结一下你的技术画像：
你是一个精通 Vue3 生态系统（Pinia, Vue Router），具备复杂状态管理能力，拥有高性能数据处理和可视化经验（ECharts），注重工程化和代码质量（TypeScript, Webpack），并能处理高实时性场景（WebSocket）的前端开发者，并且在技术门槛高的金融领域有实践经验。

### 附

```js
// echarts的使用
// 按需引入
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
// 注入必需的组件
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  CanvasRenderer,
]);

// 按需加载图表类型
export const loadChartType = async (type) => {
  switch (type) {
    case "bar":
      return await import("echarts/charts").then((module) => {
        echarts.use([module.BarChart]);
        return echarts;
      });
    case "line":
      return await import("echarts/charts").then((module) => {
        echarts.use([module.LineChart]);
        return echarts;
      });
    case "pie":
      return await import("echarts/charts").then((module) => {
        echarts.use([module.PieChart]);
        return echarts;
      });
    default:
      return echarts;
  }
};
```

```js
// vue组件封装ehcarts （类型，opions）
import { ref, onMounted, onUnmounted, watch } from "vue";
import { loadChartType } from "../utils/echarts";

export default {
  name: "ChartComponent",
  props: {
    type: {
      type: String,
      default: "bar",
    },
    options: {
      type: Object,
      required: true,
    },
    width: {
      type: String,
      default: "100%",
    },
    height: {
      type: String,
      default: "400px",
    },
  },
  setup(props) {
    const chartEl = ref(null);
    let chartInstance = null;

    const initChart = async () => {
      if (!chartEl.value) return;

      // 按需加载图表类型
      const echarts = await loadChartType(props.type);

      // 初始化图表
      chartInstance = echarts.init(chartEl.value);
      chartInstance.setOption(props.options);

      // 响应窗口大小变化
      const resizeChart = () => {
        chartInstance && chartInstance.resize();
      };
      window.addEventListener("resize", resizeChart);

      // 组件卸载时清理
      onUnmounted(() => {
        window.removeEventListener("resize", resizeChart);
        chartInstance && chartInstance.dispose();
      });
    };

    // 监听选项变化
    watch(
      () => props.options,
      (newOptions) => {
        if (chartInstance) {
          chartInstance.setOption(newOptions);
        }
      },
      { deep: true }
    );

    onMounted(initChart);

    return {
      chartEl,
    };
  },
};
```

```js
// charts试下增量更新 （通过合并配置）修改series/datasets的方式
// 官网例子 -> 每秒头部剔除数据，尾部增加数据，在调用setOptions合并，实现实时效果。
https://echarts.apache.org/examples/zh/editor.html?c=dynamic-data2
```

### ECharts 中实时展示股票等高频率更新的大数据时，卡顿的核心原因是渲染压力过大（数据点过多）和更新频率过高（频繁触发重绘）。以下是针对性的优化方案，结合具体代码示例说明：

1. 只保留最近的 N 个点（只展示一段时间内数据）。 维护一个固定长度的数组，（如最多显示 1000 个点，超过则删除最旧数据，新数据到来，只追加并裁剪数组，避免全量替换）

```js
// 初始化数据存储（固定长度1000）
let data = [];
const MAX_POINTS = 1000; // 最大数据点数量

// 处理新数据的函数
function addNewData(newTime, newPrice) {
  data.push([newTime, newPrice]); // 追加新数据
  // 超过最大长度时，删除最旧的点
  if (data.length > MAX_POINTS) {
    data.shift(); // 移除第一个元素（最旧）
  }
}
```

2. 优化渲染方式：使用 Canvas 并关闭冗余渲染. **Canvas 更适合大数据场景**。（SVG 对大量 DOM 元素处理效率低）。同时，关闭动画、隐藏不必要的视觉元素可进一步优化。

```js
const myChart = echarts.init(dom,null,{ renderer:'canvas' })
const option = [
  series:[{
    type:'line',
    data:data,
    animation:false,
    symbol:'none', // 不显示数据点标记
    symbolSize:0, // 彻底隐藏数据点
    lineStyle:{width:1.5} // 线条适度变细，减少绘画面积
    smooth:false, // 关闭平滑曲线
  }]
]
```

3. 增量渲染：只更新变化的部分，避免全量重绘
   原理：Echarts 解析完整配置的成本较高，增量更新可避免重复解析不变的配置

```js
myCharts.setOptions({
  series: [{ data: data }], // 仅更新数据
});
```

4. 节流控制渲染时机

```js
function throttle(fn, delay) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}
// 节流后的更新函数（最多每100ms更新1次）
const throttledUpdate = throttle(updateChart, 100);

// 数据推送回调中调用节流后的函数
websocket.onmessage = (event) => {
  const newData = JSON.parse(event.data);
  addNewData(newData.time, newData.price);
  throttledUpdate(); // 实际渲染被限制在100ms/次
};
```

5. 数据预处理：Worker 计算，避免阻塞主线程
   如果实时数据需要复杂计算（计算均线、MACD 等指标） 直接在主线程处理会阻塞渲染。使用 Web Worker 离线处理数据。

```js
self.onmessage = (e) => {
  const rawData = e.data;
  const processedData = calculateMA(rawData,5);
  self.postMessage(processedData);
};

function calculateMA(data, period) {
  // 均线计算逻辑（耗时操作）
  // ...
  return result;
}
```

```js
// 主线程
const dataWorker = new Worker('data-processor.js');
dataWorker.onmessage = (e) => {
  data = e.data;
  throttleUpdate();
}

webscoket.onmessage = (event) => {
  const rawData = JSON.parse(event.data);
  dataWorker.postMessage(rawData);
};
```

#### 总结
1. 数据层：限制数据点数量（如 1000 个 滚动窗口）→ 用 Web Worker 预处理数据；
2. 渲染： Canvas -> 关闭动画和冗余元素
3. 更新层： 增量更新数据 -> 节流控制更新频率（100ms/次）