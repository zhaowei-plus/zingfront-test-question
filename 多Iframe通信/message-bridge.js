/**
 * 多Iframe通信桥核心库
 * 支持跨域通信、消息加密、安全验证、消息中转
 */

// 消息类型
const MessageType = {
    REQUEST: 'request',
    RESPONSE: 'response',
    NOTIFY: 'notify'
};

// 加密工具
const CryptoUtils = {
    encode: (str) => {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) {
            console.error('加密失败:', e);
            return str;
        }
    },
    decode: (str) => {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) {
            console.error('解密失败:', e);
            return str;
        }
    }
};

// 消息桥类
class MessageBridge {
    constructor(options = {}) {
        this.identity = options.identity || 'unknown';
        this.allowedOrigins = options.allowedOrigins || ['*'];
        this.messageHandlers = new Map();
        this.pendingRequests = new Map();
        this.defaultTargetOrigin = options.defaultTargetOrigin || '*';
        
        this.init();
    }

    // 初始化消息监听
    init() {
        window.addEventListener('message', this.handleMessage.bind(this));
        console.log(`[${this.identity}] 通信桥已初始化`);
    }

    // 生成唯一消息ID
    generateMessageId() {
        return `${this.identity}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 检查来源是否允许
    isOriginAllowed(origin) {
        if (this.allowedOrigins.includes('*')) {
            return true;
        }
        return this.allowedOrigins.some(allowed => {
            if (allowed === '*') return true;
            if (allowed === origin) return true;
            // 支持通配符匹配, 如 https://*.example.com
            if (allowed.includes('*')) {
                const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
                return regex.test(origin);
            }
            return false;
        });
    }

    // 处理接收到的消息
    handleMessage(event) {
        // 安全检查: 验证来源
        if (!this.isOriginAllowed(event.origin)) {
            console.warn(`[${this.identity}] 拒绝未授权来源: ${event.origin}`);
            return;
        }

        try {
            const data = event.data;
            if (!data || !data.encrypted) {
                return;
            }

            // 解密消息
            const decryptedMessage = CryptoUtils.decode(data.encrypted);
            const message = JSON.parse(decryptedMessage);

            console.log(`[${this.identity}] 收到消息:`, {
                type: message.type,
                from: message.identity,
                source: message.source,
                relays: message.relays,
                module: message.module,
                action: message.action
            });

            // 根据消息类型处理
            switch (message.type) {
                case MessageType.REQUEST:
                    this.handleRequest(event, message);
                    break;
                case MessageType.RESPONSE:
                    this.handleResponse(message);
                    break;
                case MessageType.NOTIFY:
                    this.handleNotify(event, message);
                    break;
                default:
                    console.warn(`[${this.identity}] 未知消息类型: ${message.type}`);
            }
        } catch (e) {
            console.error(`[${this.identity}] 处理消息失败:`, e);
        }
    }

    // 处理请求消息
    handleRequest(event, message) {
        const handlerKey = `${message.module}:${message.action}`;
        const handler = this.messageHandlers.get(handlerKey);

        if (!handler) {
            console.warn(`[${this.identity}] 未找到处理器: ${handlerKey}`);
            this.sendResponse(
                event.source,
                message.messageId,
                false,
                { error: `No handler for ${handlerKey}` },
                message.origin
            );
            return;
        }

        // 调用处理器
        try {
            const context = {
                source: message.source,
                relays: message.relays || [],
                messageId: message.messageId,
                identity: message.identity
            };

            const result = handler(message.data, context);

            // 处理异步结果
            if (result instanceof Promise) {
                result.then(data => {
                    this.sendResponse(
                        event.source,
                        message.messageId,
                        true,
                        data,
                        message.origin
                    );
                }).catch(error => {
                    this.sendResponse(
                        event.source,
                        message.messageId,
                        false,
                        { error: error.message },
                        message.origin
                    );
                });
            } else {
                this.sendResponse(
                    event.source,
                    message.messageId,
                    true,
                    result,
                    message.origin
                );
            }
        } catch (e) {
            console.error(`[${this.identity}] 执行处理器失败:`, e);
            this.sendResponse(
                event.source,
                message.messageId,
                false,
                { error: e.message },
                message.origin
            );
        }
    }

    // 处理响应消息
    handleResponse(message) {
        const pending = this.pendingRequests.get(message.messageId);
        if (!pending) {
            console.warn(`[${this.identity}] 未找到对应的请求: ${message.messageId}`);
            return;
        }

        this.pendingRequests.delete(message.messageId);

        if (message.success) {
            pending.resolve({
                data: message.data,
                source: message.source,
                relays: message.relays
            });
        } else {
            pending.reject(new Error(message.data?.error || '请求失败'));
        }
    }

    // 处理通知消息
    handleNotify(event, message) {
        const handlerKey = `${message.module}:${message.action}`;
        const handler = this.messageHandlers.get(handlerKey);

        if (!handler) {
            console.warn(`[${this.identity}] 未找到通知处理器: ${handlerKey}`);
            return;
        }

        try {
            const context = {
                source: message.source,
                relays: message.relays || [],
                messageId: message.messageId,
                identity: message.identity
            };
            handler(message.data, context);
        } catch (e) {
            console.error(`[${this.identity}] 执行通知处理器失败:`, e);
        }
    }

    // 创建消息对象
    createMessage(type, options = {}) {
        return {
            type,
            messageId: options.messageId || this.generateMessageId(),
            identity: this.identity,
            module: options.module,
            action: options.action,
            data: options.data,
            source: options.source || this.identity,
            relays: options.relays || [],
            timestamp: Date.now()
        };
    }

    // 加密并发送消息
    sendEncryptedMessage(targetWindow, message, targetOrigin = '*') {
        const encrypted = CryptoUtils.encode(JSON.stringify(message));
        targetWindow.postMessage({ encrypted }, targetOrigin);
    }

    // 发送请求
    sendRequest(targetWindow, module, action, data, options = {}) {
        return new Promise((resolve, reject) => {
            const messageId = this.generateMessageId();
            const message = this.createMessage(MessageType.REQUEST, {
                messageId,
                module,
                action,
                data,
                source: options.source || this.identity,
                relays: options.relays || []
            });

            // 保存待处理的请求
            this.pendingRequests.set(messageId, { resolve, reject });

            // 发送消息
            const targetOrigin = options.targetOrigin || this.defaultTargetOrigin;
            this.sendEncryptedMessage(targetWindow, message, targetOrigin);

            console.log(`[${this.identity}] 发送请求:`, {
                to: options.targetIdentity || 'unknown',
                module,
                action,
                messageId
            });

            // 设置超时
            if (options.timeout) {
                setTimeout(() => {
                    if (this.pendingRequests.has(messageId)) {
                        this.pendingRequests.delete(messageId);
                        reject(new Error('请求超时'));
                    }
                }, options.timeout);
            }
        });
    }

    // 发送响应
    sendResponse(targetWindow, messageId, success, data, targetOrigin = '*') {
        const message = this.createMessage(MessageType.RESPONSE, {
            messageId,
            data: { success, ...data },
            source: this.identity
        });

        this.sendEncryptedMessage(targetWindow, message, targetOrigin);

        console.log(`[${this.identity}] 发送响应:`, {
            messageId,
            success
        });
    }

    // 发送通知
    sendNotify(targetWindow, module, action, data, options = {}) {
        const message = this.createMessage(MessageType.NOTIFY, {
            module,
            action,
            data,
            source: options.source || this.identity,
            relays: options.relays || []
        });

        const targetOrigin = options.targetOrigin || this.defaultTargetOrigin;
        this.sendEncryptedMessage(targetWindow, message, targetOrigin);

        console.log(`[${this.identity}] 发送通知:`, {
            to: options.targetIdentity || 'unknown',
            module,
            action
        });
    }

    // 注册处理器
    registerHandler(module, action, handler) {
        const key = `${module}:${action}`;
        this.messageHandlers.set(key, handler);
        console.log(`[${this.identity}] 注册处理器: ${key}`);
    }

    // 中转消息
    relayMessage(sourceWindow, targetWindow, originalMessage, options = {}) {
        const newMessage = {
            ...originalMessage,
            identity: this.identity,
            relays: [...(originalMessage.relays || []), this.identity],
            timestamp: Date.now()
        };

        this.sendEncryptedMessage(targetWindow, newMessage, options.targetOrigin || '*');

        console.log(`[${this.identity}] 中转消息:`, {
            from: options.sourceIdentity,
            to: options.targetIdentity,
            module: newMessage.module,
            action: newMessage.action
        });
    }

    // 销毁
    destroy() {
        window.removeEventListener('message', this.handleMessage.bind(this));
        this.messageHandlers.clear();
        this.pendingRequests.clear();
        console.log(`[${this.identity}] 通信桥已销毁`);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MessageBridge, MessageType, CryptoUtils };
}
