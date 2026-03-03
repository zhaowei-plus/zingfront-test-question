// 创建通信桥实例
const bridge = new MessageBridge({
    identity: 'iframe1',
    allowedOrigins: ['*'],
    defaultTargetOrigin: '*'
});

// 获取主页面窗口引用
const mainWindow = window.parent;

// 注册消息打印处理器
bridge.registerHandler('test', 'print', (data, context) => {
    const { message, key } = data;
    const { source, relays } = context;

    console.log(`[iframe1] 收到来自 ${source} 的消息: {${message}}`);
    addLog(`收到来自 ${source} 的消息: {${message}}`);

    return {
        success: true,
        messageKey: key,
        timestamp: new Date().toISOString(),
        relayPath: relays
    };
});

// 注册 ping 处理器
bridge.registerHandler('system', 'ping', (data, context) => {
    console.log('[iframe1] 收到 ping 请求');
    addLog('收到 ping 请求');
    
    return {
        success: true,
        identity: 'iframe1',
        timestamp: new Date().toISOString()
    };
});

// 添加日志到本地控制台
function addLog(message) {
    const consoleLog = document.getElementById('console-log');
    const time = new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-message">${message}</span>
    `;
    
    consoleLog.appendChild(logEntry);
    consoleLog.scrollTop = consoleLog.scrollHeight;
}

// Ping 主页面
async function pingMain() {
    console.log('[iframe1] 发送 ping 到主页面');
    addLog('发送 ping 到主页面');

    try {
        const result = await bridge.sendRequest(
            mainWindow,
            'system',
            'ping',
            { from: 'iframe1' },
            { targetIdentity: 'main' }
        );

        console.log('[iframe1] 主页面 pong 响应:', result);
        addLog('收到主页面 pong 响应');
    } catch (error) {
        console.error('[iframe1] Ping 失败:', error);
        addLog(`Ping 失败: ${error.message}`);
    }
}

// 通知主页面已加载
setTimeout(async () => {
    try {
        await bridge.sendNotify(
            mainWindow,
            'system',
            'statusUpdate',
            { iframeId: 'iframe1', connected: true },
            { targetIdentity: 'main' }
        );
        
        document.getElementById('status').textContent = '已连接';
        document.getElementById('status').style.color = '#00cc66';
        addLog('已连接到主页面');
        
        console.log('[iframe1] 已通知主页面连接状态');
    } catch (error) {
        console.error('[iframe1] 通知主页面失败:', error);
        addLog('通知主页面失败');
    }
}, 500);

// 页面卸载时通知主页面
window.addEventListener('beforeunload', () => {
    bridge.sendNotify(
        mainWindow,
        'system',
        'statusUpdate',
        { iframeId: 'iframe1', connected: false },
        { targetIdentity: 'main' }
    );
});

console.log('[iframe1] 初始化完成');
addLog('初始化完成');
