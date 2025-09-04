## 小程序的实现原理

### 背景：

传统的网页开发，渲染线程和脚本是互斥的。这也是为什么长时间的脚本运行会导致界面无响应的原因。因为我们常说`JS`是单线程的，微信小程序则选用了`hybird`的渲染方式，将视图层与逻辑层分开，实现双线程同时运行。在此模式下，视图层的界面使用`webview`进行渲染，而逻辑层则在`JScore`中运行。
![alt text](./img/mini_image.png)
在小程序中，渲染层主要负责界面渲染相关的任务，并在 WebView 线程中执行。一个小程序可能存在多个页面，所以渲染层存在多个 WebView 线程，而逻辑层则采用 JSCore 线程运行脚本，执行的都是与小程序业务逻辑有关的代码。

### 通信：

### 运行机制：

启动运行主要有 2 种情况：

- 冷启动（重新开始）：用户首次打开或者小程序被微信销毁后再次打开，这时候需要重新加载启动，即为冷启动。
- 热启动：用户已经打开过小程序，然后一定时间内再次打开小程序，此时无需重启，只需将后台态的小程序切换到前台，这个过程为热启动
  需要注意的是：

1. 小程序没有重启的概念
2. 当小程序进入后台，客户端会维持一段时间的运行状态，超过一定时间后会被微信主动销毁
3. 短时间收到系统两次以上内存警告，也会对小程序进行销毁。这就是为什么一旦页面内存溢出，页面会奔溃的本质原因。
   ![alt text](image.png)
   当开发者在后台发布新版本，无法立即影响所有现网用户，但最差情况下，也在发布后 24 小时之内下发新版本到用户。每次冷启动，都会检查是否有更新版本，如果发现，则会异步下载新版本代码包，并同时用客户端本地的包进行启动，即新版本的小程序需要下一次冷启动才会应用上。

## 小程序的支付流程

流程大致如下：

1. 用户通过分享或者扫码进入商户小程序，用户选择购买，完成选购流程。
2. 调用微信支付控件，用户输入支付密码。
3. 密码验证，支付成功，商户后台得到支付成功通知。
4. 返回商户小程序，显示购买成功。
5. 微信支付公众号下发支付凭证。
   详细流程图：

```mermaid
sequenceDiagram
    participant 用户
    participant 小程序前端
    participant 商户后端
    participant 微信支付服务器

    %% 1. 用户发起支付请求
    用户->>小程序前端: 点击"支付"按钮
    note over 用户,小程序前端: 选择商品后发起支付

    %% 2. 前端请求创建订单
    小程序前端->>商户后端: 请求创建订单(商品ID、金额等)
    note over 小程序前端,商户后端: 传递订单必要信息

    %% 3. 商户后端生成订单
    activate 商户后端
    note over 商户后端: 生成订单记录(状态:未支付)
    deactivate 商户后端

    %% 4. 商户调用微信统一下单接口
    商户后端->>微信支付服务器: 统一下单请求(订单信息、签名)
    note over 商户后端,微信支付服务器: 包含appid、商户号、金额等

    %% 5. 微信返回prepay_id
    微信支付服务器-->>商户后端: 返回prepay_id(预支付会话ID)

    %% 6. 商户生成支付参数签名
    activate 商户后端
    note over 商户后端: 生成签名参数(appId、timeStamp、nonceStr等)
    deactivate 商户后端

    %% 7. 商户返回支付参数给前端
    商户后端-->>小程序前端: 返回签名后的支付参数

    %% 8. 前端调用微信支付控件
    小程序前端->>微信支付服务器: 调用wx.requestPayment(支付参数)

    %% 9. 微信展示支付控件
    微信支付服务器-->>用户: 展示支付界面(输入密码/指纹)

    %% 10. 用户完成支付
    用户->>微信支付服务器: 完成支付验证

    %% 11. 微信同步通知用户结果
    微信支付服务器-->>用户: 同步返回支付结果(成功/失败)

    %% 12. 微信异步通知商户支付结果
    微信支付服务器-->>商户后端: 支付结果异步通知(含签名)
    note over 微信支付服务器,商户后端: 异步通知确保可靠性

    %% 13. 商户验证通知并更新订单
    activate 商户后端
    note over 商户后端: 1. 验证通知签名\n2. 更新订单状态(未支付→已支付)
    deactivate 商户后端

    %% 14. 商户返回通知确认
    商户后端-->>微信支付服务器: 返回"success"确认接收

    %% 15. 前端查询订单状态
    小程序前端->>商户后端: 查询最新订单状态

    %% 16. 商户返回最终状态
    商户后端-->>小程序前端: 返回订单状态(已支付)

    %% 17. 前端展示支付结果页
    小程序前端-->>用户: 展示支付成功页面
```

