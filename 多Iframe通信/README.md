# 多 Iframe 页面通信问题

## 问题分析

由于是多个 iframe 页面之间的通信，存在跨域问题，那就只能通过 postMessage 实现，思路如下：

- 获取每个 iframe 示例，如为 Iframe 标签添加 ID 属性，以方便获取 iframe 元素实例
- 使用 postMessage 在主页面中监听 iframe 的消息，并根据 iframe 的 ID 属性进行处理
