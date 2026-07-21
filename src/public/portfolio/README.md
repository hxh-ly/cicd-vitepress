# 作品集静态资源目录

## 小图（可进仓库）

截图放到这里，例如 `leda-fund.png`，在 `works.ts` 中：

```ts
cover: '/portfolio/leda-fund.png'
```

## 大视频（只放 OSS，不要 commit）

1. 本地转成 mp4 后上传到 OSS：

```text
oss://axuaxu-blog/blog/portfolio/xxx.mp4
```

2. 在 `works.ts` 里用直链：

```ts
video: 'https://axuaxu-blog.oss-cn-shanghai.aliyuncs.com/blog/portfolio/xxx.mp4'
```

本目录的 `*.mp4` 已在 `.gitignore` 中忽略；`ossutil cp` 不会删除 OSS 上已有视频。

本地 MOV → mp4：

```bash
avconvert \
  --source ./demo.MOV \
  --preset Preset960x540 \
  --output ./demo.mp4 \
  --replace
```
