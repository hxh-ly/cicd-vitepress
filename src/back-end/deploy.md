# Git Action
## 语法速成
1.触发条件`on`，定义什么时候跑这个流水线
```yaml
on:
    push:
        branchs:[main,dev]
        path:
        - 'apps/plusecube_nest/**'
        - '.github/workflows/deploy-api.yml'
    workflow_dispatch:      # 允许github网页手动点击`run workflow`
    workflow_call:          # 允许被其他workflow call
```

2.工作单元
```
workflow（整个文件）
 └─ job 任务（可并行/串行）
     └─ step 步骤（job 内按顺序执行）
```
- `runs-on`:`ubuntu-latest`
- `if`:条件执行。这份文件用它实现只在dev/main分之跑、以及按环境变量选择登录方式
- `continue-on-error:true` 某步失败不阻塞后续（这里是lint不阻断）
- `working-directory`:该步的工作目录
- `env`:环境变量（可以写在workflow/job/step三个层级，作用域从大到小）

3.step的两种写法
```yaml
- name:步骤名
  uses:actions/checkout@v4 # ① 复用第三方 action（拉取他人写好的一段逻辑）
  with:                    # 传该action的入参
   node-version:'22'
- name:跑命令
  run:pnpm run build       # ② 直接在 Runner 上执行 shell 命令
```

4.表达式于上下文`${{}}`

`${{}}`里可以引用：`secrets.XXX`（加密密钥）、`var.XXX`（非加密变量）、`env.XXX`、`github.sha`、`github.ref_name`、`steps.<step_id>.outputs.<key>`（上一步的key）等。这就是这份文件里大量`${{sercets.XXX}} ${{github.sha}} ${{steps.acr.outputs.registry}}`等来源

### Secret / Variable 的区别（关键）

- **Secrets**：存密码、密钥，写入后不可查看、不打印到日志，用于 `secrets.XXX`。
- Repository Variables：非敏感配置（如这份文件里的 `ANALYTICS_EXECUTION_MODE`），用于 `vars.XXX`，可随时改，实现 "不改代码灰度切换"。

6.步骤传递数据:`GITHUB_OUTPUT`
一个step用`echo "key=value" >> $GITHUB_OUTPUT`输出结果，下一步step用`${{steps.xxid.outputs.key}}`读取。多行值用heredoc：
```bash
echo "tags<<EOF" >> "$GITHUB_OUTPUT"
echo "img:tag1"
echo "img:tag2"
echo "EOF" >> "$GITHUB_OUTPUT"
```

（`<<EOF` ... `EOF` 是 bash 的 "多行字符串"，这里正好传给 GitHub 的多行输出约定。）

