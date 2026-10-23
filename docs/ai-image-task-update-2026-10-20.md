# AI 生图任务接口变更核对（2026-10-20）

来源：`http://192.168.0.140:48080/v3/api-docs/flycowerp`。对照 2026-10-19 接入清单，本模块从 9 个接口增加至 10 个；原有接口的 HTTP 方法、路径与当前封装一致。

更新说明：这是 2026-10-20 的历史核对记录。最新字段与服务状态请以 [2026-10-23 核对记录](./ai-image-task-update-2026-10-23.md) 为准：查询改为 `styleNo`、详情已移除 `businessKey`，服务已返回 `stagingCount`。

## 接口与页面调整

| 内容 | 最新约定与处理 |
| --- | --- |
| 指定模型重试 | 新增 GET `/flycowerp/aiImageTask/retry/{ids}/{modelId}`；ids 支持单个或逗号分隔的批量任务。 |
| 保留原模型重试 | GET `/flycowerp/aiImageTask/retry/{ids}` 继续保留；不选择模型时逐任务沿用原模型，不传 0、undefined 或额外请求体。 |
| 重试交互 | “任务中心”单条重试和批量重试共用确认弹窗；可选择一个已启用的图片模型，所有选中任务使用该模型重试；清空选择恢复原模型。 |
| 重试状态 | 修正旧页面允许“失败/已取消”的配置，遵照用户已有要求，仅等待中（0）与失败（3）可以重试。混选其他状态时禁止批量重试，确认前复核列表中的当前状态。 |
| 暂存统计 | 用户确认统计的是暂存（5），且字段更名为 `stagingCount`。API 类型与卡片读取均改为 stagingCount，卡片名为“暂存”；已取消状态仍为 4，不改状态枚举。 |
| 任务详情 | 补齐当前详情中的 businessKey、smallOriginalImg、smallReferenceImg、pauseFlag、deleted 类型；页面展示流程任务 KEY、暂停状态，预览图和原图缺失时可用缩略图兜底。deleted 仅表示服务端软删除状态，不增加修改入口。 |
| 异常与重复操作 | 重试失败或业务返回 false 保留模型选择和任务勾选；提交期间禁止重复发送、关闭弹窗与离开页面，成功刷新列表和统计。API 拦截空任务、非法任务/模型编号。 |

分页请求仍是 POST /page + page/pageSize/status/aiModelId/taskType/sourcePage/sortKey/sortVal；列表、详情、启动、取消、删除、结果单张重生和材质增强的现有契约继续沿用。未新增暂停任务的接口。

## 当前发布服务差异

用户最新约定为 **stagingCount**。本次最后拉取的 Swagger 以及实际 GET /statistics 响应仍是 **cancelCount**，尚未反映新字段。前端按用户确认的新约定接入；服务更新前卡片显示“—”，不把旧字段误当作已取消或默认为 0。接口类型无需兼容已废弃字段。

## 验证

- 真实读取 POST /page（未筛选与状态 0/3/4/5）、GET /detail、GET /statistics，均返回业务码 0；当前只有 1 个失败任务，未执行真实启动、重试、取消、删除、重生或增强。
- 浏览器使用模拟接口验证新旧重试路径、单条与批量、仅启用图片模型、清空模型恢复旧接口、false/业务异常后保留输入、提交期间重复/关闭/路由保护、自动刷新后状态变更拦截、流程 Key/暂停状态/缩略图兜底与非法编号拦截。
- 暂存统计使用只含 stagingCount 的模拟响应验证，确保页面不依赖旧 cancelCount。

- TypeScript 类型检查、修改文件 ESLint 与格式检查、生产构建通过，已生成 dist/dist.zip。

## 当前接口清单

| 方法 | 路径 | 功能 | 核对结果 |
| --- | --- | --- | --- |
| POST | `/flycowerp/aiImageTask/result/regenerate/{resultId}` | 单张重新生成 | 已接入，契约核对一致 |
| POST | `/flycowerp/aiImageTask/result/material-enhance/{resultId}` | 单张材质增强 | 已接入，契约核对一致 |
| POST | `/flycowerp/aiImageTask/page` | 查询AI生图任务列表 | 已接入，契约核对一致 |
| GET | `/flycowerp/aiImageTask/statistics` | 查询AI生图任务统计 | 已接入，契约核对一致 |
| GET | `/flycowerp/aiImageTask/start/{ids}` | 启动暂存任务，支持批量 | 已接入，契约核对一致 |
| GET | `/flycowerp/aiImageTask/retry/{ids}` | 重试任务，支持单个和批量 | 已接入，契约核对一致 |
| GET | `/flycowerp/aiImageTask/retry/{ids}/{modelId}` | 重试任务，支持单个和批量 | 新增并接入 |
| GET | `/flycowerp/aiImageTask/detail/{id}` | 查询任务详情 | 已接入，契约核对一致 |
| GET | `/flycowerp/aiImageTask/cancel/{ids}` | 取消任务，支持批量 | 已接入，契约核对一致 |
| DELETE | `/flycowerp/aiImageTask/delete/{id}` | 删除任务 | 已接入，契约核对一致 |
