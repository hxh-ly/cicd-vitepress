# Next.js

## 三种渲染策略概览

| 策略 | 全称                            | 中文         | 工作原理            | 适用场景                     |
| ---- | ------------------------------- | ------------ | ------------------- | ---------------------------- |
| SSG  | static Site Generation          | 静态站点生成 | 构建时生成静态 HTML | 内容不变或很少变化的页面     |
| SSR  | Server-Side Rendering           | 服务端渲染   | 请求时生成 HTML     | 内容频繁变化/个性化的页面    |
| ISR  | Incremental Static Regeneration | 增量静态再生 | SSG+按需再生        | 需要静态速度但内容会变的页面 |

1. SSG（静态站点生成）
   ​​ 什么时候使用 SSG​​? SSG 在 ​​ 构建时 ​​ 生成静态 HTML 文件，适合内容基本不变的页面。

​​✅ 使用场景：​​

- 个人简历/作品集网站
- 博客文章
- 产品展示页面
- 文档网站
- 营销落地页

```js
// 页面内容在构建时确定
export default function AboutPage({ pageData }) {
  return <div>{pageData.content}</div>;
}

// 获取静态数据
export async function getStaticProps() {
  const pageData = await fetchPageData();

  return {
    props: { pageData }, // 构建时传入页面
  };
}
```

2. SSR（服务端渲染）
   ​​ 什么时候使用 SSR​​? SSR 在 ​​ 每次请求时 ​​ 生成 HTML，适合内容频繁变化或需要个性化的页面。
   ​
   ​✅ 使用场景：​​

- 用户仪表盘
- 实时数据页面
- 电子商务产品页面（库存、价格常变）
- 需要用户认证的页面
- 社交媒体动态

```js
// 页面内容每次请求时生成
export default function UserProfile({ userData }) {
  return <div>Hello, {userData.name}!</div>;
}

// 每次请求时获取数据
export async function getServerSideProps(context) {
  const { req, res, params } = context;
  const userData = await fetchUserData(req.cookies.token);

  return {
    props: { userData }, // 每次请求时传入
  };
}
```

3. ISR（增量静态再生）

​​ISR 与 SSG/SSR 的联系 ​​:ISR = SSG 的速度 + SSR 的灵活性

​​🌟 核心优势：​​

- 首访用户获得静态页面（快速）
- 后台按需重新生成页面
- 无需全站重新构建

✅ 使用场景：​​

- 新闻网站文章
- 电商产品目录
- 博客评论系统
- 任何需要定期更新的内容

```js
// 初始构建时生成，之后按需再生
export default function BlogPost({ post }) {
  return <article>{post.content}</article>;
}

export async function getStaticProps({ params }) {
  const post = await fetchPost(params.slug);

  return {
    props: { post },
    revalidate: 60, // ← 关键：60秒后再生
  };
}

// 需要定义动态路由
export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking", // 或 true
  };
}
```

🚀 高级策略：混合渲染

```js
// 首页：SSG + 部分客户端数据获取
export default function HomePage({ staticProducts }) {
  const [userData, setUserData] = useState(null);

  // 静态产品数据 + 动态用户数据
  useEffect(() => {
    fetchUserData().then(setUserData);
  }, []);

  return (
    <div>
      <Header user={userData} /> {/* 动态 */}
      <ProductList products={staticProducts} /> {/* 静态 */}
    </div>
  );
}

export async function getStaticProps() {
  const staticProducts = await fetchProducts();

  return {
    props: { staticProducts },
    revalidate: 3600, // 每小时再生
  };
}
```

## ISR

ISR 是 Next.js 最强大的特性之一，它结合了 SSG 的性能优势和 SSR 的灵活性。 ISR = SSG + 按需更新能力
|特性|说明|
|---|---|
|首次访问|像 SSG 一样快速（预生成静态页面）|
|后续更新|在后台重新生成页面，用户无感知|
|更新策略|基于时间或手动触发|

## RSC

RSC（React Server Components）与 SSR/SSG/ISR 确实有密切关系，但它们处于不同的抽象层级 ​​。
|概念|层级|职责|类比|
|---|---|---|---|
|SSR/SSG/ISR|渲染策略层|决定何时、何地生成 HTML|餐桌的上菜方式（堂食/外卖/预制菜）|
|RSC|组件架构层|决定组件在哪里执行（服务端/客户端）|厨房的工作分工（厨师/服务员职责）|

