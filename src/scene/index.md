# 场景题

## 支付场景怎么实现。

## 如何通知用户更新？

考察：客户端与服务端通信机制的理解。不同场景下选择不同技术方案的能力。
核心原则上：保持版本的一致性，减少对用户的干扰。
方案 1:轮训

- 主动获取
- 缺点：浪费服务端资源

方案 2:webscoket

- 客户端订阅，服务端推送
- 场景：管理后台应用

方案 3:service worker

```js
if('serviceWorker' in navigator){
    window.addEventListener('load',()=> {
        navigator.serviceWorker.register('./serviceWorker.js').then(registration=>{
            console.log(`service work success: ${registration}`)
            registration.addEventListener('updatefound',()=>{
                let newWorker = registration.installing;
                newWorker.addEventListener('statechange',()=>{
                    if(newWorker.state === 'installled' && navigator.serviceWorker.controller) {
                        showUpdateNotificationFowSW(event.data.newVersion) // 弹窗，点击刷新，postMessage
                    }
                }
        },error=>{
            console.log(`service work error: ${error}`)
        });
    }, false);
}
    navigator.serviceWorker.addEventListner('message',event=>{
        if(event.data && event.data.type && event.data.type === 'update'){
            showUpdateNotificationFowSW(event.data.newVersion) // 弹窗，点击刷新，postMessage
        }
    })
}
```

## 虚拟列表的实现

虚拟列表的核心思想是只**渲染可视区域内的元素**。通过动态计算和位置调整模拟完整的列表的滚动效果。

### 核心概念

1. 视口：用户实际看得到的区域
2. 列表总高度
3. 渲染窗口：可视区域 + 缓冲区（预渲染防止滚动白屏）
4. 项位置缓存：记录每个项的位置信息。（尤其动态高度场景）

### 定高情况

1. 确认承载容量。滚动时可能渲染不及时，可能出现留白情况。我们需要在上下两边都加一个缓存用的 DOM 元素。`count = [totolHeight/itemSize] + bufferSize*2`。为了方便过滤该渲染的 DOM，我们设置两个变量去筛选`firstItem`和`lastItem`
   ![alt text](./img/image.png)

2. 模拟滚动高度。有限数量 item 撑不起上千条数据的列表，需要靠 css 帮忙撑开。

```html
<div class="container">
  <!-- 哨兵元素 -->
  <div
    class="sentry"
    style="{{transform:`translateY(${scrollHeight}px)`}}"
  ></div>
</div>
```

3. 实时计算显示的元素

固定高度的情况，每个 list 的 item 所在的位置都是固定的`translateY 为 idx * itemSize`。同时需要通过`visibleList`来过滤需要渲染的元素。这个需要上方提及的`firstItem`和`lastItem`

```js
useLayoutEffect(() => {
  setVisibleList(list.slice(firstItem, lastItem));
}, [list, firstItem, lastItem]);
```

现在，只需在滚动时获取`event.target.scrollTop`,计算当前应该展示的`firstItem`，firstItem 可以通过`scrollTop/itemSize`算出下标。为了让各位读者有对下面的动态高度技术有循序渐进的感觉，这里延伸出一个新的概念：【锚点元素】。这个锚点有两个属性 index 和 offset，指向的是第一个可视元素的 index，offset 表示滚动高度超过这个元素的值，如果`offset > itemSize`的时候，则`index++`。

```jsx
const updateAnchorItem = useCallback((container) => {
  const index = Math.floor(container.scrollTop / ELEMENT_HEIGHT);
  const offset = container.scrollTop - ELEMENT_HEIGHT * index;
  anchorItem.current = {
    index,
    offset,
  };
}, []);

const scroll = useCallback(
  (event) => {
    const container = event.target;
    // const tempFirst = Math.floor(container.scrollTop / ELEMENT_HEIGHT);
    // setFirstItem(tempFirst);
    // 下面搞那么多花里胡哨，都不如上方来得简单
    const delta = container.scrollTop - lastScrollTop.current;
    lastScrollTop.current = container.scrollTop;
    const isPositive = delta >= 0;
    anchorItem.current.offset += delta;
    let tempFirst = firstItem;
    if (isPositive) {
      // 向下滚
      if (anchorItem.current.offset >= ELEMENT_HEIGHT) {
        updateAnchorItem(container);
      }
      // 更新完的index是否发生了变化
      if (anchorItem.current.index - tempFirst >= BUFFER_SIZE) {
        tempFirst = Math.min(
          list.length - VISIBLE_COUNT,
          anchorItem.current.index - BUFFER_SIZE
        );
        setFirstItem(tempFirst);
      }
    } else {
      // 向上滚
      if (container.scrollTop <= 0) {
        anchorItem.current = { index: 0, offset: 0 };
      } else if (anchorItem.current.offset < 0) {
        updateAnchorItem(container);
      }
      // 更新完的index是否发生了变化
      if (anchorItem.current.index - firstItem < BUFFER_SIZE) {
        tempFirst = Math.max(0, anchorItem.current.index - BUFFER_SIZE);
        setFirstItem(tempFirst);
      }
    }
    setLastItem(
      Math.min(tempFirst + VISIBLE_COUNT + BUFFER_SIZE * 2, list.length)
    );
    // 拉到底层，加载新的数据
    if (
      container.scrollTop + container.clientHeight >=
      container.scrollHeight - 10
    ) {
      setList([...list, ...generateItems()]);
    }
  },
  [list, updateAnchorItem, firstItem]
);
```

