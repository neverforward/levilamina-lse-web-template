# LeviLamina LSE Web Template

这是一个用于快速创建包含前端和后端的 LeviLamina LSE (LeviScript Engine) 模块的模板，旨在简化 Minecraft 服务器插件开发中 Web 功能的集成流程。

## 项目简介

本项目提供了一个标准化的全栈开发结构，包含了：

- **后端服务**: 基于 Express 的 HTTP 服务器，支持 CORS
- **前端展示**: 包含基础的 HTML、CSS 和 JS 前端页面
- **API 注册**: 提供 API 注册机制以连接 LSE 引擎与 Web 服务
- **构建打包**: 使用 Rollup 将后端代码打包为单文件 bundle，并处理前端资源

## 技术栈

- **语言**: TypeScript (编译目标 ES2020, 模块系统 NodeNext)
- **运行时**: Node.js (兼容 LSE 环境)
- **Web 框架**: Express.js
- **构建工具**: Rollup (用于生产环境打包)，ts-node + nodemon (用于开发环境热重载)
- **中间件**: Cors

## 目录结构

```
levilamina-lse-web-template/
├── src/
│   ├── frontend/
│   │   ├── index.html
│   │   ├── main.js
│   │   └── style.css
│   ├── api-register.ts
│   ├── main.ts
│   └── server.ts
├── scripts/
│   └── build.js
├── output/
│   └── web-template/
├── package.json
├── rollup.config.js
├── tsconfig.json
└── README.md
```

## 快速开始

### 环境要求

- Node.js
- npm

### 安装与启动

1. 安装依赖:

```bash
npm install
```

2. 开发模式运行:

```bash
npm run dev
```

3. 生产构建:

```bash
npm run build
```

4. 运行构建后的产物:

```bash
npm start
```

## 开发指南

### 添加新的 API 接口

1. 在 [src/api-register.ts](file:///d:/code/mc/levilamina-lse-web-template/src/api-register.ts) 中定义新的接口
2. 在 [src/main.ts](file:///d:/code/mc/levilamina-lse-web-template/src/main.ts) 中注册接口
3. 在 [src/server.ts](file:///d:/code/mc/levilamina-lse-web-template/src/server.ts) 中设置路由

### 修改前端内容

- 前端资源位于 [src/frontend/](file:///d:/code/mc/levilamina-lse-web-template/src/frontend) 目录
- 修改完成后重新运行构建命令使更改生效

## 构建与部署

- 开发模式: `npm run dev` - 使用 nodemon 监听文件变化并自动重启
- 生产构建: `npm run build` - 使用 Rollup 打包代码到 output 目录
- 运行构建产物: `npm start` - 直接运行打包后的代码

## 许可证

MIT License