具体操作流程如下：

1. 打开小程序，下单，此时小程序会调`wx.login`获取用户临时凭证`code`,发送给 wx 后台换取`openId`
2. 用户下单，小程序需要将购买的商品 Id,数量，以及用户的 openId 传送到服务器
3. 服务器收到商品 id，数量，openId 后，生成订单数据，通过通过签名算法，向微信支付发送支付请求，获取预付单`perpay_id`.然后，服务器会将获取到数据再次进行签名，向小程序响应必要的信息。
4. 小程序获取对于参数，调用`wx.requestPayment`发起支付请求，唤起支付工作台，进行支付
5. 用户进行密码/指纹验证，确认支付后，微信后台进行鉴权、直接返回给前端支付的结果，前端收到返回数据后对支付结果进行展示。
6. 最后，微信后台给前端返回结果后，也会给后台返回一个支付结果，后台通过这个支付结果来更新订单信息。
   以下是后端响应数据和`wx.requestPayment`方法所需要的参数示例

```js
wx.requestPayment({
    timeStamp:'', // 时间戳
    nonceStr:'', // 随机字符串
    package:'', // 统一下单接口返回的perpay_id
    signType:'',// 签名类型
    paySign:'',// 签名
    success(){}, //成功回调
    fail(){} // 失败回调
    compelete(){} // 结束回调
})
```

### 支付安全

首先，接口基于 HTTPS 加密；
其次，支付服务提供商户证书下发、报文签名以及商户数据包（MD5）校验等多种安全机制；
此外，用户信息（银行卡、密码、验证码）等信息均不会保存商户系统或者微信系统）；
最后，微信支付还为用户提供交易过程中的安全保障，通过多种风险控制系统为用户拦截可疑交易；

### 结束

小程序支付和以往的网页、APP 微信支付大同小异，可以说小程序的支付变得更加简洁，不需要设置支付目录、域名授权等操作。其优化了支付流程，同时在安全方面也做出了保障，从而为用户提供了更好的支付体验。

## 提高微信小程序的应用速度的手段

一、减少体积

- 控制代码包大小
- 子包按需加载
- 打包优化 -> 压缩代码
- 打包优化 -> 清理无用代码

二、优化加载

- 预加载子包

三、渲染优化

- onLoad 阶段发起请求
- 合并 setData
- 首屏骨架屏
- 长列表，虚拟列表
- 懒加载图片

四、利用缓存

- 缓存本地数据
- 利用 cdn 请求资源

## 微信小程序跳转方式的区别

根据需要使用合适跳转方式，控制栈数量，合理管理小程序内存
|方法|navigateTo|redirectTo|switchTab|navigateBack|reLaunch|
|---|---|---|---|---|---|
|作用|push 栈的形式|replace 的形式|清空，只留下新的 tabBar|返回上一层|清空，只留新页面|

## 小程序微信登录流程

(小程序登录)[https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html]

### 步骤

1. 获取 code
   - 调用`wx.login()`获取 code
2. 获取 openid
   - code 发送到开发者服务器
   - 使用 code 向 wx 服务器换取`openId` `session_key`
3. 自定义登录状态
   - 拿 openId，数据库查询，不存在则创建；存在则校验，生成自定义登录态；
4. 返回登录态
   - 开发者服务器返回登录态给小程序
   - 小程序本地存储
5. 校验登录态
   - 小程序重启可校验登录态
   - `wx.checkSession`验证登录态是否过期
   - 过期则重新执行登录流程，未过期继续使用
     ![alt text](image-1.png)
     综上,微信小程序的登录流程主要分为获取 openid、生成和校验登录态几个步骤。具体实现还需要开发者服务器配合,参考微信官方文档。

