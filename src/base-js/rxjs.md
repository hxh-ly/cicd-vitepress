# rxjs
**RxJS = Reactive Extensions for JavaScript**，是**响应式编程（Reactive Programming）** 的 JS 实现。核心思想：**把异步事件（请求、点击、定时器、websocket）当作可观察的流（Observable），通过管道操作符组合、转换、过滤、合并事件**。
> 对比：Promise 处理**单次异步**；RxJS Observable 处理**一系列持续发生的事件流**。

##  observable（可观察对象/流）
数据源：会推送数据给订阅者，可以是：点击、定时器、接口请求、WebSocket、状态变更
- Promise：**惰性执行？不，Promise 创建就立刻执行**
- Observable：**惰性**，只有被 `subscribe()` 订阅之后，才开始发射数据。

## observer 被动
消费者，是一个对象，包含三个回调
```js
{
  next: (val) => {}, // 收到正常数据
  error: (err) => {}, // 发生错误
  complete: () => {} // 流正常结束
}
```

## subscription(订阅)
`observable.subscribe()`返回的对象,可以用`unsubscribe`取消订阅，释放资源。
> 重点：这是 RxJS 最大优势之一，手动取消，防止内存泄漏（H5 页面销毁时取消请求 / 事件监听）。

## Operators(操作符)
纯函数，用来在管道 `pipe()` 里处理流，**不修改原 Observable，返回新流**。
- 创建类：`of` `from` `fromEvent` `ajax`
- 转化类 `map` `mergeMap` `switchMap` `concatMap`
- 过滤类 `filter` `debounceTime` `throttleTime` `take`
- 组合类 `combineLatest` `forkJoin` `merge`
- 错误处理 `catchError` `retry`

### 用法
```js
// -------创造类---------
const input = document.querySelector('#search') as HTMLInputElement;
fromEvent(input, 'input').subscribe(e=>{
  console.log('input event', (e as InputEvent).target.value)
});
//
ajax('https://jsonplaceholder.typicode.com/todos/1')
.subscribe({
  next: res => console.log('ajax result', res.response),
  error: err => console.error('ajax error', err)
})
// -------转化类---------
// 并行，每来一个值，开启内部流；多个内部流**并行执行，不取消旧的**
of(1,2).pipe(
  mergeMap(id => ajax(`https://jsonplaceholder.typicode.com/todos/${id}`))
).subscribe(res=>console.log('mergeMap res', res.response));
// 收到新值，立刻取消上一个未完成的内部 Observable**（搜索框联想经典！防竞态）
const input = document.querySelector('#search') as HTMLInputElement;
fromEvent(input, 'input').pipe(
  map(e => (e as InputEvent).target.value),
  filter(kw => !!kw),
  switchMap(keyword => ajax(`https://xxx/search?q=${keyword}`))
).subscribe(res=>console.log('switchMap search', res.response));
// concatMap 串行排队，必须等上一个内部流 complete，才执行下一个**
of(1,2,3).pipe(
  concatMap(id => ajax(`https://jsonplaceholder.typicode.com/todos/${id}`))
).subscribe(res=>console.log('concatMap', res.response));

// -------过滤类---------
// debounceTime
const input = document.querySelector('#search') as HTMLInputElement;
fromEvent(input, 'input').pipe(
  map(e => (e as InputEvent).target.value),
  debounceTime(300) // 停止输入300ms后下发
).subscribe(v=>console.log('debounce',v));
// throttleTime
fromEvent(document, 'scroll').pipe(
  throttleTime(200)
).subscribe(()=>console.log('scroll throttle'))
// take
of(10,20,30,40).pipe(
  take(2)
).subscribe({
  next:v=>console.log('take',v),
  complete:()=>console.log('take完成')
}) // output:10,20 然后complete

// -------组合类---------
// combineLatest 多个流**全部至少发射过一次之后**；任意一个流更新，把所有流**最新值打包输出**
import { BehaviorSubject } from 'rxjs';
const a$ = new BehaviorSubject(1);
const b$ = new BehaviorSubject(10);

combineLatest([a$, b$]).subscribe(([a,b])=>{
  console.log('combineLatest', a,b)
})
a$.next(2);
b$.next(20); // 如果是普通的Subject，且b$.next未emit 则不会打印callback
// `forkJoin`：类似 Promise.all，**所有 Observable 全部 complete 之后，收集所有最后结果一次性返回**；任意一个报错整体报错
forkJoin([
  ajax('https://jsonplaceholder.typicode.com/todos/1'),
  ajax('https://jsonplaceholder.typicode.com/todos/2')
]).subscribe({
  next: ([res1, res2]) => {
    console.log('forkJoin all done', res1.response, res2.response)
  },
  error: err => console.error('forkJoin 其中一个失败', err)
})
// merge
const s1$ = of(1,2);
const s2$ = of(10,20);
merge(s1$, s2$).subscribe(v=>console.log('merge',v));// 输出顺序 1,2,10,20（如果是异步流会交叉输出）

