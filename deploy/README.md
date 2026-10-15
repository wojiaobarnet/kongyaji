# 東悍 Linux / 宝塔部署与升级

当前主站为 `http://43.128.69.6/donghan/`，后台 `/donghan/uguest/`。2026-10-15 已从旧服务器迁入腾讯云宝塔 Linux 面板 11.8，实际系统 OpenCloudOS 9.6 x86_64；宝塔 Nginx 1.30.6，Node 24.21.0，SQLite 与本地文件存储。网站不依赖 PHP 或数据库服务插件。

## 当前配置

- 服务 `donghan.service`，用户 `donghan:donghan`，后端只监听 `127.0.0.1:8010`。
- `PUBLIC_URL=http://43.128.69.6`、`BASE_PATH=/donghan`、`ADMIN_PATH=/uguest`。
- 程序 `/var/www/donghan/current`，持久数据 `/var/lib/donghan`。
- 宝塔网站列表登记 `43.128.69.6`（ID 1）；占位根目录 `/www/wwwroot/donghan`。实际程序由 systemd 管理，不能把占位根目录当成完整源码。
- 代理 `/www/server/panel/vhost/nginx/43.128.69.6.conf`；二进制 `/www/server/nginx/sbin/nginx`；访问日志 `/www/wwwlogs/43.128.69.6.log`。
- HTTP 根路径跳转 `/donghan/`，根 robots 精确代理至子站。新机不开放 8088。当前尚未配置 HTTPS。

旧服务器 `159.75.67.132` 的東悍项目已于 2026-10-15 按所有者要求退役，项目文件、数据、专属 Node、服务、代理与 8088 监听已移除；其它网站保留。后续维护只使用新后台。

## 宝塔首次迁移

先检查已有站点、端口和文件，不能覆盖别人的 vhost。安装宝塔官方 Nginx；本次使用官方 `https://download.bt.cn/install/1/nginx.sh` 的 `install 1.30`，实际安装到 1.30.6。版本以安装后的二进制核验为准，不要重复安装或无条件覆盖已有 Nginx。

Node 24.21.0 Linux x64 包与官方校验文件匹配，SHA256 为 `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6`；路径 `/opt/donghan/node-24.21.0/bin/node`。

从 GitHub main 构建：`npm ci`、`npm run build`、`npm run check`。迁移包需要 `dist/`、`worker/`、`server/`、`drizzle/`、生产 `node_modules/`、`package.json`、`deploy/` 和文档。若要在目标机器运行隔离验收，还需 `scripts/`、`assets/replica.js` 与 `source/desktop/public/images/logo.png` 测试资源。

旧站运行中 SQLite 用 `server/backup.mjs` 创建一致性备份。管理员配置、数据库、initial-login.txt（若仍存在）及 uploads 只通过私有 SSH 传输，保留权限，不能进入 GitHub、公开包或日志。迁移时的旧站快照已随旧机项目删除；新机私有暂存 `/var/lib/donghan-migration-20261015` 保留。清理前旧项目完整恢复归档已离机保存到新服务器 `/var/backups/donghan-retired-159.75.67.132-20261015/recovery.tar.gz`，目录 700、文件 600，并验证 SHA256、压缩归档及必要成员。

先通过已安装面板的本地 AddSite API 登记站点，再安装程序：

```bash
cd /www/server/panel
/www/server/panel/pyenv/bin/python3 /path/to/package/deploy/register-baota-site.py --host 43.128.69.6
cd /path/to/package
bash deploy/install-baota.sh /private/migration-snapshot 43.128.69.6 8010
```

注册脚本不修改面板登录信息，不启用 FTP、MySQL 或 Git 自动部署。安装脚本保存该站初始 nginx 配置，保留管理员配置，创建专用用户与 systemd 服务，健康后再重载代理；失败恢复原配置并保留恢复资料。不能在已有 Donghan 服务上重复运行首次安装。

## 已有服务器升级

