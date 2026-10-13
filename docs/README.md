# 東悍 donghan 项目文档

部署前请依次阅读：

1. [给接手 AI 的部署说明](给接手AI的部署说明.txt)
2. [完整项目文档](项目文档.md) 或 [PDF 版](项目文档.pdf)
3. [Ubuntu 安装说明](../deploy/README.md) 与 [安装脚本](../deploy/install.sh)

原交付包的源码基线为 `732bdfbf8697243addc449e5e6b760edfde8c117`。GitHub 初始化提交另补充了本目录、首页文档导航与忽略规则，应用功能保持一致。

三份交付压缩包见本仓库 [交付下载目录](../deliverables/README.md)，[Releases](https://github.com/wojiaobarnet/kongyaji/releases) 也提供对应下载链接。`SHA256SUMS.txt` 核对其中的网站部署包和完整源码包。

目标服务器 `159.75.67.132` 尚未部署。文件不包含 SSH 私钥、VPN 密钥、生产密码或本地验收数据。部署人员需从用户另行取得 `waxiang1.pem`，使用支持正常 SSH 的运行环境。
