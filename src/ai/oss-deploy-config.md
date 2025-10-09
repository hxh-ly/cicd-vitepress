# 阿里云 OSS 部署配置说明

在 GitHub Actions 中使用阿里云 OSS 部署功能需要配置以下环境变量（secrets）：

## 需要配置的 Secrets

1. **ALIYUN_OSS_ACCESS_KEY_ID**
   - 阿里云访问密钥 ID
   - 获取方式：阿里云控制台 -> 访问控制 RAM -> 用户 -> 创建用户或使用现有用户 -> 获取 AccessKey

2. **ALIYUN_OSS_ACCESS_KEY_SECRET**
   - 阿里云访问密钥 Secret
   - 注意：这是敏感信息，请妥善保管

3. **ALIYUN_OSS_BUCKET**
   - OSS 存储桶名称
   - 示例：my-website-bucket

4. **ALIYUN_OSS_ENDPOINT**
   - OSS 访问域名
   - 格式：https://oss-cn-hangzhou.aliyuncs.com（根据实际地域调整）

## 配置步骤

1. 进入 GitHub 仓库页面
2. 点击 "Settings" 选项卡
3. 在左侧菜单中选择 "Secrets and variables" -> "Actions"
4. 点击 "New repository secret" 按钮
5. 依次添加以上四个 secrets

## 工作流说明

- 当代码推送到 `main` 分支时，会自动触发构建和部署流程
- 构建完成后，静态资源会自动上传到指定的 OSS bucket
- 可以通过 GitHub Actions 页面手动触发部署流程