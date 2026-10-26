# 每日岛屿版本命名

## 公开版本

公开仓库 `KarenSeven97/daily-island` 使用 `V主版本.次版本`：

- 当前正式版本：`V1.0`
- 兼容现有数据和主要使用方式的小功能：依次使用 `V1.1`、`V1.2`、`V1.3`
- 明显改变主要体验、数据结构或产品阶段的大版本：使用 `V2.0`、`V3.0`
- 每次公开发布同时更新根目录 `VERSION`、README、GitHub Release 和离线缓存版本

## 私有开发版本

私有仓库 `KarenSeven97/my-first-web` 的开发分支、开发快照和提交标题使用：

`DI-新增功能-YYYYMMDD-HHmmss`

规则：

- `DI` 固定大写，代表 Daily Island
- `新增功能` 使用简短、可识别的名称，不使用空格
- 时间使用北京时间，精确到秒
- 示例：`DI-自动更新-20261026-214914`
- 同一功能的后续更新创建新的时间版本，不复用旧名称

## 发布流程

1. 从 private `main` 创建符合上述规则的开发分支。
2. 在 private 完成功能、测试和构建，再合并回 private `main`。
3. 确定公开版本号，将通过检查的 private 内容同步到 public。
4. 更新 public 的 `VERSION`、README 和 GitHub Release；推送 public `main` 后由 GitHub Pages 自动部署。
5. private 只执行检查，不负责公开网站部署。