## SSG、SSR 和 RSC 中使用 Hooks 的完整指南

🎯 快速总结

| 组件类型              | 渲染策略 | 能否使用 useState | 能否使用 useEffect | 备注             |
| --------------------- | -------- | ----------------- | ------------------ | ---------------- |
| ​​ 客户端组件 ​​      | SSG/SSR  | ✅ 可以           | ✅ 可以            | 在客户端执行     |
| ​​ 服务端组件 (RSC)​​ | SSG/SSR  | ❌ 不能           | ❌ 不能            | 在服务端执行     |
| ​​ 混合组件 ​​        | SSG/SSR  | ✅ 有条件使用     | ✅ 有条件使用      | 需注意 hydration |

混合模式：服务端组件包含客户端交互 ​

```js
// app/mixed-page/page.js
export default async function MixedPage() {
  // 服务端数据获取
  const initialData = await getServerData();

  return (
    <div>
      <h1>混合页面</h1>

      {/* 服务端渲染的静态内容 */}
      <StaticContent data={initialData} />

      {/* 客户端交互部分 */}
      <ClientInteractiveSection />

      {/* 动态客户端组件 */}
      <DynamicClientComponent />
    </div>
  );
}

// 静态内容组件（服务端）
function StaticContent({ data }) {
  // ❌ 不能使用 useState/useEffect
  // 但可以直接使用服务端数据
  return <div>{data}</div>;
}

// 客户端交互组件
("use client");
function ClientInteractiveSection() {
  // ✅ 可以使用所有 Hooks
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 客户端初始化逻辑
    console.log("组件挂载");
  }, []);

  const handleSubmit = async () => {
    setIsLoading(true);
    // 客户端数据提交
    await fetch("/api/submit", {
      method: "POST",
      body: JSON.stringify({ input: userInput }),
    });
    setIsLoading(false);
  };

  return (
    <div>
      <input
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        placeholder="输入内容"
      />
      <button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "提交中..." : "提交"}
      </button>
    </div>
  );
}
```

🚀 实际应用模式

1. SSG + 客户端状态管理 ​

```jsx
/ 电商产品页面（SSG + 客户端交互）
export default function ProductPage({ product }) {
  // 服务端提供的静态产品数据
  const { name, price, description } = product

  return (
    <div>
      {/* 静态产品信息 */}
      <h1>{name}</h1>
      <p>价格: ${price}</p>
      <p>{description}</p>

      {/* 客户端交互部分 */}
      <AddToCartButton productId={product.id} />
      <ProductReviews productId={product.id} />
    </div>
  )
}

// 客户端购物车组件
'use client'
function AddToCartButton({ productId }) {
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)

  const handleAddToCart = async () => {
    setIsAdding(true)
    await addToCart(productId, quantity)
    setIsAdding(false)
  }

  return (
    <div>
      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        min="1"
      />
      <button onClick={handleAddToCart} disabled={isAdding}>
        {isAdding ? '添加中...' : '加入购物车'}
      </button>
    </div>
  )
}
```

💡 最佳实践总结

1. 明确组件边界 ​​：服务端组件用于数据获取和静态渲染，客户端组件用于交互
2. ​​ 最小化客户端代码 ​​：将交互逻辑隔离到小型客户端组件中
3. 注意 hydration​​：确保服务端和客户端初始渲染一致
4. 合理使用 Hooks​​：在正确的组件类型中使用相应的 Hooks
5. 关键记住：​​ SSG/SSR 决定的是 ​​ 页面生成时机 ​​，而 RSC/客户端组件决定的是 ​​ 代码执行环境 ​​。Hooks 的使用限制来自于执行环境，而不是页面生成策略。

## Next.js 中 7 大代码分割优化策略的深度解析：

### 一、​​ 路由级自动代码分割（核心机制）​​

- ​​ 原理 ​​：基于文件系统的路由（pages/或 app/目录），每个路由生成独立 chunk
  ​​ 优势 ​​：
- 用户访问 /about 时仅加载 about 路由的代码
- 首页加载时不加载未访问路由的代码
- 实现

```js
// pages/index.js → 生成 main-home.js
// pages/about.js → 生成 chunk-about.js
```

### 二、​​ 动态导入（Dynamic Import）​​

- ​ 场景 ​​：组件/模块级代码分割

