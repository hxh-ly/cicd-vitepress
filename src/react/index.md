# React
欢迎来到 React 文档！
## 发展历史
| 年份 | 版本 | 关键特性 |
|------|------|----------|
| 2013 | v0.3 | 开源 |
| 2015 | v0.14 | 拆分为 `react` 和 `react-dom` |
| 2016 | v15 | 首个稳定版 |
| 2017 | v16 (Fiber) | 新核心架构、Fragment、Portal、Error Boundaries |
| 2018 | v16.6 | `React.memo`、`lazy`、`Suspense` |
| 2019 | v16.8 | **Hooks** |
| 2020 | v17 | 过渡版本、新的 JSX 转换 |
| 2022 | v18 | **并发渲染**、自动批处理、Suspense 改进 |
| 2024 | v19 (Beta) | React Compiler、Actions、Web Components 支持 |

## React的核心理念
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