# NoteMD 部署指南

> Web 端类 Typora 的 Markdown 编辑器，基于 Next.js 16 + Tiptap + Vercel AI SDK。

---

## 目录

- [架构约束（部署前必读）](#架构约束部署前必读)
- [环境要求](#环境要求)
- [环境变量](#环境变量)
- [本地构建与验证](#本地构建与验证)
- [方案一：VPS + PM2（推荐）](#方案一vps--pm2推荐)
- [方案二：Docker](#方案二docker)
- [方案三：systemd](#方案三systemd)
- [方案四：Vercel 等无状态平台（受限）](#方案四vercel-等无状态平台受限)
- [反向代理（Nginx）](#反向代理nginx)
- [数据持久化与备份](#数据持久化与备份)
- [更新流程](#更新流程)
- [安全清单](#安全清单)
- [故障排查](#故障排查)

---

## 架构约束（部署前必读）

NoteMD 的笔记数据**直接读写服务器本地文件系统**（由 `CONTENT_DIR` 指定的目录），而非数据库。这决定了部署形态：

| 特性 | 含义 |
|------|------|
| 文件系统存储 | 笔记（`.md` / `.excalidraw`）和上传的图片都落在磁盘 `CONTENT_DIR` |
| 单用户模型 | 编辑器是单用户设计，无协作功能，不需要多实例共享状态 |
| 无数据库 | 不依赖 Postgres / MySQL / Redis，省去数据库运维 |
| Node.js 长驻进程 | 使用 `next start` 运行，需要 Node.js 运行时 |

**结论**：必须部署在**拥有持久化文件系统**的环境中，如 VPS、自建服务器或带持久卷的容器平台。Serverless/无状态平台（Vercel、Netlify 函数）的文件系统是临时/只读的，**仅能用于受限模式**，见[方案四](#方案四vercel-等无状态平台受限)。

---

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | **≥ 20.9**（推荐 22 LTS） | Next.js 16 最低要求 18.18，建议用当前 LTS |
| pnpm | ≥ 10 | 项目锁文件为 `pnpm-lock.yaml`，**必须用 pnpm 安装依赖**以保证版本一致 |

> 建议在项目根目录添加 `.nvmrc` 固定 Node 版本：
> ```bash
> echo "22" > .nvmrc
> ```

```bash
# 安装 pnpm（若未安装）
corepack enable
corepack prepare pnpm@latest --activate
```

---

## 环境变量

所有变量通过环境注入，**切勿将真实密钥提交到代码库**（`.env*` 已在 `.gitignore` 中）。

| 变量 | 必填 | 说明 | 示例 |
|------|:---:|------|------|
| `ACCESS_PASSWORD` | ✅ | 进入应用的访问密码 | `your-strong-password` |
| `AUTH_SECRET` | ✅ | Session token 的 HMAC 签名密钥 | `openssl rand -hex 32` 生成 |
| `OPENAI_BASE_URL` | ✅ | AI 提供商的 OpenAI 兼容端点 | `https://api.openai.com/v1` |
| `OPENAI_API_KEY` | ✅ | AI 提供商的 API Key（本地模型可用 `dummy`） | `sk-...` |
| `AI_MODEL` | ❌ | 模型名称，默认 `gpt-4o-mini` | `gpt-4o-mini` |
| `CONTENT_DIR` | ❌ | 笔记存储目录，默认 `./content`（相对 `cwd`） | `/data/notemd/content` |
| `DEV_ORIGIN` | ❌ | **仅开发模式**：允许的 dev server 来源（如内网 IP） | `http://10.0.0.5:3000` |

### 生成密钥

```bash
# 生成 AUTH_SECRET
openssl rand -hex 32

# 生成强访问密码
openssl rand -base64 24
```

> ⚠️ **重要**：修改 `AUTH_SECRET` 或 `ACCESS_PASSWORD` 会立即使所有已发放的 session 失效（用户需重新登录）。

### 生产环境配置示例

在服务器上创建 `/opt/notemd/.env.local`：

```bash
# 使用绝对路径，避免受 cwd 影响
CONTENT_DIR=/data/notemd/content

# AI 提供商
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
AI_MODEL=gpt-4o-mini

# 认证（请替换为生成的值）
ACCESS_PASSWORD=替换为openssl生成的强密码
AUTH_SECRET=替换为openssl生成的64位hex
```

设置文件权限（仅运行用户可读）：

```bash
chmod 600 /opt/notemd/.env.local
chown notemd:notemd /opt/notemd/.env.local
```

---

## 本地构建与验证

部署前先在本地验证构建通过：

```bash
# 1. 安装依赖
pnpm install --frozen-lockfile

# 2. 运行测试与 lint
pnpm test
pnpm lint

# 3. 生产构建
pnpm build

# 4. 本地以生产模式启动验证
pnpm start
# 访问 http://localhost:3000，登录后测试编辑/保存/AI 功能
```

构建产物在 `.next/` 目录。

---

## 方案一：VPS + PM2（推荐）

PM2 提供**进程守护、开机自启、日志管理、零停机重启**，适合 VPS 部署。

### 1. 准备运行用户与目录

```bash
# 创建专用用户（避免用 root 运行）
sudo useradd --system --create-home --shell /bin/bash notemd

# 创建目录
sudo mkdir -p /opt/notemd /data/notemd/content
sudo chown -R notemd:notemd /opt/notemd /data/notemd
```

### 2. 拉取代码与安装依赖

```bash
sudo -u notemd -i
cd /opt/notemd
git clone <your-repo-url> .
pnpm install --frozen-lockfile
pnpm build
```

### 3. 配置环境变量

```bash
nano /opt/notemd/.env.local   # 按"环境变量"章节填写
chmod 600 .env.local
```

### 4. 配置 PM2

创建 `ecosystem.config.cjs`：

```js
// /opt/notemd/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'notemd',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/opt/notemd',
      env: {
        NODE_ENV: 'production',
        // 环境变量从 .env.local 读取，也可在此处显式注入
      },
      // 单用户应用，无需多实例；如需水平扩展需先解决文件系统共享
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      error_file: '/var/log/notemd/err.log',
      out_file: '/var/log/notemd/out.log',
      time: true,
    },
  ],
}
```

为了让 PM2 读取 `.env.local`，建议用 `dotenv` 加载，或在启动脚本中 `set -a; source .env.local; set +a` 后再 `pm2 start`。简单做法：

```bash
sudo mkdir -p /var/log/notemd && sudo chown notemd:notemd /var/log/notemd

# 加载 .env.local 后启动
sudo -u notemd bash -c 'cd /opt/notemd && set -a && . ./.env.local && set +a && pm2 start ecosystem.config.cjs'

pm2 save                          # 保存进程列表
pm2 startup systemd               # 按提示执行返回的命令，设置开机自启
```

### 5. 验证

```bash
pm2 status
pm2 logs notemd --lines 50
curl -I http://localhost:3000    # 应返回 200/302
```

---

## 方案二：Docker

适合需要环境隔离或频繁重建的场景。

### 1. 启用 standalone 输出（减小镜像体积）

在 `next.config.ts` 中添加 `output: 'standalone'`：

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  // ...其余配置
}
```

### 2. 编写 Dockerfile

在项目根目录创建 `Dockerfile`：

```dockerfile
# ---------- 1. 依赖安装 ----------
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- 2. 构建 ----------
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 环境变量在构建期通常不需要，Next.js 在运行时读取 process.env
RUN pnpm build

# ---------- 3. 运行 ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# standalone 产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 数据卷：笔记将持久化到此处（对应 CONTENT_DIR）
RUN mkdir -p /data/content
VOLUME ["/data/content"]

EXPOSE 3000
CMD ["node", "server.js"]
```

### 3. 编写 docker-compose.yml

```yaml
# docker-compose.yml
services:
  notemd:
    build: .
    container_name: notemd
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"   # 仅监听本地，由 Nginx 反代对外
    environment:
      CONTENT_DIR: /data/content
      ACCESS_PASSWORD: ${ACCESS_PASSWORD}
      AUTH_SECRET: ${AUTH_SECRET}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      AI_MODEL: ${AI_MODEL:-gpt-4o-mini}
    volumes:
      - ./data/content:/data/content   # 笔记持久化到宿主机
```

同目录放一个 `.env`（与 docker-compose 配合，**勿提交**）：

```bash
ACCESS_PASSWORD=你的密码
AUTH_SECRET=你的密钥
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-xxxx
AI_MODEL=gpt-4o-mini
```

### 4. 启动

```bash
docker compose up -d --build
docker compose logs -f notemd
```

---

## 方案三：systemd

若不希望引入 PM2，可直接用 systemd 管理服务。

创建 `/etc/systemd/system/notemd.service`：

```ini
[Unit]
Description=NoteMD Markdown Editor
After=network.target

[Service]
Type=simple
User=notemd
WorkingDirectory=/opt/notemd
EnvironmentFile=/opt/notemd/.env.local
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5
# 安全加固
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/data/notemd /opt/notemd/.next/cache
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now notemd
sudo systemctl status notemd
journalctl -u notemd -f     # 查看日志
```

---

## 方案四：Vercel 等无状态平台（受限）

> ⚠️ **不推荐用于正式使用**。Vercel 的 Serverless 函数文件系统是只读/临时的，所有写入（保存笔记、上传图片）在请求结束后即丢失。

如果仅作**只读演示**或临时预览，可以：

1. 把内容预置在仓库 `content/` 目录，构建为静态/只读；
2. 删除或禁用所有写操作（保存、上传、创建/删除文件）；
3. 部署到 Vercel，环境变量在 Dashboard 配置。

**生产部署请使用方案一/二/三。**

---

## 反向代理（Nginx）

生产环境应通过 Nginx 反代，统一处理 HTTPS、域名、流式响应。

```nginx
# /etc/nginx/sites-available/notemd.conf
server {
    listen 80;
    server_name notemd.example.com;
    # HTTP → HTTPS 跳转（配置证书后）
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name notemd.example.com;

    # SSL（用 certbot 自动配置，此处示例）
    ssl_certificate     /etc/letsencrypt/live/notemd.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notemd.example.com/privkey.pem;

    # 上传图片体积上限（按需调整）
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # AI 流式响应（SSE）必须禁用缓冲，否则会卡住直到结束
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header X-Accel-Buffering no;

        # 长连接支持
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
    }
}
```

申请 HTTPS 证书（Let's Encrypt）：

```bash
sudo certbot --nginx -d notemd.example.com
```

---

## 数据持久化与备份

笔记数据全部在 `CONTENT_DIR`，**备份这一个目录即可**。

### 目录结构

```
CONTENT_DIR/
├── 笔记1.md
├── 子目录/
│   ├── 笔记2.md
│   └── assets/          # 上传的图片存放于此
│       └── <uuid>.png
└── 白板.excalidraw
```

### 定时备份（cron 示例）

```bash
# 每日凌晨 3 点打包备份，保留最近 30 天
0 3 * * * tar -czf /backup/notemd-$(date +\%Y\%m\%d).tar.gz -C /data/notemd content && find /backup -name "notemd-*.tar.gz" -mtime +30 -delete
```

对于更重要的数据，建议额外用 `rclone` 推送到对象存储（S3 / R2 / OSS）。

---

## 更新流程

```bash
sudo -u notemd -i
cd /opt/notemd

git pull origin main
pnpm install --frozen-lockfile
pnpm build

# 重启服务（按所用方案二选一）
pm2 reload notemd          # PM2：零停机 reload
# 或
sudo systemctl restart notemd   # systemd
```

### Docker

```bash
git pull
docker compose up -d --build
```

---

## 安全清单

- [ ] **`AUTH_SECRET` 使用 `openssl rand -hex 32` 生成**，不使用弱值
- [ ] **`ACCESS_PASSWORD` 为强密码**，非默认值
- [ ] `.env.local` / `.env` 文件权限为 `600`，仅运行用户可读
- [ ] 应用以**非 root 用户**运行
- [ ] 对外仅开放 80/443 端口，Node 进程（3000）**只监听 127.0.0.1**
- [ ] 已配置 **HTTPS**（Let's Encrypt）
- [ ] `CONTENT_DIR` 定期**备份**
- [ ] 服务器系统、Node.js 保持更新

> 应用本身的安全设计：所有 API 路由经 `proxy.ts` 认证网关 + `requireAuth()` 双重校验；文件路径解析有**路径穿越防护**；上传仅允许图片类型；密码比较使用**恒定时间比较**防时序攻击。

---

## 故障排查

### 启动时报 `ACCESS_PASSWORD and AUTH_SECRET must be set`

环境变量未注入。检查 `.env.local` 是否存在、PM2/systemd 是否正确加载环境文件。

```bash
# systemd：确认 EnvironmentFile 路径正确
systemctl cat notemd | grep EnvironmentFile
# PM2：确认启动时 source 了 .env.local
```

### 保存笔记后刷新内容丢失

`CONTENT_DIR` 指向了**临时/非持久**位置（如容器内未挂载卷的路径，或 Serverless 环境）。改用绝对路径并挂载持久卷。

### AI 对话无响应或卡住

1. 确认 `OPENAI_BASE_URL` / `OPENAI_API_KEY` 正确，`curl` 测试连通性：
   ```bash
   curl $OPENAI_BASE_URL/models -H "Authorization: Bearer $OPENAI_API_KEY"
   ```
2. 若经过 Nginx，确认 `proxy_buffering off`（见[反向代理](#反向代理nginx)）。
3. 查看 `pm2 logs` / `journalctl` 中的报错。

### 登录后立即被登出 / 401

- `AUTH_SECRET` 在多实例/重启间不一致 → 固定该值，不要每次启动随机生成。
- 系统时间错误导致 token 的 `iat` 校验失败 → 校正服务器时间（`ntp`）。
- 经反代时 `Cookie` 被剥离 → 确认 Nginx 转发了请求头。

### 内存占用过高

`package.json` 中 dev 脚本设了 `--max-old-space-size=4096`，生产模式一般无需此参数。如构建期 OOM，可在构建时临时调高：

```bash
NODE_OPTIONS='--max-old-space-size=4096' pnpm build
```

运行期内存高，可在 PM2/systemd 中限制（`max_memory_restart` / `MemoryMax`）。

---

## 附录：常用命令速查

```bash
# 构建与运行
pnpm install --frozen-lockfile
pnpm build
pnpm start

# PM2
pm2 start ecosystem.config.cjs
pm2 reload notemd          # 零停机重启
pm2 logs notemd            # 实时日志
pm2 monit                  # 资源监控

# systemd
sudo systemctl restart notemd
journalctl -u notemd -f

# Docker
docker compose up -d --build
docker compose logs -f notemd
```
