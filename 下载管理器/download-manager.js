/**
 * 下载管理器核心类
 * 支持单个/批量下载、并发控制、进度展示、ZIP打包
 */

// 任务状态枚举
const TaskStatus = {
    PENDING: 'pending',
    DOWNLOADING: 'downloading',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// 下载任务类
class DownloadTask {
    constructor(options) {
        this.id = options.id;
        this.url = options.url;
        this.fileName = options.fileName || this.extractFileName(options.url);
        this.type = options.type; // 'single' or 'batch'
        this.zipName = options.zipName || 'batch_download.zip';
        this.status = TaskStatus.PENDING;
        this.progress = 0;
        this.downloaded = 0;
        this.total = 0;
        this.speed = 0;
        this.files = options.files || []; // 批量下载的文件列表
        this.completedFiles = 0;
        this.error = null;
        this.abortController = new AbortController();
        this.startTime = null;
        this.lastUpdateTime = null;
        this.lastDownloadedBytes = 0;
    }

    extractFileName(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            return filename || 'downloaded_file';
        } catch (e) {
            return 'downloaded_file';
        }
    }

    updateProgress(downloaded, total) {
        this.downloaded = downloaded;
        this.total = total;
        this.progress = total > 0 ? (downloaded / total) * 100 : 0;

        // 计算速度
        const now = Date.now();
        if (this.lastUpdateTime) {
            const timeDiff = (now - this.lastUpdateTime) / 1000; // 秒
            const bytesDiff = downloaded - this.lastDownloadedBytes;
            this.speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
        }
        this.lastUpdateTime = now;
        this.lastDownloadedBytes = downloaded;
    }

    reset() {
        this.status = TaskStatus.PENDING;
        this.progress = 0;
        this.downloaded = 0;
        this.total = 0;
        this.speed = 0;
        this.completedFiles = 0;
        this.error = null;
        this.abortController = new AbortController();
        this.startTime = null;
        this.lastUpdateTime = null;
        this.lastDownloadedBytes = 0;
    }

    getFormattedSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }

    getFormattedSpeed() {
        return this.getFormattedSize(this.speed) + '/s';
    }

    pause() {
        this.abortController.abort();
        this.status = TaskStatus.PAUSED;
    }

    cancel() {
        this.abortController.abort();
        this.status = TaskStatus.FAILED;
        this.error = '已取消';
    }
}

// 下载管理器类
class DownloadManager {
    constructor(maxConcurrent = 5) {
        this.tasks = [];
        this.maxConcurrent = maxConcurrent;
        this.activeDownloads = 0;
        this.listeners = new Map();
    }

    // 生成唯一ID
    generateId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 添加单个下载任务
    addSingleTask(url, fileName) {
        const task = new DownloadTask({
            id: this.generateId(),
            url,
            fileName,
            type: 'single'
        });
        this.tasks.push(task);
        this.notify('taskAdded', task);
        return task;
    }

    // 添加批量下载任务
    addBatchTask(urls, zipName) {
        const files = urls.map(url => ({
            url,
            fileName: new DownloadTask({}).extractFileName(url)
        }));

        const task = new DownloadTask({
            id: this.generateId(),
            url: urls.join(','),
            fileName: zipName || 'batch_download.zip',
            type: 'batch',
            zipName: zipName || 'batch_download.zip',
            files
        });
        this.tasks.push(task);
        this.notify('taskAdded', task);
        return task;
    }

    // 获取待处理的任务
    getPendingTask() {
        // 找到第一个 PENDING 状态的任务
        return this.tasks.find(task => 
            task.status === TaskStatus.PENDING && 
            this.tasks.indexOf(task) < this.tasks.indexOf(this.tasks.find(t => t.status === TaskStatus.DOWNLOADING || false))
        );
    }

