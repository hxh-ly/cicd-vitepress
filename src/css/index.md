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