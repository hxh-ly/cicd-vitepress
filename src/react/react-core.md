# React原理

## 65. react 的并发机制是怎么实现的

场景：输入框+筛选高亮列表。如果顺序更新，如果要处理的 fiber 节点比较多，渲染一次就比较慢，这时候用户输入的内容可能就不能及时渲染出来。 react18 实现了这样的一套并发机制。
并发就是在循环里多了打断和恢复的机制，所以代码是这样的：

```js
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```

怎么打断：每个 fiber 节点，shouldYield 返回 true 时终止这次循环
怎么恢复：每次 setState 引起的渲染都是有 schedule 调度执行的，它维护了一个任务队列，上一个执行完就执行下一个，没渲染完的话，再加一个新任务不就行了。
怎么判断是中断还是渲染完：wip 是否为空
shouldYield 是怎么判断：根据过期时间，每个任务开始记录一个时间，如果处理完超时，就打断

```js
function shouldYieldToHost() {
  var timeElapsed = exports.unstable_now() - startTime;
  if (timeElapsed < frameInterval) {
    // 5ms
    return false;
  }
  return true;
}
```

会根据任务优先级打断吗：不会，任务优先级只影响 Scheduler 里的 taskQueue 的排序结果，但打断只会根据过期时间。
那这样高任务不还是得不到立即执行？也不会，一个时间分片 5ms，会按优先级排序的任务来执行，让高优先级任务得到及时处理。

react 中的 Schedule 优先级

```js
var ImmediatePriority = 1; // click input
var UserBlockingPriority = 2; //scroll drag mouseover
var NormalPriority = 3;
var LowPriority = 4;
var IdlePriority = 5;
```

并发模式下不同的 setState 的优先级不同，就是通过指定 Scheduler 的优先级来实现的
Scheduler 是分离的一个包，React 有自己的一套优先级机制 Lane；
react 还给事件也区分了优先级：

- DiscreteEventPriority 离散事件优先级
- ContinuousEventPriorty 连续事件优先级
- DefaultEventPriority 默认事件优先级
- IdleEventPriority 空闲事件优先级

react 通过 Schedule 时，优先级时怎么转的： 先把 Lane 转化为事件优先级，然后在转化为 Scheduler 优先级。

```js
switch (lanesToEventPriority(nextLanes)) {
  case DiscreteEventPriority:
    schedulerPriorityLevel = ImmediatePriority;
    break;
  case ContinuousEventPriority:
    schedulerPriorityLevel = UserBlockingPriority;
  case NormalPriority:
    schedulerPriorityLevel = DefaultEventPriority;
  case IdlePriority:
    schedulerPriorityLevel = IdleEventPriority;
}
```

react 并发模式的一些 api:
同步执行：

```js
function renderRootSync(root, lane) {
  do {
    try {
      workLoopSync();
    } catch (thrownValue) {
      handleError(root, thrownValue);
    }
  } while (true);
}
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}
```

并发执行：

```js
function renderRootConcurrent(root, lane) {
  do {
    try {
      workLoopConcurrent();
    } catch (thrownValue) {
      handleError(root, thrownValue);
    }
  } while (true);
}
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```

结论：能开启设置时间分片的 lane 的 api 都是基于并发的 api
也不是所有的特性都要时间分片，只有部分需要：
那就是如果这次 schedule 更新里包含了并发特性，就是用 workLoopConcurrent，否则走 workLoopSync

```js
var shouldTimeSlice =
  !includesBlockingLane(root, lanes) && !includesExpiredLane(root, lanes);
var exitStatus = shouldTimeSlice
  ? workLoopConcurrent(root, lanes)
  : workLoopSync(root, lanes);
```

useTransition useDeferredValue

```js
const [isPending, startTransition] = useTransition();
```

列子标上不同的优先级
useTransition 是把回调函数里的更新设置为连续事件的优先级，比离散事件的优先级低。useDeferredValue 则是延后更新 state 的值。

```jsx
export default function App() {
  const [text, setText] = useState('guang');
  const [text2, setText2] = useState('guang2');

  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(() => {
      setText('dong');
    });

    setText2('dong2');
  }

  return (
    <button onClick={handleClick}>{text}{text2}</button>
  );

function App() {
  const [text, setText] = useState("");

  const handleChange = (e) => {
    setText(e.target.value);
  };

  return (
    <div>
      <input value={text} onChange={handleChange}/>
      <List text={text}/>
    </div>
  );
};
```

### 总结

react 的渲染机制 render + commit，render 实现 vdom 转 fiber 的 reconcile，之后 commit 阶段执行增删改 dom。更新 ref，调用 effect 回调和生命周期函数。
setState 引起多次渲染，重要程度不同，优先级不同，react 为了高优先级的更新先渲染，实现了并发模式。
打断和恢复，实现 shouldYield 的时间分片机制
react 的 lanes 优先级机制，基于二进制设计。 调度任务时先把 lanes 转为事件优先级，然后转为 scheduler 的优先级。
时间分片 workloop+优先级调度，就是 react 的并发机制的实现原理
