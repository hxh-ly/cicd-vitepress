# 后端
后端部分以node、nest为主

## Node是什么？优缺点？应用场景？
`Node.js`是一个开源`JavaScript`运行环境。在浏览器外，利用事件驱动，非阻塞和异步输入输出模型来提升性能。
### 优缺点
优点：
- 处理高并发场景性能更佳
- 适合io密集型应用，指的是应用在运行极限时，CPU占用率仍然很低。大部分时间在做io硬盘内存操作

缺点：
因为node是单线程
- 不适合CPU密集型应用
- 只支持单核cpu，不能充分利用cpu
- 可靠性低，一旦代码某个环节崩溃，整个系统都奔溃。

### 应用场景
- 善于I/O。不善于计算。因为Nodejs是单线程，如果计算（同步）太多。则会阻塞线程
- 大量并发I/O。应用程序内部程序并不需要进行非常复杂的处理。

## Node的stream的理解？应用场景
核心概念:用于处理**流式数据**，它提供一种抽象接口，允许你高效处理那些不需要（或不能）一次性全部加载到内存中的数据源或者目的地。
1. 数据分块处理。核心思想是把数据分割成较小块，然后逐步处理这些块，想象水流通过管道，而不是一次性搬动整个湖泊。
2. 内存效率。处理大型文件（如视频、日志、数据库备份）或持续产生的数据（如实时传感器数据、网络请求）时，Stream 允许你边读边处理边写，只保持当前处理块在内存中，极大降低内存占用，避免程序因处理大文件而崩溃
3. 时间效率。你可以在数据可用时立即开始处理第一个数据块，而无需等待整个数据源加载完毕。同样，处理完的数据块也可以立即发送到目的地。这显著减少了整体处理时间，尤其对于网络传输或实时处理。
4. 组合型。node的`pipe`可以轻松将多个流连接起来，`sourceStream.pipe(transfromStream).pipe(destination)`
5. 事件驱动。stream是Node.js事件驱动架构的典型表现。它们继承`EventEmitter`.通过事件（如 'data', 'end', 'error', 'finish'）通知你数据的到达、结束、错误或写入完成。

### 四种流类型
|名字|Readable Streams|Writable Stream|Duplex Streams|Transform Streams|
|---|---|---|---|---|
|介绍| 数据源。你可以从中读取数据。|数据目的地。你可以向其中写入数据。| 同时实现 Readable 和 Writable 接口。可以读也可以写，输入和输出端通常是独立的。|一种特殊的 Duplex 流。它的输出是其输入的某种计算或转换结果。写入转换流的数据经过处理后，通常会被读取出来。|
|例子|http请求、文件读取流`fs.createReadStream`、process.stdin、TCP sockets、`zlib.createGunzip()`|http响应，文件写入流，process.stdout/process.stderr,TCP socket,`zlib.createGzip()`|TCP socket, zlib 流 (如 zlib.createDeflate())，crypto 流 (如 crypto.createCipheriv()) |zlib 流 (压缩/解压), crypto 流 (加密/解密), 自定义的流用于解析 (如 JSON.parse 流)、重新格式化、添加/删除数据等|

### 背压
- 当**可读性流**生产数据的速度大于**可写流**消费数据的速度，就会产生背压。
- node的`stream`内部机制自动处理背压
- `pipe`方法，这套背压机制是自动处理的。

### 应用场景
凡事涉及处理**大量数据或持续数据流**的地方，都是它的用武之地。
1. 文件处理（大文件处理）
   - 复制大文件 `fs.createReadStream('source.iso').pipe(fs.createWriteStream('copy.iso'))`内存恒定且极小。
   - 视频/图片处理：转码、压缩、水印添加。处理大尺寸媒体图片避免尺寸爆炸。
   - 读取巨大的日志文件进行分析（如统计、搜索、聚合），逐行（`readline`模块基于流）或分块读取处理。
   - 数据导入/导出：将大型csv/json文件流式导入数据库或从数据库导出。
2. 网络通信
   - http请求响应。req和res本身就是流。处理上传的大文件（如图片、视频）时，使用流可以边接收边保存或处理，避免内存耗尽。下载大文件给客户端也是流式传输。
   - API代理：代理服务器接收到客户端请求流，直接管道传输给目标服务器；接受到目标服务器响应流，直接管道传输给客户端。
   - websockets/tcp sockets：实现双向通信。数据持续流动
  
