# 生图接口按款式关联更新

日期：2026-10-22。核对来源：`http://192.168.0.140:48080/v3/api-docs/flycowerp`。

## 契约变化

- `POST /flycowerp/aiImg/save` 和 `/update` 共用 `AiImgSaveReqVO`，已移除 `businessKey`，增加字符串 `styleId`（款式 ID）。
- 结果查询改为 `GET /flycowerp/aiImageResult/list/{styleId}[/{imgId}]`；批次下拉改为 `GET /flycowerp/aiImageResult/dropdown/{styleId}`。
- 本地结果保存 `POST /flycowerp/aiImageResult/save` 同样使用 `styleId`，继续携带 `imgId` 和三种图片地址。
- `save/update` 响应仍为通用对象，没有新增可依赖的具体返回字段。

## 页面更新

- 模特图工作区使用当前颜色款式的真实 ID 生图、暂存、查询批次和结果，不再使用任务 ID；字符串传递款式 ID，保留大整数精度。
- 独立生图弹窗的“流程任务标识”改为“款式 ID”；生成结果页改为“按款式查询”，路由参数改为 `styleId`。旧 `businessKey` 查询参数不再当成款式 ID 使用。
- 通用工作台的生成结果标签增加款式选择，覆盖动作图节点及只读详情，防止继续把任务 ID 传给款式查询接口。
- 本地结果上传保留批次选择，同时传入当前款式 ID。
- 流程节点明细等真正仍使用 `businessKey` 的独立接口保持其原有契约。

## 后端待同步

`AiImgRespVO` 尚未声明 `styleId`，需要同步列表/详情的响应说明及实际字段，保证再次编辑时能回显关联。节点过滤、已提交模特图回读仍见 `model-generation-workspace-2026-10-22.md`。未提交选图与右侧生图参数已改用通用流程草稿接口整体保存、恢复。

## 验证

使用模拟接口浏览器验证生图/暂存均传当前款式 ID、不再发送 `businessKey`，颜色批次与结果隔离，跨批次选图，指定款式及批次上传本地结果，只读工作台切换款式，独立生图弹窗及按款式查询入口；没有触发真实生图或业务流转。

验证脚本与请求记录：`docs/testing/model-generation-workspace-2026-10-22/`。
