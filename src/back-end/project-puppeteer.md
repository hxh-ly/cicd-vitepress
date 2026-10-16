# 基于Node.js+Puppeteer高并发批量PDF打印服务

本文前半部分展示手写进程池，末尾的「引入 BullMQ 的改造示例」展示 Redis 队列与独立 Worker 的替代实现。两套代码分别使用，不要同时启动两套任务调度器。
## 完整架构
```
客户端
   │
   ▼
Nginx 网关
   │
   ├─ 限制请求速率
   ├─ 限制请求体大小
   ├─ 处理 HTTPS
   ├─ 反向代理
   └─ 超时配置
   │
   ▼
Node.js API 主进程
   │
   ├─ 参数校验
   ├─ 创建批量任务
   ├─ 写入 BullMQ
   ├─ 查询任务状态
   └─ 返回 jobId
   │
   ▼
Redis
   │
   └─ BullMQ 队列
        │
        ▼
PDF Worker Consumer
   │
   ├─ BullMQ 并发控制
   ├─ child_process 子进程池
   ├─ Puppeteer
   └─ Chromium
        │
        ▼
对象存储 / 本地文件
   │
   ▼
任务结果和下载地址
```

## 整体架构
```
HTTP/API 主进程
│
├─ 接收批量打印请求
├─ 拆分任务
├─ 放入任务队列
├─ 控制最大并发数
├─ 分配任务给空闲子进程
├─ 处理超时和异常
└─ 汇总打印结果
     │
     ├─ child_process 1
     │    └─ Puppeteer + Chromium
     │
     ├─ child_process 2
     │    └─ Puppeteer + Chromium
     │
     └─ child_process 3
          └─ Puppeteer + Chromium
```

核心原则：
1. 主进程不能执行 Chromium 渲染。
2. 子进程数量由 maxWorkers 控制。
3. 一个子进程同一时间只处理一个打印任务。
4. 子进程内部负责 Puppeteer 生命周期。
5. 子进程异常时，主进程可以销毁并重新拉起。
6. 任务超时必须杀掉对应子进程，不能只结束 Promise。

