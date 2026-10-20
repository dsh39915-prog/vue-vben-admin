# 制图流程测试归档

报告：[制图流程测试与问题归档](../../drawing-workflow-test-2026-10-20.md)。机器问题单见 [issues.json](./issues.json)，结果统计见 [evidence/summary.json](./evidence/summary.json)。

本目录保存本轮真实只读响应、Swagger、浏览器模拟回归请求、日志、截图及复测脚本。不含登录令牌，浏览器账号/图片/授权数据为合成测试数据。真实响应仅用于内部联调归档。

## 运行

在项目根目录执行，要求已安装项目依赖、Playwright 及本机 Chrome，并运行 `@vben/web-antd` 开发服务。默认地址 `http://127.0.0.1:5666`，可用 `DRAWING_TEST_BASE_URL` 覆盖。

```powershell
node docs/testing/drawing-2026-10-20/scripts/run-browser.mjs
```

执行9组浏览器回归，每组结果写入 evidence/*.txt，汇总写入 browser-rerun.json。包括确认已知缺陷的断言；缺陷修复后需调整对应期望。所有业务写请求均由 Playwright 拦截，不发送到真实后端。

真实只读复测须显式提供环境变量 `DRAWING_TEST_TOKEN`，可选 `DRAWING_API_BASE` 覆盖默认测试服务：

```powershell
node docs/testing/drawing-2026-10-20/scripts/live-readonly.mjs
node docs/testing/drawing-2026-10-20/scripts/live-supplement.mjs
node docs/testing/drawing-2026-10-20/scripts/live-filters.mjs
```

这些脚本覆盖同名证据文件，保留历史归档时请先复制目录。live-readonly 只执行查询接口，POST 仅用于分页查询；live-supplement 对已保存的两张搭配原图发 HEAD；不会发起流程变更或AI生成。真实响应可能随服务和数据变更，空列表或样本缺失不能作为业务通过依据。

## 证据

| 文件 | 内容 |
| --- | --- |
| live-readonly.json / swagger.json | 本轮37次基础只读请求及70路径接口快照 |
| live-supplement.json | 管理员处理人筛选对照、两张已有图片HEAD结果 |
| live-filters.json | 14项有效但不匹配的筛选，11项符合预期、3项异常 |
| all-nodes.json | 15节点页面动作及请求；刷新丢失未保存内容的断言 |
| state-and-errors.json | 冻结/解冻、6类审核驳回、失败保留输入、第16节点缺口 |
| live-replay.json | 真实接口响应在前端回放的请求记录 |
| *.txt | 本轮9组浏览器回归输出 |
| unsaved-before.png / unsaved-after.png | 制作页刷新前后 |
| live-flow-error.png | 真实流转记录错误响应回放 |
| live-model-no-material.png | 真实模特生成节点基础资料和空图片区 |
| material-prepare-no-action.png | 第16节点缺少处理动作（模拟任务） |

material-fixture.mjs 内嵌最小ZIP测试字节，仅用于验证下载传输；不能据此认为真实素材包目录和内容已经验收。普通员工隔离、职责授权和批量转派均以模拟后端验证前端行为，不等于服务端权限测试。
