## 支持md绘制graph
步骤
`npm install vitepress-plugin-mermaid mermaid --save-dev`

配置插件：在 VitePress 的配置文件.vitepress/config.js中引入withMermaid函数，并传入相关配置。示例如下：

```js
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    // 其他VitePress配置项
  })
);
```