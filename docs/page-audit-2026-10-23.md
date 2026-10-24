# 页面审核弹窗

2026-10-23，页面审核参考修图审核重做，二者复用 `style-image-audit-modal.vue`。

- 页面审核列表点击“审核”直接打开弹窗，不进入工作台；原工作台审核入口也复用此弹窗。
- 顶部展示任务款号、服饰图，按款式折叠展示上一节点提交的图片，默认展开第一款。
- 商品主图按接口顺序展示，标注“主图1 / 主图2 / 面料3 / 主图4 / 搭配5”；详情页图另起一组，支持多图。图片定宽、高度自动，可预览原图。
- 材料区可滚动，审核意见和底部按钮保持可见；弹窗适配 1366×768 视口。
- 审核意见必填，最多 1000 字；附件最多 6 张。底部为“取消 / 驳回 / 通过”。
- 加载材料及提交前重新检查当前员工、节点和节点任务 ID。任务变化阻止审核，失败保留意见及附件，请求或上传期间阻止关闭和切换页面。

## 接口

- 材料：`GET /admin-api/flycowerp/newProductStyle/list?taskId=...`，读取 `productMainImageUrls`、`productDetailImageUrls`，支持数组、JSON 数组字符串及空值，保留 `imageId` 和三种图片地址。
- 审核：`POST /admin-api/flycowerp/flow/audit`，节点为 `pageProductionAudit`，携带当前 `procInstId/nodeTaskId/nodeKey` 及 `auditInfoVO`；通过为 `auditStatus=1`，驳回为 `2`。
- 只展示已提交页面制作图片，不使用草稿、AI 图片或精修图片填充空材料。

## 验证

- 页面审核与修图审核浏览器模拟回归均通过：直接打开弹窗、图片分组及主图顺序、原图预览、必填校验、通过/驳回、失败保留、节点变化拦截、缺失字段和加载失败重试、处理中导航保护及弹窗视口边界。
- 真实接口只读验证通过：当前任务 12（JJG64901）的 5 张主图和 5 张详情页图在弹窗显示，10 张图片地址与接口一致且实际加载解码成功。未执行真实通过、驳回或其他业务写入。
- 主应用类型检查、修改代码 ESLint、差异空白检查通过。

证据归档：`docs/testing/page-audit-2026-10-23/` 中的 `browser.mjs`、`result.json`、`audit.png`、`live-read.mjs`、`live-read-result.json`、`live-read.png`。共用测试脚本位于 `docs/testing/retouch-audit-2026-10-23/`，通过 `DRAWING_AUDIT_KIND=page` 切换页面审核。