### 动态高度

需要解决的问题：

- 元素渲染完后，在获取高度
- 模拟滚动高度不确定，需要实时计算
- 每个可视元素 Y 不固定
- 当元素调整完后，对滚动条影响

## 如何实现 PC 扫码登录

1. 客户端展示二维码

- 二维码可以通过后端生成（后端请求服务商接口，然后跳转链接）
- 前端生成（qrCode.js）
- 使用 Canvas 画图
  具体流程：
- 用户访问
- 服务器准备 服务器会生成用于唯一标识这次登录请求的 ID 通常称为`your_token`，存入 Redis
- 服务器请求微信： 请给我一个二维码，用于登录，并且当用户扫码完后，请通知到我这个地址`https://xxx/x/callback`
- 微信服务器响应：返回一个二维码 url 和本次微信操作的会话 ID（`wx_session_id`）
- 网站显示二维码： 同时前端轮询服务器问：那个临时 ID 的状态改变了吗

2. 用户扫描二维码并鉴权，（手机 app 需要确认登录，发送请求）

- 用户扫码：微信解析出二维码信息（内含 wx_session_id 和指令“授权登录”）
- 微信 app 请求微信服务器：解析出信息和用户自身的微信登录凭证
- 微信服务器验证并推送提示：确认二维码有效，然后在微信 app 弹出授权（是否允许网站获取你的微信头像、昵称等信息？）

3. 微信回调你的服务器

- 用户确认
- 微信服务器处理。它会重定向或回调到你在开始提供的`https://xxx/x/callback` ,url 会凭借关键参数
- - 参数
- - 授权临时票据（`code`）：一个一次性的、短期的凭证。
- - 状态：就是你最初生成`your_token`，微信原样返回，用户防止 CSRF 攻击和匹配请求。
- 你的服务器接收到回调

4. 你的服务器最终完成登录

- 你的服务器验证：根据`your_token`找到之前缓存的登录状态.将其状态更改为`已扫码` 然后拿着收到的`code`、你的**应用 ID**和**应用密钥**（`app_secret`）。再次请求微信服务器
- 微信服务器发放门票：验证`code`,`app_id app_secret` 返回一个**访问令牌**和用户**唯一标识 openId**
- 你的服务器处理登录
- - 用`openid`去找用户，找到就登录；没找到就注册（可能需要`access_token`去获取微信用户信息，去创建账号）
- - 为网站用户创建自己的登录会话（Session Cookie）
- - 缓存的临时 ID 更新为‘登录成功’
- 前端轮询得知成功： 随后跳转登录的首页。

角色分工
|角色|职责|
|---|---|
|你的服务器|1.为业务提供服务。2.管理用户的登录状态(Sesson) 3.向 wx 服务器申请二维码、查询扫码状态。4.最终接管微信认证成功的结果，为用户创建自己网站的登录会话|
|微信服务器|1.认证中心：验证扫码用户的微信身份。2.授权中心：询问用户是否同意授权给你的网站 3.信息中介：用户同意，将标识(openId)给你的服务器 |

### 附长轮询示例

```js
// 前端长轮询逻辑
async function longPolling() {
  try {
    // 发起请求，设置较长超时时间（需大于服务器超时时间）
    const response = await axios.get("/api/long-poll", {
      timeout: 30000, // 30秒超时（服务器通常设置25秒左右，客户端略长）
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 处理服务器返回的新数据
    if (response.data && response.data.hasNewData) {
      console.log("收到新数据:", response.data.data);
      // 这里可以触发UI更新等操作
    }

    // 无论是否有新数据，立即发起下一次轮询
    longPolling();
  } catch (error) {
    console.error("轮询出错或超时，重试中...", error.message);
    // 出错后延迟一段时间重试（避免频繁请求）
    setTimeout(longPolling, 1000);
  }
}

// 启动长轮询
longPolling();
```

