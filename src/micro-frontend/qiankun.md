# 乾坤微前端方案

## 1.应用注册与加载
- 注册子应用： 通过`registerMicroApps`方法注册微应用，主应用保存子应用的关键信息（如`name`、`entry`）入口地址、`activeRule`激活路由规则。
```js
registerMicoApps({
    name:'sub-app1',
    entry:'https://app1.com/main.js',
    activeRule: function (location) {
        console.log(location) // => https://app1.com/main
        return ['/main'].some(item => location.pathname.indexOf(item) > -1)
    },
    props: {}//给微应用传值
})
```

- 加载子应用
当路由匹配`activeRule`，主应用通过`HTML入口解析`加载子应用资源：
- 先请求子应用的入口HTML，解析script和link，提取js/css地址
- 动态创建script和link，加载这些资源到主应用中。

## 2.隔离机制（核心增强点）
JS隔离

乾坤的隔离性是其相比 single-spa 的核心优势，主要通过以下方式实现：
提供两种沙箱模式：
- 快照：当子应用激活时，记录全局变量快照；↩卸载时，回复快找，清楚子应用修改。
- 代理沙箱：子应用对`window`的读写操作会被代理到一个独立的对象中，不影响真实`window`

CSS隔离

防止子应用样式污染，乾坤提供两种方案：
- CSS Module 或 BEM 规范（推荐配合使用）：通过工程化手段（如 CSS Module）或命名规范（如 BEM）避免类名冲突。
- Shadow DOM 隔离（可选）：将子应用挂载到 Shadow DOM 中，利用浏览器原生的样式隔离特性（子应用样式仅作用于 Shadow DOM 内部）。

通讯机制

乾坤提供了全局事件总线和props 传递两种通信方式，保证主应用与子应用的安全交互：
- 全局事件总线
```js
// 主应用
const { setGlobalState } = initGlobalState({ user: null });
setGlobalState({ user: { name: '张三' } });

// 子应用
export function mount(props) {
  props.onGlobalStateChange((state) => {
    console.log('子应用收到主应用数据：', state.user); // { name: '张三' }
  });
}
```

- props 传递：
主应用注册子应用时，可通过 props 传递数据或方法给子应用，子应用在生命周期钩子（如 mount）中接收。

## 路由管理
乾坤继承了 single-spa 的生命周期规范，为子应用定义了标准化的生命周期钩子，主应用通过调用这些钩子实现子应用的 “加载 - 激活 - 卸载” 流程：
- boostrap:子应用初始化（只执行一次，如初始化路由、全局变量）。
- mount:子应用激活（渲染 DOM 到主应用的容器中）。
- unmount:子应用卸载（清理 DOM、事件监听、定时器等）。
- update(可选)：子应用更新


