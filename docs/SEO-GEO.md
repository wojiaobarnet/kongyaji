# 東悍网站 SEO 与 GEO 维护说明

当前规范地址为 `http://159.75.67.132/donghan/`，继续使用现有 IP，不需要购买域名。GEO 在本项目中指生成式搜索优化（Generative Engine Optimization）。技术优化只创造可发现和理解的条件，不代表平台已经抓取、收录、排名或引用。

## 本次实现

- 公共内容由服务器输出标题、独立摘要、canonical、Open Graph、Twitter Card 和 JSON-LD，抓取不依赖浏览器执行 JavaScript。去除旧关键词堆叠和重复元标签。
- 首页使用产品目录、选型与服务的描述。分类页根据栏目生成摘要；产品、文章与案例按本页标题生成摘要。后台改过的已发布摘要优先使用，草稿不影响公开元数据。
- 电脑页自指 canonical，手机页指向对应电脑页；电脑页提供带 media 的手机版 alternate。查询参数如 view、utm_source 不进入 canonical。新闻第二页与手机第二页分别对应，不合并到第一页。
- 目录 index.html 和原来仅 JavaScript 跳转的电脑栏目别名改为 HTTP 308。分页有独立标题和规范网址。
- `WebSite`、`WebPage` 和 `BreadcrumbList` 表达网站、页面及栏目关系。未添加未经确认的公司资质、厂家声明、售价、库存、评价或评分；未宣称获得富媒体展示资格。
- `/donghan/sitemap.xml` 根据模板及已发布数据库内容即时生成，当前初始内容为 186 个规范页面加 1 个选型指南。新内容发布才进入网站地图，下架后移除；手机重复页、别名、参数和私有页不进入地图。
- 修改日期取对应已发布版本的 `cms_revisions.created_at`，不会使用尚未发布草稿的 updated_at。原镜像没有可信最后修改日期时省略 lastmod；指南使用实际内容更新日期。
- `/robots.txt` 在主机根路径提供抓取规则，nginx 精确代理到 `/donghan/robots.txt`。没有全站 Disallow，其他网站路由保留；只限制本项目后台、API、私有模板与健康接口。
- 后台、预览、API、健康检查及应用错误响应带 `X-Robots-Tag: noindex, nofollow`。robots 不是访问控制，后台继续需要登录。
- 新增 `/donghan/guide/`：可见的选型信息、产品分类表、询价问答与来源说明，电脑和手机首页都有入口。内容参考本站现有目录及美国能源部的压缩空气系统资料，不编造测试、认证或节能承诺。
- `/donghan/llms.txt` 是可选导航索引，实时读取公开栏目，不暴露草稿或私有数据。Google Search 不使用 llms.txt 决定排名，不能把该文件视为 GEO 成效证明。
- 修复当前 HTTP IP 环境缺少 crypto.randomUUID 时的咨询提交：使用 getRandomValues 生成符合 UUID v4 格式的提交标识。该标识仅用于留言去重，不是登录凭据。

## 抓取入口

| 资源 | 地址 |
| --- | --- |
| 网站地图 | http://159.75.67.132/donghan/sitemap.xml |
| 主机抓取规则 | http://159.75.67.132/robots.txt |
| 规则代理源 | http://159.75.67.132/donghan/robots.txt |
| 选型指南 | http://159.75.67.132/donghan/guide/ |
| 可选机器导航 | http://159.75.67.132/donghan/llms.txt |

主机根路径还承载其他站点。当前部署前 `/robots.txt` 为 404，才增加精确路由。如果将来其他站点有规则或网站地图，必须合并并保留其要求。不要把整个根站跳转到東悍，也不要占用其他站点的 sitemap.xml 或 llms.txt。

## 发布与验证

```bash
npm ci
npm run build
npm run check
npm run test:seo
node scripts/uguest-qa.mjs
```

SEO 验收在临时本机数据库中逐个检查 186 份模板及其两端元数据、规范链接、JSON-LD、网站地图排除项和栏目跳转；还验证新增草稿、发布、未发布再编辑、下架与 lastmod 的行为，以及 HTTP 咨询标识兼容。生产环境不插入验收内容。

现有服务器先执行 `deploy/update.sh`。首次补充根 robots 路由时执行：

```bash
sudo python3 deploy/configure-robots.py --config /etc/nginx/sites-enabled/stool-shop
```

脚本发现已有 robots 响应或规则会停止，要求人工合并；创建备份并检查 nginx，失败恢复原配置。后续普通代码升级不需要重复更改 nginx；已有本项目标记的规则会保留。

公网验证应确认网站地图与 root robots 返回 200，后台 noindex 与认证有效；抽查页面 head、指南、小屏布局和原服务器各站点。检查 `/var/www/donghan/current/REVISION` 与 GitHub 发布提交一致。

## 内容与后续维护

目前公司名称、电话、地址、资质和历史案例来自原站镜像，尚未由网站所有者确认。技术元数据不重复原模板的厂家和资质宣传。所有者确认真实资料后，更新后台网站设置、相关正文和必要的结构化数据，再发布；不能用虚构实体、城市词或评价堆叠来补充 GEO。

指南目前作为源码中的静态页面维护，不是后台新增模板。修改指南同时更新其页面日期与 guideMeta.modified；已有产品、新闻和案例仍通过后台维护。后续更换真实域名或协议时更改 PUBLIC_URL，保留 BASE_PATH，设置旧地址跳转并再次验证 canonical、网站地图和根 robots。当前 HTTP 环境没有伪造 HTTPS 地址。

未登录或操作 Google Search Console、Bing Webmaster Tools、百度资源平台，没有提交所有权验证或请求收录。本次已通过 robots 声明网站地图。后续可用网站所有者的站长平台账号观察索引、搜索表现与引用；平台支持的站点类型及验证方式以其实际界面为准。不能把 HTTP 200 当作已收录，也不保证首页排名或 AI 推荐。

## 官方参考

- [Google：生成式搜索优化](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) —— 仍依赖 SEO、可靠内容与索引；不需要特殊 AI 标记。
- [Google：规范网址](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) —— canonical、跳转和网站地图的一致性。
- [Google：移动优先索引](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) —— 分离手机网址的双向关联。
- [Google：构建网站地图](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) —— 规范网址及可信修改日期。
- [Bing：站长指南](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a) —— 搜索与 AI 引用依赖可抓取、可靠的内容。
- [美国能源部：压缩空气系统资料](https://www.energy.gov/sites/prod/files/2014/05/f16/compressed_air_sourcebook.pdf) —— 通用工况需求整理的参考资料，不是本网站产品背书。
