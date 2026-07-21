# 作品集静态资源目录

把作品截图、演示视频放在这里，例如：

- `ai-teacher.mp4`
- `three-teach.mp4`
- `demo.png`

在 `src/project/works.ts` 中引用：

```ts
cover: '/portfolio/demo.png'
video: '/portfolio/ai-teacher.mp4'
```

说明：

- 浏览器播放请用 **mp4**（H.264），不要提交 `.MOV`
- 本地可用 macOS 自带工具转换：

```bash
avconvert \
  --source ./demo.MOV \
  --preset Preset960x540 \
  --output ./demo.mp4 \
  --replace
```
