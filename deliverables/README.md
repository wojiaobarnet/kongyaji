# 東悍 donghan 完整交付包

三个压缩包分别用于直接部署、二次开发与部署交接。由用户请求保存到 GitHub。

- [网站部署包](donghan-website.zip)：前台、手机版、后台、Node 24 Linux x64、生产依赖、SQLite 迁移及安装脚本。
- [项目源码包](donghan-project.zip)：完整源码、镜像、资源、构建与验收脚本。
- [项目文档包](donghan-documents.zip)：PDF/Markdown、AI 交接说明、服务器资料及校验文件。

先读仓库 [AI 部署交接说明](../docs/给接手AI的部署说明.txt)。服务器 `159.75.67.132` 尚未部署，SSH 私钥需由用户另行提供。

网站部署包与项目源码包的 SHA256 见 [校验清单](../docs/SHA256SUMS.txt)。这些 ZIP 文件不包含 SSH 私钥、VPN 密钥、生产密码或本地验收数据。