主进程：创建子进程池
```js
// pool.js
const path = require('node:path')
const {fork} = require('node:child_process')
const {randomUUID} = require('node:crypto');

class PdfWorkPool {
    construtor(options = {}) {
        this.workerFile = path.resolve(__direname,'pdf-worker.js')
        this.maxWorkers = options.maxWorkers ?? 4;
        this.taskTimeout = options.taskTimeout ?? 60_000;
        this.queue = [];
        this.workers = new Map();
        this.taskMap = new Map();

        for(let i = 0;i<this.maxWorkers;i++) {
            this.createWorker();
        }
    }

    createWorker() {
        const workerId = randomUUID();
        const child = fork(this.workFile,[],{
            stdio:['ignore','pipe','pipe','ipc'],
            env: {
                ...process.env,
                WORKER_ID:workerId
            }
        })

        const worker = {
      id: workerId,
      child,
      busy: false,
      taskId: null,
      completedCount: 0,
    intentionalExit: false,
    };

    this.workers.set(workerId, worker);

    child.stdout?.on('data', (data) => {
      console.log(`[pdf-worker:${workerId}] ${data.toString().trim()}`);
    });

    child.stderr?.on('data', (data) => {
      console.error(`[pdf-worker:${workerId}] ${data.toString().trim()}`);
    });

    child.on('message', (message) => {
      this.handleWorkerMessage(worker, message);
    });

    child.on('error', (error) => {
      console.error(`[pdf-worker:${workerId}] process error`, error);
    });

    child.on('exit', (code, signal) => {
      this.handleWorkerExit(worker, code, signal);
    });

    return worker;
    }

      enqueue(payload) {
    return new Promise((resolve, reject) => {
      const task = {
        id: randomUUID(),
        payload,
        resolve,
        reject,
        timer: null,
        workerId: null,
      };

      this.queue.push(task);
      this.dispatch();
    });
  }

  dispatch() {
    for (const worker of this.workers.values()) {
      if (worker.busy) {
        continue;
      }

      const task = this.queue.shift();

      if (!task) {
        break;
      }

      this.runTask(worker, task);
    }
  }

  runTask(worker, task) {
    worker.busy = true;
    worker.taskId = task.id;

    task.workerId = worker.id;
    this.taskMap.set(task.id, task);

    task.timer = setTimeout(() => {
      this.handleTaskTimeout(worker, task);
    }, this.taskTimeout);

    worker.child.send({
      type: 'render',
      taskId: task.id,
      payload: task.payload,
    });
  }

  handleWorkerMessage(worker, message) {
    if (!message || !message.type) {
      return;
    }

    if (message.type === 'ready') {
      worker.busy = false;
      worker.taskId = null;
      this.dispatch();
      return;
    }

    if (message.type === 'result') {
      const task = this.taskMap.get(message.taskId);

      if (!task) {
        return;
      }

      clearTimeout(task.timer);
      this.taskMap.delete(message.taskId);

      worker.busy = false;
      worker.taskId = null;

      worker.completedCount += 1;

      if (message.ok) {
        task.resolve(message.data);
      } else {
        task.reject(new Error(message.error));
      }

    /*
     * 当前任务已经完成，再决定是否回收 Worker。
     * 不能在任务尚未结束时直接退出，否则会中断当前 PDF 生成。
     */
    if (worker.completedCount >= MAX_TASKS_PER_WORKER) {
      this.recycleWorker(worker);
      return;
    }

      this.dispatch();
    }
  }

  recycleWorker(worker) {
  if (worker.intentionalExit) {
    return;
  }

  worker.intentionalExit = true;
  worker.recycling = true;

  console.log(
    `[pdf-pool] recycle worker=${worker.id}, ` +
    `completed=${worker.completedCount}`,
  );

  /*
   * 当前任务已经结束，可以让子进程优雅退出。
   */
  worker.child.send({
    type: 'shutdown',
  });

  /*
   * 如果子进程迟迟不退出，强制终止。
   */
  worker.recycleTimer = setTimeout(() => {
    if (!worker.child.killed) {
      worker.child.kill('SIGKILL');
    }
  }, 5_000);
}

  handleTaskTimeout(worker, task) {
    if (!this.taskMap.has(task.id)) {
      return;
    }

    clearTimeout(task.timer);
    this.taskMap.delete(task.id);

    task.reject(new Error(`PDF render timeout: ${task.id}`));

    /*
     * 不能只把 worker.busy 改成 false。
     * 因为底层 Chromium 可能仍然没有退出。
     * 这里直接终止子进程，确保 Chromium 一起被回收。
     */
    this.killWorker(worker, 'task timeout');

    // 拉起新的子进程补充池容量
    this.createWorker();
    this.dispatch();
  }

  handleWorkerExit(worker, code, signal) {
    this.workers.delete(worker.id);

    if (worker.taskId) {
      const task = this.taskMap.get(worker.taskId);

      if (task) {
        clearTimeout(task.timer);
        this.taskMap.delete(worker.taskId);
        task.reject(
          new Error(
            `PDF worker exited unexpectedly: code=${code}, signal=${signal}`,
          ),
        );
      }
    }

     /*
     * 非主动退出时补充一个新的 Worker。
     * 生产环境中可以增加重启次数限制和退避策略。
     */
    if (!worker.intentionalExit) {
      this.createWorker();
      this.dispatch();
    }
  }

  killWorker(worker, reason) {
    worker.intentionalExit = true;

    console.warn(`[pdf-pool] kill worker=${worker.id}, reason=${reason}`);

    if (!worker.child.killed) {
      worker.child.kill('SIGTERM');
    }

    setTimeout(() => {
      if (!worker.child.killed) {
        worker.child.kill('SIGKILL');
      }
    }, 3_000);
  }

    async close() {
    for (const worker of this.workers.values()) {
      worker.intentionalExit = true;
      worker.child.send({ type: 'shutdown' });

      setTimeout(() => {
        if (!worker.child.killed) {
          worker.child.kill('SIGTERM');
        }
      }, 3_000);
    }
  }
}

module.exports = {
  PdfWorkerPool,
};
```