### `session_key`的作用：

1. 解密用户敏感数据
   微信小程序中，用户的部分敏感信息（如手机号、头像昵称的完整信息、unionId 等）会以加密形式返回给开发者（通过 wx.getUserProfile、wx.getPhoneNumber 等接口），这些加密数据必须使用 session_key 才能解密为明文。

2. 验证登录状态的有效性
   流程

- 调用`auth.code2Session`获取`session_key`和`openid`，开发者生成一个 token 关联这两个值，返回给小程序前端。
- 后续用户操作`如提交订单`，前端携带 token 发起请求，验证身份合法性。

3. 保证数据传输安全性

- 敏感数据的解密过程只能在开发者服务器完成，避免前端存储密钥导致的泄露风险。
- 即使 session_key 泄露，其时效性也能限制风险范围（过期后自动失效）。

4. 总结

- session_key 是小程序中处理用户敏感数据、验证登录状态的 “安全钥匙”，其核心价值在于在保障用户数据安全的前提下，实现开发者对用户信息的合法获取与身份验证。

## 小程序生命周期

分为三部分：

- 应用生命周期
- 页面生命周期
- 组件生命周期

### 应用生命周期

| 方法                 | 含义                               |
| -------------------- | ---------------------------------- |
| onLaunch             | 全局执行一次，小程序初始化完成触发 |
| onShow               | 启动或者，后台切前台               |
| onHide               | 切后台                             |
| onError              | 脚本错误或者 API 调用错误报错      |
| onPageNotFound       | 跳转页面未找到                     |
| onUnhandledRejection | 未处理的 Promise 拒接              |
| onThemeChange        | 主题切换                           |

### 页面生命周期

| 方法     | 含义                            |
| -------- | ------------------------------- |
| onLoad   | 全局执行一次,页面初始化加载触发 |
| onShow   | 页面显示                        |
| onReady  | 渲染完成                        |
| onHide   | 切后台                          |
| onUnload | 卸载                            |

### 组件声明周期

| 方法     | 含义                     |
| -------- | ------------------------ |
| created  | 组件实例刚创建时触发     |
| attached | 组件进入页面节点树时触发 |
| ready    | 组件首次渲染完成时触发   |
| moved    | 组件位置改变时触发       |
| detached | 组件离开页面节点树时触发 |
| error    | 组件方法错误时触发       |

### 执行顺序

1. 小程序打开： onLaunch -> onShow -> onLoad -> onShow -> onReady
2. 进入新页面： onHide -> onLoad -> onShow -> onReady
3. 返回上一页： onUnload -> onShow
4. 小程序切后台:onHide
5. 小程序重启： onLaunch -> onShow

## 说说对小程序的理解？优缺点

小程序是依托于超级 APP（如微信、支付宝、抖音等）生态的**轻量级应用**，核心特点是 “**无需下载安装、即点即用、用完即走**”。它介于 H5 网页和原生 APP 之间，通过平台提供的底层能力（如支付、定位、社交关系链）实现轻量化服务，同时复用宿主 APP 的流量和用户基础。

优点：

- 无需下载，分发简单，性能优于 h5
- 借助平台
- 相对安全
- 开发门槛低
- 降低兼容性
- 可使用 native

缺点：

- 用户留存率不高
- 性能和复杂度有上限，体积限制
- 受限微信，自由度较低

## 小程序的事件

冒泡事件列表

| 类型        | 触发条件                                    |
| ----------- | ------------------------------------------- |
| touchStart  | 触摸动作开始                                |
| touchMove   | 手指触摸后移动                              |
| touchcancel | 触摸被打断，来电提醒、弹窗                  |
| touchend    | 触摸结束                                    |
| tap         | 触摸后马上离开                              |
| longpress   | 触摸超 350ms，如果触发了这个，则 tap 不触发 |

- `bind`绑定事件：`bindtap`
- `catch`阻止冒泡：`catchtap`
- `capture`捕获事件阶段，`capture-bind:tap` `capture-catch:tap`(中断捕获，取消冒泡)
  - 下列，点击 inner View ，事件顺序为：handleTap2 handleTap4 handleTap3 handleTap1

