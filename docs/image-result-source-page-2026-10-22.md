# AI 图片生成结果接口更新

日期：2026-10-22。依据测试环境最新 Swagger：`http://192.168.0.140:48080/v3/api-docs/flycowerp`。

2026-10-23 补充：`list/{styleId}` 的批次分组返回值新增 `status`，枚举为 0=等待中、1=生成中、2=成功、3=失败、4=已取消、5=暂存。字段位置、请求约定和实际响应核对见[批次任务状态](./image-result-status-2026-10-23.md)。

- `GET /admin-api/flycowerp/aiImageResult/dropdown/{styleId}`：查询参数新增必传 `sourcePage`。
- `GET /admin-api/flycowerp/aiImageResult/list/{styleId}`：查询参数必传 `sourcePage`；可选 `imgId` 改为查询参数，不再拼接在路径末尾。全部批次不传 `imgId`。
- 批次及结果分组返回值增加 `sourcePage`，补齐类型并展示分组来源。保存类型补充可选 `creator`、`updater`，页面沿用服务端记录操作人的方式。
- 模特图和动作图工作区分别固定传来源 5、6。通用按款式查图及任务款式结果提供六种来源切换，默认单图生成（0）。
- 切换来源重新加载批次并选择全部批次；上传、删除及刷新保留当前来源和有效批次。旧来源的迟到响应不会覆盖新来源的结果。
- 保存指定 `styleId`、`imgId` 和三个图片地址；2026-10-23 最新接口增加 `styleNo`、`sourcePage`，上传时一并提交。模特图、动作图和任务款式结果自动带入已选款式的款号，独立结果查询页可在上传弹窗填写款号（Swagger 未标必填）。来源取已查询结果的来源，切换来源后保持一致。删除仍以 `code=0` 判断成功。两个历史查询接口、单图重新生成及材质增强接口继续沿用原契约。

验证：图片结果模块浏览器模拟回归通过，覆盖六种来源、全部及指定批次、上传、删除返回 `data=false`、来源快速切换、空批次下拉、失败刷新恢复；另回归普通生图及模特图/动作图工作区来源参数。类型检查、修改文件 ESLint、差异空白检查通过，未写入真实业务数据。

脚本及结果：`docs/testing/image-result-source-page-2026-10-22/`；流程生图回归：`docs/testing/image-source-page-2026-10-22/browser.mjs`。

2026-10-23 上传参数补充：最新保存请求定义见 `docs/testing/image-result-upload-2026-10-23/upload-contract.json`。独立结果页回归断言上传时提交 `styleNo` 和当前 `sourcePage`；模特图、动作图上传回归位于 `docs/testing/image-result-upload-2026-10-23/`，覆盖自动带入款号、来源 5/6、完整款式 ID、批次及三种图片地址、保存失败复用上传地址重试。写入均使用模拟接口。
