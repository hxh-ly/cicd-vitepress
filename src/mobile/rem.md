# rem 移动端搭建（react 项目）
## 创建Vite+React项目
npm create vite@latest react-h5-rem -- --template react
cd react-h5-rem

## 安装依赖
npm install

## 安装适配相关依赖
npm install postcss-pxtorem autoprefixer --save-dev

## 方案说明
适配原理
以 750px 设计稿为基准，1rem = 75px（设计稿宽度的 1/10）
通过 postcss-pxtorem 自动将 CSS 中的 px 转换为 rem 单位
动态计算根元素 fontSize，实现不同设备上的等比例缩放

```js
//src/utils/rem 进行计算
// 动态设置根元素fontSize
function setRemUnit() {
  // 设计稿宽度为375px
  const designWidth = 375;
  // 实际设备宽度
  const deviceWidth = document.documentElement.clientWidth || window.innerWidth;

  // 限制最大宽度，避免在平板等大屏设备上字体过大
  const maxWidth = 750;
  const width = Math.min(deviceWidth, maxWidth);

  // 计算根元素fontSize，设计稿1px = 0.01rem
  // 例如：设计稿375px宽度对应根元素fontSize为37.5px，1rem = 37.5px
  document.documentElement.style.fontSize = (width / designWidth) * 37.5 + "px";
}

// 初始化
setRemUnit();

// 监听窗口大小变化
window.addEventListener("resize", setRemUnit);

// 监听屏幕旋转事件
window.addEventListener("orientationchange", setRemUnit);

```

```js
// 在main.tsx引入
import "./utils/rem.js";
```

```js
//post.config.js
import autoprefixer from "autoprefixer";
import pxtorem from "postcss-pxtorem";
export default {
  plugins: [
    autoprefixer(),
    pxtorem({
      rootValue: 75,
      propList: ["*"],
      unitPrecision: 5,
      selectorBlackList: ["ignore-rem"],
      replace: true,
      mediaQuery: false,
      minPixelValue: 1,
      exclude: /node_modules/i,
    }),
  ],
};
```

固定内容区域是750px，且居中显示。 >750px的设备则居中显示。 <750px的缩放显示，最小的显示尺度在375px。
```css
#root {
  min-width:375px;
  max-width: 750px;
  margin: 0 auto;
  padding: 16px;
  text-align: center;
  background-color: #ccc;
  overflow: auto;
  height: 100%;
}
```

#  数据大屏适配方案 (vw vh、rem、scale)

适配方案分析
| 方案 | 实现方式 | 优点| 缺点|
|---|---|---|---|
| vw vh | 1.按照设计稿的尺寸，将 px 按比例计算转为 vw 和 vh | 1.可以动态计算图表的宽高，字体等，灵活性较高 2.当屏幕比例跟 ui 稿不一致时，不会出现两边留白情况 | 1.每个图表都需要单独做字体、间距、位移的适配，比较麻烦 |
| scale | 1.通过 scale 属性，根据屏幕大小，对图表进行整体的等比缩放| 1.代码量少，适配简单 2.一次处理后不需要在各个图表中再去单独适配 | 1.因为是根据 ui 稿等比缩放，当大屏跟 ui 稿的比例不一样时，会出现周边留白情况 2.当缩放比例过大时候，字体会有一点点模糊，就一点点 3.当缩放比例过大时候，事件热区会偏移。 |
| rem + vw vh | 1.获得 rem 的基准值 2.动态的计算 html 根元素的 font-size 3.图表中通过 vw vh 动态计算字体、间距、位移等 | 1.布局的自适应代码量少，适配简单 | 1.因为是根据 ui 稿等比缩放，当大屏跟 ui 稿的比例不一样时，会出现周边留白情况 2.图表需要单个做字体、间距、位移的适配|

如果想简单，客户能同意留白，选用 scale 即可
如果需要兼容不同比例的大屏，并且想在不同比例中都有比较好的效果，图表占满屏幕，类似于移动端的响应式，可以采用 vw vh 的方案
至于 rem，个人觉得就是 scale 和 vw vh 的综合，最终的效果跟 scale 差不多