子进程：执行Puppeteer渲染
pdf-worker.js
```js
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require('puppeteer');

const PRINT_TEMPLATE_URL =
  process.env.PRINT_TEMPLATE_URL ??
  'http://127.0.0.1:3000/print/exam';

const OUTPUT_DIR =
  process.env.PDF_OUTPUT_DIR ??
  path.resolve(process.cwd(), 'output');

let browser = null;

async function init() {
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  process.send?.({
    type: 'ready',
    workerId: process.env.WORKER_ID,
  });
}

/**
 * 根据业务参数拼接固定打印模板 URL。
 *
 * payload 示例：
 * {
 *   examPageId: '10001',
 *   type: 3,
 *   userId: 'user-001',
 *   tenantId: 'tenant-001'
 * }
 */
function buildPrintUrl(payload) {
  if (!payload || !payload.examPageId) {
    throw new Error('examPageId is required');
  }

  if (payload.type === undefined || payload.type === null) {
    throw new Error('type is required');
  }

  const url = new URL(PRINT_TEMPLATE_URL);

  url.searchParams.set(
    'examPageId',
    String(payload.examPageId),
  );

  url.searchParams.set(
    'type',
    String(payload.type),
  );

  /*
   * 以下参数按照你的真实业务需要保留。
   * 不需要的参数不要拼到 URL 中。
   */
  if (payload.userId) {
    url.searchParams.set('userId', String(payload.userId));
  }

  if (payload.tenantId) {
    url.searchParams.set('tenantId', String(payload.tenantId));
  }

  if (payload.scene) {
    url.searchParams.set('scene', String(payload.scene));
  }

  return url.toString();
}

async function waitForPrintReady(page, timeout = 30_000) {
  /*
   * 固定 HTML 模板在数据和公式都完成后设置：
   *
   * window.__PDF_RENDER_READY__ = true
   */
  await page.waitForFunction(
    () => window.__PDF_RENDER_READY__ === true,
    {
      timeout,
    },
  );
}

async function renderPdf(payload) {
  const page = await browser.newPage();

  const printUrl = buildPrintUrl(payload);

  const outputFileName =
    payload.outputFileName ??
    `exam-${payload.examPageId}-${payload.type}-${Date.now()}.pdf`;

  const outputPath = path.resolve(
    OUTPUT_DIR,
    outputFileName,
  );

  try {
    await page.setViewport({
      width: payload.width ?? 1440,
      height: payload.height ?? 900,
      deviceScaleFactor: 1,
    });

    /*
     * 如果页面需要登录态，可以在这里设置 Cookie 或请求头。
     */
    if (payload.cookies?.length) {
      await page.setCookie(...payload.cookies);
    }

    if (payload.authorization) {
      await page.setExtraHTTPHeaders({
        Authorization: payload.authorization,
      });
    }

    /*
     * 访问固定打印模板，只通过 query 参数区分业务场景。
     */
    await page.goto(printUrl, {
      waitUntil: 'domcontentloaded',
      timeout: payload.navigationTimeout ?? 20_000,
    });

    /*
     * 等待固定 HTML 页面：
     * 1. 根据 examPageId 请求试卷数据；
     * 2. 根据 type 判断打印场景；
     * 3. 完成公式、图片、字体、Canvas 等渲染；
     * 4. 设置 window.__PDF_RENDER_READY__。
     */
    await waitForPrintReady(
      page,
      payload.renderTimeout ?? 30_000,
    );

    await fs.mkdir(OUTPUT_DIR, {
      recursive: true,
    });

    await page.pdf({
      path: outputPath,
      format: payload.format ?? 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: payload.margin ?? {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    return {
      taskId: payload.taskId,
      examPageId: payload.examPageId,
      type: payload.type,
      printUrl,
      outputPath,
      status: 'success',
    };
  } finally {
    /*
     * 每个任务独立创建 Page。
     * 无论成功还是失败，都必须释放页面资源。
     */
    await page.close().catch(() => {});
  }
}

process.on('message', async (message) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === 'render') {
    const { taskId, payload } = message;

    try {
      const result = await renderPdf({
        ...payload,
        taskId,
      });

      process.send?.({
        type: 'result',
        taskId,
        ok: true,
        data: result,
      });
    } catch (error) {
      process.send?.({
        type: 'result',
        taskId,
        ok: false,
        error: error instanceof Error
          ? error.message
          : String(error),
      });
    }

    return;
  }

  if (message.type === 'shutdown') {
    await shutdown();
  }
});

async function shutdown() {
  try {
    await browser?.close();
  } catch (error) {
    console.error('close browser failed', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

init().catch((error) => {
  console.error('worker init failed', error);
  process.exit(1);
});
```


