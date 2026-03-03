// 创建通信桥实例
const bridge = new MessageBridge({
    identity: 'main',
    allowedOrigins: ['*'], // 生产环境应该配置具体域名
    defaultTargetOrigin: '*'
});

// Iframe 引用
const iframes = {
    iframe1: null,
    iframe2: null,
    iframe3: null
};

// 等待 iframe 加载
window.addEventListener('load', () => {
    iframes.iframe1 = document.getElementById('iframe1').contentWindow;
    iframes.iframe2 = document.getElementById('iframe2').contentWindow;
    iframes.iframe3 = document.getElementById('iframe3').contentWindow;

    console.log('[主页面] 所有 iframe 已加载');
    addLog('主页面', '所有 iframe 已加载完成');
});

// 更新连接状态
function updateConnectionStatus(iframeId, connected) {
    const statusEl = document.getElementById(`status-${iframeId}`);
    if (statusEl) {
        statusEl.textContent = connected ? '已连接' : '未连接';
        statusEl.className = `status-badge ${connected ? 'status-connected' : 'status-disconnected'}`;
    }
}

// 注册中转处理器 - 用于 iframe 之间的通信
bridge.registerHandler('relay', 'forward', async (data, context) => {
    const { target, module, action, messageData, originalSource } = data;
    
    console.log(`[主页面] 中转消息: ${originalSource} -> ${target}`);
    addLog('主页面', `中转消息: ${originalSource} -> ${target}`);

    // 获取目标 iframe
    const targetWindow = iframes[target];
    if (!targetWindow) {
        throw new Error(`未找到目标 iframe: ${target}`);
    }

    // 中转消息到目标 iframe
    const result = await bridge.sendRequest(
        targetWindow,
        module,
        action,
        messageData,
        {
            source: originalSource,
            relays: [...(context.relays || []), 'main']
        }
    );

    return {
        ...result,
        relayed: true,
        relayPath: [...(context.relays || []), 'main']
    };
});

// 注册状态更新处理器
bridge.registerHandler('system', 'statusUpdate', (data, context) => {
    const { iframeId, connected } = data;
    updateConnectionStatus(iframeId, connected);
    addLog('主页面', `${iframeId} ${connected ? '已连接' : '断开连接'}`);
});

// 发送消息到 Iframe 1
async function sendToIframe1() {
    if (!iframes.iframe1) {
        alert('Iframe 1 尚未加载');
        return;
    }

    const message = `Hello from main page at ${new Date().toLocaleTimeString()}`;
    const key = `msg_${Date.now()}`;

    console.log(`[主页面] 发送消息到 iframe1: ${message}`);
    addLog('主页面', `发送消息到 iframe1: ${message}`);

    try {
        const result = await bridge.sendRequest(
            iframes.iframe1,
            'test',
            'print',
            { message, key },
            { targetIdentity: 'iframe1' }
        );

        console.log(`[主页面] iframe1 已成功执行命令: ${result.data.messageKey}`);
        addLog('主页面', `iframe1 已成功执行命令: ${result.data.messageKey}`);
    } catch (error) {
        console.error('[主页面] 发送消息失败:', error);
        addLog('主页面', `发送失败: ${error.message}`);
    }
}

// 发送消息到 Iframe 2
async function sendToIframe2() {
    if (!iframes.iframe2) {
        alert('Iframe 2 尚未加载');
        return;
    }

    const message = `Hello from main at ${new Date().toLocaleTimeString()}`;
    const key = `msg_${Date.now()}`;

    console.log(`[主页面] 发送消息到 iframe2: ${message}`);
    addLog('主页面', `发送消息到 iframe2: ${message}`);

    try {
        const result = await bridge.sendRequest(
            iframes.iframe2,
            'test',
            'print',
            { message, key },
            { targetIdentity: 'iframe2' }
        );

        console.log(`[主页面] iframe2 已成功执行命令: ${result.data.messageKey}`);
        addLog('主页面', `iframe2 已成功执行命令: ${result.data.messageKey}`);
    } catch (error) {
        console.error('[主页面] 发送消息失败:', error);
        addLog('主页面', `发送失败: ${error.message}`);
    }
}

// 发送消息到 Iframe 3
async function sendToIframe3() {
    if (!iframes.iframe3) {
        alert('Iframe 3 尚未加载');
        return;
    }

    const message = `Hello from main at ${new Date().toLocaleTimeString()}`;
    const key = `msg_${Date.now()}`;

    console.log(`[主页面] 发送消息到 iframe3: ${message}`);
    addLog('主页面', `发送消息到 iframe3: ${message}`);

    try {
        const result = await bridge.sendRequest(
            iframes.iframe3,
            'test',
            'print',
            { message, key },
            { targetIdentity: 'iframe3' }
        );

        console.log(`[主页面] iframe3 已成功执行命令: ${result.data.messageKey}`);
        addLog('主页面', `iframe3 已成功执行命令: ${result.data.messageKey}`);
    } catch (error) {
        console.error('[主页面] 发送消息失败:', error);
        addLog('主页面', `发送失败: ${error.message}`);
    }
}

// 广播到所有 iframe
async function broadcastToAll() {
    const message = `Broadcast from main at ${new Date().toLocaleTimeString()}`;
    const key = `broadcast_${Date.now()}`;

    console.log(`[主页面] 广播消息: ${message}`);
    addLog('主页面', `广播消息到所有 iframe: ${message}`);

    const promises = [];
    
    if (iframes.iframe1) {
        promises.push(
            bridge.sendRequest(iframes.iframe1, 'test', 'print', { message, key }, { targetIdentity: 'iframe1' })
        );
    }
    if (iframes.iframe2) {
        promises.push(
            bridge.sendRequest(iframes.iframe2, 'test', 'print', { message, key }, { targetIdentity: 'iframe2' })
        );
    }
    if (iframes.iframe3) {
        promises.push(
            bridge.sendRequest(iframes.iframe3, 'test', 'print', { message, key }, { targetIdentity: 'iframe3' })
        );
    }

    try {
        const results = await Promise.all(promises);
        console.log('[主页面] 广播完成:', results);
        addLog('主页面', `广播完成, 成功发送到 ${results.length} 个 iframe`);
    } catch (error) {
        console.error('[主页面] 广播失败:', error);
        addLog('主页面', `广播失败: ${error.message}`);
    }
}

// 添加日志
function addLog(source, message) {
    const consoleLog = document.getElementById('console-log');
    const time = new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-source">${source}</span>
        <span class="log-message">: ${message}</span>
    `;
    
    consoleLog.appendChild(logEntry);
    consoleLog.scrollTop = consoleLog.scrollHeight;
}

// 清空日志
function clearLog() {
    const consoleLog = document.getElementById('console-log');
    consoleLog.innerHTML = '';
    console.log('[主页面] 日志已清空');
}

// 通知主页面已加载完成
setTimeout(() => {
    addLog('主页面', '通信桥初始化完成');
}, 100);
