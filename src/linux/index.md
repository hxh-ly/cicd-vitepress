## 常见命令
```shell
whereis filename # 查找文件路径
```

## scp
```shell
scp localpath root@47.115.61.169:/remotePath
```

## mv
```shell
mv file1 file2 # 修改文件名字
```

## 添加永久代理
```shell
echo $SHELL #确认当前使用的 Shell

vim ~/.bashrc

# add
# 永久设置代理
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897

source ~/.bashrc
```

## curl
```shell
# 保存百度首页为 baidu.html
curl -o baidu.html https://www.baidu.com

# 下载图片（URL 包含文件名 example.jpg）
curl -O https://picsum.photos/200/300/example.jpg

# 发送表单数据（默认 Content-Type: application/x-www-form-urlencoded）
curl -d "username=test&password=123" https://api.example.com/login

curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","age":20}' \
  https://api.example.com/user

# -L 跟随重定向（如 301/302 跳转）
# -I  只显示响应头（不显示响应体）
# -i 显示响应头 + 响应体
# -x 通过代理访问（支持 HTTP/SOCKS 代理）
curl -x socks5h://127.0.0.1:7891 https://github.com
# -k 忽略 HTTPS 证书验证
# -v 调试
```

## other
```shell
echo $SHELL #确认当前使用的 Shell
```