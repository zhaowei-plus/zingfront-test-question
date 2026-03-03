# 素材下载管理器

一个功能完善的VIP批量下载工具,支持单个/批量下载、并发控制、进度展示、ZIP打包等功能。

## 📋 功能特性

### ✅ 核心功能

1. **单个下载模式**
   - 输入URL即可下载单个文件
   - 实时显示下载进度和速度
   - 支持暂停/继续/删除

2. **批量下载模式**
   - 支持一次添加多个文件URL
   - 自动打包成ZIP文件下载
   - 显示批量下载进度 (已完成/总数)

3. **智能并发控制**
   - 最多同时下载5个文件
   - 自动队列管理,确保顺序执行
   - 高效利用带宽资源

4. **实时进度展示**
   - 单个文件: 下载百分比 + 速度
   - 批量文件: 已完成数量/总数量
   - 实时统计面板显示任务状态

5. **ZIP打包集成**
   - 使用JSZip库自动打包批量文件
   - 可自定义ZIP文件名
   - 保持原始文件名

## 🚀 使用方法

### 单个下载

1. 在"输入素材URL"框中输入文件URL
2. (可选)输入自定义文件名
3. 点击"单个下载"按钮
4. 文件将自动开始下载

### 批量下载

1. 在"批量下载"文本框中每行输入一个URL
   ```
   https://example.com/image1.jpg
   https://example.com/image2.jpg
   https://example.com/image3.png
   ```
2. (可选)输入ZIP文件名
3. 点击"批量下载"按钮
4. 系统将自动下载所有文件并打包成ZIP

### 下载控制

- **全部开始**: 启动所有等待中和已暂停的任务
- **全部暂停**: 暂停所有正在下载的任务
- **清除已完成**: 删除所有已完成的任务

### 任务操作

每个任务都有以下操作按钮:
- **开始**: 启动任务(用于暂停后继续)
- **暂停**: 暂停正在下载的任务
- **删除**: 删除任务

## 📁 文件结构

```
下载管理器/
├── index.html           # 主页面HTML
├── style.css            # 样式文件
├── download-manager.js  # 下载管理器核心类
├── app.js               # 应用程序逻辑
└── README.md            # 说明文档
```

## 🏗️ 核心架构

### DownloadManager 类

下载管理器的核心类,负责管理所有下载任务。

#### 主要方法

- `addSingleTask(url, fileName)` - 添加单个下载任务
- `addBatchTask(urls, zipName)` - 添加批量下载任务
- `startTask(taskId)` - 开始指定任务
- `pauseTask(taskId)` - 暂停指定任务
- `removeTask(taskId)` - 删除指定任务
- `startAll()` - 开始所有任务
- `pauseAll()` - 暂停所有任务
- `clearCompleted()` - 清除已完成的任务
- `getStats()` - 获取统计信息

#### 并发控制机制

```javascript
// 最多同时下载5个文件
const maxConcurrent = 5;

// 等待直到有可用下载槽位
while (this.activeDownloads >= maxConcurrent) {
    await this.sleep(100);
}

// 开始下载
await this.downloadSingleFile(task);
```

### DownloadTask 类

表示单个下载任务。

#### 属性

- `id`: 任务唯一标识
- `url`: 下载URL
- `fileName`: 文件名
- `type`: 任务类型 ('single' 或 'batch')
- `status`: 任务状态
- `progress`: 下载进度 (0-100)
- `downloaded`: 已下载字节数
- `total`: 总字节数
- `speed`: 下载速度 (字节/秒)

#### 状态枚举

```javascript
const TaskStatus = {
    PENDING: 'pending',       // 等待中
    DOWNLOADING: 'downloading', // 下载中
    PAUSED: 'paused',         // 已暂停
    COMPLETED: 'completed',   // 已完成
    FAILED: 'failed'         // 失败
};
```

## 🔧 技术实现

### 跨域下载

使用 `fetch` API 下载文件,支持 CORS 跨域请求:

```javascript
const response = await fetch(task.url, {
    signal: task.abortController.signal
});

const reader = response.body.getReader();
// 读取流数据
```

### 进度追踪

通过读取 `response.body` 的流数据,实时计算下载进度:

```javascript
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    receivedLength += value.length;
    task.updateProgress(receivedLength, total);
}
```

### ZIP打包

使用 JSZip 库将批量下载的文件打包:

```javascript
const zip = new JSZip();
zip.file(fileName, blob);
const zipBlob = await zip.generateAsync({ type: 'blob' });
```

### 并发下载控制

使用 `Promise.race` 实现并发数控制:

```javascript
async concurrentDownload(items, downloadFn, concurrency) {
    const executing = [];
    
    for (const item of items) {
        const promise = downloadFn(item).then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
        });
        
        executing.push(promise);
        
        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }
    
    return Promise.all(results);
}
```

## 📊 统计面板

显示实时统计信息:
- **总任务数**: 所有任务的数量
- **进行中**: 正在下载的任务数
- **已完成**: 已完成的任务数
- **并发数**: 当前并发下载数 (最大5)

## 🎨 UI特性

- 渐变色现代化设计
- 响应式布局,支持移动端
- 流畅的动画效果
- 清晰的状态指示
- 实时进度条展示

## ⚠️ 注意事项

1. **CORS限制**: 确保素材服务器支持 CORS 或允许跨域访问
2. **大文件**: 大文件下载可能需要较长时间,建议使用稳定的网络
3. **批量限制**: 批量下载大量文件时,建议分批处理
4. **浏览器兼容**: 需要支持 ES6+ 和 Fetch API 的现代浏览器

## 🌟 测试示例

### 单个下载测试

```
URL: https://picsum.photos/800/600
文件名: test-image.jpg
```

### 批量下载测试

```
https://picsum.photos/800/600?1
https://picsum.photos/800/600?2
https://picsum.photos/800/600?3
https://picsum.photos/800/600?4
https://picsum.photos/800/600?5
ZIP文件名: batch-images.zip
```

## 📝 使用场景

适合以下场景:
- 素材网站批量下载图片/视频
- 设计资源收集整理
- 文档资料批量获取
- 备份多个文件

## 🔐 安全考虑

- URL验证: 验证输入URL的合法性
- 文件名安全: 防止恶意文件名
- 并发限制: 防止资源耗尽
- 内存管理: 及时释放Blob对象

## 🎯 性能优化

1. **并发控制**: 限制最多5个并发下载
2. **流式下载**: 使用流式读取,避免内存溢出
3. **进度优化**: 节流更新UI,减少重绘
4. **资源释放**: 及时释放URL对象和Blobs

## 📱 浏览器支持

- Chrome/Edge (推荐)
- Firefox
- Safari
- 其他现代浏览器

需要支持:
- ES6+
- Fetch API
- Blob API
- Promise API
