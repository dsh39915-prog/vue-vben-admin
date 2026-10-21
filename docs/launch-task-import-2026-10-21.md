# 上新任务 Excel 导入接入与联调（2026-10-21）

入口：上新管理 → 任务管理 → 导入任务（`/launch/tasks`）。按用户最新要求恢复 Excel 导入；手动新建仍不接入。

## 接口与页面

- `POST /admin-api/flycowerp/newProductTask/import`，multipart 参数 `file`；实际返回 `CommonResult<String>`，上传超时为 120 秒。
- 支持选择 `.xlsx/.xls`，拒绝空文件，点击“开始导入”后上传。失败保留文件并显示接口错误，允许重试；成功展示后端原始说明并刷新当前列表。
- 上传期间禁用文件选择、关闭和重复提交，并阻止站内路由切换；完成后禁止再次提交同一份文件，重新打开弹窗可选择下一份文件。
- 最新 Swagger 仍未声明 multipart 请求体、模板下载地址和表头规范。此次以真实上传确认 `file` 参数有效，未虚构模板下载入口。

## 使用实际模板验证

用户提供：`C:\Users\as225\Downloads\原始数据源（任务导入） - 20261021.xlsx`。工作表“开发明细表”，173 列表头，2 行实际业务数据。原文件 SHA256：`f0a701fc3d8ed77ad5e612cd3e42a7e26524611f15dae62c53af6082feeecd9e`。

原文件未修改、未整表上传。测试副本保留原模板结构，仅留一条样本，将 C2、D2 替换为唯一测试款号 `QAIMP26102146A589`；其余样本字段保持模板原值。该副本仍包含模板中的其他业务字段，仅置于本机临时目录，未纳入仓库。实际上传副本 SHA256：`d35495f4fbf07f174d6278dd8d4e090b380e63c99e0c9daf9469f49e38ce0ac1`。

实测环境 `http://192.168.0.140:48080`，接口响应：

```json
{"code":0,"msg":"","data":"导入成功，导入1条数据"}
```

分页和详情回读确认生成 1 条任务，ID 为 6，流程状态 0，未启动流程。前一次排查还生成测试 ID 5。两条测试任务均已执行删除，详情返回 `data: null`；但分页仍返回这两条已删数据，见下列问题。没有启用真实业务流程。

证据：[成功导入与回读](./testing/launch-import-2026-10-21/live-exact-template-result.json)、[导入原始响应](./testing/launch-import-2026-10-21/live-import-response.json)、[删除后回读](./testing/launch-import-2026-10-21/live-post-cleanup-readback.json)。证据中的 `fixture` 描述仓库内重建样本；成功请求实际使用保留原模板结构的临时副本，以本节上传哈希为准。

## 后端待修复问题

### 1. 按款号筛选返回系统异常

请求 `POST /admin-api/flycowerp/newProductTask/page`：

```json
{"pageNo":1,"pageSize":200,"styleNo":"QAIMP26102146A589"}
```

HTTP 200，但业务返回 `{"code":500,"msg":"系统异常","data":null}`。去掉 `styleNo` 后分页成功。会影响用户按款号查询刚导入的任务；根因需后端排查。测试脚本通过无筛选分页及详情回读查找测试记录。

### 2. 删除成功后分页仍返回已删除任务

`DELETE /admin-api/flycowerp/newProductTask/delete/5` 和 `/delete/6` 均返回 `code: 0, data: true`；随后 `GET /get/5`、`GET /get/6` 均返回 `code: 0, data: null`。无筛选分页仍包含 ID 5、6，`total` 也未排除；不同分页大小 10/100/200 均可观察到。会造成导入清理后列表残留，需后端统一分页和详情的删除过滤逻辑。测试记录仅确认逻辑删除，未声称数据库物理删除。

## 前端回归与复现脚本

浏览器模拟覆盖文件校验、multipart 文件字节与认证、失败重试、上传中关闭/导航保护、成功说明与刷新、缺失说明警告、重复提交保护及重新打开重置。已通过，无运行时错误，见[浏览器结果](./testing/launch-import-2026-10-21/browser-result.json)。类型检查、变更文件 ESLint 和格式检查通过，主应用生产打包通过。

```powershell
$env:DRAWING_TEST_BASE_URL='http://127.0.0.1:5670'
node docs/testing/launch-import-2026-10-21/browser.mjs
```

仓库内 `fixtures/single-qa-task.xlsx` 仅包含人工重建表头和测试字段，用于前端上传回归；该重建文件真实导入曾返回系统异常，不应作为后端成功样本或正式模板。失败证据保留在 `live-result.json`。后端对模板其他结构或业务字段的要求尚未明确，不据此推断具体原因。

`live.mjs` 仅在显式传入 `--execute` 时操作后端。再次正向验证需要设置 `LAUNCH_IMPORT_FIXTURE` 指向按原模板制作的隔离测试副本，并设置 `LAUNCH_IMPORT_EXACT_TEMPLATE=1`；脚本按唯一测试款号回读和清理，不上传原始整表。`--cleanup-only` 只清理该测试款号。当前验证已经完成，无需重复导入。
