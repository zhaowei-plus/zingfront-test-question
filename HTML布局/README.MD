# 页面布局

## 问题分析

1. 整个 UI（出内容区域外）需要占满整个 PC 屏幕，所以宽高均为 100%

2. 下拉菜单层级设置需要跟随按钮走，一般将按钮容器设置为相对布局，菜单为绝对布局，并设置 zindex，以确保浮层正确

3. 内容区滚动容器必须是 body，那么:

- Header 和 Silder 则需要设置为 fixed，以确保内容区滚动时，Header 和 Silder 不随内容区滚动
- body 设置 padding-top 和 padding-left，用于避免 body 内容区与 Header 和 Silder 重叠
- 设置 Overflow：auto，用于支持内容元素滚动

4. Silder 纵向是撑满除 Header 外的高度，首尾固定，中间自动撑满（隐藏滚动条） 5. 下拉支持支持动画（透明度 + 过渡动画），保证有序性
