# 修图审核：展示上一节点提交材料

## 前端调整

- 修图审核列表直接打开专用审核弹窗，工作台中的审核入口复用同一个弹窗。
- 展示任务款号、服饰缩略图，按款式折叠展示精修模特图和精修动作图，默认展开第一款。
- 图片支持预览原图；缺少图片时显示提示，不使用未提交草稿或原始 AI 图片替代。
- 审核意见必填，最多 1000 字；附件沿用上传组件，最多 6 张。底部直接提供取消、驳回、通过。
- 加载材料前和提交审核前均重新核验员工、流程节点和节点任务 ID。提交失败保留审核意见和附件，提交期间阻止关闭和页面切换。
- 关闭图片预览不会连带关闭审核弹窗。
- 页面审核改造后，两个审核入口共用 `style-image-audit-modal.vue`，根据节点切换材料字段和标题；修图审核继续读取精修模特图、精修动作图。相关说明见 `page-audit-2026-10-23.md`。

## 已确认的后端读取接口

2026-10-23 后端补齐返回字段后，重新检查最新 Swagger 和实际数据，读取依赖已解决：

- 写入接口 `POST /admin-api/flycowerp/newProductStyle/saveImageData` 的 `items` 支持 `retouchedModelImageUrls`、`retouchedActionImageUrls`，用于修图制作提交。
- 读取接口为 `GET /admin-api/flycowerp/newProductStyle/list?taskId=...`，`NewProductStyleSimpleRespVO` 已增加 `retouchedModelImageUrls`、`retouchedActionImageUrls`，图片结构为 `TempImageBaseVO`，含三个图片地址和字符串 `imageId`。
- 实际查询 taskId=12（JJG64901）和 taskId=13（JKG65460），均各返回 1 张精修模特图和 1 张精修动作图。
- taskId=3 两个字段均返回 `null`，前端按空图片列表处理。
- 修图审核直接使用该款式列表返回的精修图片，无需再从 `queryMatchStyleList` 查询。

前端已在款式列表读取中接入两个字段，支持图片对象数组及 JSON 数组字符串，沿用 `originalUrl / previewUrl / thumbnailUrl`。最新实际返回与现有字段解析、弹窗展示一致，无需变更映射。字段缺失与显式空数组使用不同提示；未获取到任何精修图片时，点击通过会提示刷新，不会直接通过。

`flow/draft/get` 为未提交草稿，不作为审核材料来源。

## 验证

浏览器模拟测试：`docs/testing/retouch-audit-2026-10-23/browser.mjs`，覆盖列表直接打开、按款式显示、原图预览、数组和 JSON 字符串解析、必填校验、通过/驳回、失败保留、节点变动阻止提交、加载失败重试、字段缺失提示和 1366×768 视口布局。所有写请求均模拟，不修改真实业务数据。

最新接口结构快照：`docs/testing/retouch-audit-2026-10-23/read-contract.json`。真实接口只读浏览器验证脚本：`live-read.mjs`，读取当前审核任务和款式列表，核验两类图片与接口地址一致且可加载，不执行通过、驳回或其他业务写入；证据保存到同目录的 `live-read-result.json`、`live-read.png`。

真实接口只读验证已通过：当前修图审核任务 12（JJG64901）的精修模特图、精修动作图均在弹窗正确显示，两张图片实际加载解码成功，无前端运行错误。

实际后端的修图制作驳回流转问题继续等待后端修复，详见 `retouching-reject-backend-issue-2026-10-23.md`，本次没有更改驳回接口约定。

验证结果：上述浏览器回归、`pnpm --filter @vben/web-antd typecheck`、本次四个代码文件的 ESLint 及 `git diff --check` 均通过。
