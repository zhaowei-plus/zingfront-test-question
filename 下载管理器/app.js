/**
 * 应用程序逻辑
 */

// 创建下载管理器实例
const downloadManager = new DownloadManager(5);

// UI 元素
const elements = {
    fileUrl: document.getElementById('fileUrl'),
    fileName: document.getElementById('fileName'),
    batchUrls: document.getElementById('batchUrls'),
    zipName: document.getElementById('zipName'),
    taskList: document.getElementById('taskList'),
    totalTasks: document.getElementById('totalTasks'),
    activeTasks: document.getElementById('activeTasks'),
    completedTasks: document.getElementById('completedTasks'),
    concurrentDownloads: document.getElementById('concurrentDownloads')
};

// 初始化
function init() {
    bindEvents();
    setupDownloadManagerListeners();
    updateStats();
}

// 绑定事件
function bindEvents() {
    // 回车键快捷添加
    elements.fileUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addSingleDownload();
        }
    });
}

// 设置下载管理器事件监听
function setupDownloadManagerListeners() {
    downloadManager.on('taskAdded', (task) => {
        renderTask(task);
        updateStats();
    });

    downloadManager.on('taskStarted', (task) => {
        updateTaskStatus(task.id, TaskStatus.DOWNLOADING);
        updateStats();
    });

    downloadManager.on('taskProgress', (task) => {
        updateTaskProgress(task);
        updateStats();
    });

    downloadManager.on('taskPaused', (task) => {
        updateTaskStatus(task.id, TaskStatus.PAUSED);
        updateStats();
    });

    downloadManager.on('taskCompleted', (task) => {
        updateTaskStatus(task.id, TaskStatus.COMPLETED);
        updateStats();
    });

    downloadManager.on('taskFailed', (task) => {
        updateTaskStatus(task.id, TaskStatus.FAILED);
        showTaskError(task.id, task.error);
        updateStats();
    });

    downloadManager.on('taskCancelled', (task) => {
        removeTaskFromUI(task.id);
        updateStats();
    });

    downloadManager.on('taskRemoved', (task) => {
        removeTaskFromUI(task.id);
        updateStats();
    });

    downloadManager.on('concurrentChanged', (count) => {
        elements.concurrentDownloads.textContent = `${count}/5`;
    });
}

// 添加单个下载
function addSingleDownload() {
    const url = elements.fileUrl.value.trim();
    const fileName = elements.fileName.value.trim();

    if (!url) {
        alert('请输入素材URL');
        return;
    }

    try {
        new URL(url);
    } catch (e) {
        alert('请输入有效的URL');
        return;
    }

    const task = downloadManager.addSingleTask(url, fileName || undefined);
    
    // 清空输入
    elements.fileUrl.value = '';
    elements.fileName.value = '';

    // 自动开始下载
    downloadManager.startTask(task.id);
}

// 添加批量下载
function addBatchDownload() {
    const urlsText = elements.batchUrls.value.trim();
    const zipName = elements.zipName.value.trim();

    if (!urlsText) {
        alert('请输入批量下载URL列表');
        return;
    }

    // 解析URL列表
    const urls = urlsText.split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

    if (urls.length === 0) {
        alert('请输入至少一个URL');
        return;
    }

    // 验证所有URL
    const invalidUrls = [];
    urls.forEach(url => {
        try {
            new URL(url);
        } catch (e) {
            invalidUrls.push(url);
        }
    });

    if (invalidUrls.length > 0) {
        alert(`以下URL无效:\n${invalidUrls.join('\n')}`);
        return;
    }

    const task = downloadManager.addBatchTask(urls, zipName || undefined);
    
    // 清空输入
    elements.batchUrls.value = '';
    elements.zipName.value = '';

    // 自动开始下载
    downloadManager.startTask(task.id);
}

