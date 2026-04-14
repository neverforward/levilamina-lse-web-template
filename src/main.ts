import { app, PORT } from './server.js';
import { sendUpdate } from './server.js';  // 导入sendUpdate函数

// 示例：监听聊天事件并发送更新
mc.listen('onChat', (p, msg) => {
  sendUpdate('chat', { player: p.name, message: msg });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});