## 读懂某一份action.yml
```yaml
name: Deploy API (plusecube_nest) — ACR

on:
  push:
    branches: [main, dev]
    paths:
      - 'apps/plusecube_nest/**'
      - '.github/workflows/deploy-api.yml'
  workflow_dispatch:
  workflow_call:

env:
  SERVER_PROJECT_PATH: /opt/plusecube-app
  SERVER_NEST_PATH: /opt/plusecube-app/nest
  SERVER_DATA_PATH: /opt/plusecube-data
  IMAGE_NAME: plusecube_nest
  ACR_REGISTRY_DEFAULT: registry.cn-hangzhou.aliyuncs.com

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/dev' || github.ref == 'refs/heads/main'

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Resolve ACR settings
        id: acr
        run: |
          REGISTRY="${{ secrets.ACR_REGISTRY }}"
          NAMESPACE="${{ secrets.ACR_NAMESPACE }}"
          if [ -z "$REGISTRY" ]; then REGISTRY="${{ env.ACR_REGISTRY_DEFAULT }}"; fi
          REGISTRY="${REGISTRY#https://}"
          REGISTRY="${REGISTRY#http://}"
          REGISTRY="${REGISTRY%/}"
          NAMESPACE="$(echo -n "$NAMESPACE" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
          if [ -z "$NAMESPACE" ]; then
            echo "缺少 Secret: ACR_NAMESPACE"
            exit 1
          fi
          echo "registry=${REGISTRY}" >> "$GITHUB_OUTPUT"
          echo "namespace=${NAMESPACE}" >> "$GITHUB_OUTPUT"
          echo "Resolved registry=${REGISTRY} namespace=${NAMESPACE}"

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - name: Install dependencies
        # API 构建不应被无关 workspace 的临时 lockfile 漂移阻断；CI 内只更新工作副本，不提交锁文件。
        run: pnpm install --filter plusecube_nest... --no-frozen-lockfile

      - name: Lint (non-blocking)
        working-directory: apps/plusecube_nest
        continue-on-error: true
        run: pnpm run lint

      - name: Build application
        working-directory: apps/plusecube_nest
        run: pnpm run build

      # docker 驱动：build 后镜像留在本地，可 docker save，无需再 pull ACR
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        with:
          driver: docker

      - name: Choose ACR auth mode
        id: auth
        env:
          AK: ${{ secrets.ALIYUN_ACCESS_KEY_ID }}
          SK: ${{ secrets.ALIYUN_ACCESS_KEY_SECRET }}
        run: |
          if [ -n "$AK" ] && [ -n "$SK" ]; then
            echo "mode=access_key" >> "$GITHUB_OUTPUT"
          else
            echo "mode=password" >> "$GITHUB_OUTPUT"
          fi

      - name: Log in to ACR via AccessKey
        if: steps.auth.outputs.mode == 'access_key'
        uses: aliyun/acr-login@v1
        with:
          login-server: https://${{ steps.acr.outputs.registry }}
          region-id: cn-hangzhou
          access-key-id: ${{ secrets.ALIYUN_ACCESS_KEY_ID }}
          access-key-secret: ${{ secrets.ALIYUN_ACCESS_KEY_SECRET }}

      - name: Log in to ACR via username/password
        if: steps.auth.outputs.mode == 'password'
        uses: aliyun/acr-login@v1
        with:
          login-server: https://${{ steps.acr.outputs.registry }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - name: Compute image tags
        id: meta
        run: |
          SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
          if [ "${{ github.ref_name }}" = "main" ]; then
            TAG="prod-${SHORT_SHA}"
            LATEST_TAG="latest"
          else
            TAG="test-${SHORT_SHA}"
            LATEST_TAG="test"
          fi
          FULL_IMAGE="${{ steps.acr.outputs.registry }}/${{ steps.acr.outputs.namespace }}/${{ env.IMAGE_NAME }}"
          {
            echo "tag=${TAG}"
            echo "latest_tag=${LATEST_TAG}"
            echo "full_image=${FULL_IMAGE}"
            echo "image_tags=${FULL_IMAGE}:${TAG}"
            echo "tags<<EOF"
            echo "${FULL_IMAGE}:${TAG}"
            echo "${FULL_IMAGE}:${LATEST_TAG}"
            echo "EOF"
          } >> "$GITHUB_OUTPUT"
          echo "Will build/push: ${FULL_IMAGE}:${TAG} and :${LATEST_TAG}"

      - name: Build and push to ACR
        uses: docker/build-push-action@v6
        with:
          context: apps/plusecube_nest
          file: apps/plusecube_nest/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          provenance: false

      - name: Export image tarball (local, no ACR pull)
        run: |
          set -euo pipefail
          IMAGE_TAGS="${{ steps.meta.outputs.image_tags }}"
          echo "Saving local image: ${IMAGE_TAGS}"
          docker image inspect "$IMAGE_TAGS" >/dev/null
          docker save "$IMAGE_TAGS" | gzip -1 > /tmp/nest-image.tar.gz
          ls -lh /tmp/nest-image.tar.gz

      - name: Prepare SSH key
        env:
          SSH_PRIVATE_KEY: ${{ secrets.TEST_SSH_PRIVATE_KEY }}
          SSH_HOST: ${{ secrets.TEST_SERVER_IP }}
          SSH_USER: ${{ secrets.TEST_SERVER_USER }}
        run: |
          set -euo pipefail
          mkdir -p ~/.ssh
          chmod 700 ~/.ssh
          KEY_FILE="$HOME/.ssh/deploy_key"

          SSH_HOST="$(printf '%s' "${SSH_HOST:-}" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
          SSH_USER="$(printf '%s' "${SSH_USER:-}" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
          if [ -z "$SSH_HOST" ]; then
            echo "ERROR: Secret TEST_SERVER_IP is empty"
            exit 1
          fi
          if [ -z "$SSH_USER" ]; then
            SSH_USER="root"
          fi
          echo "SSH target: ${SSH_USER}@${SSH_HOST}"

          if printf '%s' "$SSH_PRIVATE_KEY" | grep -q 'BEGIN .*PRIVATE KEY'; then
            printf '%s\n' "$SSH_PRIVATE_KEY" > "$KEY_FILE"
          else
            printf '%s' "$SSH_PRIVATE_KEY" | sed 's/\\n/\n/g' > "$KEY_FILE"
          fi
          if [ -n "$(tail -c1 "$KEY_FILE" 2>/dev/null || true)" ]; then
            echo >> "$KEY_FILE"
          fi
          chmod 600 "$KEY_FILE"
          ssh-keygen -y -f "$KEY_FILE" >/dev/null

          cat > ~/.ssh/config <<EOF
          Host deploy-target
            HostName ${SSH_HOST}
            User ${SSH_USER}
            IdentityFile ${KEY_FILE}
            IdentitiesOnly yes
            StrictHostKeyChecking no
            ServerAliveInterval 30
          EOF
          sed -i 's/^[[:space:]]*//' ~/.ssh/config
          chmod 600 ~/.ssh/config
          ssh deploy-target 'echo SSH_OK from $(hostname)'

      - name: Deploy via SCP + SSH (keep data volumes)
        env:
          IMAGE_TAGS: ${{ steps.meta.outputs.image_tags }}
          PROJECT_PATH: ${{ env.SERVER_PROJECT_PATH }}
          NEST_PATH: ${{ env.SERVER_NEST_PATH }}
          DATA_PATH: ${{ env.SERVER_DATA_PATH }}
          ANALYTICS_GITHUB_CLIENT_ID: ${{ secrets.ANALYTICS_GITHUB_CLIENT_ID }}
          ANALYTICS_GITHUB_CLIENT_SECRET: ${{ secrets.ANALYTICS_GITHUB_CLIENT_SECRET }}
          ANALYTICS_GITHUB_ALLOWED_USER_IDS: ${{ secrets.ANALYTICS_GITHUB_ALLOWED_USER_IDS }}
          # Repository Variable，可在不改代码的情况下灰度切换 local/tcp。
          ANALYTICS_EXECUTION_MODE: ${{ vars.ANALYTICS_EXECUTION_MODE || 'local' }}
        run: |
          set -euo pipefail

          echo "Deploy image (pinned): ${IMAGE_TAGS}"

          case "$ANALYTICS_EXECUTION_MODE" in
            local|tcp) ;;
            *)
              echo "ERROR: Repository Variable ANALYTICS_EXECUTION_MODE must be local or tcp"
              exit 1
              ;;
          esac
          echo "Analytics Gateway mode: ${ANALYTICS_EXECUTION_MODE}"

          for required_name in \
            ANALYTICS_GITHUB_CLIENT_ID \
            ANALYTICS_GITHUB_CLIENT_SECRET \
            ANALYTICS_GITHUB_ALLOWED_USER_IDS
          do
            if [ -z "${!required_name:-}" ]; then
              echo "ERROR: missing GitHub Actions Secret: ${required_name}"
              exit 1
            fi
          done

          rm -rf /tmp/nest-bundle
          mkdir -p /tmp/nest-bundle/nginx/ssl
          cp apps/plusecube_nest/docker-compose.test.yml /tmp/nest-bundle/
          cp apps/plusecube_nest/nginx.conf /tmp/nest-bundle/
          cp apps/plusecube_nest/.env.development.example /tmp/nest-bundle/
          cp -a apps/plusecube_nest/nginx/conf.d /tmp/nest-bundle/nginx/

          # 线上容器当前以 NODE_ENV=development 运行，因此挂载 .env.development。
          # OAuth Secret 仅写入临时部署包，不写入仓库或 Actions 日志。
          cp apps/plusecube_nest/.env.development.example /tmp/nest-bundle/.env.development
          {
            printf '\nANALYTICS_GITHUB_CLIENT_ID=%s\n' "$ANALYTICS_GITHUB_CLIENT_ID"
            printf 'ANALYTICS_GITHUB_CLIENT_SECRET=%s\n' "$ANALYTICS_GITHUB_CLIENT_SECRET"
            printf 'ANALYTICS_GITHUB_ALLOWED_USER_IDS=%s\n' "$ANALYTICS_GITHUB_ALLOWED_USER_IDS"
            printf 'ANALYTICS_GITHUB_CALLBACK_URL=%s\n' 'https://www.axuaxu.top/plusecube-nest/analytics/auth/github/callback'
            printf 'ANALYTICS_GITHUB_SUCCESS_REDIRECT=%s\n' 'https://www.axuaxu.top/back-admin/'
            printf 'ANALYTICS_GITHUB_FAILURE_REDIRECT=%s\n' 'https://www.axuaxu.top/back-admin/login'
            printf 'ANALYTICS_OAUTH_STATE_TTL_SECONDS=%s\n' '600'
            printf 'ANALYTICS_ADMIN_SESSION_TTL_SECONDS=%s\n' '43200'
          } >> /tmp/nest-bundle/.env.development
          chmod 600 /tmp/nest-bundle/.env.development

          umask 077
          {
            echo "IMAGE_TAGS=${IMAGE_TAGS}"
            echo "PROJECT_PATH=${PROJECT_PATH}"
            echo "NEST_PATH=${NEST_PATH}"
            echo "DATA_PATH=${DATA_PATH}"
            echo "ANALYTICS_EXECUTION_MODE=${ANALYTICS_EXECUTION_MODE}"
          } > /tmp/deploy.env

          cat > /tmp/deploy-remote.sh <<'SCRIPT'
          #!/usr/bin/env bash
          set -euo pipefail
          set -a
          # shellcheck disable=SC1091
          source /tmp/deploy.env
          set +a

          echo "=== Nest deploy (keep data volumes) ==="
          echo "Image: ${IMAGE_TAGS}"
          echo "Nest path: ${NEST_PATH}"

          if ! command -v docker >/dev/null 2>&1; then
            echo "ERROR: docker not installed"
            exit 1
          fi
          systemctl start docker || true

          mkdir -p "$PROJECT_PATH/frontend" "$PROJECT_PATH/portal" "$DATA_PATH/nginx/ssl"

          # 部署前备份数据库（防止误操作/部署失败导致数据丢失），保留最近 10 份
          if docker ps --format '{{.Names}}' | grep -q '^mysql-db-test$'; then
            BACKUP_DIR="$DATA_PATH/backups"
            mkdir -p "$BACKUP_DIR"
            BACKUP_FILE="$BACKUP_DIR/plusecube_test_$(date +%Y%m%d_%H%M%S).sql.gz"
            if docker exec mysql-db-test mysqldump -u testuser -ptestuserpassword plusecube_test 2>/dev/null | gzip > "$BACKUP_FILE"; then
              echo "DB backup saved: $BACKUP_FILE"
              ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f 2>/dev/null || true
            else
              echo "WARN: DB backup failed, continue deploy"
            fi
          fi

          # down 不带 -v：只停/删容器，保留 mysql-data-test / redis-data-test 数据卷，不丢数据
          for d in \
            "$PROJECT_PATH" \
            "$PROJECT_PATH/apps/plusecube_nest" \
            "$NEST_PATH"
          do
            if [ -f "$d/docker-compose.test.yml" ]; then
              echo "compose down (keep volumes): $d"
              ( cd "$d" && docker compose -f docker-compose.test.yml down --remove-orphans ) 2>/dev/null || true
            fi
          done

          # 清理未被 compose 接管的残留容器；app 先给 Worker 足够时间优雅退出。
          docker stop -t 190 nest-app-test 2>/dev/null || true
          docker stop -t 30 nest-analytics-test 2>/dev/null || true
          for c in nest-app-test nest-analytics-test nginx-proxy-test redis-cache-test mysql-db-test; do
            docker rm -f "$c" 2>/dev/null || true
          done

          rm -f \
            "$PROJECT_PATH/docker-compose.test.yml" \
            "$PROJECT_PATH/docker-compose.yml" \
            "$PROJECT_PATH/.env.deploy" \
            2>/dev/null || true

          rm -rf "$NEST_PATH"
          mkdir -p "$NEST_PATH"
          cp -a /tmp/nest-bundle/. "$NEST_PATH/"

          sed -i 's/\r$//' "$NEST_PATH/.env.development"
          install -m 600 "$NEST_PATH/.env.development" "$DATA_PATH/.env.development"

          if [ -d "$DATA_PATH/nginx/ssl" ] && [ "$(ls -A "$DATA_PATH/nginx/ssl" 2>/dev/null || true)" ]; then
            cp -a "$DATA_PATH/nginx/ssl/." "$NEST_PATH/nginx/ssl/"
          fi
          if [ ! -f "$NEST_PATH/nginx/ssl/www.axuaxu.top.pem" ] || [ ! -f "$NEST_PATH/nginx/ssl/www.axuaxu.top.key" ]; then
            echo "ERROR: SSL missing at ${DATA_PATH}/nginx/ssl/www.axuaxu.top.{pem,key}"
            ls -la "$DATA_PATH/nginx/ssl" || true
            exit 1
          fi

          echo "=== docker load nest image ==="
          gunzip -c /tmp/nest-image.tar.gz | docker load
          docker image inspect "$IMAGE_TAGS" >/dev/null

          {
            printf 'IMAGE_TAGS=%s\n' "$IMAGE_TAGS"
            printf 'ANALYTICS_EXECUTION_MODE=%s\n' "$ANALYTICS_EXECUTION_MODE"
          } > "$NEST_PATH/.env.deploy"
          cd "$NEST_PATH"

          # MySQL、Redis、nginx 是长期运行的固定基础镜像。部署应用时复用服务器
          # 已有镜像，避免第三方镜像源短暂 5xx 导致整个线上栈被 down 后无法恢复。
          for required_image in \
            mysql:8.0 \
            docker.m.daocloud.io/library/redis:7 \
            docker.m.daocloud.io/library/nginx:1.27
          do
            if ! docker image inspect "$required_image" >/dev/null 2>&1; then
              echo "ERROR: required base image is missing: ${required_image}"
              echo "Pull this image on the server before deploying."
              exit 1
            fi
          done

          echo "=== Start database dependencies ==="
          docker compose -f docker-compose.test.yml --env-file .env.deploy up -d database-test redis-test --remove-orphans --force-recreate
          db_ready=0
          for i in $(seq 1 40); do
            if docker exec mysql-db-test mysqladmin ping -h 127.0.0.1 -u testuser -ptestuserpassword --silent >/dev/null 2>&1; then
              db_ready=1
              break
            fi
            echo "[$i] waiting for mysql"
            sleep 3
          done
          if [ "$db_ready" != "1" ]; then
            echo "ERROR: mysql did not become ready"
            docker logs mysql-db-test --tail 80 || true
            exit 1
          fi

          echo "=== Run TypeORM migrations before application start ==="
          docker compose -f docker-compose.test.yml --env-file .env.deploy run --rm --no-deps app-test \
            node node_modules/typeorm/cli.js migration:run -d dist/data-source.js

          echo "=== Start Analytics after migration ==="
          docker compose -f docker-compose.test.yml --env-file .env.deploy up -d analytics-test --remove-orphans --force-recreate --pull never

          echo "=== Waiting for nest-analytics-test healthy ==="
          analytics_healthy=0
          for i in $(seq 1 30); do
            status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' nest-analytics-test 2>/dev/null || echo missing)"
            echo "[$i] analytics=${status}"
            if [ "$status" = "healthy" ]; then
              analytics_healthy=1
              break
            fi
            if [ "$status" = "unhealthy" ] || [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
              break
            fi
            sleep 5
          done
          if [ "$analytics_healthy" != "1" ]; then
            echo "ERROR: Analytics microservice did not become healthy"
            docker logs nest-analytics-test --tail 120 || true
            exit 1
          fi

          echo "=== Start Gateway and nginx after Analytics is healthy ==="
          docker compose -f docker-compose.test.yml --env-file .env.deploy up -d app-test nginx-test --remove-orphans --force-recreate --pull never

          echo "=== Waiting for nest-app-test healthy ==="
          healthy=0
          for i in $(seq 1 40); do
            status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' nest-app-test 2>/dev/null || echo missing)"
            echo "[$i] nest=${status}"
            if [ "$status" = "healthy" ]; then
              healthy=1
              break
            fi
            if [ "$status" = "unhealthy" ] || [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
              break
            fi
            sleep 5
          done

          docker compose -f docker-compose.test.yml --env-file .env.deploy ps
          echo "=== nest logs ==="
          docker logs nest-app-test --tail 100 || true
          echo "=== analytics logs ==="
          docker logs nest-analytics-test --tail 100 || true
          echo "=== nginx logs ==="
          docker logs nginx-proxy-test --tail 40 || true

          echo "=== probes ==="
          docker exec nest-app-test curl -sf -m 5 http://127.0.0.1:3000/ | head -c 200 || {
            echo "IN_CONTAINER_CURL_FAIL"
            healthy=0
          }
          echo
          rpc_ready=1
          docker exec nest-app-test node dist/analytics-health.js || {
            echo "ANALYTICS_RPC_PROBE_FAIL"
            rpc_ready=0
          }
          code="$(curl -sk -o /tmp/hc.body -w '%{http_code}' -m 10 https://127.0.0.1/plusecube-nest/ || echo 000)"
          echo "https_local=${code}"
          head -c 200 /tmp/hc.body 2>/dev/null || true
          echo

          rm -f /tmp/nest-image.tar.gz
          docker image prune -af --filter "until=24h" || true

          if [ "$healthy" != "1" ] || [ "$analytics_healthy" != "1" ] || [ "$rpc_ready" != "1" ] || [ "$code" != "200" ]; then
            echo "ERROR: deploy verification failed (gateway=${healthy} analytics=${analytics_healthy} rpc=${rpc_ready} https=${code})"
            exit 1
          fi
          echo "=== Deploy OK: ${IMAGE_TAGS} (analytics mode=${ANALYTICS_EXECUTION_MODE}) ==="
          SCRIPT
          sed -i 's/^[[:space:]]*//' /tmp/deploy-remote.sh
          chmod +x /tmp/deploy-remote.sh

          # -O 强制旧 scp/rcp 协议：ubuntu-latest 的 OpenSSH 9.x scp 默认走 SFTP，
          # 递归上传目录到「不存在的远端目标目录」会报 stat remote: No such file or directory
          scp -O /tmp/deploy.env /tmp/deploy-remote.sh deploy-target:/tmp/
          scp -O -r /tmp/nest-bundle deploy-target:/tmp/nest-bundle
          scp -O /tmp/nest-image.tar.gz deploy-target:/tmp/nest-image.tar.gz
          ssh deploy-target 'bash /tmp/deploy-remote.sh; ec=$?; rm -rf /tmp/deploy.env /tmp/deploy-remote.sh /tmp/nest-bundle /tmp/nest-image.tar.gz; exit $ec'

      - name: Public health check
        run: |
          set -euo pipefail
          ok=0
          for i in $(seq 1 12); do
            code="$(curl -sk -o /tmp/hc.out -w '%{http_code}' -m 15 https://www.axuaxu.top/plusecube-nest/ || echo 000)"
            echo "[$i] https://www.axuaxu.top/plusecube-nest/ -> ${code}"
            if [ "$code" = "200" ]; then
              head -c 200 /tmp/hc.out; echo
              echo "Health check OK"
              ok=1
              break
            fi
            sleep 8
          done
          if [ "$ok" != "1" ]; then
            echo "Public health check failed"
            ssh deploy-target 'docker ps -a; docker logs nest-app-test --tail 80; docker logs nest-analytics-test --tail 80; docker logs nginx-proxy-test --tail 40' || true
            exit 1
          fi

          oauth_code="$(curl -sk -o /dev/null -w '%{http_code}' -m 15 \
            https://www.axuaxu.top/plusecube-nest/analytics/auth/github/start || echo 000)"
          echo "GitHub OAuth start -> ${oauth_code}"
          if [ "$oauth_code" != "302" ]; then
            echo "GitHub OAuth configuration check failed"
            ssh deploy-target 'docker logs nest-app-test --tail 80' || true
            exit 1
          fi

```