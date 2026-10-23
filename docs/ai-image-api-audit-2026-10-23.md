# AI 图片生成接口复核（2026-10-23）

来源：`http://192.168.0.140:48080/v3/api-docs/flycowerp`，并只读检查测试服务列表、详情和款号查询。

## 接口清单

| 方法 | 路径 | 核对结果 |
| --- | --- | --- |
| POST | `/admin-api/flycowerp/aiImg/save` | 已接入，参数字段与当前表单一致 |
| POST | `/admin-api/flycowerp/aiImg/update` | 已接入，与保存共用请求类型，修改携带记录 ID |
| POST | `/admin-api/flycowerp/aiImg/page` | 已接入，分页读取 `records/total`，款号筛选传 `styleNo` |
| GET | `/admin-api/flycowerp/aiImg/details/{id}` | 已接入，读取最新响应字段 |

## 关键字段

- 款号统一为 `styleNo`，保存、修改、查询、列表、结果页及结果弹窗均已切换；不再依赖 `goodsCode/styleNumber`。
- 来源统一为 `sourcePage`：0 单图、1 批量、3 线稿、4 材质增强、5 模特图、6 动作图。请求不再传 `imgType`。
- 保存、修改支持 `styleId`；最新列表及详情响应未提供此字段，模特图和动作图生成使用当前流程款式的 ID 和款号。
- 原图使用 `originalImg/previewOriginalImg/smallOriginalImg`；参考图使用 `referenceImg/previewReferenceImg/smallReferenceImg`。上传后保留三种地址，多图按相同顺序序列化。
- 返回的 `results` 使用 `originalUrl/previewUrl/thumbnailUrl`，保留结果 ID、任务 ID、槽位及历史版本信息。
- 保存请求文档还包含 `generatedImg/smallGeneratedImg/createTime/updateTime/operatorId/createUserId`；当前生成表单不人工填写生成结果或这些审计字段，未增加输入控件。

本次最新 Swagger 与此前已完成的款号及来源字段改造一致，未发现需要继续修改页面或调用方式的新差异。

## 实际只读检查

- POST `/page` 返回 `code=0`，当前总数 16；响应包含 `styleNo`、`sourcePage` 和六个原图/参考图地址字段。
- GET `/details/16` 返回 `code=0`，字段与最新 `AiImgRespVO` 一致；款号为空时按现有空值逻辑处理。
- 样本 `results` 返回三种图片地址、结果/任务/生图 ID、槽位、尺寸、版本及时间字段。
- 使用不存在的款号 `CODEX-NO-IMAGE-20261023` 查询，返回 `code=0`、总数 0。
- 本次未调用真实保存或修改接口，未新增或变更业务数据；没有代码变更，因此未重复运行前轮已通过的浏览器和类型检查。
