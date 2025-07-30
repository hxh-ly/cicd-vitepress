# React

欢迎来到 React 文档！

## 发展历史

| 年份 | 版本        | 关键特性                                       |
| ---- | ----------- | ---------------------------------------------- |
| 2013 | v0.3        | 开源                                           |
| 2015 | v0.14       | 拆分为 `react` 和 `react-dom`                  |
| 2016 | v15         | 首个稳定版                                     |
| 2017 | v16 (Fiber) | 新核心架构、Fragment、Portal、Error Boundaries |
| 2018 | v16.6       | `React.memo`、`lazy`、`Suspense`               |
| 2019 | v16.8       | **Hooks**                                      |
| 2020 | v17         | 过渡版本、新的 JSX 转换                        |
| 2022 | v18         | **并发渲染**、自动批处理、Suspense 改进        |
| 2024 | v19 (Beta)  | React Compiler、Actions、Web Components 支持   |

## React 的核心理念

声明式、组件化、和单向数据流

## 三大核心特性

虚拟 DOM、 生命周期管理、 hooks

## React 的 class 类有什么生命周期？

构建（constructor)： 派(getDerivedStateFromProps) -> 绘(render) -> 挂(componentDidMount)
| 方法 | 调用时机 | 用途 | 是否可调用 setState |
| ---- | ---- | ---- | ---- |
| constructor | 组件初始化 | 初始化 state，绑定方法 | ❌ |
| getDerivedStateFromProps | 每次渲染前 | 根据 props 更新 state | ❌ |
| render | 必须实现的方法 | 返回 jsx | ❌ |
| componententDidMount | 组件挂载后 | DOM 操作、网络请求、订阅 | ✅ |

变更 ： 派(getDerivedStateFromProps) -> 判(shouldComponentUpdate) -> 绘(render) -> 捕(getSnapShotBeforeUpdate) -> 更(componentDidUpdate)
| 方法 | 调用时机 | 用途 | 是否可调用 setState |
| ---- | ---- | ---- | ---- |
| getDerivedStateFromProps | 每次渲染前 | 根据 props 更新 state | ❌ |
| shouldComponentUpdate | 更新前 | 性能优化，控制是否渲染 | ❌ |
| render | 必须实现的方法 | 返回 jsx | ❌ |
| getSnapShotBeforeUpdate | Dom 更新前 | 获取 DOM 的快照信息 | ❌ |
| componentDidUpdate | 更新完成后 | DOM 操作，网络请求 | ✅ |

卸载： 清(componentWillUnmount)
| 方法 | 调用时机 | 用途 | 是否可调用 setState |
| ---- | ---- | ---- | ---- |
| componentWillUnmount | 组件卸载前 | 清理操作（计时器，订阅） | ❌ |

错误处理： 派(getDerivedStateFromError) -> 记(componentDidCatch)

| 方法                     | 调用时机           | 用途         | 是否可调用 setState |
| ------------------------ | ------------------ | ------------ | ------------------- |
| getDerivedStateFromError | 后代组件抛出错误后 | 渲染备用 UI  |                     |
| componententDidCatch     | 后代组件抛出错误后 | 记录错误形象 |                     |

附加：class 的生命周期怎么使用 hook 的对比

| 方法                     | hook                     | xx  | xx  |
| ------------------------ | ------------------------ | --- | --- |
| constructor              | useState 初始化          | xx  | xx  |
| getDerivedStateFromProps | useState+useEffect       | xx  | xx  |
| render                   | 函数组件本身             | xx  | xx  |
| componententDidMount     | useEffect                | xx  | xx  |
| shouldComponentUpdate    | useMemo                  | xx  | xx  |
| componententDidUpdate    | useEffect                | xx  | xx  |
| componententDidUnmount   | useEffect 返回的清理函数 | xx  | xx  |

## useCallback 和 useMemo

useCallback 和 useMemo 都是用于性能优化的 Hook，它们通过缓存计算结果来避免不必要的重复计算或渲染
| 特性 | useMemo | useCallback |
| ------------------------ | ------------------------ | --- |
| 返回值 | 缓存计算结果（值/对象/数组) | 缓存的函数本身 |
| 等效写法 | useMemo(()=>fn,deps) | useCallBack(fn,deps)|  
|优化目标| 避免重复计算、引用变化 | 避免函数重建、引用变化|
| 典型使用场景 | 复杂计算、稳定对象引用 | 事件处理函数、函数依赖稳定性 |
|何时使用| 计算成本高的值，useEffect 依赖，传递给子组件的 props（阻止子组件重新渲染） | props 传递给子组件，被 useEffect 依赖，需要稳定函数引用(debounce/throttle 等)|

## React 常见的性能优化手段

- 组件渲染优化
  React.memo
  shouldComponentUpdate

- hook 优化
  - useMemo
  - useCallback

- 列表渲染优化
  key 优化；虚拟列表优化`react-virtualized` `react-window`
- 代码分割和懒加载
  组件级别

```js
import LazyComponent = React.Lazy(()=>import('./HeavyComponent)')
function MyComponent(){

    return <>
    <Suspense fallback={}>
        <LazyComponent/>
    </Suspense>
     </>
}
```

路由级别

```js
  const router = CreateBrowserRouter([
      {
          path:'/lazy',
          component:React.lazy(() => import('./HeavyComponent'))
    },
    {
        path:'/',
        element:<Layout>,
        children:[
            {
                path:'dashboard',
                lazy:()=> import('./dashboard'),
            },
        ]
    }
  ])
```

- 状态管理优化
  - 拆分多个context
  - 精细化、原子化的状态管理(zustand/jotai)

- 渲染过程优化
  - 延迟更新非关键UI(useDeferredValue、useTransition)

- 内存优化
  - 清楚定时器，监听等资源
- 构建优化
  - treeShaking,bundle 优化，压缩等
  - 资源优化 ServiceWorker，HTTP缓存, CDN 加速，预加载，预执行，按需加载，缓存协商等
  - SSR优化，按需加载

## 优化策略优先级

1. 先测量：使用 Profiler 定位瓶颈(80/20 法则)
2. 关键路径优先:优化 👋 屏和核心交互
3. 渐进优化：避免过早优化
4. 权衡考虑：优化可能增加代码复杂度

### 指标：

- FP First Paint, FP
- FCP First Contentful Paint，FCP
- LCP Largest Contentful Paint,LCP
- TTI Time To Interactive，TTI
- FMP First Meaningful Paint, FMP
- FID First Input Delay， FID
- TBT Total Blocking Time, TBT

## React虚拟dom的好处
- 跨平台
- 内存轻量化，避免dom的开销