3. 数据转换与处理管道：
   - 压缩/解压缩 `fs.createReadStream('input.txt').pipe(zlib.createGzip()).pipe(fs..createWriteStream('input.txt.gz'))`
   - 加密/解密：类似压缩，使用`cypto`模块的流
   - 数据格式转换： 例如，将 CSV 流转换为 JSON 流（使用自定义的 Transform 流或第三方库如 csv-parser 和 JSONStream）。
   - 实时数据处理： 传感器数据流、金融行情流，经过一系列转换流进行过滤、聚合、分析。
4. 命令行工具 (CLI) 与进程间通信 (IPC)：
   - `process.stdin`、`process.stdout`、`process.stderr`都是流。构建CLI工具时，可以管道连接输入输出。例如`child_process.spawn`产生的子进程`stdout/stderr`也是流。
5. 数据库操作：
   - 一些数据库驱动支持流式查询结果，避免一次性将所有结果加载到内存，尤其海量数据集。

### 总结
stream是流式数据处理的基石。通过分块和管道的机制，完美解决了处理大数据集和持续数据流的内存效率和时间效率。

## Node的process的理解？应用场景
是Node的一个全局对象，提供与**当前运行的Node.js进程**进行交互和控制的接口。理解`process`是掌握Node.js环境、执行控制、资源访问和进程管理的关键。
核心理解：
1. 进程代表者，process 对象代表了当前正在执行的 Node.js 程序实例。
2. 信息中心：提供关于**进程本身**、**运行环境**和**执行上下文**（工作目录、环境变量）的丰富信息。
3. 控制中心。它允许你**控制进程行为**，**监听进程事件**和与**操作系统交互**
4. 全局访问点。它提供访问标准流（stdin、stdout、stderr）的入口点，这是程序与外部世界（命令行、其他进程）通信的主要方式。
5. 异步钩子。它包含一些特殊的队列机制(`process.nextTick()`),用于微调异步操作的执行时机。
常用方法详解：

#### 进程信息与控制：
- process.pid: 返回当前进程的进程 ID (PID)。

- process.ppid: 返回当前进程的父进程的进程 ID (仅在支持时可用，如 Linux/macOS)。

- process.argv: 返回一个数组，包含启动 Node.js 进程时传递的命令行参数。

- process.argv[0]: Node.js 可执行文件的绝对路径。

- process.argv[1]: 正在执行的 JavaScript 文件的绝对路径。

- process.argv[2] 及以后：用户传入的命令行参数。

- process.exit([code]): 强制同步终止 Node.js 进程。可以指定退出码 code (默认为 0，表示成功；非 0 通常表示失败)。调用后，事件循环立即停止，不再执行任何后续异步操作。

- process.kill(pid[, signal]): 向指定的进程 ID (pid) 发送一个系统信号（如 'SIGTERM', 'SIGINT'）。默认信号是 'SIGTERM'。常用于控制子进程或自身 (process.kill(process.pid, 'SIGTERM'))。

#### 环境变量
- process.env: 返回一个包含用户环境的键值对对象。用于存储配置信息（如数据库连接字符串、API 密钥、运行模式 NODE_ENV）。
```js
const dbUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
```
#### 标准输入输出
- `process.stdin`:一个连接到标准输入 (stdin) 的 Readable Stream。用于从命令行或管道读取用户输入。
```js
process.stdin.on('data', (data) => {
  console.log(`You typed: ${data}`);
});
```
- process.stdout: 一个连接到标准输出 (stdout) 的 Writable Stream。用于向控制台输出信息
```js
process.stdout.write('Hello, World!\n'); // 等同于 console.log 的基础
```
- process.stderr
```js
process.stderr.write('Error: Something went wrong!\n');
```

#### 工作目录
- `process.cwd()` 当前进程的当前工作目录
- `process.chdir(directory)`.改变 Node.js 进程的当前工作目录到指定的 directory 路径。

#### 进程事件监听
process 对象继承自 EventEmitter，可以监听多种事件：
- exit
- `beforeExit`
- `uncaughtException`
- `unhandleRejection`
- `warning`
- `SIGINT`、`SIGTERM`
```js
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
});
```