### 方案一

实现思路

```js
假设设计稿是 1920 * 1080
1920 -> 100vw
1080 -> 100vh

如果有个div是 300*300
width = (300/1920)*100vw
height = (300/1080)*100vh
```

css 方案 sass

```css
/* utils.scss */
// 使用 scss 的 math 函数，https://sass-lang.com/documentation/breaking-changes/slash-div
@use "sass:math";

// 默认设计稿的宽度
$designWidth: 1920;
// 默认设计稿的高度
$designHeight: 1080;

@function vw($px) {
  @return math.div($px, $designWidth) * 100vw;
}

// px 转为 vh 的函数
@function vh($px) {
  @return math.div($px, $designHeight) * 100vh;
}
```

```css
使用 .box {
  width: vw(300);
  height: vh(100);
  font-size: vh(16);
  background-color: black;
  margin-left: vw(10);
  margin-top: vh(10);
  border: vh(2) solid red;
}
```

图标字体、间距、位移等尺寸自适应

```js
function fitChatSize(size,defaultWidth = 1920) {
    const clientWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth
    if(!clientWidth) reutrn size;
    let scale = (clientWidth/defaultWidth)/size;
    return Number((size*scale).toFixed(3));
}
```

使用

```js
// echart等配置
const option = {
  backgroundColor: "transparent",
  tooltip: {
    trigger: "item",
    formatter: "{a} <br/>{b} : {c}%",
  },
  grid: {
    left: fitChartSize(10),
    right: fitChartSize(20),
    top: fitChartSize(20),
    bottom: fitChartSize(10),
    containLabel: true,
  },
  // ....
};
```

### 方案二

实现思路：
当屏幕宽高比 < 设计稿宽高比，我们需要缩放的比例是屏幕宽度 / 设计稿宽度 。上下留白
当屏幕宽高比 > 设计稿宽高比，我们需要缩放的比例是屏幕高度 / 设计稿高度。 左右留白。

```js
handleScreenAuto();
//初始化实现
window.onresize = () => handleScreenAuto();

function handleScreenAuto() {
  const designDraftWidth = 1920; //设计稿的宽度
  const designDraftHeight = 960; //设计稿的高度
  // 根据屏幕的变化适配的比例
  const scale =
    document.documentElement.clientWidth /
      document.documentElement.clientHeight <
    designDraftWidth / designDraftHeight
      ? document.documentElement.clientWidth / designDraftWidth
      : document.documentElement.clientHeight / designDraftHeight;
  // 缩放比例
  document.querySelector(
    "#screen"
  ).style.transform = `scale(${scale}) translate(-50%, -50%)`;
}
```

css 部分

```css
.screen-root {
  height: 100%;
  width: 100%;
  #screen {
    display: inline-block;
    width: 1920px; //设计稿的宽度
    height: 960px; //设计稿的高度
    transform-origin: 0 0; //设置动画的基点
    translate(-50%, -50%);
    position: absolute;
    left: 50%; // 距离父亲50%
    top: 50%; 距离父亲50%
  }
}
```

### 方案三

实现思路：

1. 计算 rem 基准值 1920/10 = 192;
2. 所有元素长宽位置，字体全部转化为 rem
3. 网页加载后，js 计算浏览器高宽度，并设置 html 的 fontsize

初始计算 fontSize

```js
(function init(screenRadioByDesign = 16 / 9) {
  let doEle = document.documentElement;
  function setHtmlFontSize() {
    const clientRadio = doEle.wdith / doEle.height;
    const scale =
      clientRadio > screenRadioByDesign ? clientRadio / screenRadioByDesign : 1;
    const fontSize = (scale * doEle.wdith) / 10;
    doEle.style.fontSize = fontSize.toFixed(3) + "px";
  }
  setHtmlFontSize;
  window.addEventlistenr("resize", setHtmlFontSize);
})();
```

图标的字体、间距、位移用方案一 vw、vh 的实现方式。