    // 开始单个文件下载
    async downloadSingleFile(task) {
        task.status = TaskStatus.DOWNLOADING;
        task.startTime = Date.now();
        this.activeDownloads++;
        this.notify('taskStarted', task);

        try {
            const response = await fetch(task.url, {
                signal: task.abortController.signal
            });

            if (!response.ok) {
                throw new Error(`下载失败: ${response.status} ${response.statusText}`);
            }

            const contentLength = response.headers.get('Content-Length');
            const total = contentLength ? parseInt(contentLength) : 0;
            task.total = total;

            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                chunks.push(value);
                receivedLength += value.length;
                
                task.updateProgress(receivedLength, total);
                this.notify('taskProgress', task);
            }

            // 合并所有块并下载
            const blob = new Blob(chunks);
            await this.saveBlob(blob, task.fileName);
            
            task.status = TaskStatus.COMPLETED;
            this.notify('taskCompleted', task);

        } catch (error) {
            if (error.name === 'AbortError') {
                task.status = TaskStatus.PAUSED;
                console.log(`任务 ${task.id} 已暂停`);
            } else {
                task.status = TaskStatus.FAILED;
                task.error = error.message;
                console.error(`任务 ${task.id} 下载失败:`, error);
                this.notify('taskFailed', task);
            }
        } finally {
            this.activeDownloads--;
            this.notify('concurrentChanged', this.activeDownloads);
        }
    }

    // 批量下载文件并打包成ZIP
    async downloadBatchFiles(task) {
        task.status = TaskStatus.DOWNLOADING;
        task.startTime = Date.now();
        this.activeDownloads++;
        this.notify('taskStarted', task);

        try {
            const zip = new JSZip();
            const files = task.files;
            const totalFiles = files.length;

            // 并发下载文件，最多5个
            const downloadFile = async (fileInfo) => {
                const response = await fetch(fileInfo.url, {
                    signal: task.abortController.signal
                });

                if (!response.ok) {
                    throw new Error(`下载失败: ${fileInfo.fileName}`);
                }

                const blob = await response.blob();
                
                // 添加到ZIP
                zip.file(fileInfo.fileName, blob);
                
                task.completedFiles++;
                task.progress = (task.completedFiles / totalFiles) * 100;
                task.downloaded = task.completedFiles;
                task.total = totalFiles;
                
                this.notify('taskProgress', task);
                
                return { success: true, fileName: fileInfo.fileName };
            };

            // 批量下载，限制并发数为5
            const results = await this.concurrentDownload(files, downloadFile, 5);

            // 检查是否有失败的文件
            const failedFiles = results.filter(r => !r.success);
            if (failedFiles.length > 0) {
                throw new Error(`${failedFiles.length} 个文件下载失败`);
            }

            // 生成ZIP并下载
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            await this.saveBlob(zipBlob, task.zipName);

            task.status = TaskStatus.COMPLETED;
            this.notify('taskCompleted', task);

        } catch (error) {
            if (error.name === 'AbortError') {
                task.status = TaskStatus.PAUSED;
                console.log(`任务 ${task.id} 已暂停`);
            } else {
                task.status = TaskStatus.FAILED;
                task.error = error.message;
                console.error(`任务 ${task.id} 下载失败:`, error);
                this.notify('taskFailed', task);
            }
        } finally {
            this.activeDownloads--;
            this.notify('concurrentChanged', this.activeDownloads);
        }
    }

    // 并发下载控制
    async concurrentDownload(items, downloadFn, concurrency) {
        const results = [];
        const executing = [];

        for (const item of items) {
            const promise = downloadFn(item).then(result => {
                executing.splice(executing.indexOf(promise), 1);
                return result;
            });

            results.push(promise);
            executing.push(promise);

            if (executing.length >= concurrency) {
                await Promise.race(executing);
            }
        }

        return Promise.all(results);
    }

    // 保存Blob到本地
    saveBlob(blob, fileName) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            resolve();
        });
    }

    // 开始任务
    async startTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            console.error(`未找到任务: ${taskId}`);
            return;
        }

        // 如果任务已完成或失败，重置状态
        if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
            task.reset();
        }

        // 等待直到可以开始新任务
        while (this.activeDownloads >= this.maxConcurrent) {
            await this.sleep(100);
        }

        if (task.type === 'single') {
            await this.downloadSingleFile(task);
        } else {
            await this.downloadBatchFiles(task);
        }
    }

    // 暂停任务
    pauseTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.pause();
            this.notify('taskPaused', task);
        }
    }

    // 取消任务
    cancelTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.cancel();
            this.notify('taskCancelled', task);
        }
    }

    // 删除任务
    removeTask(taskId) {
        const index = this.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            const task = this.tasks[index];
            if (task.status === TaskStatus.DOWNLOADING) {
                task.cancel();
            }
            this.tasks.splice(index, 1);
            this.notify('taskRemoved', task);
        }
    }

    // 开始所有任务
    async startAll() {
        // 找出所有非完成状态的任务
        const tasksToStart = this.tasks.filter(task => 
            task.status === TaskStatus.PENDING || task.status === TaskStatus.PAUSED
        );

        // 按顺序启动任务
        for (const task of tasksToStart) {
            this.startTask(task.id);
        }
    }

    // 暂停所有任务
    pauseAll() {
        this.tasks.forEach(task => {
            if (task.status === TaskStatus.DOWNLOADING) {
                this.pauseTask(task.id);
            }
        });
    }

    // 清除已完成的任务
    clearCompleted() {
        this.tasks = this.tasks.filter(task => task.status !== TaskStatus.COMPLETED);
        this.notify('tasksCleared');
    }

    // 获取统计信息
    getStats() {
        const total = this.tasks.length;
        const active = this.tasks.filter(t => t.status === TaskStatus.DOWNLOADING).length;
        const completed = this.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
        
        return {
            total,
            active,
            completed,
            concurrent: this.activeDownloads
        };
    }

    // 事件监听
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    // 事件通知
    notify(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    // 睡眠函数
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
