# wujie微前端的实现方案 
## 应用加载机制和js沙箱机制
将子应用的`js`注入主应用同域的`iframe`运行，`iframe`是一个原生的`window`沙箱，内部有完整的`history` `locaton`接口，子应用实例`instance`运行在`instance`，路由也彻底与主应用解耦。可以直接在业务组件里面启动应用

### 1 无界的应用加载机制：子应用 JS 在 “同域 iframe” 中运行
无界加载子应用的核心方式是：将**子应用的 JavaScript 代码注入到主应用同域的 iframe 中执行**，而非直接在主应用的全局环境
- **同域iframe的意义**； 主应用与 iframe 保持相同域名（或子域名，通过 CORS 配置允许通信），避免了跨域限制。这使得主应用与子应用之间可以通过`window.parent`（子应用访问主应用）或`iframe.contentWindow`（主应用访问子应用）直接通信，无需复杂的跨域代理，同时保留了 iframe 的隔离特性。

- **加载流程简化**:主应用先创建一个隐藏的同域 iframe，然后将子应用的入口 JS（如app.js）通过script标签插入到 iframe 中，子应用的代码在 iframe 的环境中初始化、渲染，最终将渲染结果 “挂载” 到主应用的指定容器中（用户看到的是整合后的界面）。

### 2.JS 沙箱机制：利用 iframe 的原生隔离特性
“沙箱（Sandbox）” 的核心目的是`隔离子应用与主应用、子应用之间的代码环境`，避免全局变量污染、API 冲突等问题。无界的沙箱机制直接基于浏览器原生的 iframe 实现：

收益
- 组件方式来使用微前端

- 一个页面可以同时激活多个子应用

- 天然js沙箱

- 应用切换没有清理成本


## 路由的同步机制
在`iframe`内部进行`history.pushState`，浏览器会自动在`join session history`中添加`iframe`的seesion-history，浏览器的前进、后退在不做任何处理的情况下可以直接作用于子应用

劫持`iframe`的`history.pushState`和`history.replaceState`,就可以将子应用的`url`同步到主应用的`query`参数哈桑，当刷新浏览器初始化`iframe`，读回子应用的`url`并使用`iframe`的`history.replaceState`进行同步。

### 路由彻底解耦：子应用拥有独立的 history/location
- iframe 内部有完整的 history/location 接口：每个 iframe 都有独立的history对象（用于路由跳转，如history.pushState）和location对象（用于获取当前 URL），与主应用的history完全分离。
- 子应用路由独立运作:子应用的路由跳转（如从/sub/page1到/sub/page2）只会修改 iframe 内部的history和location，不会影响主应用的路由状态；反之，主应用的路由变化（如从/main/home到/main/about）也不会干扰子应用的路由。这种 “彻底解耦” 避免了路由冲突（如主应用和子应用路由路径重叠）。


收益
- 浏览器刷新、前进、后退都可以作用子应用
- 实现成本低、无需复杂的监听来处理同步问题
- 多应用同时激活也能保持路由同步

## iframe连接机制和css沙箱机制
无界采用webcomponent来实现页面的样式隔离，无界会创建一个wujie自定义元素，然后将子应用的完整结构渲染在内部
子应用的实例instance在iframe内运行，dom在主应用容器下的webcomponent内，通过代理 iframe的`document`到`webcomponent`，可以实现两者的互联。
将document的查询类接口：getElementsByTagName、getElementsByClassName、getElementsByName、getElementById、querySelector、querySelectorAll、head、body全部代理到webcomponent，这样instance和webcomponent就精准的链接起来。当子应用发生切换，`iframe`保留下来，子应用的容器可能销毁，但`webcomponent`依然可以选择保留，这样等应用切换回来将webcomponent再挂载回容器上，子应用可以获得类似`vue`的`keep-alive`的能力.

### 实现子应用的“隔离”和“关联”
- WebComponenet：提供DOM容器和样式隔离，确保子应用DOM不污染子应用。
- iframe：提供JS沙箱，确保子应用JS逻辑不干扰主应用
- docment代理：解决JS环境与DOM容器的“失联”问题，让子应用DOM操作能精准作用到实际渲染的节点上。

收益：
- 天然css沙箱
- 天然适配弹窗
- 子应用保活
- 完整的DOM结构

## 通信机制
- props 注入机制
子应用通过`$wujie.props`可以轻松拿到主应用注入的数据

- window.parent 通信机制
子应用`iframe`沙箱和主应用同源，子应用可以直接通过`window.parent`和主应用通信

- 去中心化的通信机制
无界提供了`EventBus`实例，注入到主应用和子应用，所有的应用可以去中心化的进行通信

收益
- 多应用同时激活
- 组件化的使用方式
- 应用级别的keep-alive
- 纯净无污染
- 性能和体积兼具
- 开箱即用


## 运行模式
- 保活
保留实例，`webcomponent`保留在内存中，当子应用重新激活无界将内存的`webcomponent`重新挂载到容器。
- 单例
页面切换，实例(iframe,框架实例，全局数据)保留，`window.__WUJIE_UNMOUNT`执行，清除状态，卸载dom
- 重建
页面切换，实例销毁