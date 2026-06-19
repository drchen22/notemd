# NoteMD 部署指南

> Web 端类 Typora 的 Markdown 编辑器，基于 Next.js 16 + Tiptap + Vercel AI SDK。

---

## 架构约束（部署前必读）

NoteMD 的笔记数据**直接读写服务器本地文件系统**（由 `CONTENT_DIR` 指定的目录），而非数据库。这决定了部署形态：

| 特性 | 含义 |
|------|------|
| 文件系统存储 | 笔记（`.md` / `.excalidraw`）和上传的图片都落在磁盘 `CONTENT_DIR` |
| 单用户模型 | 编辑器是单用户设计，无协作功能，不需要多实例共享状态 |
| 无数据库 | 不依赖 Postgres / MySQL / Redis，省去数据库运维 |
| Node.js 长驻进程 | 使用 `next start` 运行，需要 Node.js 运行时 |

**结论**：必须部署在**拥有持久化文件系统**的环境中，如 VPS、自建服务器。Serverless/无状态平台（Vercel、Netlify 函数）的文件系统是临时/只读的，**不适用于本项目**。

---

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | **≥ 20.9**（推荐 22 LTS） | Next.js 16 最低要求 18.18 |
| pnpm | ≥ 10 | 项目锁文件为 `pnpm-lock.yaml`，**必须用 pnpm** 以保证版本一致 |

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
| `PORT` | ❌ | 服务监听端口，默认 3000 | `11250` |
| `DEV_ORIGIN` | ❌ | **仅开发模式**：允许的 dev server 来源（如内网 IP） | `http://10.0.0.5:3000` |

### 生成密钥

```bash
# 生成 AUTH_SECRET
openssl rand -hex 32

# 生成强访问密码
openssl rand -base64 24
```

> ⚠️ **重要**：修改 `AUTH_SECRET` 或 `ACCESS_PASSWORD` 会立即使所有已发放的 session 失效（用户需重新登录）。

---

## 部署方案：PM2

PM2 提供**进程守护、开机自启、日志管理、零停机重启**。

### 1. 准备目录与代码

```bash
# 克隆代码到独立目录（与开发目录隔离）
git clone <your-repo-url> /home/chen/notemd-prod
cd /home/chen/notemd-prod
pnpm install --frozen-lockfile
pnpm build
```

### 2. 配置环境变量

创建 `.env.production`（已被 `.gitignore` 忽略）：

```bash
# 笔记存储目录（用绝对路径）
CONTENT_DIR=/home/chen/notes

# 服务端口
PORT=11250

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
chmod 600 .env.production
```

> Next.js 在 `NODE_ENV=production` 时会自动加载 `.env.production`。详见 [Next.js 环境变量加载顺序](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)。

### 3. 配置 PM2

创建 `ecosystem.config.cjs`（放在项目根目录）：

```js
module.exports = {
  apps: [
    {
      name: 'notemd-prod',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 11250',
      cwd: '/home/chen/notemd-prod',
      env: { NODE_ENV: 'production' },
      // 单用户应用，无需多实例
      exec_mode: 'fork',
      max_memory_restart: '1G',
      out_file: '/home/chen/notemd-prod/.pm2/logs/out.log',
      error_file: '/home/chen/notemd-prod/.pm2/logs/err.log',
      time: true,
    },
  ],
}
```

### 4. 启动与验证

```bash
pm2 start ecosystem.config.cjs
pm2 save                          # 保存进程列表
pm2 startup                       # 按提示执行返回的命令，设置开机自启

# 验证
pm2 status
pm2 logs notemd-prod --lines 50
curl -I http://localhost:11250    # 应返回 200/302
```

---

## 日常更新流程

```bash
cd <部署目录>          # 如 /home/chen/notemd-prod
git pull
pnpm install
NODE_ENV=production node_modules/.bin/next build   # ⚠ 不能用 pnpm build
pm2 restart notemd-prod
```

