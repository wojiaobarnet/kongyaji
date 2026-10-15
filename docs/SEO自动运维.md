# SEO 中心与每日自动运维

更新：2026-10-15。生产主机 43.128.69.6，前台 /donghan/，后台 /donghan/uguest/#seo。旧机项目已退役，不向旧机部署。

## 网站做了什么

保留服务端标题、摘要、canonical、两端链接、社交标签、JSON-LD、公开 sitemap、robots 及选型指南。图片异步解码，前三张之后未设置加载方式的图片使用延迟加载；CMS 图片有明确页面上下文且完全没有 alt 时补上说明，保留主动设置的空 alt。没有更改正文、报价或公司资质。

每日任务按公开地图逐页检查 HTTP 状态、单一标题和摘要、规范网址、noindex、JSON-LD、主标题、图片 alt 及重复标题/摘要，并检查 Nginx 根 robots。只请求本项目同源路径，不跟随重定向到外部，最多 2,000 个规范页，单次请求超时 12 秒、应用检查最多 18 分钟，systemd 最长运行 20 分钟。超过限制或任务中断会留下失败状态，不能解释成检查通过。

自动修复只对缺失/重复的历史模板标题或摘要生效：标题使用现有标题和分类；摘要取现有公开正文段落。不覆盖所有者已发布的元数据，不读草稿生成搜索信息，不编造文本或修改 lastmod。修复保存在运行库覆盖层，复查返回内容和 canonical 等检查，未按预期生效时恢复原覆盖值。私有库保存已校验的地图/robots 快照，公开抓取文件仍实时随发布和下架生成。没有可安全修复的问题时只记录结果。

H1、没有可确定含义的图片、重复内容等问题留作人工核对。技术指标规则为每页：错误计 0、仅提醒计 0.75、无问题计 1，再取平均百分比；它不是搜索引擎评分或排名。

## 后台与数据口径

- “页面与问题”：最近一次完整检查的页面，按错误、提醒、通过筛选，每页 20 条。
- “来源与页面”：最近 30 天的来源、热门页和爬虫响应；趋势按北京时间逐日汇总。
- “优化动作”：最近 100 条开始、修复前后值、检查、失败、恢复和完成记录。
- “运行日志”：最近 30 次任务，区分每日定时与管理员手动，显示开始/结束、状态和结果。
- 计划卡片读取 systemd 实时 active/enabled、下次运行与服务 Result；不是只读一份安装配置。手动任务使用后台登录、同源 POST；自动任务走服务器 CLI，不开放无认证触发地址。

浏览器数据是公开页面 GET 请求，不是独立访客、搜索曝光、搜索结果点击或按钮点击。错误路径合并统计，不存查询参数。排除本检查器、常见自动化和登录管理员，仍可能混入未识别的自动化。搜索来源由 Referer 的主机分类，爬虫由 User-Agent 的声明分类，未进行爬虫身份验证。未保存 IP、原始 UA、Cookie、完整 Referer 或搜索词。数据从启用开始采集，不从旧站日志推算。

当前未连接 Google Search Console、Bing 或百度站长平台，曝光、结果点击、收录和关键词排名保持“暂无数据”。每天改写不是排名保证；Google 的建议仍着重可抓取、可靠、有用的内容。[官方入门说明](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)、[生成式搜索说明](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)。

## 安装和实际验收

先把源码、构建管理资源和文档作为新 release 部署到 current，保留账号与生产库，再执行：

```bash
bash /var/www/donghan/current/deploy/install-seo.sh
systemctl start donghan-seo.service
systemctl is-active donghan-seo.timer
systemctl is-enabled donghan-seo.timer
systemctl list-timers donghan-seo.timer --no-pager
systemctl show donghan-seo.service -p Result -p ExecMainStatus
journalctl -u donghan-seo.service -n 80 --no-pager
```

安装器适用于当前宝塔主机的 donghan 服务用户和 Node 路径，不可盲目复用至其它用户/主机。配置文件是 /etc/systemd/system/donghan-seo.service 与 .timer；每天 Asia/Shanghai 03:30，Persistent=true 补跑。运行用户 donghan，仅能写 /var/lib/donghan。无需浏览器保持打开，无外部付费接口，也没有给定时服务 GitHub 凭证。需要验证 service 实际执行结束、后台有结果和 timer 的下一次计划；只安装 unit 不算成功。

## 持久化、日志与备份

/var/lib/donghan/seo.sqlite 为私有运行库，文件 600、父目录 700。表包括 seo_runs、seo_pages、seo_actions、seo_overrides、seo_traffic 和 seo_meta；与 content.sqlite 分离。匿名访问聚合保留 180 天，检查/动作保留最近 90 次，成功完成检查时清理过期记录。任务开始即写运行记录；异常写 failed，超过 25 分钟仍未结束的任务在下一次触发时标为中断。systemd 在应用启动前发生的失败可从计划卡片的 Result 及 journalctl 查看。

每日运行及覆盖层属于服务器运行数据，动作记录保存在运行库，不逐日提交数据库或访问数据到 GitHub。源码、策略、界面或配置变更仍同步日志、项目 Markdown/PDF、操作手册、GitHub 与主服务器，并追加 /var/www/donghan/deployment-log.jsonl。没有后台自动生成源码文档或自动 GitHub 推送服务。

server/backup.mjs 现在对 content.sqlite 及存在的 seo.sqlite 分别执行 SQLite 一致性备份；uploads、admin.json、服务和计划配置另按私有资料保留。不能直接复制运行中的 SQLite 单文件忽略 WAL，也不能把备份放在 public/dist/client 或 GitHub。

## 暂停、故障与恢复

```bash
systemctl disable --now donghan-seo.timer
systemctl stop donghan-seo.service
```

暂停后网站和人工编辑继续工作；后台计划状态会变化。恢复使用 enable --now timer，并核对下次计划和最近结果。若自动修复未通过响应复查，任务只恢复该次覆盖值并记 rollback；不会恢复/覆盖生产正文。涉及人工内容质量的问题由所有者核实后在内容编辑器发布。

升级切换 current 前先停仍在运行的 SEO service。回退至没有 SEO 中心的旧 release 时先停用 timer/service，切换到备份记录的旧路径并重启 donghan，检查前台、登录与健康；保留 SEO 库及生产内容库，不用初始空库覆盖。已存在的旧计划配置可从 install-seo.sh 输出的私有 backups 目录恢复，然后 daemon-reload 并核对；不要整份恢复共享 Nginx 配置。

验证命令：npm run check、npm run test:seo、npm run test:seo-center，以及 node scripts/uguest-qa.mjs。新增测试覆盖真实修复/复查、人工优先、重复执行、互斥、失败持久化、跨站请求拦截、匿名统计、未登录访问和 CSRF；业务验收使用隔离数据库，生产不写验收内容。

首次线上每日服务的本地 robots 检查因 Node fetch 未正确保留 Host 而命中宝塔默认站点 404，部署自动回退；已改用显式 HTTP 客户端保留虚拟主机，补充回归测试并在目标机验证 200 后重新部署。公网代理及生产数据未改。 本机代理检查使用 node:http 显式设置 Host，并有默认虚拟主机拒绝请求的回归用例。
