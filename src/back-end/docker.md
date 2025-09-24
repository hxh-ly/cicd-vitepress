# Docker
|特性|DockerFile|docker-compose.yml|
|---|---|---|
|目的|构建一个镜像|编排多个容器|
|角色|零件清单和组件说明书|整个工厂的流水配置图|
|范围|定义单个容器的内容和环境|定义多个服务以及关系（网络、卷、依赖）|
|内容|FORM、RUN、COPY、CMD| `service`,`networks`,`volumes`等配置项 |
|命令|`docker build ...`|`docker-compose up ...`|
|使用场景|创建自定义的应用镜像|开发、测试、部署多服务引用（全栈）|


## docker-compose
docker-compose up 会按照以下逻辑处理镜像：
1. 解析compose文件：识别出美感服务所需要的镜像
2. 检查镜像是否存在
3. 自动拉取镜像
   - 不存在，自动拉取
   - 存在：使用本地
4. 构建镜像：`build .` Compose会根据DockerFile构建一个新的镜像
5. 启动容器：在所有所需要的镜像已就位之后，会根据配置创建并启动所有容器


## 命令
```shell
docker ps -a --filter id=958edf28e695
docker logs nest-app-test
docker exec -it nest-app-test sh
sudo docker exec -it 958edf28e695 /bin/bash
```

## pm2读取日志
```js
// 日志配置 - 增强版
log_date_format: 'YYYY-MM-DD HH:mm:ss',
error_file: './logs/error.log',
out_file: './logs/output.log',
merge_logs: true,
```
```shell
# 在容器内
# 查看所有应用的日志列表
pm run pm2 logs

# 查看特定应用的日志（plusecube_nest为应用名称）
pm run pm2 logs plusecube_nest

# 只查看错误日志
npm run pm2 logs plusecube_nest --err

# 只查看标准输出日志
npm run pm2 logs plusecube_nest --out

# 实时监控日志（尾部）
pm run pm2 logs plusecube_nest --lines 100
```

```shell
# 宿主内
# 查看容器内logs目录内容
docker exec -it nest-app-test ls -la /app/logs/

# 查看错误日志内容
docker exec -it nest-app-test cat /app/logs/error.log

# 查看输出日志内容
docker exec -it nest-app-test cat /app/logs/output.log

# 实时跟踪日志
docker exec -it nest-app-test tail -f /app/logs/output.log
```