调用方式
server.js
```js
app.post('/pdf/batch', async (req, res) => {
  const tasks = req.body.tasks ?? [];

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({
      message: 'tasks must be a non-empty array',
    });
  }

  try {
    const results = await Promise.allSettled(
      tasks.map((task) =>
        pool.enqueue({
          url: task.url,
          outputDir: './output',
          format: task.format ?? 'A4',
        }),
      ),
    );

    const success = [];
    const failed = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        success.push(result.value);
      } else {
        failed.push({
          error: result.reason.message,
        });
      }
    }

    return res.json({
      total: tasks.length,
      successCount: success.length,
      failedCount: failed.length,
      success,
      failed,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

process.on('SIGTERM', async () => {
  await pool.close();
  process.exit(0);
});

app.listen(3000, () => {
  console.log('PDF service listening on port 3000');
});

```

## 完整例子

批量打印 20 份试卷，最大并发数为 4：
```
HTTP 请求到达
  -> 主进程将 20 个任务放入 queue
  -> 分配任务 1、2、3、4
  -> 4 个子进程分别访问固定 HTML 模板
  -> 子进程通过 examPageId、type 加载不同试卷场景
  -> 完成后发送 result
  -> 主进程将对应 Worker 标记为空闲
  -> 每有一个子进程空闲，立即给它分配队头任务，不等待整批完成
  -> 直到 20 个任务全部完成
  -> 主进程汇总成功和失败结果
  -> 4 个子进程继续等待
```

如果 Worker 2 在任务 6 时崩溃：
```
Worker 2 崩溃
  -> 主进程收到 exit
  -> 任务 6 标记失败
  -> 销毁 Worker 2 的记录
  -> 创建新的 Worker 5
  -> Worker 5 初始化完成并发送 ready
  -> Worker 5 接收队列中的下一个任务
```

当一个Woker处理满100个任务,这样可以避免 Chromium 长时间运行后出现内存缓慢增长。
```
完成第 100 个任务
  -> 关闭 Browser
  -> 退出子进程
  -> 主进程创建新的子进程
```

## 根据机器配置决定预热多少子进程
主要资源消耗是 Chromium，重点关注：
- 可用内存；
- 单个打印任务的峰值内存；
- CPU 核数；
- 页面复杂度；
- 图片、公式、Canvas 和 WebAssembly 数量；
- 业务允许的打印耗时。
```
最大并发数
≈ 可用于打印的内存 × 安全系数 / 单任务峰值内存


机器内存：8 GB
系统和主服务占用：2 GB
可分给打印服务：6 GB
安全系数：0.6
单个 Chromium 任务峰值：500 MB

最大并发数 ≈ 6 × 0.6 / 0.5 ≈ 7
```

实际可能不会直接设置 7，而是从 4 开始压测，观察：
- 成功率
- 平均耗时
- p95/p99耗时
- 峰值内存
- cpu使用率
- 超时数量
- chromium奔溃数量

## CentOS监控
```shell
top

##
%Cpu(s)  CPU 使用率
MiB Mem  内存使用情况
load average  系统负载

# top -p <node_pid>
```

## 合理配置Docker

2c4g的配置
```yml
services:
  pdf-service:
    build: .
    environment:
      PDF_MIN_WORKERS: 1
      PDF_MAX_WORKERS: 2
      PDF_TASK_TIMEOUT: 60000
    mem_limit: 2g # 最大使用2g内存
    cpus: 1.5 # 这个容器最多使用约1.5个CPU核心的计算能力
    pids_limit: 120 # 最多允许创建120个进程和线程
    shm_size: "512m" # 共享内存的大小
    restart: unless-stopped
```

最多运行 2 个打印子进程
容器最多使用 2GB 内存
容器最多使用约 1.5 个 CPU 核心
容器最多创建 120 个进程/线程
Chromium 可使用 512MB /dev/shm

## Nginx
限制请求速率
```nginx
http {
    limit_req_zone $binary_remote_addr zon=pdf_limit:10m rate=2r/s;

    server {
        listen 80;

        location /api/pdf {
            limit_req zone=pdf_limit burst=5 nodelay; # 额外突发最多5个积压请求 ；突发请求不等待，直接转发，直到超过 burst 上限

            proxy_pass http://api:3000;
            proxy_connect_timeout 5s;
            proxy_read_timeout 30s;
            client_max_body_size 2m;
        }
    }
}
```