```js
// 后端
const express = require("express");
const app = express();
app.use(express.json());

// 模拟存储需要推送给客户端的数据
let messageQueue = [];
// 模拟新数据产生（实际场景可能是数据库变更、消息队列通知等）
setInterval(() => {
  messageQueue.push({
    id: Date.now(),
    content: `新消息 ${Date.now().toString().slice(-4)}`,
  });
}, 5000); // 每5秒产生一条新数据

// 长轮询接口
app.get("/api/long-poll", (req, res) => {
  // 检查是否有未处理的新数据
  if (messageQueue.length > 0) {
    // 有数据则立即返回（并清空队列，实际场景可能按需保留）
    const data = messageQueue;
    messageQueue = [];
    return res.json({
      hasNewData: true,
      data: data,
    });
  }

  // 没有数据时，设置超时定时器（25秒后返回空响应）
  const timeoutTimer = setTimeout(() => {
    // 超时后返回空数据，客户端会重新发起请求
    res.json({
      hasNewData: false,
      data: null,
    });
    // 清除监听（避免内存泄漏）
    clearInterval(checkTimer);
  }, 25000);

  // 定时检查是否有新数据（每1秒检查一次）
  const checkTimer = setInterval(() => {
    if (messageQueue.length > 0) {
      // 有新数据时，清除超时定时器并返回数据
      clearTimeout(timeoutTimer);
      const data = messageQueue;
      messageQueue = [];
      res.json({
        hasNewData: true,
        data: data,
      });
      // 清除检查定时器
      clearInterval(checkTimer);
    }
  }, 1000);

  // 处理客户端主动断开连接的情况
  req.on("close", () => {
    clearTimeout(timeoutTimer);
    clearInterval(checkTimer);
  });
});

// 启动服务器
app.listen(3000, () => {
  console.log("服务器运行在 http://localhost:3000");
});
```

```js
import axios from 'axios';
// 取消请求
const controller =  new AbortController();
const {signal} = controller;;
axios.get('xx',{signal}).catch(e=>{
  if(axios.isCancel(e)) {

    return;
  }
  alert('xxx')
})

setTimeout(()=>>{
  controller.abort('err');
},3000)
```

## 大文件上传，断点续传

### 流程

- 读取大文件，切片`Blob().slice(0,1024)`，哈希计算
- 分片上传
- 允许暂停，断点续传
- 通知合并

### 前端处理

1. 分片上传

- 前端：文件固定大小，每个分片携带`fileHash`、`chunkIndex`(分片索引)
- 后端：接收分片存储到临时目录（以`fileHash`命名，避免文件名冲突），分片命名`chunk-${index}`

2. 断点续传

- 唯一标识：通过`SparkMD5`计算文件内容的 MD5 哈希`fileHash`，即使文件名相同、内容不同也能被区分。
- 检查已上传分片：上传前前端向后端查询`fileHash`对于的已上传分片索引，仅上传缺失的分片。
- 断点恢复：暂停后再次上传时，重复`检查已上传分片`，继续上传未完成部分。

3. 文件合并

- 前端通知合并
- 后端按分片索引排序，将文件分片内容一次写入最终文件。完成后删除临时分片。

优化点

- 分片大小：根据网络环境调整
- 并发控制：限制同时上传的分片数量、避免请求过多导致超时
- 校验机制：可对每个分片计算哈希
- 过期清理：定期清理为合并的临时分片

文件哈希的作用（没有 hash，无法实现的可靠断点续传和大文件上传管理）

- 解决同名冲突
- 追踪文件上传进度
- 验证文件完整性
- 简化后端对分片的存储和管理

### 文件下载模版代码

