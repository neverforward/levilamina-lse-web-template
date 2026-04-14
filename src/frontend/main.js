const API_BASE_URL = 'http://localhost:3000/api';

// 初始化SSE连接以接收服务器发送的数据更新
function initEventSource() {
  const eventSource = new EventSource('http://localhost:3000/events');
  
  eventSource.addEventListener('open', function(e) {
    console.log('Connected to SSE stream');
  });
  
  eventSource.addEventListener('message', function(e) {
    const data = JSON.parse(e.data);
    
    // 处理不同类型的消息
    switch(data.type) {
      case 'connected':
        console.log(data.message);
        break;
      case 'chat':
        handleChatMessage(data.payload);
        break;
      default:
        console.log('Received unknown message type:', data);
        break;
    }
  });
  
  eventSource.addEventListener('error', function(e) {
    console.error('SSE connection error:', e);
    if (eventSource.readyState === EventSource.CLOSED) {
      console.log('SSE connection closed. Attempting to reconnect...');
      // EventSource 会自动重连，所以无需手动重连
    }
  });
}

// 处理聊天消息的函数
function handleChatMessage(payload) {
  console.log(`Player ${payload.player} said: ${payload.message}`);
  
  // 获取聊天日志元素并添加新消息
  const chatLog = document.getElementById('chatLog');
  const messageElement = document.createElement('div');
  messageElement.className = 'chat-message';
  messageElement.innerHTML = `<strong>${payload.player}:</strong> ${payload.message}`;
  chatLog.appendChild(messageElement);
  
  // 保持滚动到底部
  chatLog.scrollTop = chatLog.scrollHeight;
}

// 启动SSE连接
initEventSource();

// 通用API请求函数
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    return { response, data };
  } catch (error) {
    throw new Error(`Network error: ${error.message}`);
  }
}

// 运行命令的函数
async function runCommand() {
  const input = document.getElementById('commandInput');
  const cmd = input.value.trim();
  
  if (!cmd) {
    alert('Please enter a command to run');
    return;
  }
  
  try {
    // 显示加载状态
    const resultContainer = document.getElementById('resultContainer');
    const commandResult = document.getElementById('commandResult');
    const commandStatus = document.getElementById('commandStatus');
    
    commandResult.textContent = 'Running command...';
    commandStatus.textContent = 'Processing...';
    commandStatus.className = 'status-indicator';
    resultContainer.style.display = 'block';
    
    // 发送命令到后端
    const { response, data } = await apiRequest('/run-command', {
      method: 'POST',
      body: JSON.stringify({ cmd })
    });
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to run command');
    }
    
    // 显示结果
    commandResult.textContent = data.output;
    
    if (data.success) {
      commandStatus.textContent = 'Command executed successfully';
      commandStatus.className = 'status-indicator status-success';
    } else {
      commandStatus.textContent = 'Command failed';
      commandStatus.className = 'status-indicator status-error';
    }
  } catch (error) {
    console.error('Error running command:', error);
    
    const commandResult = document.getElementById('commandResult');
    const commandStatus = document.getElementById('commandStatus');
    const resultContainer = document.getElementById('resultContainer');
    
    commandResult.textContent = `Error: ${error.message}`;
    commandStatus.textContent = 'Error occurred';
    commandStatus.className = 'status-indicator status-error';
    resultContainer.style.display = 'block';
  }
}

document.getElementById('runcmdbtn').addEventListener('click', runCommand);

async function runCmd(cmd) {
  try {
    const { response, data } = await apiRequest('/runcmd', {
      method: 'POST',
      body: JSON.stringify({ cmd })
    });
    if (!response.ok) {
      throw new Error(data.error || 'Failed to run cmd');
    }
    console.log('Command output:', data.message);
  } catch (error) {
    showStatus(`Error running command: ${error.message}`, 'error');
    console.error('Error running command:', error);
  }
}
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;

  // 3秒后自动清除状态消息
  setTimeout(() => {
    statusDiv.textContent = '';
    statusDiv.className = '';
  }, 3000);
}