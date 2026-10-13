# 开山销售网站复刻

完整保留原站可公开访问的电脑及手机页面、原始布局、产品详情、新闻正文、案例、服务、联系资料、分页、图片和轮播交互。快照来源为 `http://www.kaishansales.com/` 与 `http://m.kaishansales.com/`；主域名首页与 www 首页相同。

- 电脑端：`/`
- 手机端：`/mobile/`，小屏设备访问电脑页面时自动跳转至相应手机页面。
- 强制电脑端：`/?view=desktop`；页尾提供电脑/手机版切换。
- 389 个原站页面、324 个资源文件（详见 `replica-inventory.json`）。
- 购买咨询：`/consultation/` 与 `/mobile/listinfo-6-0.html`，独立接口 `/api/inquiries` 将留言保存到复刻站的 Cloudflare D1 数据库。

## 运行

需要 Node.js 22.13+、Python 3、npm。

```bash
npm ci
npm run build
npm run db:local
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
