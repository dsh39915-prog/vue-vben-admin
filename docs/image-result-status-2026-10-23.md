# 按款式查询图片：批次任务状态

更新日期：2026-10-23。依据 [最新 Swagger](http://192.168.0.140:48080/swagger-ui/index.html?urls.primaryName=flycowerp#/)，并只读核对实际响应。

`GET /admin-api/flycowerp/aiImageResult/list/{styleId}` 的批次分组响应 `AIBusinessKeyImgRespVO` 新增 `status`，类型为 `integer/int32`。字段位于 `data[].status`，表示该批次的任务状态，不是单张图片的状态，也不是新增查询条件。

| status | 含义 |
| --- | --- |
| 0 | 等待中 |
| 1 | 生成中 |
| 2 | 成功 |
| 3 | 失败 |
| 4 | 已取消 |
| 5 | 暂存 |

请求参数保持现有约定：路径参数 `styleId` 必传；查询参数 `sourcePage` 必传；`imgId` 可选，不传时查询全部批次。

批次分组包含 `imgId`、`createTime`、`name`、`sourcePage`、`status` 和图片数组 `list`。图片数组仍使用 `id/originalUrl/previewUrl/thumbnailUrl/isAiCreate`。状态没有在 Swagger 中标为必填，缺失时应按未知状态处理，不能默认成等待中；值为 0 时应识别为有效状态。图片数组为空也可能是暂存等非成功状态，不代表批次不存在。

实际只读验证：`styleId=3&sourcePage=6` 返回 5 个批次，均有 `status`；批次 8、4 为 `2`（成功），批次 7、6、5 为 `5`（暂存），后三个批次的图片数组为空。`sourcePage=5` 返回成功、空数组。本次未创建任务或修改图片。

最新接口及响应结构快照：[swagger.json](./testing/image-result-status-2026-10-23/swagger.json)。

## 页面接入

模特图、动作图及共用批次结果组件已接入 `data[].status`：标题显示状态标签；无结果时按等待、生成中、完成但未返回图片、失败、取消、暂存分别提示。等待和生成中使用蓝色进度卡片与加载图标，元信息统一为紧凑的一行，支持换行与深色主题。部分结果已返回时继续展示图片和生成提示，不清空已有选图。

等待及生成中的批次每 5 秒刷新结果；保持当前款式、来源和批次，完成后停止更新。切换来源或款式时旧响应失效；页面隐藏、停用、上传或其他操作期间暂停更新。自动更新失败保留当前结果和选图，提示手动刷新，避免重复报错。

验证：类型检查、修改文件 ESLint、补丁空白检查通过。浏览器模拟分别在模特图与动作图页面触发“立即生成”，覆盖等待、生成中、部分图片、成功、失败、取消、暂存与缺失状态，验证选图保留、结束后停止更新、自动查询失败与恢复。另回归六种来源、批次筛选、上传、删除、旧响应失效。测试不写入真实任务。

记录：[浏览器脚本](./testing/image-result-status-2026-10-23/browser.mjs)、[结果](./testing/image-result-status-2026-10-23/result.json)、[模特图截图](./testing/image-result-status-2026-10-23/5-generating.png)、[动作图截图](./testing/image-result-status-2026-10-23/6-generating.png)。