在独立目录构建、验收、打包后执行：

```bash
sudo bash deploy/update.sh
```

脚本备份 SQLite 和服务配置，创建新 release、切换 current、重启检查，失败切回旧版本。它保留 PUBLIC_URL、BASE_PATH、ADMIN_PATH、nginx、账号和持久数据。不得在 current 目录直接执行，不得删除 `/var/lib/donghan`。数据库只追加兼容迁移。

`install.sh` 与 `configure-robots.py` 是旧 Ubuntu 独立 Host / 旧主站配置的辅助脚本，不适用于当前宝塔首次迁移。不要把 `/etc/nginx/sites-enabled/stool-shop` 复制到宝塔。

## 验证与维护

```bash
sudo systemctl status donghan --no-pager
sudo systemctl is-enabled donghan
sudo /www/server/nginx/sbin/nginx -t
curl -fsS http://127.0.0.1:8010/donghan/healthz
sudo journalctl -u donghan -n 80 --no-pager
cat /var/www/donghan/current/REVISION
```

验收前台、手机版、后台、预览、图片与留言；业务写入测试只用临时 DATA_ROOT。`npm run test:seo` 验证规范网址、JSON-LD、动态地图、草稿隔离和 noindex；`node scripts/uguest-qa.mjs` 验证认证、发布、图片和持久化。生产验证原密码登录、数据完整性、根 robots、187 个地图页面及新 IP canonical。

每次修改同步源码、完整项目 Markdown/PDF、部署交接、CHANGELOG 与 GitHub，并将同一提交号记录到服务器 REVISION。详细记录见 `docs/宝塔迁移说明.md`，内容策略见 `docs/SEO-GEO.md`。

## 每次更新的完成标准

所有更新必须同时写 CHANGELOG、更新项目 Markdown/PDF 及 docs/操作手册.md，再将本次相关文件部署到 43.128.69.6 和同步 GitHub。手册步骤不变也记录已核对；纯文档变更校验文档及运行代码哈希，不重复无关测试。使用可恢复 release，保留持久数据。

验收线上行为、文件 SHA256 与 current/REVISION 后，向 /var/www/donghan/deployment-log.jsonl 追加脱敏记录（时间、目标、提交、发布、文件、验证、旧版本/备份），权限 600、位于网站资源目录之外。记录实际结果，失败或只完成部分同步必须说明。后台内容已发布到生产数据库的，验证前台并补齐记录，不把数据库、留言或密码推送 GitHub。具体执行步骤见操作手册第 6 节。

## SEO 每日任务与持久数据

部署包含 SEO 中心的新 release 后，以 root 执行 `bash /var/www/donghan/current/deploy/install-seo.sh`，再用 `systemctl start donghan-seo.service` 完成首次实际检查。安装器备份旧计划配置并验证 unit；每日北京时间 03:30，Persistent=true 补跑。用 `systemctl list-timers donghan-seo.timer`、`systemctl show donghan-seo.service -p Result -p ExecMainStatus` 和后台 SEO 中心核对实际结果。后台读取 systemd 实时状态，不能只看配置文件声称已运行。

访问聚合、检查、动作和自动元数据在 /var/lib/donghan/seo.sqlite，属于运行数据，不能提交 GitHub。新版 server/backup.mjs 同时一致性备份 content.sqlite 和存在的 seo.sqlite；另保留管理员配置、uploads 和 timer/service 配置。更新切换前停止正在执行的 SEO oneshot，保留 timer；新旧版本切换仍须检查任务兼容。回退到不含 SEO 的旧版时先停止并禁用 donghan-seo.timer，保留运行数据库，不能用旧空快照覆盖生产数据。详细恢复边界见 docs/SEO自动运维.md。

每天的检查、按需元数据优化及日志在服务器私有运行库持续记录；不持有 GitHub 凭证，不把访问数据推送仓库。源码、策略、界面或配置变更仍执行本项目每次更新的文档与服务器/GitHub 同步要求。
