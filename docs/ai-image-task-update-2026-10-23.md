# AI 生图任务接口核对（2026-10-23）

来源：`http://192.168.0.140:48080/v3/api-docs/flycowerp`，并对照测试服务实际只读返回。

## 变更及处理

| 位置 | 最新契约 | 前端处理 |
| --- | --- | --- |
| POST `/aiImageTask/page` 请求 | 查询参数为 `styleNo`（款号），不含 `styleId` | 查询框改为“款号”，去除首尾空格；清空和重置时不发送该条件 |
| POST `/aiImageTask/page` 返回 | 最新已补充 `styleNo`，仍保留字符串 `styleId` | 按用户要求，列表移除“款式 ID”列，改为“款号”；空款号显示 `-` |
| GET `/aiImageTask/detail/{id}` 返回 | 新增 `styleNo`；保留 `styleId`；不再声明或返回 `businessKey` | 详情显示款号，移除流程任务 KEY；款号为空显示 `-` |
| GET `/aiImageTask/statistics` 返回 | `stagingCount` 表示暂存（状态 5） | 已接入，实际响应已同步；2026-10-20 文档的服务端旧字段差异已解除 |
| 重试状态 | 用户已明确仅允许等待中（0）、失败（3）重试 | 修正当前配置误包含已取消（4）的问题，单条及批量使用同一规则 |

其余模型、任务类型、来源、排序、状态筛选与响应字段一致。本模块共 10 个 Swagger 路径，现有方法及路径均一致；包括指定模型和原模型重试、启动、取消、删除、单张重新生成、材质增强，未发现漏接接口。

## 实际只读检查

- 分页、详情、统计均返回 `code=0`；当前分页总数 20。
- 用不存在款号 `CODEX-NOT-EXIST-20261023` 传 `styleNo` 查询，总数为 0；同一值传旧 `styleId` 条件，总数仍为 20，证实旧条件已被服务忽略。
- 首轮核对时列表仅返回 `styleId`；后续按列表展示需求复核，Swagger 和实际分页均已补充 `styleNo`，所读样本为 `null`，前端保留空值占位。
- 统计实际返回 `stagingCount`，当前值为 3。
- 未对真实业务任务执行重试、启动、取消、删除或消耗生图资源的操作。

浏览器回归脚本：`docs/testing/image-task-fields-2026-10-23/browser.mjs`，使用模拟接口验证款号查询请求、清空/重置、详情展示及空值、款式 ID 精度、暂存统计、等待/失败以外任务的重试限制。

验证结果：应用 TypeScript 检查、修改文件 ESLint、`git diff --check` 和浏览器回归均通过。回归请求与结果记录于 `docs/testing/image-task-fields-2026-10-23/result.json`。