#### 异步操作调度
附加：浏览器与Node.js的事件循环差异
|特性|浏览器|Node|
|---|---|---|
|宏任务架构|单一阶段|多阶段（timers、check）|
|微任务类型|Promise,queueMicrotask|Promise,process.nextTick|
|微任务清空的时机|每轮宏任务之后|每个阶段之后|
|事件循环过程| 宏任务 （同步代码、清空微任务）->执行渲染 -> 下一轮宏任务 | timers -> pending -> idle -> poll -> check -> close callbacks |
|`setTimeout` `setImmediate`|`setTimeout`总是先执行|顺序不确定（取决于阶段）|
- `process.nextTick`
```js
console.log('Start');
process.nextTick(() => {
  console.log('Next tick callback');
});
console.log('Scheduled');
// 输出顺序: Start -> Scheduled -> Next tick callback
```
- `process.nextTick`VS `setImmediate`
nextTick: 在同一个阶段（当前操作后）立即执行。
setImmediate(): 在事件循环的下一个迭代（'check' 阶段） 执行。

#### 性能分析
- process.hrtime([time])
- process.cpuUsage
- process.memoryUsage()
#### 平台信息
- process.platform
- process.arch
- process.versions
- process.release
#### 总结
Node.js 的 process 对象是程序与自身运行环境交互的核心枢纽。它让你能够：
- 获取信息： 进程 ID、命令行参数、环境变量、工作目录、平台架构、内存/CPU 使用、版本信息。
- 控制流程： 优雅或强制退出进程 (exit, kill)、监听退出和信号事件。
- 处理 I/O： 通过 stdin, stdout, stderr 与外部世界通信。
- 管理环境： 读写环境变量 (env)、改变工作目录 (cwd, chdir)。
- 处理异常： 捕获未处理的异常和 Promise 拒绝 (uncaughtException, unhandledRejection)。
- 调度任务： 使用 nextTick 安排高优先级异步回调。
- 性能监控： 测量时间 (hrtime)、内存 (memoryUsage)、CPU (cpuUsage)。

## 说说Node中的EventEmitter?如何实现一个EventEmitter?

## 说说Node文件查找的优先级以及 Require方法的文件查找策略?

## 说说Node有哪些全局对象?

## 说说对中间件概念的理解,如何封装node中间件?

## 说说对Nodejs中的事件循环机制
核心：事件循环的职责是调度和执行异步操作的回调函数（如 I/O 完成、定时器到期、setImmediate 等）。

主要阶段
1. Timer（定时器）
    - 检查 setTimeout() 和 setInterval() 设定的回调是否到期。执行所有到期的定时器回调。
2. Pending Callbacks（待定回调阶段）
   - 执行一些系统操作（如TCP错误）的回调。例如，如果尝试连接收到`ECONNREFUSED`，这个错的回调通常会被推迟到这个阶段执行。
3. Idle，Prepare（空闲、准备阶段）
4. Poll（轮询阶段-核心）
   - 计算阻塞时间，根据下一个即将到期的定时器`setTimeout setInterval` 计算阻塞等待I/O事件多长时间
   - 处理I/O时间，阻塞并等待新的 I/O 事件到达（如文件读取完成、新的网络连接、新的 HTTP 请求数据到达）。当有事件到达，就执行对应的回调函数（例如 fs.readFile 的回调、net.Socket 的 'data' 事件回调、HTTP request 事件的回调）。
   - Poll不为空，遍历同步执行，直至清空或系统限制。
   - Poll为空，如果有`setImmediate`则进入`check`
    - - 如果没有`setImmediate`，定时器到期，则结束poll回到timers
    - - 如果没有到期定时器,则阻塞在poll阶段等待I/O事件到来。
5. check（检查阶段）
   - 专门执行通过 setImmediate() 设置的回调函数
6. close callback
   - 执行一些关闭事件的回调。例如 socket.on('close', ...) 或 process.nextTick() 中发出的 'close' 事件回调。
## 如何实现文件上传?说说你的思路
文件分片上传，在调一个合并的接口。
## 如何实现jwt鉴权机制?说说你的思路

## 如果让你来设计一个分页功能,你会怎么设计?前后端如何交互?