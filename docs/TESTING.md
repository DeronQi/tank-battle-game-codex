# 测试、采样与截图

## 核心检查

```sh
npm run check
npm test
```

测试不依赖第三方测试框架、浏览器或网络。核心场景包括：

- 1,000 个种子的合法性、独立步行连通性、出生区、护墙、地形变化和种子复现。
- 地形碰撞、友军免伤、四类敌军、七种道具及效果到期。
- 复活、胜负、关卡成长继承、失败恢复、原地图重试。
- 基地挡弹、护盾队员分配、对射实际抵消、交叉火力躲避与开火限制。
- 主动出击、射击位置、钢墙侧翼、砖墙清除和持续攻击重装敌军。
- 七种道具的实际拾取与生效、可达性、到期限制、需求评估、双 AI 分配和紧急防御取消拾取。

GitHub Actions 在 Node.js 20、22、24 下运行核心检查。浏览器场景另行执行，不应将引擎测试视为所有浏览器 / 设备的兼容性证明。

## AI 固定样本

```sh
node scripts/benchmark-ai.mjs
```

标准强度、第一关、种子 0–99、单 / 双 AI 各 100 局、步长 1/30 秒，每局模拟上限 360 秒。结果写入忽略的 `output/ai-benchmark.json`。

发布快照见 [AI 采样数据](benchmarks/ai-benchmark.json) 与 [验证记录](../VERIFICATION.md)。拾取统计在道具真正生效时递增，不把选择目标计为成功拾取。平均耗时仅统计获胜对局。固定样本表现不代表所有随机种子、强度或后续关卡。

## 浏览器检查

先启动本地服务器：

```sh
npm start -- --port 5187
```

单独安装 Playwright CLI 后，在仓库目录执行：

```sh
npm install -g @playwright/cli@0.1.22
playwright-cli -s=smoke open http://127.0.0.1:5187 --headed
playwright-cli -s=smoke run-code --filename=scripts/browser-smoke.cjs
playwright-cli -s=smoke close
```

其余脚本使用同样的 `open` / `run-code --filename=...` / `close` 流程，每个脚本建议使用新的会话。将地址端口替换为实际启动端口。

| 脚本 | 检查 |
|---|---|
| `browser-smoke.cjs` | 模式切换、双人输入、暂停、工坊绘制 / 撤销 / 保存 / JSON 导入导出、帮助弹窗、AI 启动 |
| `browser-fullscreen.cjs` | 实际全屏包含状态栏、两列等高、退出和正常布局恢复、战斗状态保留；使用桌面视口 |
| `browser-progression.cjs` | 固定种子与虚拟时钟完整战斗，失败自动 / 手动重试和胜利进入下一关 |
| `browser-pickups.cjs` | 双 AI 在真实运行页面中实际拾取至少两次道具 |

这些脚本会在测试浏览器中保存测试地图、产生截图或下载文件，使用独立测试会话。带虚拟时钟的脚本应在新会话中运行一次。修改 AI 或生成器后，如固定种子战斗的结果发生变化，应重新选择合适的场景并完整验证，不能只更新期望值掩盖状态转换问题。

## 公开截图

```sh
playwright-cli -s=shots open http://127.0.0.1:5187 --headed
playwright-cli -s=shots run-code --filename=scripts/capture-screenshots.cjs
playwright-cli -s=shots close
```

脚本使用固定种子、独立测试存储和实际 Chromium 界面，截取开始画面、双人战斗、双 AI、关卡工坊、包含状态栏的全屏以及移动端。图片写入 `docs/screenshots/`，这部分会随仓库提交；其他临时截图、导出地图与日志留在被忽略的 `output/`、`.playwright-cli/`。

更新截图后检查清晰度、功能状态和隐私内容，再提交。不要把工具日志、浏览器账户信息或本机路径一并提交。