## 引入 BullMQ 的改造示例

### 有什么帮助

手写进程池解决的是单机资源控制；BullMQ 解决排队、任务状态、重试和跨进程/跨机器消费。只在单机临时打印少量文件时，进程池已经够用；需要 API 重启后仍可查询任务、积压排队和横向扩容时，引入 BullMQ 更有价值。

- `this.queue` 内存数组改为 Redis 中的 BullMQ 队列；可靠程度仍取决于 Redis 持久化、备份与高可用配置。
- HTTP 不再等待 20 份 PDF 全部完成，而是入队成功后返回 `202 + batchId + jobIds`。
- 每份 PDF 是一个 job，可以单独成功、失败和重试。
- API 与打印进程独立部署，API 重启不会主动终止正在运行的独立 Worker。
- Worker 异常退出后，失去锁的任务可经 stalled 检测重新排队；恢复不是即时的，也不是恰好执行一次。

BullMQ 不会让 Chromium 单次渲染变快，也不会自动上传 PDF、实现业务幂等或清理所有孤儿浏览器进程。

### 两种接入方式与任务分配

**最小改造**可以保留已经修好的本地进程池，用 `new Worker('pdf-render', job => pool.enqueue(job.data), { connection, concurrency: 4 })` 接入。必须返回/等待 `enqueue()` 的 Promise，并把 BullMQ 并发与池容量协调好；否则任务先在 Redis 排一次队，又大量进入本地队列等待。上面的手写池仍需完善 ready 状态、回收和超时处理后才能用于生产。

**下面选择更容易理解的替代方案：4 个独立 Node.js Worker 进程，每个 `concurrency: 1`。** 不再使用 `pool.js`、`busy`、`dispatch()` 或 `process.send({ type: 'result' })`。由进程管理器/容器负责启动和重启 Worker，BullMQ 负责领取与确认任务。

```text
HTTP POST /pdf/batch
        ↓
API → BullMQ Queue（Redis，20 个独立 job）
        ↓ 多个 Worker 竞争领取，不是广播
        ├─ Worker 进程 A：concurrency 1 → Puppeteer / Chromium
        ├─ Worker 进程 B：concurrency 1 → Puppeteer / Chromium
        ├─ Worker 进程 C：concurrency 1 → Puppeteer / Chromium
        └─ Worker 进程 D：concurrency 1 → Puppeteer / Chromium
        ↓
文件写入存储，job 保存结果引用
        ↑
客户端通过 API 查询 job 状态和批次汇总
```

若 A/B/C/D 分别执行 1/2/3/4，C 最先完成且其他三个仍忙，C 就有机会领取等待中的任务 5。正常 FIFO、无优先级/延迟/重试插队时领取队头任务；多个消费者竞争时不保证由哪个进程拿到，也不保证完成顺序。任务 3 重试时可能由 A 执行。

