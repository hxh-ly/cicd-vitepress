# JS隔离的实现原理
> 在微前端架构，不同的子应用运行在同一个主应用的环境下，共享一个`window`对象、全局事件、全局变量，为了避免互相污染，三大微前端框架(qianduan、Wujie、micro-app)都引入了**JS隔离机制**
## Qiankun的JS隔离机制
基于Proxy沙箱和Snapshot沙箱
### Proxy沙箱
- QianKun的沙箱主要是基于ES6的`proxy`实现，通过代理`window`对象来隔离子应用的全局状态。
- 在Proxy沙箱中，子应用内部对`window`的读写并不会影响到主应用。
- 实现原理
- - 当子应用加载时，会创建一个代理对象`proxy`
```js
const sandbox = new Proxy(window,{
    get(target,prop) {
        return prop in target?target[prop]:undefined;
    }
    set(target, prop, val) {
        target[prop] = val;
        return true;
    }
})
```
- - 访问`window`当任何属性都会被代理，所有修改只在当前作用域生效。
- - 子应用卸载时，会清空沙箱环境

### Snapshot沙箱
- 这是Qiankun的另一种隔离模式，适合不支持Proxy的低版本浏览器
- 主要是通过在挂载和卸载时，保持和恢复`window`的状态
```js
// 激活前保存window的状态
const snapshot = {...window};
// 激活后还原window的状态
Object.keys(snapshot).forEach((key)=> window[key] = snapshot[key])
```

### 总结
- 主要靠`proxy`代理`window`对象
- 变量修改、事件注册都在沙箱内部独立存在。
- 卸载时自动回复，防止全局污染。

## Wujie的JS隔离机制
基于**iframe沙箱**和**Proxy沙箱**的双重隔离

### iframe沙箱
- Wujie的核心隔离时基于`<iframe></iframe>`
- `<iframe></iframe>`天然隔离JS作用域，CSS和DOM
- 每一个子应用在一个独立的`iframe`内执行
```html
<iframe src="" sandbox="allow-scripts allow-same-origin"></iframe>
```
- Wujie会自动设置`iframe`的`sandbox`属性，屏蔽跨域访问，防止主应用修改。

### Proxy沙箱
- Wujie内部通过`Proxy`封装了iframe的`window`，对子应用内部的修改都映射到iframe到作用域中
```js
const proxyWindow = new Proxy(iframe,contentWindow,{
 get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
})
```
### 总结
- 基于原生`iframe` 完全独立的JS沙箱
- 通过`Proxy`代理对`window`的操作，避免污染
- 隔离最彻底，适合跨域场景。

## micro-app的JS隔离机制

### Proxy沙箱
基于Proxy沙箱+ Patch DOM API
- micro-app和qiankun类似，也使用Proxy沙箱隔离JS作用域
- 当子应用执行修改`window`的操作时，会被沙箱捕获并仅在内部生效。
```js
const proxyWindow = new Proxy(window, {
  get(target, prop) {
    return prop in target ? target[prop] : undefined;
  },
  set(target, prop, value) {
   if (target.hasOwnProperty(prop)) {
      target[prop] = value;
    } else {
      target[prop] = value;
    }
    return true;
  },
});
```

### Patch DOM API
- micro-app还会对dom相关api做隔离处理
  - `document.getElementById` 、`document.querySelector`等方法会自动限定作用域。
  - 事件监听 `addEventListener`也会仅限当前子应用内。

### 总结
- 通过`proxy`实现js隔离，通过DOM Patch实现更细粒度的控制
- 自动隔离DOM事件，保证不同子应用互不干扰。
- 兼容性更好，支持IE11以上。

## 三者对比
|特性|Qiankun|Wujie|micro-app|
|---|---|---|---|
|隔离方式|Proxy|iframe+proxy|proxy+patch DOM API|
|全局变量隔离|强，基于Proxy|最强，基于iframe|强，基于Proxy|
|Dom操作隔离|需要手动ScopedCss|iframe内天然隔离|自动Patch DOM|
|事件隔离|沙箱内独立|iframe内独立|自动隔离|
|兼容性|高（不支持ie11）|中（部分新特性需要polyfill）|高（支持IE11以上）|
|隔离彻底性|中|最彻底|高|