const assert = require('node:assert/strict');
const { createApp } = require('./mini-express.cjs');

// 使用模拟 req/res，只观察调度顺序，不需要安装 Express 或监听端口。
const response = () => ({
  writableEnded: false,
  end(body) { this.body = body; this.writableEnded = true; },
});

async function main() {
  // 场景一：同步 next()，函数调用栈展开后再逐层返回。
  {
    const app = createApp();
    const logs = [];
    app.use((req, res, next) => {
      logs.push('A before');
      next();
      logs.push('A after');
    });
    app.use((req, res, next) => {
      logs.push('B before');
      next();
      logs.push('B after');
    });
    app.use((req, res) => { logs.push('C'); res.end('ok'); });
    app.handle({}, response());
    assert.deepEqual(logs, ['A before', 'B before', 'C', 'B after', 'A after']);
    console.log('同步：', logs.join(' → '));
  }

  // 场景二：即便上游 await next()，也不会等下游的异步操作。
  {
    const app = createApp();
    const logs = [];
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    app.use(async (req, res, next) => {
      logs.push('A before');
      await next(); // 实际 await undefined，不是下游完成的 Promise。
      logs.push('A after');
    });
    app.use(async (req, res, next) => {
      logs.push('B before');
      await gate; // 模拟数据库查询尚未完成。
      logs.push('B async done');
      next();
      logs.push('B after');
    });
    app.use((req, res) => { logs.push('C'); res.end('ok'); });
    app.handle({}, response());
    await Promise.resolve();
    assert.deepEqual(logs, ['A before', 'B before', 'A after']);
    release();
    await Promise.resolve();
    assert.deepEqual(logs, [
      'A before', 'B before', 'A after', 'B async done', 'C', 'B after',
    ]);
    console.log('异步：', logs.join(' → '));
  }

  // 场景三：next(err)、同步 throw、返回 Promise 的 rejection 都进入错误链。
  for (const mode of ['next-error', 'throw', 'reject']) {
    const app = createApp();
    const logs = [];
    app.use((req, res, next) => {
      if (mode === 'next-error') return next(new Error('失败'));
      if (mode === 'throw') throw new Error('失败');
      return Promise.reject(new Error('失败'));
    });
    app.use((req, res, next) => { logs.push('不应执行'); next(); });
    app.use((err, req, res, next) => {
      logs.push(`捕获：${err.message}`);
      next(); // 清除错误，恢复后续普通中间件。
    });
    app.use((req, res) => { logs.push('恢复'); res.end('ok'); });
    app.handle({}, response());
    await Promise.resolve();
    assert.deepEqual(logs, ['捕获：失败', '恢复']);
    console.log(`${mode}：`, logs.join(' → '));
  }

  // 场景四：不调用 next，后面的中间件不会自动执行。
  {
    const app = createApp();
    app.use(async (req, res) => { res.end('由当前中间件响应'); });
    let reached = false;
    app.use(() => { reached = true; });
    const res = response();
    app.handle({}, res);
    await Promise.resolve();
    assert.equal(reached, false);
    assert.equal(res.body, '由当前中间件响应');
  }

  // 场景五：两个请求交错执行，各自拥有独立的 index。
  {
    const app = createApp();
    const pending = [];
    const logs = [];
    app.use((req, res, next) => { pending.push(next); });
    app.use((req, res) => { logs.push(req.id); res.end('ok'); });
    app.handle({ id: 'request-1' }, response());
    app.handle({ id: 'request-2' }, response());
    pending[1]();
    pending[0]();
    assert.deepEqual(logs, ['request-2', 'request-1']);
  }
  console.log('全部断言通过：同步/异步、错误传播、停止调度、请求隔离。');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
