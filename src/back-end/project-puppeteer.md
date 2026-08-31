# 基于Node.js+Puppeteer高并发批量PDF打印服务
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
  -> 分别分配任务 5、6、7、8
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