```js
// 1. 动态导入组件
const DynamicComponent = dynamic(() => import("../components/HeavyComponent"));

// 2. 动态导入库
import("lodash/debounce").then((module) => {
  const debounce = module.default;
  // 使用逻辑
});

// 高级配置
dynamic(() => import("../components/AdminPanel"), {
  loading: () => <LoadingSpinner />, // 加载状态
  ssr: false, // 禁用服务端渲染
  suspense: true, // React 18 Suspense 模式
});
```

### 三、第三方库分割(Vendor Spliting)
问题 ​​：大型第三方库（如 lodash）影响首包体积
```jsx
// 手动分离
// webpack 优化
module.exports = {
webpack: (config) => {
config.optimization.splitChunks.cacheGroups.vendor = {
test: /[\\/]node_modules[\\/]/,
name: 'vendors',
chunks: 'all',
}
return config
}
}
```

### 四、服务端组件代码分割
- App Router特性
- - 服务端组件默认不包含在客户端 bundle 中
- - 客户端组件自动生成独立 chunk
```jsx
import ServerComp from './ServerComp' // 不包含在客户端 JS
import ClientComp from './ClientComp' // 自动代码分割

export default function Home() {
  return (
    <>
      <ServerComp />
      <ClientComp />
    </>
  )
}
```

### 五、​​预加载策略（Intelligent Preloading）​

- `<Link>`组件自动预加载视区内链接的资源
- 滚动到链接时加载目标路由 chunk
```jsx
<Link 
  href="/dashboard" 
  prefetch={false} // 禁用预加载
>
  Dashboard
</Link>
```

### 六、模块联合（Module Federation）​
- ​​微前端场景优化​​：
- 效果​​：跨应用共享公共依赖
```js
// next.config.js
const { withModuleFederation } = require('@module-federation/nextjs-mf')

module.exports = withModuleFederation({
  name: 'hostApp',
  remotes: {
    resumeModule: 'resumeModule@http://cdn.example.com/remoteEntry.js'
  },
  shared: ['react', 'react-dom']
})
```

### 七、​​资源加载优化（配合代码分割）​
- 1. ​​图片优化​​：
```jsx
// 自动优化功能：
// ✅ 自动 WebP/AVIF 格式转换
// ✅ 响应式图片生成
// ✅ 懒加载
// ✅ 占位符和模糊效果
import Image from 'next/image'
<Image src="/profile.jpg" width={500} height={500} placeholder="blur" />
```
- 2. 字体优化
```js
// 自动子集化​​：只包含使用的字符
// ​​CSS 内联​​：关键字体 CSS 内联到 HTML
// ​​预加载​​：关键字体提前加载
​// ​无布局偏移​​：避免字体加载导致的布局跳动

// next.config.js
module.exports = {
  experimental: { optimizeFonts: true }
}
```
- 静态资源处理
```js
// 公共资源自动优化
// public/ 目录下的文件：
// - 自动压缩
// - 添加缓存头
// - CDN 分发

// next.config.js 配置
module.exports = {
  headers: async () => {
    return [
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  }
}
```
### Next.js 的资源优化是一个​​全栈式、自动化​​的过程：


1. ​​图片​​：格式转换、尺寸优化、懒加载
2. ​​字体​​：子集化、内联、预加载
3. 代码​​：分割、树摇、压缩
​4. ​静态资源​​：缓存、压缩、CDN
​​5. 性能监控​​：指标跟踪、分析报告

关键优势：
- ✅ ​​零配置优化​​：大部分优化开箱即用
- ✅ ​​渐进增强​​：支持现代浏览器特性
- ✅ ​​性能优先​​：围绕 Core Web Vitals 设计
- ✅ ​​开发友好​​：优化不增加开发复杂度
通过这些优化，Next.js 应用能够轻松达到 ​​90+ Lighthouse 分数​​，提供接近原生应用的性能体验。
```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 基本优化
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  
  // 图片优化
  images: {
    formats: ['image/webp'], // 优先 WebP 格式
    deviceSizes: [640, 750, 828, 1080, 1200], // - ​​设备断点配置​
    imageSizes: [96, 128, 256], // - ​​布局尺寸配置​
    domains: [], // 如果没有外部图片，保持为空
  },
  
  // 缓存头配置
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on' // DNS 预获取
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'  //强制 HTTPS 连接  1年，包含所有子域名 HSTS
          },
        ],
      },
      {
        source: '/static/:path*', // 静态资源
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'  // 长期缓存
          }
        ]
      }
    ]
  },
  
  // 环境变量配置（如果需要）
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  }
}

module.exports = nextConfig
```