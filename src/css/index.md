## css解析是在什么时候
- css解析会阻塞渲染树构建，但不会阻塞HTML解析（和css可并行）
- css未解析完成，浏览器会延迟渲染。
- css解析的核心产物树CSSOM --》 描述所有样式规则的树形结构，包括选择器、样式属性以及优先级等信息。
css核心解析实际是：
- 首次加载阶段：与html解析并行，遇到css资源触发（外部/内部），生成CSSOM
- 动态更新阶段：CSS内容变化，重新解析并更新CSSOM

本质上为渲染树提供样式信息
## 垂直居中的几种方式

flex

```css
.t1 {
  display: flex;
  justify-content: center;
  align-items: center;
}
```

grid

```css
.parent {
  display: grid;
  align-items: center;
  /* 可选：水平居中加 justify-items: center; */
  height: 300px;
}
.child {
  /* 无需额外样式 */
}
```

margin1

```css
.t1 {
  position: relative;
}
.t2 {
  margin: auto;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

margin2

```css
.t1 {
  position: relative;
}
.t2 {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
}
```

Line-height（单行文本专用）

```css
/* 父元素 */
.parent {
  height: 100px; /* 固定高度 */
  line-height: 100px; /* 行高 = 父元素高度 */
}

/* 子元素（文本） */
.child {
  /* 文本默认垂直居中 */
}
```

Table-cell（传统方法）

```css
.parent {
  display: tall-cell;
  vertical-align: middle;
  height: 300px;
}
.child {
  display: inline-block; /* 才会被 vertical-align 影响 */
}
```

### 总结

- 现代项目首选：flex / grid
- 未知高度： position + Transform
- 单行文本：直接用 line-height
- 兼容性要求高（如 IE8）：Table-cell 布局

## 块元素和行内元素的差异

|差异|块|行内|
|占据空间的方式|独占一行|不独占一行|
|宽高|有效|宽高有元素内容决定|
|边距|有效|左右有效，上下无效|
|代表元素|div/navigator/aside/article/p/h1-h6 |span/strong/a/img/input |
|嵌套|可嵌套 块/行内| 可嵌套行内/文本 |
注意：img/input 虽然是行内元素（替换元素），但是可以设置宽高（内容由外部资源决定、图片的实际尺寸）

## rem优缺点
优点
- 天然支持响应式布局
- 避免嵌套
- 灵活适配设计稿
- 兼容性良好

缺点
- 依赖根元素字体大小
- 精确尺寸控制不便
- 转化成本 （rem->px）
- 极端场景兼容性（ie8完全不支持）


## 0.5px的线
```css
.line {
  width:300px; 
  height:1px;
  transform:scaleY(0.5);
  background:black;
  transform-origin:top; /* 为了对齐 */
}

.vertical-line {
  width:1px; 
  height:300px;
  transform:scaleX(0.5);
  background:black;
  transform-origin:left; /* 为了对齐 */
}
```

## float 
float 是 CSS 早期的布局属性，设计初衷是实现 “文字环绕元素” （如新闻中图片左 / 右浮动，文字围绕图片排列）
### 基本取值
取值：`left`、`right`、`none`、`inherit`
核心行为：浮动元素会”脱离文档流“，但不会完全脱离(区别`position:absolute`) ---- 文本、行内元素会自动环绕浮动元素、而非覆盖。

### 关键特性
- 脱离文档流，但保留文字环绕：
- 包裹性 （内容宽度会“收缩”以适应内容）
- 破坏性（高度塌陷）
- 浮动元素同行排列。多个同方向浮动的元素（如均为 float: left）会自动在一行排列，超出父容器宽度时会换行
### 清除浮动
为解决 “高度塌陷” 和 “浮动元素影响后续布局” 的问题，需通过 clear 属性 或 learfix 技巧 清除浮动：
```css
.st{
overflow:hidden;
}
.clearfix::after {
  content: "";
  display: block;
  clear: both; /* 不允许两边有浮动元素 */
  visibility: hidden;
  height: 0;
}
```

### grid布局
### 网格编排
```css
.parent{
  display:grid; /* 所有元素会变成块级*/
  grid-template-rows:1fr 1fr 1fr; /* 这里表示三行，每行占1/3。fr时fragment缩写 */
  grid-template-columns:repeat(3,1fr);/* repeat是 重复 */
  grid-auto-rows:minmax(80px,auto); /* 隐式网格布局,也就是规定 子项多于规定的数量时 的编排尺寸， 函数minmax表示[80px,auto-占满] */

}
/* 父容器 */
auto-fill: 尽可能填充更多的容器
auto-fit: 在一行的时候，和fill有区别，区别在于刚好填充满，而auto-fill是尽可能填充满。
```
### 子项放置 
```css
.parent {
  grid-template-areas: 
  'header header'
  'aside tab'
  'aside main'; 
  align-items:center;
  place-items:center center; /* 速写justify-items 和 align-items */

  justify-content: center; /* 定义轨道在容器中主轴的排列，必须容器有多余空间才生效 */
  justify-items: center; /* 定义子项在轨道中主轴的排列 */
}
.son {
  grid-column: grid-column-start grid-column-end; /* 用于控制自相跨越的列的网格线 */
  grid-auto-flow:row; /* 默认从左到右 从上到下*/
  grid-auto-flow:column dense; /* 默认从上到下，从左到右 */  /* dense表示紧凑排列 */
  align-self:end;
  place-self:center center; /* 速写justify-items 和 align-items */
}
.item:last-child{
  order:-1; /* 升序，最小的排在最前面 */
}
```