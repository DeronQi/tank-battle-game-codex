# 截图来源

本目录图片均于 2026-10-24 从当前游戏实际运行的 Chromium 页面截取，未使用生成式图片、概念稿或手工拼接界面。

| 文件 | 内容 |
|---|---|
| [start-screen.png](start-screen.png) | 开始选择画面 |
| [local-coop.png](local-coop.png) | 双人同屏，真实按键开火后的战斗 |
| [ai-demo.png](ai-demo.png) | 双 AI 演示运行中的战场 |
| [level-editor.png](level-editor.png) | 随机地形、画笔、导入导出和保存入口 |
| [fullscreen.png](fullscreen.png) | 游戏与状态栏共同全屏 |
| [mobile.png](mobile.png) | 移动端战场、触控键和下方状态栏 |

桌面视口为 1440 × 1024；移动端视口为 390 × 844，移动端图片为整页截图。桌面初始地图种子为 42，后续演示与工坊使用固定递增种子。虚拟时钟用于让战斗稳定推进到截图时刻，画面仍由原始游戏模拟与渲染生成。

使用独立测试会话和清理后的游戏本地记录，不包含浏览器地址栏、账号、私人关卡名称或系统桌面信息。复现脚本为 [capture-screenshots.cjs](../../scripts/capture-screenshots.cjs)，执行方法见 [测试文档](../TESTING.md)。
