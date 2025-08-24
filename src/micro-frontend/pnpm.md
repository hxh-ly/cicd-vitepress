# pnpm

## 优势
- 节省空间
- 提升安装速度
- 非扁平化（包互相依赖）

```shell
# 软连接 类似win的快捷方式
ln -s index.js ruan.js 

ln index.js ying.js

# 查询 pnpm的store目录
pnpm store path  

pnpm add

# package-lock.json -> pnpm-lock.yml
pnpm import  
# 添加依赖
pnpm -F main add common --workspace
```