// -------错误类---------
// catchError
ajax('https://jsonplaceholder.typicode.com/notfound')
.pipe(
  catchError(err => {
    console.error('捕获ajax错误', err);
    // 兜底返回默认值流
    return of({title:'默认兜底数据'})
  })
).subscribe(res=>console.log('catchError结果', res))
// retry
ajax('https://jsonplaceholder.typicode.com/notfound')
.pipe(
  retry(2) // 失败最多重试2次，总共尝试3次
).subscribe({
  next: res=>console.log(res),
  error: err=>console.error('重试全部失败', err)
})
```

## Subject(主体) 主动
既是 Observable 又是 Observer。可以手动调用 `.next()` 发射数据，**多播**：一个数据源，多个订阅者共享。
- subject：不会缓存历史值
- behaviorSubject：保存**最新值**，新订阅上来立刻拿到当前值（很多状态管理用它）
- ReplaySubject：缓存 N 条历史，新订阅可以拿到历史数据
```js
import {Subject} from 'rxjs'
const msg$ = new Subject<string>();
msg$.subscribe((v)=>console.log('A',v))
msg$.subscribe((v)=>console.log('A',v))

msg$.next('hello')
```

> BehaviorSubject(业务状态管理、用户信息、全局loading)适合
```js
import { BehaviorSubject } from 'rxjs';

// 初始值 'offline'
const status$ = new BehaviorSubject('offline');

// 订阅者，新订阅上来直接拿到当前最新值
status$.subscribe(v => console.log('当前网络状态：', v));

// 主动更新状态
status$.next('online');
status$.next('reconnecting');

// 任何地方随时拿到当前值
console.log(status$.value);
```

|类型|新订阅拿到什么|缓存规则|典型使用场景|
|---|---|---|---|
|Subject|❌ 拿不到历史值，只能接收**订阅之后**新推送的值|不缓存|事件总线、一次性通知、`takeUntil` 的销毁信号|
|BehaviorSubject| ✅ **立刻拿到最新 1 条值**（必须传入初始值）|永久保存最近 1 条|状态管理（loading、用户信息、全局状态）|
|ReplaySubject|N条历史，可设置过期时间|缓存 N 条，也可设置窗口时间|日志回放、消息历史，新订阅需要看最近多条消息|
|Async| ✅ **仅在流 complete 之后，拿到最后一条值**；complete 前订阅收不到任何 next |只缓存最后一条，complete 才对外推送|只关心异步任务最终结果，中间过程丢弃|

> RePlaySubject
```js
import { ReplaySubject } from 'rxjs';
const r$ = new ReplaySubject(2); // 缓存最近2条
r$.next(1);
r$.next(2);
r$.next(3);
r$.subscribe(v => console.log(v)); // 收到 2、3
```

> AsyncSubject
```js
import { AsyncSubject } from 'rxjs';
const a$ = new AsyncSubject<number>();
a$.next(1);
a$.next(2);
a$.subscribe(v => console.log(v)); // 此时无输出
a$.complete(); // complete触发，输出 2
```

## nest的rxjs使用场景
日志拦截器（tap）
```js
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LogInterceptor implements NestInterceptor {
  private logger = new Logger(LogInterceptor.name);
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${req.method} ${req.url} success, cost ${Date.now() - start}ms`),
        error: err => this.logger.error(`${req.method} ${req.url} failed`, err.message)
      })
    )
  }
}
```
封装返回
```js
@Injectable()
export class ResponseWrapInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(rawData => ({
        code: 200,
        msg: 'ok',
        data: rawData
      }))
    )
  }
}
```
接口超时
```js
import { RequestTimeoutException } from '@nestjs/common';
import { catchError, timeout, TimeoutError, throwError } from 'rxjs';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(3000),
      catchError(err => {
        if(err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('接口超时'))
        }
        return throwError(() => err);
      })
    )
  }
}
```
sse
```js
import { Controller, Get, Sse, MessageEvent } from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';

@Controller('sse')
export class SseController {
  @Get('stream')
  @Sse()
  stream(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map((i): MessageEvent => ({
        data: { tick: i }
      }))
    )
  }
}
```
微服务
```js
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class OrderService {
  constructor(@Inject('USER_SERVICE') private userClient: ClientProxy) {}

  batchQuery() {
    // 并行调用多个微服务
    return forkJoin([
      this.userClient.send({cmd:'getUser'}, {id:1}),
      this.userClient.send({cmd:'getProfile'}, {id:1})
    ]).pipe(
      catchError(() => of([null, null]))
    )
  }
}
```