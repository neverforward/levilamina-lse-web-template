import express, { Request, Response } from 'express';
import { Router } from 'express';
import cors from 'cors';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { ApiRegister } from './api-register.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// 存储所有活动的SSE连接
const clients: Response[] = [];

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, './frontend')));

// SSE endpoint
app.get('/events', (req: Request, res: Response): void => {
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 将客户端连接添加到列表中
  clients.push(res);

  // 当客户端断开连接时，从列表中移除
  req.on('close', () => {
    const index = clients.indexOf(res);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });

  // 发送初始连接消息
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to server' })}\n\n`);
});

// 创建API注册器实例
const apiRegister = new ApiRegister();

// 使用API注册器注册路由
apiRegister.post('/api/run-command', (req: Request, res: Response): void => {
  const { cmd } = req.body;
  
  if (!cmd) {
    res.status(400).json({ 
      error: 'Command is required' 
    });
    return;
  }

  // 运行命令
  const result = mc.runcmdEx(cmd);
  
  res.json({
    output: result.output,
    success: result.success,
    command: cmd
  });
});

apiRegister.get('/api/health', (req: Request, res: Response): void => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 将API路由应用到Express应用
const router = Router();
apiRegister.applyRoutes(router);
app.use(router);

// 提供前端页面
app.get('/', (req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 发送更新给所有客户端的函数
function sendUpdate(type: string, data: any): void {
  const message = `data: ${JSON.stringify({ type, payload: data })}\n\n`;
  clients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      // 如果发送失败，可能是客户端已断开连接，将其从列表中移除
      const index = clients.indexOf(client);
      if (index !== -1) {
        clients.splice(index, 1);
      }
    }
  });
}

export { app, PORT, sendUpdate };