# 東悍 Ubuntu 部署与升级

当前已部署：前台 `http://159.75.67.132/donghan/`，后台 `/donghan/uguest/`，健康检查 `/donghan/healthz`。Node 24.21.0，回环端口 8010，服务 `donghan.service`。

## 已有服务器升级

从最新 main 源码在独立目录构建并检查，提供 `dist/`、`worker/`、`server/`、`drizzle/`、生产依赖 `node_modules/`、`package.json` 和 `deploy/`，执行：

```bash
sudo bash deploy/update.sh
```

脚本要求已有安装；备份 SQLite 和服务配置，创建新发布，切换 current、重启并检查健康状态，失败恢复旧发布。它保留 PUBLIC_URL、BASE_PATH、ADMIN_PATH、nginx 路由和账号。不可从运行中的 current 目录升级。

当前环境：`PUBLIC_URL=http://159.75.67.132`，`BASE_PATH=/donghan`，`ADMIN_PATH=/uguest`。新后台资源和跳转都映射到 uguest；旧 `/donghan/admin/` 为 404，API 仍在 `/donghan/api/admin/` 且必须登录。

## 首次独立 Host 安装

`install.sh <域名> <回环端口>` 为全新独立 Host 安装。准备 nginx、curl、Python 3、www-data 用户、Node 24 和完整构建包后运行。默认网站位于根路径，后台为 /admin/。不要用这个默认模式覆盖现有 IP 的 /donghan/ 部署。

该脚本保留已有默认站点，新增虚拟主机使用 zz-donghan 启用名；首次安装的软链接回滚和重载后等待已修正。数据库迁移不自动撤销，迁移只能兼容追加。

## 数据、备份与验证

数据 `/var/lib/donghan`，数据库 content.sqlite，图片 uploads/，管理员配置 admin.json。初始账号 admin，随机密码在 initial-login.txt（600 权限），不提交到 GitHub。密码修改后初始文件删除，旧会话失效。

```bash
sudo systemctl status donghan --no-pager
sudo nginx -t
curl -fsS http://127.0.0.1:8010/donghan/healthz
sudo journalctl -u donghan -n 80 --no-pager
```

每次升级验证实际前台、手机端、后台登录和预览、图片及留言，并检查原有网站。当前 HTTP，HTTPS 未配置；修改协议时同步 PUBLIC_URL。

每次代码修改同时更新完整项目 Markdown/PDF、部署交接、CHANGELOG 和 GitHub，详见 AGENTS.md。完整参数、目录及恢复说明见 `docs/项目文档.md`。
