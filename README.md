# 東悍 donghan 网站与内容管理后台

网站当前部署在 43.128.69.6 的宝塔 Linux 面板服务器，使用 OpenCloudOS 9.6、宝塔 Nginx 1.30.6 和 Node 24.21.0。前台、手机版、后台、SQLite 与图片存储正常运行。

- **前台：** http://43.128.69.6/donghan/
- **手机版：** http://43.128.69.6/donghan/mobile/
- **选型指南：** http://43.128.69.6/donghan/guide/ 。[SEO/GEO 说明](docs/SEO-GEO.md) · [网站地图](http://43.128.69.6/donghan/sitemap.xml)。
- **后台：** http://43.128.69.6/donghan/uguest/ 。账号 `admin`，初始密码仅保存在服务器私有文件中。
- **项目文档：** [Markdown](docs/项目文档.md) · [PDF](docs/项目文档.pdf) · [修改记录](docs/CHANGELOG.md) · [操作手册](docs/操作手册.md)。
- **接手与升级：** [部署交接](docs/给接手AI的部署说明.txt) · [部署说明](deploy/README.md)。
- **最新完整源码：** [下载 main 分支](https://github.com/wojiaobarnet/kongyaji/archive/refs/heads/main.zip)。[历史交付包](deliverables/README.md) 是初始快照。

新 IP 根路径自动跳转到 `/donghan/`；`/donghan/admin/` 返回 404。新服务器不开放 8088，后端 8010 仅监听回环地址。2026-10-15 按所有者要求清理旧服务器 159.75.67.132 的東悍项目、数据及专属配置，保留其它网站；后续编辑仅使用新后台，恢复归档私下存放新机。当前为 HTTP。

## 构建与维护

```bash
npm ci
npm run build
npm run check
node scripts/server-qa.mjs
node scripts/mount-qa.mjs
node scripts/uguest-qa.mjs
npm run test:seo
```

构建需要 Python 3 与 Node 22.13+；运行 Linux 独立后端使用 Node 24。当前服务配置为 `PUBLIC_URL=http://43.128.69.6`、`BASE_PATH=/donghan`、`ADMIN_PATH=/uguest`。

现有服务器升级：在独立的已构建完整包目录执行 `sudo bash deploy/update.sh`。保留 `/var/lib/donghan`，保留既有 nginx 和上述环境配置；不要使用默认首次安装脚本覆盖现有路由。

宝塔首次迁移见 [宝塔部署说明](deploy/README.md) 和 [迁移记录](docs/宝塔迁移说明.md)。每次更新必须写变更日志、更新项目 Markdown/PDF 和操作手册，并把相关变动同步到主服务器及 GitHub，核对线上版本后才算完成；维护要求见 [AGENTS.md](AGENTS.md)。

## 原始镜像与开发说明


完整保留原站可公开访问的电脑及手机页面、原始布局、产品详情、新闻正文、案例、服务、联系资料、分页、图片和轮播交互。快照来源为 `http://www.kaishansales.com/` 与 `http://m.kaishansales.com/`；主域名首页与 www 首页相同。

- 电脑端：`/`
- 手机端：`/mobile/`，小屏设备访问电脑页面时自动跳转至相应手机页面。
- 强制电脑端：`/?view=desktop`；页尾提供电脑/手机版切换。
- 389 个原站页面、324 个资源文件（详见 `replica-inventory.json`）。
- 购买咨询：`/consultation/` 与 `/mobile/listinfo-6-0.html`，独立接口 `/api/inquiries` 将留言保存到复刻站的 Cloudflare D1 数据库。

## 托管版的本机开发

需要 Node.js 22.13+、Python 3、npm。

```bash
npm ci
npm run build
npm run db:local
cp .dev.vars.example .dev.vars
npm run preview
```

打开命令打印的本地地址。`db:local` 只迁移本机开发数据库，生产数据库由 Sites 在部署时迁移。生产网站默认仅所有者可访问。

```bash
npm run check
```

检查全部生成页面、站内链接、样式图片依赖和脚本语法。

浏览器验收脚本使用已有的 Playwright 和 Chromium：

```bash
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROMIUM_PATH=/absolute/path/to/chromium node scripts/browser-qa.mjs
```

先启动 `npm run preview -- --port 4173`。脚本会检查电脑轮播、下拉导航、产品图片、新闻分页、手机自动跳转、侧边菜单、微信弹窗及两端留言保存；只向本机数据库写入验收数据，不向原站提交。

## 文件结构与修改

| 路径 | 内容 |
| --- | --- |
| `source/desktop/` | 电脑站原始 HTML、CSS、JS 和图片快照 |
| `source/mobile/` | 手机站原始页面及独立样式和脚本 |
| `source/snapshot-manifest.json` | 可重建的快照清单 |
| `scripts/build.py` | URL 本地化、设备映射、原站断链修复、页面打包 |
| `assets/replica.js` | 设备切换、留言提交、分享和本地浏览次数 |
| `worker/index.js` | 页面路由、404 页面、咨询 API |
| `db/schema.ts`、`drizzle/` | 数据库结构及迁移 |
| `.openai/hosting.json` | Sites 项目身份和 D1 绑定 |
| `dist/client/`、`dist/server/` | 构建后的页面、资源与 Worker |

修改 `source` 中的页面或资源后运行 `npm run build`。已有数据库迁移不得修改；修改 `db/schema.ts` 后运行 `npm run db:generate`，检查新迁移，再进行构建和本地迁移。

刷新原站快照使用 `python scripts/mirror.py`。此命令递归获取公开链接并保留已有下载，更新快照清单；删除指定快照文件后再运行可以重新下载该文件。无须网络即可通过已提交的快照重建本项目。

## 与原站的差异

原站后台、数据库内容和账号权限无法从公开网站获取，本项目实现独立留言存储；不使用原站的 PHP 投稿、会员、计数或留言服务。咨询入口转向本站表单，留言不会发送给原站。数据库留言可通过 Sites 数据库工具读取，未开放匿名查询接口。

原站的 22 个缺失装饰图片以无背景处理。原站两个失效的历史轮播栏目转向新闻栏目，手机端一处不存在的荣誉正文转向相应电脑正文。联系我们中的地图改用 OpenStreetMap 嵌入，地图依赖网络；其余页面图片、CSS 和 JS 均在本站。

原站百度统计与旧分享脚本已移除，分享入口改为浏览器分享/复制链接。原站浏览次数不可读取，显示的是当前浏览器的本地访问次数。电话、二维码、邮箱和地址保留原站快照；原站电脑/手机版本中的部分电话号码及楼层存在不同值，本项目没有擅自统一。

`build/sites-vite-plugin.ts` 为 Sites 模板中的 MIT 授权构建集成；原站快照的品牌、内容和图片保留原有归属。

## 原 Sites 托管版内容管理说明

后台入口：`/admin/`。线上使用网站所有者的 ChatGPT 账号登录；管理员邮箱由 Sites 的服务端 `CMS_ADMIN_EMAIL` 配置授权。匿名访客、其他账号不能访问管理页面或管理 API。网站分享范围保持原有设置。

后台管理 186 份现有内容和栏目，并关联它们的电脑及手机版页面：

- 首页与轮播：点击预览中的区域，编辑文字、图片和跳转链接，分别维护电脑/手机布局。
- 产品、新闻、案例：编辑标题、摘要、封面、富文本正文；可从现有内容复制模板新增内容，发布后出现在相应栏目列表。
- 页面与栏目：维护公司简介、服务、联系及栏目页面，保留原有页面版式。
- 图片素材：浏览已有图片，上传 PNG/JPG/GIF/WebP（8MB以内）到独立 R2 存储。
- 咨询留言：查看、搜索、标记已处理、写跟进备注及导出 CSV。
- 网站设置：统一修改公司名称、电话、邮箱、地址、网站标志、微信号及二维码。

保存草稿不会影响前台。点击“发布到前台”立即生效；历史版本可以恢复成草稿，确认后重新发布。下架内容的详情和栏目入口都会隐藏，之后可以取消下架并重新发布。新增内容采用新地址，原站页面地址保留。

本地开发复制 `.dev.vars.example` 为 `.dev.vars`，然后运行构建、本地迁移与预览命令。仅本机 HTTP 地址在 `CMS_LOCAL_DEV=1` 时模拟管理员，线上访问始终检查平台提供的账号身份。实际 `.dev.vars` 不得提交或放入部署归档。`scripts/preview.mjs` 会为本地 Wrangler 复制它；部署归档必须排除此文件及 `.wrangler` 运行状态。

自动验收（需要已启动本地4173端口）：

```bash
node scripts/cms-api-qa.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/cms-browser-qa.mjs
```

API验收覆盖草稿隔离、两端发布、同时编辑冲突、富文本清理、新增/下架、历史恢复、上传、设置及留言跟进。浏览器验收覆盖后台编辑与手机布局。验收只写入本地数据库，不向线上数据库或原站发送内容。


## Linux 服务器版本（原 Ubuntu 部署）

站点名称为 `donghan`。通过 [部署说明](deploy/README.md) 使用 Node 24、SQLite 和本地图片存储运行；服务器使用独立后台账号，支持修改密码。前台及后台已替换为東悍品牌，轮播图提供对应的品牌替换资源。

后台按中文栏目筛选内容、按页面板块编辑，首页轮播支持替换图片、修改跳转和排序。图片支持批量选择、拖拽上传、进度、失败重试、内容重复检测、名称与用途管理。编辑实时预览不写入数据库；保存草稿与发布分开，历史版本可恢复。

验证：`npm run check`；`node scripts/server-qa.mjs` 验证独立登录、持久化、上传去重、预览隔离与密码变更。