> **关键**：build 必须显式带 `NODE_ENV=production`。若 shell 环境里 `NODE_ENV=development`，`next build` 会在 `/_global-error` 预渲染阶段崩溃（详见[故障排查](#pnpm-build-在-_global-error-预渲染崩溃)）。`next start`（运行时）不受影响，仅 build 敏感。
>
> 笔记目录 `CONTENT_DIR` 不在 git 仓库内，`git pull` 不会影响笔记数据。

---

## 数据持久化与备份

笔记数据全部在 `CONTENT_DIR`，**备份这一个目录即可**。

```
CONTENT_DIR/
├── 笔记1.md
├── 子目录/
│   ├── 笔记2.md
│   └── assets/          # 上传的图片存放于此
└── 白板.excalidraw
```

定时备份（cron 示例）：

```bash
# 每日凌晨 3 点打包备份，保留最近 30 天
0 3 * * * tar -czf /backup/notes-$(date +\%F).tar.gz -C /home/chen notes && find /backup -name "notes-*.tar.gz" -mtime +30 -delete
```

对于更重要的数据，建议额外用 `rclone` 推送到对象存储（S3 / R2 / OSS）。

---

## 安全清单

- [ ] **`AUTH_SECRET` 使用 `openssl rand -hex 32` 生成**，不使用弱值
- [ ] **`ACCESS_PASSWORD` 为强密码**，非默认值
- [ ] `.env.production` 文件权限为 `600`，仅运行用户可读
- [ ] 已配置 **HTTPS**（反代 + Let's Encrypt）或通过受信网络访问
- [ ] `CONTENT_DIR` 定期**备份**
- [ ] 服务器系统、Node.js 保持更新

> 应用本身的安全设计：所有 API 路由经 `proxy.ts` 认证网关 + `requireAuth()` 双重校验；文件路径解析有**路径穿越防护**；上传仅允许图片类型；密码比较使用**恒定时间比较**防时序攻击。

---

## 反向代理（Nginx，可选）

生产环境对外暴露建议通过 Nginx 反代，统一处理 HTTPS、域名、流式响应。

```nginx
# /etc/nginx/sites-available/notemd.conf
server {
    listen 80;
    server_name notemd.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name notemd.example.com;

    ssl_certificate     /etc/letsencrypt/live/notemd.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notemd.example.com/privkey.pem;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:11250;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # AI 流式响应（SSE）必须禁用缓冲
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header X-Accel-Buffering no;

        proxy_set_header Connection "";
        proxy_read_timeout 300s;
    }
}
```

```bash
sudo certbot --nginx -d notemd.example.com
```

---

## 故障排查

### 启动时报 `ACCESS_PASSWORD and AUTH_SECRET must be set`

环境变量未注入。确认 `.env.production` 存在且 `NODE_ENV=production`（Next.js 据此加载该文件）。

### 保存笔记后刷新内容丢失

`CONTENT_DIR` 指向了**临时/非持久**位置。改用绝对路径。

### AI 对话无响应或卡住

1. 确认 `OPENAI_BASE_URL` / `OPENAI_API_KEY` 正确：
   ```bash
   curl $OPENAI_BASE_URL/models -H "Authorization: Bearer $OPENAI_API_KEY"
   ```
2. 若经过 Nginx，确认 `proxy_buffering off`。
3. 查看 `pm2 logs` 中的报错。

### 登录后立即被登出 / 401

- `AUTH_SECRET` 在重启间不一致 → 固定该值，不要每次启动随机生成。
- 经反代时 `Cookie` 被剥离 → 确认 Nginx 转发了请求头。

### `pnpm build` 在 `/_global-error` 预渲染崩溃

**症状**：

```
Error occurred prerendering page "/_global-error"
TypeError: Cannot read properties of null (reading 'useContext')
```

**根因**：`next build` 必须在 `NODE_ENV=production` 下运行。若 shell 环境里 `NODE_ENV=development`（常见于装过某些开发工具的机器），`next build` 会带着错误的 NODE_ENV 跑生产构建，导致 React 19 的 server renderer dispatcher 与 Next.js 预渲染管线不匹配 —— `LayoutRouterContext` 在 `/_global-error` 预渲染时 `useContext` 返回 null 而崩溃。

> Next.js 会在构建开头警告：`⚠ You are using a non-standard "NODE_ENV" value`。看到这条警告就是中了此坑。

**诊断**：

```bash
echo $NODE_ENV           # 若输出 "development" 即为根因
```

**修复**：构建时显式覆盖 NODE_ENV。不要用 `pnpm build`（不会自动设置），直接：

```bash
NODE_ENV=production node_modules/.bin/next build
```

或修正 shell 环境（在 `~/.bashrc` 等移除错误的 `export NODE_ENV=development`）。

> 注：`pnpm dev` / `next start`（运行时）不受影响 —— 只有 build 这一步对 NODE_ENV 敏感。
