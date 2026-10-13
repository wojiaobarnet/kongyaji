# 東悍 donghan 交付文件

## 最新版本

最新完整源码和项目文档以仓库 `main` 分支为准：[下载当前分支源码 ZIP](https://github.com/wojiaobarnet/kongyaji/archive/refs/heads/main.zip)。

当前前台 http://159.75.67.132/donghan/ ，后台 /donghan/uguest/ 。[完整项目文档](../docs/项目文档.md) · [PDF](../docs/项目文档.pdf) · [升级说明](../deploy/README.md) · [修改记录](../docs/CHANGELOG.md)。

## 初始交付快照

以下 ZIP 对应初始交付，保留用于恢复、对照和历史记录，**不对应当前生产版本**：

- [网站快照](donghan-website.zip)：原始根路径部署包、Linux x64 Node 24 和生产依赖。
- [源码快照](donghan-project.zip)：初始完整镜像、源码、构建与验收脚本。
- [文档快照](donghan-documents.zip)：初始 PDF/Markdown 和尚未部署时的交接状态。

这些快照的校验见 [SHA256 清单](../docs/SHA256SUMS.txt)，只用于核对旧包。升级当前服务器必须使用最新源码和 update.sh，保留 /var/lib/donghan 与现有路由。所有包均不包含 SSH 私钥、生产密码或用户持久数据。