```wxml
  <view id="outer" bind:touchstart="handleTap1" capture-bind:touchstart="handleTap2">
  outer view
  <view id="inner" bind:touchstart="handleTap3" capture-bind:touchstart="handleTap4">
    inner view
  </view>
</view>
```

- `mul-bind`:换而言之，所有 mut-bind 是“互斥”的，只会有其中一个绑定函数被触发。同时，它完全不影响 bind 和 catch 的绑定效果。
  - 下列，点击 inner View，触发顺序为 handleTap3 handleTap2

```wxml
  <view id="outer" mut-bind:tap="handleTap1">
  outer view
  <view id="middle" bindtap="handleTap2">
    middle view
    <view id="inner" mut-bind:tap="handleTap3">
      inner view
    </view>
  </view>
</view>
```

## 小程序开发的难点

小程序开发的难点贯穿**技术架构、性能优化、兼容性适配**等多个维度，其复杂性源于**微信生态的封闭性、跨端运行环境的差异性以及用户体验与功能实现**的博弈。

### 一、架构设计：在轻量化与扩展性间走钢丝

1. 包体积限制生死线
   包大小 2m，需要极致的代码拆分策略。（分包加载【我的订单】【设置】、资源外置、代码压缩）

2. 双线程架构天生缺陷。
   小程序采用 逻辑层（JS）+ 渲染层（WebView） 的双线程模型，两者通过 setData 通信，这带来性能与灵活性的双重枷锁：

- 跨线程通讯开销：`setData`需要序列化数据并跨线程传输、频繁调用导致帧率下降
- DOM 操作缺失。`wx.createSelectQuery`
- 状态管理困境。复杂应用中，跨组件通信需要依赖事件冒泡或全局状态库，但后者可能引入额外代码和性能损耗。

### 二、性能优化：与微信底层框架的博弈

1. 渲染性能的天花板
   传统 webView 在复杂场景表现乏力：

- 动画卡顿：在低端安卓帧率可能低于 30FPS，需要`requestAnimationFrame`
- 长列表灾难：渲染 1000 条商品数据、`scrollview`频繁触发重排导致内存飙升 300MB 以上
- 3D 图形缺失：WebGL 支持有限，无法直接实现 AR 试妆、3D 建模等原生级体验，，需依赖 Skyline 等原生渲染引擎。

优化：

- 虚拟列表
- worklet：将动画迁移至渲染线程

2.  内存管理的隐形杀手

- 页面栈溢出：默认最多保留 10 层页面栈，但企业级应用可能因多级导航导致内存占用失控（如某政务小程序连续打开 5 个页面后内存达 380MB）。
- 图片加载失控：未压缩的 PNG 图片在列表页滚动时频繁触发 GC（垃圾回收），导致 FPS 剧烈波动。

解决：

- 页面卸载清理：在 onUnload 生命周期中手动释放定时器、事件监听等资源。
- 图片压缩与缓存：使用 WebP 格式（压缩比提升 30%），并通过 `wx.createImage` 预加载关键图片。

### 三、兼容性、跨平台

1. 设备碎片化的泥潭

不同手机的屏幕尺寸、分辨率、性能差异可能导致同一套代码呈现完全不同的效果：

适配技巧：

- 条件编译 `ifdef` `ifndef` 指令为不同平台编写差异化代码（如微信用 rpx 单位，支付宝用 px）。

- 多端测试：使用微信开发者工具的「真机调试」功能，覆盖主流机型（如 iPhone 14、华为 P60、小米 13）和微信版本。

2. 跨平台开发的修罗场
   若需同时支持微信、支付宝、百度等多平台，需解决：

- 组件差异： wx 的 button 和支付宝 button 默认参数一致、事件参数完全不同
- api 语法冲突：微信的 wx.request 与支付宝的 my.request 在请求头、响应格式上存在差异。

### 四、数据管理

1. 数据通信的肠梗阻
   setData 是逻辑层与渲染层通信的唯一通道，但存在**吞吐量与延迟的矛盾**：