// 渲染任务
function renderTask(task) {
    // 移除空状态提示
    const emptyState = elements.taskList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    taskElement.id = `task-${task.id}`;
    taskElement.innerHTML = `
        <div class="col-name">
            <div class="task-title">${task.fileName}</div>
            ${task.type === 'batch' ? `<div class="task-subtitle">${task.files.length} 个文件</div>` : ''}
        </div>
        <div class="col-size">
            ${formatSize(task.total)}
        </div>
        <div class="col-progress">
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">0%</div>
        </div>
        <div class="col-status status-${task.status}">
            ${getStatusText(task.status)}
        </div>
        <div class="col-speed">0 B/s</div>
        <div class="col-action">
            <button class="btn-small btn-success" onclick="resumeTask('${task.id}')">开始</button>
            <button class="btn-small btn-warning" onclick="pauseTask('${task.id}')">暂停</button>
            <button class="btn-small btn-danger" onclick="removeTask('${task.id}')">删除</button>
        </div>
    `;

    elements.taskList.appendChild(taskElement);
}

// 更新任务状态
function updateTaskStatus(taskId, status) {
    const taskElement = document.getElementById(`task-${taskId}`);
    if (!taskElement) return;

    const statusElement = taskElement.querySelector('.col-status');
    statusElement.className = `col-status status-${status}`;
    statusElement.textContent = getStatusText(status);

    // 更新任务项样式
    if (status === TaskStatus.DOWNLOADING) {
        taskElement.classList.add('active');
    } else {
        taskElement.classList.remove('active');
    }
}

// 更新任务进度
function updateTaskProgress(task) {
    const taskElement = document.getElementById(`task-${task.id}`);
    if (!taskElement) return;

    const progressFill = taskElement.querySelector('.progress-fill');
    const progressText = taskElement.querySelector('.progress-text');
    const speedElement = taskElement.querySelector('.col-speed');
    const sizeElement = taskElement.querySelector('.col-size');

    progressFill.style.width = `${task.progress.toFixed(1)}%`;
    
    if (task.type === 'batch') {
        progressText.textContent = `${task.completedFiles}/${task.files.length}`;
    } else {
        progressText.textContent = `${task.progress.toFixed(1)}%`;
    }

    speedElement.textContent = task.getFormattedSpeed();
    sizeElement.textContent = formatSize(task.total);
}

// 显示任务错误
function showTaskError(taskId, error) {
    const taskElement = document.getElementById(`task-${taskId}`);
    if (!taskElement) return;

    const statusElement = taskElement.querySelector('.col-status');
    statusElement.textContent = `失败: ${error}`;
}

// 移除任务UI
function removeTaskFromUI(taskId) {
    const taskElement = document.getElementById(`task-${taskId}`);
    if (taskElement) {
        taskElement.remove();
    }

    // 如果没有任务了，显示空状态
    if (elements.taskList.children.length === 0) {
        elements.taskList.innerHTML = `
            <div class="empty-state">
                <p>暂无下载任务</p>
                <p>请添加单个或批量下载任务</p>
            </div>
        `;
    }
}

// 更新统计信息
function updateStats() {
    const stats = downloadManager.getStats();
    elements.totalTasks.textContent = stats.total;
    elements.activeTasks.textContent = stats.active;
    elements.completedTasks.textContent = stats.completed;
    elements.concurrentDownloads.textContent = `${stats.concurrent}/5`;
}

// 恢复任务
function resumeTask(taskId) {
    downloadManager.startTask(taskId);
}

// 暂停任务
function pauseTask(taskId) {
    downloadManager.pauseTask(taskId);
}

// 移除任务
function removeTask(taskId) {
    const task = downloadManager.tasks.find(t => t.id === taskId);
    if (task) {
        if (task.status === TaskStatus.DOWNLOADING) {
            if (confirm('任务正在下载中，确定要删除吗?')) {
                downloadManager.removeTask(taskId);
            }
        } else {
            downloadManager.removeTask(taskId);
        }
    }
}

// 格式化大小
function formatSize(bytes) {
    if (bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        [TaskStatus.PENDING]: '等待中',
        [TaskStatus.DOWNLOADING]: '下载中',
        [TaskStatus.PAUSED]: '已暂停',
        [TaskStatus.COMPLETED]: '已完成',
        [TaskStatus.FAILED]: '失败'
    };
    return statusMap[status] || status;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
