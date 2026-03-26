# 文昌存证 SaaS — Monorepo

> 面向设计工作室的版权存证平台：上传作品 → SHA-256 → 文昌链存证 → 生成 PDF 证书

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15 (App Router) + Tailwind CSS + Shadcn UI |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | MongoDB (Mongoose) |
| 区块链 | 文昌链 (Bianjie OpenAPI) |
| 构建 | Turborepo + pnpm Workspaces |

## 项目结构

```
wenchang/
├── apps/
│   ├── web/                  # Next.js 前端
│   └── server/               # Express 后端
│       ├── src/
│       │   ├── config/       # DB、Logger、Multer 配置
│       │   ├── models/       # Mongoose Models
│       │   ├── services/     # 业务逻辑 (Hash、文昌链、证书)
│       │   ├── controllers/  # 请求处理
│       │   ├── routes/       # 路由定义
│       │   ├── middlewares/  # 认证、限流、校验
│       │   ├── app.ts
│       │   └── index.ts
│       ├── uploads/          # 临时上传目录
│       └── certificates/     # 生成的 PDF 证书
└── packages/
    └── shared/               # 共享 TypeScript 类型 & 常量
```

## 快速开始

### 前置要求
- Node.js >= 20
- pnpm >= 9
- MongoDB (本地或 Atlas)

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.local.example apps/web/.env.local
# 编辑 .env 文件，填入 MongoDB URI、JWT Secret、文昌链 API Key 等
```

### 启动开发服务

```bash
# 同时启动前后端
pnpm dev

# 仅启动后端
pnpm --filter @wenchang/server dev

# 仅启动前端
pnpm --filter @wenchang/web dev
```

- 前端: http://localhost:3000
- 后端: http://localhost:4000
- 健康检查: http://localhost:4000/health

## API 文档

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录 |
| GET  | `/api/v1/auth/me` | 获取当前用户 |

### 作品存证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/artworks` | 上传作品 (multipart/form-data) |
| GET  | `/api/v1/artworks` | 作品列表 |
| GET  | `/api/v1/artworks/:id` | 作品详情 |

### 证书
| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/v1/certificates` | 证书列表 |
| GET  | `/api/v1/certificates/:id` | 证书详情 |
| GET  | `/api/v1/certificates/:id/download` | 下载 PDF |
| GET  | `/api/v1/certificates/verify/:certNo` | 公开核验 (无需登录) |

## 核心业务流程

```
用户上传文件
    │
    ▼
Multer 保存到 uploads/
    │
    ▼
计算 SHA-256 (流式，支持大文件)
    │
    ▼
检查是否已存证 (防重复)
    │
    ▼
调用文昌链 API 提交哈希
    │
    ▼
保存 txHash 到 Artwork 记录
    │
    ▼
生成确权证书 (CertificateModel)
    │
    ▼
异步生成 PDF (PDFKit)
    │
    ▼
扣减用户配额
```

## 套餐配额

| 套餐 | 月存证次数 |
|------|----------|
| Free | 5 次 |
| Pro | 100 次 |
| Enterprise | 无限制 |