```js
//前端
const downloadTextFile = async () => {
  try {
    setDownloading(true);
    setMessage("正在下载文本文件...");

    const response = await axios({
      url: "http://localhost:3001/download/text",
      method: "GET",
      responseType: "blob", // 重要：指定响应类型为blob
    });

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement("a");
    a.href = url;

    // 从响应头获取文件名（如果后端设置了的话）
    const contentDisposition = response.headers["content-disposition"];
    let fileName = "example.txt";
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // 清理
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    setMessage("文本文件下载成功");
  } catch (error) {
    console.error("下载失败:", error);
    setMessage("下载失败: " + (error.response?.data || error.message));
  } finally {
    setDownloading(false);
  }
};

// 服务端node
app.get("/download/video", (req, res) => {
  const fileName = req.query.filename || "example.mp4";
  const filePath = path.join(__dirname, "files", fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("文件不存在");
  }

  // 获取文件信息
  const stats = fs.statSync(filePath);

  // 设置响应头
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(fileName)}"`
  );
  res.setHeader("Content-Length", stats.size);

  // 发送文件
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});
```

### 登录无感刷新

无感刷新的前提是采用 “Access Token + Refresh Token” 双令牌架构，两者职责分离：
|令牌类型|作用|有效期|特点|
|---|---|---|---|---|
|Access Token|用于接口访问的“短期凭证”|短期（如 2 小时）|有效期短，降低泄漏风险|
|Refresh Token|用于刷新 Access Token 的 “长期凭证”|长期（如 7 天）|有效期长，仅用于刷新接口；泄露风险较高|

流程包括：

1. 登录时获取 accessToken（短期）和 refreshToken（长期）；
2. 接口请求携带 accessToken，过期时触发刷新；
3. 用 refreshToken 调用刷新接口，获取新令牌并重试原请求；
4. 处理并发刷新、提前刷新等边缘场景，兼顾安全性和体验。

```
┌───┐        ┌─────────┐        ┌─────────┐        ┌─────────┐
│用户│        │ 前端应用 │        │ 后端服务器 │        │ 存储    │
└─┬─┘        └─────┬───┘        └─────┬───┘        └─────┬───┘
  │                 │                  │                  │
  │  1. 登录请求     │                  │                  │
  ├────────────────>│                  │                  │
  │                 │  2. 提交登录凭证  │                  │
  │                 ├─────────────────>│                  │
  │                 │                  │  3. 验证凭证     │
  │                 │                  ├─────────────────>│
  │                 │                  │  4. 返回用户信息  │
  │                 │                  │<─────────────────┤
  │                 │  5. 返回双令牌    │                  │
  │                 │<─────────────────┤                  │
  │                 │  6. 存储令牌      │                  │
  │                 ├─────────────────>│                  │
  │                 │                  │                  │
  │  7. 操作应用     │                  │                  │
  ├────────────────>│                  │                  │
  │                 │  8. 携带accessToken请求接口         │
  │                 ├─────────────────>│                  │
  │                 │                  │  9. 验证accessToken过期 │
  │                 │                  ├─────────────────>│
  │                 │                  │  10. 返回401错误  │
  │                 │<─────────────────┤                  │
  │                 │  11. 检测到401，发起refresh请求     │
  │                 ├─────────────────>│                  │
  │                 │                  │  12. 验证refreshToken │
  │                 │                  ├─────────────────>│
  │                 │                  │  13. 生成新双令牌 │
  │                 │                  │<─────────────────┤
  │                 │  14. 返回新双令牌 │                  │
  │                 │<─────────────────┤                  │
  │                 │  15. 更新存储令牌 │                  │
  │                 ├─────────────────>│                  │
  │                 │  16. 用新accessToken重试原请求      │
  │                 ├─────────────────>│                  │
  │                 │                  │  17. 验证通过，返回数据 │
  │                 │<─────────────────┤                  │
  │  18. 展示操作结果 │                  │                  │
  │<────────────────┤                  │                  │
  │                 │                  │                  │
  │                 │  (异常场景)       │                  │
  │                 │  19. refreshToken无效/过期          │
  │                 │<─────────────────┤                  │
  │                 │  20. 清除令牌，跳转登录页            │
  │                 ├─────────────────>│                  │
  │  21. 重新登录    │                  │                  │
  ├────────────────>│                  │                  │
```

```js
// 前端响应拦截器（核心逻辑）
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config; // 保存原请求配置

    // 条件1：错误状态码为401（令牌过期）
    // 条件2：未进入过刷新流程（避免无限循环）
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // 标记已进入刷新流程

      try {
        // 步骤1：获取本地存储的refreshToken
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          // 无refreshToken，必须重新登录
          redirectToLogin();
          return Promise.reject(error);
        }

        // 步骤2：调用后端刷新接口，用refreshToken换全新的双令牌
        const { data } = await axios.post("/api/auth/refresh-token", {
          refreshToken: refreshToken,
        });

        // 步骤3：更新本地存储的令牌
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        // 步骤4：用新的accessToken重试原请求
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return axios(originalRequest); // 重试原请求
      } catch (refreshError) {
        // 刷新失败（如refreshToken过期/无效），必须重新登录
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        redirectToLogin(); // 跳转登录页
        return Promise.reject(refreshError);
      }
    }

    // 非401错误，直接抛出
    return Promise.reject(error);
  }
);
```
