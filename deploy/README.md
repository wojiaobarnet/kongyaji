# 東悍 Ubuntu 部署

安装包包含网站静态资源、Node 24 运行时、数据库迁移、后台服务和依赖。私钥、后台密码和本地验收数据均不在包内。

解压后执行：

```bash
sudo bash deploy/install.sh donghan.159-75-67-132.sslip.io 8010
```

脚本仅新增 `/var/www/donghan`、`/var/lib/donghan`、`donghan.service` 和独立 nginx 虚拟主机；不会替换 IP 默认站点。部署前仍应检查服务器现有 nginx 配置、域名和端口。使用独立 Host 在现有 80 端口提供服务，不占用现有 8000、8001。

站点：`http://donghan.159-75-67-132.sslip.io/`；后台：`/admin/`。该主机名自动指向服务器 IP，可改成已有域名并设置 A 记录。仅使用已授权或临时访问域名。

首次安装生成 `admin` 账号和随机初始密码，保存在服务器 `/var/lib/donghan/initial-login.txt`（600 权限）。用 `sudo cat` 在自己的终端读取。后台右上角支持修改密码，修改后删除初始密码文件并使旧登录失效。账号哈希、SQLite 数据库与上传图片保存在 `/var/lib/donghan`，升级时保留。

若将访问域名配置为 HTTPS，需要同时把 systemd 服务中的 `PUBLIC_URL` 更新为 HTTPS，重启 `donghan.service` 后登录 Cookie 会启用 Secure。管理员认证使用密码散列、签名 Cookie 和登录限流。

常用命令：

```bash
sudo systemctl status donghan
sudo journalctl -u donghan -n 80 --no-pager
sudo nginx -t
```

发布采用带时间戳的目录和 `current` 软链接；安装前保留本站 nginx、systemd 和数据库备份。验证失败会恢复服务与 nginx 配置。数据库迁移只增加列和索引，保留已有内容。