`concurrency` 是每个 Worker 实例的并发数，不会自动创建子进程。4 个进程 × 每个并发 1 = 最多 4 个正常执行的 job；若每个都改成 4，则总并发可能达到 16。浏览器自身还有多个操作系统子进程，不等于总共只存在 4 个 OS 进程。[BullMQ 并发说明](https://docs.bullmq.io/guide/workers/concurrency)

### 示例准备

以下是 **BullMQ 5、Express 5、Puppeteer 的独立本地示例**，将三个 `.cjs` 文件保存在同一个新目录中。安装命令在示例目录执行，无需向文档站点安装服务端依赖。

```bash
npm init -y
npm install bullmq@5 express@5 puppeteer
docker run --name pdf-demo-redis -p 127.0.0.1:6379:6379 -v pdf-demo-redis:/data redis:7 redis-server --appendonly yes --maxmemory-policy noeviction
```

沿用前文的固定试卷模板：`http://127.0.0.1:3000/print/exam`。模板服务需单独运行，根据 `examPageId`、`type` 加载数据，完成字体、图片、公式等渲染后设置 `window.__PDF_RENDER_READY__ = true`。示例 API 使用 3001 端口。

### 1. 共享队列配置：queue-config.cjs

```js
// queue-config.cjs
module.exports = {
  queueName: 'pdf-render',
  connection: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
};
```

### 2. API：入队后立即返回，按 jobIds 查询批次

```js
// api.cjs
const express = require('express');
const { randomUUID } = require('node:crypto');
const { Queue } = require('bullmq');
const { queueName, connection } = require('./queue-config.cjs');

const queue = new Queue(queueName, {
  connection: {
    ...connection,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  },
  defaultJobOptions: {
    attempts: 3, // 首次执行 + 最多 2 次失败重试
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: false, // 演示保留结果供查询
    removeOnFail: false,
  },
});
queue.on('error', (error) => console.error('queue error', error));

const app = express();
app.use(express.json({ limit: '100kb' }));

app.post('/pdf/batch', async (req, res) => {
  const tasks = req.body?.tasks;
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 100 ||
      tasks.some((t) => !t || typeof t.examPageId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(t.examPageId) ||
        !Number.isInteger(t.type) || t.type < 0 || t.type > 10)) {
    return res.status(400).json({ error: '需要 1~100 个有效试卷任务' });
  }

  const batchId = randomUUID();
  // addBulk 是一次批量入队；每个元素仍是独立 job。
  const jobs = await queue.addBulk(tasks.map((task, index) => ({
    name: 'render-exam',
    data: { batchId, examPageId: task.examPageId, type: task.type },
    opts: { jobId: `${batchId}-${index + 1}` },
  })));

  res.status(202).json({ batchId, jobIds: jobs.map((job) => job.id) });
});

// 客户端保存入队返回的 jobIds，轮询这个只读查询接口。
app.post('/pdf/status', async (req, res) => {
  const ids = req.body?.jobIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 ||
      ids.some((id) => typeof id !== 'string' ||
        !/^[a-f0-9-]{36}-\d{1,3}$/.test(id)) ||
      new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'jobIds 格式错误' });
  }

  const results = await Promise.all(ids.map(async (id) => {
    const job = await queue.getJob(id);
    if (!job) return { jobId: id, state: 'missing' };
    const state = await job.getState();
    // 再取一次记录，减少状态切换期间拿到旧 returnvalue 的情况。
    const latest = await queue.getJob(id);
    if (!latest) return { jobId: id, state: 'missing' };
    return {
      jobId: id,
      state,
      result: state === 'completed' ? latest.returnvalue : null,
      error: state === 'failed' ? latest.failedReason : null,
    };
  }));

  const successCount = results.filter((r) => r.state === 'completed').length;
  const failedCount = results.filter((r) => r.state === 'failed').length;
  res.json({
    total: results.length,
    successCount,
    failedCount,
    done: results.every((r) => ['completed', 'failed'].includes(r.state)),
    results,
  });
});

// Express 5 会把 async handler 的异常交给此中间件。
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status ?? 503).json({ error: '请求失败，请稍后查询或重试' });
});

queue.waitUntilReady().then(() => {
  const server = app.listen(3001, '127.0.0.1');
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      queue.close().then(() => process.exit(0), () => process.exit(1));
    });
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
```

查询结果是轮询快照，任务可能在查询过程中完成，下次查询会更新。`delayed` 可能表示正在等待重试，不能把它当作最终失败；`missing` 表示任务不存在或已清理，不能当作完成。

本例用客户端持有的 `jobIds` 汇总批次，没有依赖 API 内存 Map。生产系统应把批次、所属用户、jobId 和结果写入数据库，支持刷新后查询，并在状态/下载接口校验用户权限。当前每次 POST 都创建新批次，HTTP 重复提交会重复打印；需要业务幂等键及持久化记录处理响应丢失后的重试。

### 3. Worker：领取、打印、返回结果

```js
// worker.cjs
const { Worker } = require('bullmq');
const puppeteer = require('puppeteer');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { queueName, connection } = require('./queue-config.cjs');

const outputDir = path.resolve(process.env.PDF_OUTPUT_DIR ?? './output');
const templateUrl = process.env.PRINT_TEMPLATE_URL ??
  'http://127.0.0.1:3000/print/exam';

// 模块变量只属于当前 Worker 进程，4 个进程各自维护一个 Browser。
let browser = null;
let browserTaskCount = 0;
const MAX_TASKS_PER_BROWSER = 100;

async function withDeadline(operation, ms, message) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function closeBrowser() {
  const current = browser;
  if (!current) return;
  try {
    await withDeadline(current.close(), 5000, 'browser close timeout');
  } catch (error) {
    console.error('force close browser', error);
    const child = current.process();
    // 无法确认旧浏览器已退出，就退出 Worker，交给容器清理整个进程树。
    if (!child) process.exit(1);
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      try {
        child.kill('SIGKILL');
        await withDeadline(exited, 5000, 'browser kill timeout');
      } catch (killError) {
        console.error(killError);
        process.exit(1);
      }
    }
  }
  browser = null;
  browserTaskCount = 0;
}

async function getBrowser() {
  // concurrency: 1，当前进程不会有两个 job 同时初始化浏览器。
  if (browser && !browser.connected) await closeBrowser();
  if (!browser) {
    browser = await puppeteer.launch({ headless: true, timeout: 20_000 });
  }
  return browser;
}

const worker = new Worker(queueName, async (job) => {
  const { batchId, examPageId, type } = job.data;
  const url = new URL(templateUrl);
  url.searchParams.set('examPageId', examPageId);
  url.searchParams.set('type', String(type));

  await fs.mkdir(outputDir, { recursive: true });
  // 由服务端生成 jobId，重试使用相同目标文件；临时文件区分执行尝试。
  const outputPath = path.join(outputDir, `${job.id}.pdf`);
  const tempPath = path.join(outputDir, `${job.id}-${randomUUID()}.tmp`);
  let context;
  let recycle = false;
  try {
    const currentBrowser = await getBrowser();
    // 每份试卷使用独立会话，隔离 Cookie/localStorage 等数据。
    context = await currentBrowser.createBrowserContext();
    const page = await context.newPage();
    await page.goto(url.toString(), {
      waitUntil: 'domcontentloaded', timeout: 20_000,
    });
    await page.waitForFunction(() => window.__PDF_RENDER_READY__ === true, {
      timeout: 30_000,
    });
    await page.pdf({
      path: tempPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 30_000,
    });
    await fs.rename(tempPath, outputPath);
    console.log(`pid=${process.pid}, completed job=${job.id}`);
    // resolve → BullMQ 保存 returnvalue 并将 job 标为 completed。
    return { batchId, examPageId, type, outputPath };
  } catch (error) {
    // 示例保守处理：打印异常后回收浏览器，让下一次尝试使用新实例。
    recycle = true;
    throw error;
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    if (context) {
      try {
        // 正常任务只关闭自己的 Context（连同内部 Page），保留 Browser。
        await withDeadline(context.close(), 5000, 'context close timeout');
      } catch (error) {
        console.error('context cleanup failed', error);
        recycle = true;
      }
    }
    browserTaskCount += 1;
    if (recycle || (browser && !browser.connected) ||
        browserTaskCount >= MAX_TASKS_PER_BROWSER) {
      // 当前任务结束后再回收；下一份任务会按需启动新 Browser。
      await closeBrowser();
    }
  }
  // 异常向上抛出 → BullMQ 按 attempts/backoff 重试，耗尽后 failed。
}, {
  connection: { ...connection, maxRetriesPerRequest: null },
  concurrency: 1,
});

worker.on('error', (error) => console.error('worker error', error));
worker.on('failed', (job, error) => {
  // 单次尝试失败也可能触发，不代表已耗尽全部重试。
  console.error(`attempt failed: ${job?.id}`, error.message);
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await worker.close(); // 停止领取，等待当前 job 完成。
  await closeBrowser(); // 当前任务结束后再关闭进程持有的 Browser。
}
process.on('SIGTERM', () => stop().catch(console.error));
process.on('SIGINT', () => stop().catch(console.error));
```

启动 API，再在 **4 个独立终端**各运行一次 `node worker.cjs`，就是 4 个 Worker 进程。每个进程首次处理任务时启动自己的 Browser，后续任务复用；每个任务独立创建并关闭 Context。正常完成时不会关闭 Browser，因此仍是 **4 个 Worker × 并发 1 = 最多同时打印 4 份**，同时省去每份 PDF 启动浏览器的开销。

例如进程 C 完成任务 3 后，关闭任务 3 的 Context，继续用 Browser C 创建任务 5 的 Context。其他进程的任务不受影响。每个 Browser 累计处理 100 次任务尝试后回收；打印异常、Context 清理失败、浏览器断连或 Worker 优雅停机时也会关闭浏览器。100 是演示阈值，实际应结合内存监控和压测调整。

`withDeadline()` 只限制等待时间，本身不会终止操作。因此 Context 清理超时后必须回收 Browser，Browser 关闭超时后必须终止浏览器进程；无法确认终止时退出 Worker，由部署层清理进程树并重启，而不是继续在旧浏览器仍运行的情况下领取下一份任务。生产部署仍需配置容器/进程组清理及停机期限。

参考：[独立 BrowserContext](https://pptr.dev/api/puppeteer.browser.createbrowsercontext)、[关闭 Context 及其页面](https://pptr.dev/api/puppeteer.browsercontext.close)。

```bash
# API 终端
node api.cjs

# 其他四个终端，每个执行一次
node worker.cjs
```

提交两份作为演示，将 tasks 扩展到 20 个即可验证并发排队：

```bash
curl -X POST http://127.0.0.1:3001/pdf/batch \
  -H 'Content-Type: application/json' \
  -d '{"tasks":[{"examPageId":"10001","type":3},{"examPageId":"10002","type":3}]}'

# 将返回的真实 jobIds 放入查询请求中
curl -X POST http://127.0.0.1:3001/pdf/status \
  -H 'Content-Type: application/json' \
  -d '{"jobIds":["替换为返回的第一个jobId","替换为返回的第二个jobId"]}'
```

### 与原进程池的边界、上线时需要补齐的部分

- **API 不再管理 Worker 的 busy 状态。** Worker 从 Redis 领取任务，处理函数返回值代表成功，抛出 Error 代表失败。不要 catch 后返回 `{ success: false }`，那会被当作正常完成。
- **不要在 active job 内长时间等待本地队列。** 本例没有本地二级队列。如果保留进程池，Worker 并发不要无意义地超过可执行容量。
- **重试可能重复执行。** 固定 jobId 的目标文件减少重复文件，但这不等于严格 exactly-once；多个尝试重叠、业务数据改变、重复提交仍需版本化数据和业务幂等控制。
- **本例是同机文件输出。** `outputPath` 是 Worker 本机路径，不是下载 URL。多机时上传 OSS/S3，在上传完成后返回对象 key；API 鉴权后提供签名下载链接。Redis 只存参数和结果引用，不存整份 PDF。
- **浏览器超时与队列锁是两件事。** 上面的 timeout 分别约束启动、导航、等待页面和打印，不是整个 job 的硬超时。`lockDuration` 也不是任务超时。整任务硬超时仍应使用可终止的隔离进程/容器并清理 Chromium 进程树，不能只用 Promise.race 提前返回就允许重试与旧渲染重叠。
- **进程故障由部署层拉起。** systemd、PM2 或容器负责重启退出的 Worker；BullMQ 负责 stalled 检测和任务恢复。优雅停机要留足当前打印的完成时间。
- **结果要有保留策略。** 本例关闭自动删除以便学习查询；生产环境应先持久化业务结果，再设置完成/失败 job 的 age/count 和文件清理策略，避免无限占用 Redis/磁盘。
- **模板鉴权独立处理。** 固定模板需登录时，Worker 使用服务端签发的短期凭证；不要允许用户提交任意 URL，也不要把长期登录凭证写入 Redis job。

若还需要把 Node.js 中 CPU 密集计算与队列续锁隔离，可使用 BullMQ 的 sandboxed processor：把处理函数放在独立文件并将文件路径传给 Worker。它与普通 `async job => ...` 的进程模型不同，不应把 `concurrency: 4` 本身理解成自动启动四个子进程。[Sandboxed processors](https://docs.bullmq.io/guide/workers/sandboxed-processors)

参考：[批量入队](https://docs.bullmq.io/guide/queues/adding-bulks)、[连接配置](https://docs.bullmq.io/guide/connections)、[失败重试](https://docs.bullmq.io/guide/retrying-failing-jobs)、[stalled 恢复](https://docs.bullmq.io/guide/workers/stalled-jobs)、[PDF 超时选项](https://pptr.dev/api/puppeteer.pdfoptions)。
