# AI图片生成（动作图）工作区

日期：2026-10-22。

## 问题及调整

动作图节点此前仍进入通用工作台的素材查看及手工图片页，未接入模特图节点已有的完整 AI 生图工作区。

- 两个生成节点现在共用工作区，按款式（颜色）折叠展示左侧素材池、右侧 AI 生图表单、下方全部批次及本款待提交图片。
- 动作图显示“立即生成（动作图）”和“本款待提交动作图”。支持模型、提示词、画质、尺寸、比例及生成数量，原图和参考图支持素材加入或本地上传，多图排序与移除。
- 动作图素材池额外展示当前款式已提交的模特图，可直接加入原图或参考图。通过现有 `queryMatchStyleList` 读取，按当前任务款式 ID 和款号精确匹配，不借用模糊查询的其他款式结果。
- 底部提供取消、整体保存、提交及驳回上一节点。保存不校验必填项，提交时再校验选图、备注和附件；失败保留当前内容。驳回沿用通用审核接口，写入前重新核对当前员工范围及节点任务。
- 冻结或不可处理的任务禁用写入，流程只读详情沿用原有入口。

## 接口与隔离

| 用途 | 约定 |
| --- | --- |
| AI 生成 | POST `/flycowerp/aiImg/save`，按当前款式传字符串 `styleId`、款号及生图参数 |
| 已提交模特图素材 | GET `/flycowerp/newProductStyle/queryMatchStyleList?styleNo=…`，取精确匹配款式的 `aiModelImageUrls` |
| 批次及历史图片 | 复用按款式查询接口，支持全部批次及跨批次选择 |
| 整体草稿 | `/flow/draft/save` 和 `/flow/draft/get` 使用当前 `nodeKey=aiImageActionTask`；草稿 `formType` 同为当前节点，禁止读取其他节点的表单结构 |
| 动作图提交 | POST `/newProductStyle/saveImageData`，`nodeKey=aiImageActionTask`、`items[].aiActionImageUrls` |
| 驳回 | POST `/flow/audit`，当前节点上下文、`auditStatus=2`、必填原因及附件 |

用户已明确确认：动作图与模特图一样，仅提交 `originalUrl/previewUrl/thumbnailUrl` 三个地址。最新 Swagger 仍将动作图定义为含 `imageId` 的 `TempImageBaseVO`，前端按用户确认执行，不将生成结果记录 ID 冒充图片标识；后端需同步该接口说明。审核及备注附件仍保留临时上传的 `imageId`。

当前批次查询接口只按款式提供数据，没有节点过滤字段，因此继续展示该款式的全部批次，不推断图片来自模特图还是动作图节点；由用户选择本次动作图提交内容。

## 验证

复用同一组浏览器用例分别测试模特图与动作图：

```powershell
$env:DRAWING_TEST_BASE_URL='http://127.0.0.1:5683'
$env:DRAWING_GENERATION_NODE='aiImageActionTask'
node docs/testing/model-generation-workspace-2026-10-22/browser.mjs
node docs/testing/model-generation-reject-2026-10-22/browser.mjs
```

- 动作图完整工作区、已提交模特图带入及款式精确匹配、AI 生成请求、多原图及参考图上传排序、跨批次选图、最终图本地上传、空表单整体保存和恢复、未展开款式保留、错误及不同节点草稿防覆盖、提交字段及三种地址、只读详情。
- 动作图普通员工（仅当前节点权限）的驳回原因、接口失败保留、节点变化保护、驳回中防重复及导航拦截、冻结和只读不可驳回。
- 模特图原有生成、草稿和提交回归；源码类型检查、ESLint、格式检查及生产构建。

动作图测试记录和截图位于 `docs/testing/action-generation-workspace-2026-10-22/` 及 `docs/testing/action-generation-reject-2026-10-22/`。均使用模拟接口，不创建真实生图任务或推进真实业务流程。