- 必须精确指定变更字段（如 this.setData({ 'list[0].price': 99 })），否则可能触发不必要的全量渲染。
- 序列化开销：传递 2MB 数据时，JSON 序列化耗时可能超过 300ms，导致页面更新明显滞后。

2. 复杂业务的状态地狱
   在涉及多页面协同的场景中，数据同步可能演变为灾难：

- 购物车同步：用户在「商品详情页」添加商品后，需实时更新「购物车页」和「底部导航栏」的显示。
- 主题色切换：全局样式变更需立即反映在所有页面和组件中，传统事件冒泡机制难以实现。

解决：

- 全局 Store：通过 mobx-miniprogram 等库创建全局状态中心，各页面订阅状态变更并自动更新视图。
- SharedValue：利用 wx.worklet 的共享变量实现线程间状态同步，适用于动画参数、手势坐标等高频更新场景。

## 小程序全局状态管理：

|方案|响应式|持久化	|学习成本|适合项目规模|核心优势|
|---|---|---|---|---|---|---|---|
|globalData|❌|❌|极低|小型|原生支持，简单直接|
|缓存（Storage）|❌|✅|低|全规模|原生支持，简单直接|
|Westore|✅|❌|中|中小|轻量，响应式，腾讯官方出品|
|mobx-miniprogram|✅|❌|中高|中大型|功能完善，适合复杂状态管理|

- `globalData`

```js
App({
  globalData: {
    userInfo: null, // 用户信息
    theme: "light", // 主题设置
  },

  // 可选：封装修改方法，便于统一管理
  setGlobalData(key, value) {
    this.globalData[key] = value;
  },
});

// 页面/组件中使用
const app = getApp();

// 读取
Page({
  onLoad() {
    console.log("当前用户：", app.globalData.userInfo);
  },
});
```

- 缓存
- mobx-miniprogram

```shell
npm install mobx-miniprogram mobx-miniprogram-bindings --save
```

```js
// 创建
import { observable, action, computed } from "mobx-miniprogram";

export const cartStore = observable({
  // 可观察状态
  items: [], // 购物车商品

  // 计算属性（自动依赖 items，变化时重新计算）
  get totalPrice() {
    return this.items.reduce((sum, item) => sum + item.price * item.count, 0);
  },

  // Action：修改状态的方法（必须用 action 包裹）
  addItem: action(function (goods) {
    const existing = this.items.find((item) => item.id === goods.id);
    if (existing) {
      existing.count += 1;
    } else {
      this.items.push({ ...goods, count: 1 });
    }
  }),

  removeItem: action(function (id) {
    this.items = this.items.filter((item) => item.id !== id);
  }),
});
```

```js
Page({
  onLoad() {
    // 绑定 store 到组件
    this.storeBindings = createStoreBindings(this, {
      store: cartStore,
      fields: ["items", "totalPrice"], // 映射需要的状态和计算属性
      actions: ["addItem", "removeItem"], // 映射需要的 action
    });
  },

  onUnload() {
    // 解绑，避免内存泄漏
    this.storeBindings.destroy();
  },

  methods: {
    handleAdd(goods) {
      // 调用 action 修改状态（自动触发更新）
      this.addItem(goods);
    },
  },
});
```

- westore

```js
// store/index.js
import { createStore } from "westore";

// 定义全局状态
const store = createStore({
  user: { name: "游客", isLogin: false },
  cart: [], // 购物车数据
});

// 定义修改状态的方法（推荐集中管理，避免散落在组件中）
store.actions = {
  login(userInfo) {
    // 修改状态（自动触发响应式更新）
    this.user = { ...userInfo, isLogin: true };
  },
  addToCart(goods) {
    this.cart.push(goods);
  },
};

export default store;
```

```js
import store from './store';
import { appEnhance } from 'westore';
// app.js
App(appEnhance({
  onLaunch:{
    const user = wx.getLocalStorageSync('user')
  if(user) {
    store.data.user = user;
  }
}
},store) )
```

```js
// 组件
import store from './store';
Page( connect({
  mapState(store){
    reutrn {
      user:store.data.user,
      cartCount: store.cart.length
    }
  }
})  ) {
  onLoad(){
    store.actions.login({name:'张三'})
  }
}
```
