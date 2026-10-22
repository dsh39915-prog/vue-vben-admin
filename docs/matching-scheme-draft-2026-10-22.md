# AI搭配方案通用流程草稿

日期：2026-10-22。

- “AI搭配方案提交”中的“保存方案”改为 `POST /admin-api/flycowerp/flow/draft/save`，传 `procInstId/nodeTaskId/nodeKey/formDataJson`，`nodeKey=aiMatchingOutput`。成功返回草稿 ID，以业务 `code=0` 为准。
- 打开可编辑输出节点时通过 `GET /admin-api/flycowerp/flow/draft/get`（`procInstId/nodeKey`）恢复草稿；无草稿时沿用已保存方案和表格款式初始化。
- JSON 包含 `version:1`、`formType:"aiMatchingOutput"`、全部 `schemes` 以及 `remarkInfoVO`。保留各方案素材、辅服饰、合拍标记、备注原始文字与附件。主服饰继续从当前表格款式带出，保持唯一且不可编辑。
- 保存不做必填、图片完整性或数量校验，不调用搭配方案业务保存接口、不推进流程。提交方案仍校验完整性并调用 `/flycowerp/aiMatchingScheme/save`，`status=1`。
- 保存失败保留输入；草稿读取或解析失败禁止用空表单覆盖，支持重新加载。只读查看不加载未提交草稿。
- 保留保存前核验节点归属、状态及节点任务 ID 的机制；保存、上传和选图期间阻止弹窗关闭和页面切换。

验证使用模拟接口浏览器回归，涵盖空必填方案保存、提交拦截、关闭重开恢复素材/辅服饰/合拍标记/备注/附件、失败保留、保存及提交期间关闭保护、节点变化阻止写入、异常草稿恢复、冻结只读及权限范围复核。未写入真实流程或验证后端落库。

脚本及请求记录：`docs/testing/matching-scheme-draft-2026-10-22/`。另执行主应用类型检查、修改文件 ESLint/格式检查、生产构建及补丁空白检查。
