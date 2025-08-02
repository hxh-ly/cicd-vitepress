# 微前端样式隔离
> 在微前端架构中，样式隔离 是一个非常重要的问题，否则不同子应用的 CSS 会互相污染，导致样式错乱。我们来看看 qiankun、Wujie 和 micro-app 是如何实现样式隔离的
## qiankun的样式隔离
qiankun 是基于 **single-spa** 和 **JS 沙箱** 实现的微前端框架，它提供了两种主要的样式隔离机制：
### 动态样式隔离
- qiankun会在子应用加载的时候，动态解析所有`<style> <link>`
- 使用`ScopedCSS`的模式来给所有CSS选择器加上前缀，保证只作用在当前子应用的DOM节点上。
```css
.app-title{
    color:red;
}

[data-qiankun="sub-app-1"] .app-title {
color:red;
}
```
### Shadow DOM模式(可选)
- qiankun允许使用 `experimentalStyleIsolation:true`开始Shadow DOM隔离。
- 样式和DOM被完全封装在Shadow Tree内，不会与外部冲突。
- 缺点时：Shadow DOM内部的全局样式（body、html）不会继承主应用的样式


## Wujie的样式隔离
Wujie 是一款轻量且高性能的微前端解决方案，内部实现更加细致。
### 内置 Shadow DOM 隔离
- Wujie 默认开启 Shadow DOM 隔离模式。
- 子应用所有 DOM 都会被插入到 Shadow DOM 内部，这样主应用和其他子应用都无法影响它的样式。
- 这意味着：即使是全局样式（如 body { margin: 0 }）也无法污染到子应用。

### 样式沙箱处理
- 除了 Shadow DOM，Wujie 还会拦截所有 `<style>` 和 `<link>` 标签，将其作用域局限在 Shadow Root 内部。
- 支持`::post` 和 `::slotted`机制来暴露特定DOM样式给主应用。

## micro-app的样式隔离
micro-app 是一款轻量的微前端框架，注重性能与隔离。

### 基于 Shadow DOM 和 Style Scoped
- micro-app 优先使用 Shadow DOM 进行隔离，子应用的所有 DOM 节点会自动插入 Shadow Tree 中。
- 如果开启 disableSandbox，会降级为 ScopedCSS 处理。

### ScopedCSS 隔离
- 如果浏览器不支持 Shadow DOM，micro-app 会自动对 `<style>` 标签进行解析和作用域隔离。
```js
/* 子应用中的样式 */
.header {
  color: blue;
}

/* 处理后 */
micro-app[name="sub-app-1"] .header {
  color: blue;
}
```

## 总结对比

|框架|样式隔离方法|兼容性|隔离效果|性能损耗|
|---|---|---|---|---|
|qiankun|Shadow DOM + ScopedCSS|高|存在性能损耗|
|Wujie|Shadow DOM + 样式沙箱|IE11 |中|低|
|micro-app|Shadow DOM + ScopedCSS|高|强|低|