// 教学版 Express 5 风格中间件调度器：不实现路径匹配、Router 和 next('route')。
function createApp() {
  // ① 注册时共享的中间件列表；请求执行时不修改这个列表。
  const stack = [];

  function use(handler) {
    if (typeof handler !== 'function') throw new TypeError('需要中间件函数');
    stack.push(handler);
    return app;
  }

  function handle(req, res, done = (error) => {
    if (res.writableEnded) return;
    res.statusCode = error ? 500 : 404;
    res.end(error ? 'Internal Server Error' : 'Not Found');
  }) {
    // ② 每个请求独立的游标，通过闭包被 next 保留。
    let index = 0;

    function next(error) {
      // ③ 从上次的位置继续寻找可执行的函数。
      while (index < stack.length) {
        const handler = stack[index++];
        const isErrorHandler = handler.length === 4;
        if (error ? !isErrorHandler : handler.length > 3) continue;

        try {
          // ④ 先推进游标，再调用函数；把同一个 next 传给它。
          const result = error
            ? handler(error, req, res, next)
            : handler(req, res, next);

          // ⑤ Express 5 风格：捕获返回的 Promise 拒绝。
          // 成功 resolve 不会自动 next，也不把这个 Promise 返回给上游。
          if (result && typeof result.then === 'function') {
            Promise.resolve(result).catch((reason) => {
              next(reason || new Error('Rejected promise'));
            });
          }
        } catch (caught) {
          next(caught);
        }

        // ⑥ 一次只调用一个匹配的中间件。由它决定是否继续调用 next。
        return;
      }

      done(error);
    }

    // ⑦ 启动当前请求的第一次调度。
    next();
  }

  const app = { use, handle };
  return app;
}

module.exports = { createApp };
