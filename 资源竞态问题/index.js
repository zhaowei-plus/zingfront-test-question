
// 模拟网络请求：返回时间随机（1-4秒），模拟不同响应时间
function mockAsyncRequest(buttonId) {
    return new Promise((resolve) => {
        // 随机延迟 1000-4000ms，模拟不同的响应时间
        const delay = Math.floor(Math.random() * 3000) + 1000;
        console.log(`按钮 ${buttonId} 请求已发送，预计响应时间: ${delay}ms`);

        setTimeout(() => {
            resolve({
                buttonId: buttonId,
                timestamp: Date.now(),
                data: `数据来自按钮 ${buttonId}`,
                // 颜色用于UI显示，可根据需要使用
                color: `hsl(${buttonId * 60}, 70%, 50%)`,
                // 位置信息，可用于UI布局
                position: Math.random() * 100
            });
        }, delay);
    });
}

// 模拟异步请求：回调版本
function mockAsyncRequestCallback(buttonId, callback) {
    const delay = Math.floor(Math.random() * 3000) + 1000;
    console.log(`[回调] 按钮 ${buttonId} 请求已发送，预计响应时间: ${delay}ms`);

    setTimeout(() => {
        callback(null, {
            buttonId: buttonId,
            timestamp: Date.now(),
            data: `数据来自按钮 ${buttonId}`,
            color: `hsl(${buttonId * 60 + 180}, 70%, 50%)`,
            position: Math.random() * 100
        });
    }, delay);
}

// ========== 方案一：Promise 方案（队列机制）==========
class PromiseSolution {
    constructor() {
        this.queue = []; // 任务队列
        this.isProcessing = false; // 是否正在处理
        this.updateCallback = null; // 自定义更新函数
        this.nextExpectedIndex = 1; // 下一个期望处理的序号
    }

    /**
     * 注册自定义更新函数
     * @param {Function} callback - 更新回调函数
     * 参数:
     *   - data: 返回的数据对象 { buttonId, timestamp, data, color, position }
     *   - index: 处理序号（从1开始）
     *   - waitTime: 等待时间（毫秒）
     */
    registerUpdateCallback(callback) {
        this.updateCallback = callback;
    }

    /**
     * 请求数据
     * @param {number} buttonId - 按钮ID
     */
    async requestData(buttonId) {
        const task = {
            id: Date.now(),
            buttonId: buttonId,
            promise: mockAsyncRequest(buttonId),
            startTime: Date.now()
        };

        this.queue.push(task);
        console.log(`[Promise] 按钮 ${buttonId} 已加入队列，当前队列长度: ${this.queue.length}`);

        // 如果没有在处理，开始处理队列
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * 处理队列（核心逻辑：按顺序处理请求结果）
     */
    async processQueue() {
        if (this.queue.length === 0 || this.isProcessing) return;

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const task = this.queue.shift();

            try {
                // 等待当前任务完成
                const data = await task.promise;
                const waitTime = Date.now() - task.startTime;

                console.log(`[Promise] 按钮 ${data.buttonId} 数据已返回，等待了 ${waitTime}ms`);

                // 调用自定义更新函数
                if (this.updateCallback) {
                    this.updateCallback(data, this.nextExpectedIndex, waitTime);
                } else {
                    console.warn('未注册更新函数，结果将被忽略');
                }

                this.nextExpectedIndex++;
            } catch (error) {
                console.error(`处理按钮 ${task.buttonId} 时出错:`, error);
            }
        }

        this.isProcessing = false;
        console.log('[Promise] 队列处理完成');
    }
}

// ========== 方案二：非 Promise 方案（回调队列）==========
class CallbackSolution {
    constructor() {
        this.queue = []; // 任务队列
        this.isProcessing = false; // 是否正在处理
        this.updateCallback = null; // 自定义更新函数
        this.nextExpectedIndex = 1; // 下一个期望处理的序号
    }

    /**
     * 注册自定义更新函数
     * @param {Function} callback - 更新回调函数
     * 参数:
     *   - data: 返回的数据对象 { buttonId, timestamp, data, color, position }
     *   - index: 处理序号（从1开始）
     *   - waitTime: 等待时间（毫秒）
     */
    registerUpdateCallback(callback) {
        this.updateCallback = callback;
    }

    /**
     * 请求数据
     * @param {number} buttonId - 按钮ID
     */
    requestData(buttonId) {
        const task = {
            id: Date.now(),
            buttonId: buttonId,
            startTime: Date.now(),
            data: null
        };

        this.queue.push(task);

        console.log(`[Callback] 按钮 ${buttonId} 已加入队列，当前队列长度: ${this.queue.length}`);

        // 发起异步请求（使用回调）
        mockAsyncRequestCallback(buttonId, (error, data) => {
            if (error) {
                console.error(`按钮 ${buttonId} 请求失败:`, error);
                return;
            }

            // 将结果存入对应的任务中
            const taskIndex = this.queue.findIndex(t => t.buttonId === buttonId && !t.data);
            if (taskIndex !== -1) {
                this.queue[taskIndex].data = data;
                console.log(`[Callback] 按钮 ${buttonId} 数据已返回，等待队列处理`);
            } else {
                console.warn(`[Callback] 按钮 ${buttonId} 不在队列中`);
            }
        });

        // 如果没有在处理，开始处理队列
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * 处理队列（核心逻辑：按顺序处理请求结果）
     */
    processQueue() {
        if (this.queue.length === 0 || this.isProcessing) return;

        this.isProcessing = true;
        this.processNext();
    }

    /**
     * 处理下一个任务（轮询方式）
     */
    processNext() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            console.log('[Callback] 队列处理完成');
            return;
        }

        const task = this.queue[0];

        if (task.data) {
            // 数据已返回，立即处理
            const waitTime = Date.now() - task.data.timestamp;

            console.log(`[Callback] 按钮 ${task.data.buttonId} 开始处理，等待了 ${waitTime}ms`);

            // 调用自定义更新函数
            if (this.updateCallback) {
                this.updateCallback(task.data, this.nextExpectedIndex, waitTime);
            } else {
                console.warn('未注册更新函数，结果将被忽略');
            }

            this.nextExpectedIndex++;
            this.queue.shift();
            this.processNext();
        } else {
            // 数据还未返回，等待并轮询
            setTimeout(() => {
                this.processNext();
            }, 100); // 每100ms检查一次
        }
    }
}

// ========== 使用示例 ==========
console.log('资源竞态问题解决方案已加载');
console.log('请通过 HTML 页面进行测试');
