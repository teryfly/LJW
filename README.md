# 刘静文（THEA）· 个人网站

按《艺术家网站内容文档 · 版本 C 人生叙事》（2026-10-25）制作，并按《艺术家网站需求更改.docx》（2026-10-30）与《艺术家网站需求1.3.docx》（2026-11-02）各改过一轮的静态网站。纯 HTML + CSS，**没有 JavaScript**，没有背景音乐、弹窗、滚动动画，也没有评论区或留言表单——联系渠道只有邮箱、Instagram 与小红书主页链接。

## 本地预览

```bash
python3 -m http.server 8000   # 临时预览，打开 http://localhost:8000
./start.sh                    # 起停正式源站（systemd 服务，见下）
```

直接双击 `index.html` 也能看，但用本地服务更接近真实部署。

改完 `data/site.json` 或页面结构后：

```bash
node build.js                                  # 重新生成 27 个页面
.venv/bin/python scripts/build-fonts.py        # 文案变了就重跑字体子集
```

`build-fonts.py` 需要 `pip install fonttools brotli`（本仓库装在 `.venv/`），源字体放在站点之外的 `~/.cache/ljw-fonts/`（完整思源宋体一个 8MB，不能进 assets/），取法写在脚本开头。`.venv/` 是 75MB 的构建环境，**上传站点时不要带上**——部署只需要 HTML、`assets/` 和 `data/`。

## 线上部署与开机自启

线上访问地址 <https://THEA.fhir.press>。链路是 nginx 反代到本机源站：

```
THEA.fhir.press  ->  nginx (443, 证书在 /etc/nginx/certs/hostproxy/)
                   ->  python3 -m http.server 127.0.0.1:5268  (本仓库目录)
```

源站由 systemd 服务 `ljw-web` 托管，已 `enable`，开机自动拉起，进程异常退出 3 秒后自动重启。单元文件在本仓库 `deploy/ljw-web.service`，改动后重新安装：

```bash
sudo install -m 0644 deploy/ljw-web.service /etc/systemd/system/ljw-web.service
sudo systemctl daemon-reload
```

`start.sh` 是该服务的快捷入口（内部走 `systemctl`，需要 sudo）：

```bash
./start.sh            # 启动
./start.sh stop       # 停止
./start.sh restart    # 重启（改完页面不用它，静态文件即时生效）
./start.sh status     # 状态
./start.sh logs       # 最近日志
```

5268 只监听 `127.0.0.1`，公网流量必须经过 nginx，不能直连端口。nginx 侧的 hostproxy 证书全部是自签名的，浏览器会提示不受信任——这是这台机器所有域名的共同现状，不是本站特例。

## 页面

| 文件 | 内容 |
| --- | --- |
| `index.html` | 页头 → 一句话定位 → 通栏大图 → 四个系列入口（按文档「网站结构」表的顺序） |
| `works.html` | 四个系列的方形封面入口 + 系列名 + 件数（2026-10-31：去掉一句话总结与页尾那两句说明） |
| `series-{love,yixiang,congzhong,xuejing}.html` | 系列简介 + 单列竖排的作品流（画占满容器，文字紧跟其下）+ 上一/下一系列 |
| `<文件名>.html` | 18 个单件作品页：大图、标题、完成日期、尺寸、布面丙烯、询价、上一件/下一件（2026-11-02：去掉日期尺寸媒材下的一句话总结） |
| `about.html` | 艺术家照片（浮动）、艺术家陈述、「关于我 about the artist」、展览 & 新闻 |
| `contact.html` | 提示语、邮箱 / Instagram / 小红书 / 所在地（同级同行）、询价说明 |
| `404.html` | 找不到页面时的入口 |

## 图片：一条流水线

原图放进 `assets/images/originals/`，用文档里的「文件名」命名，然后：

```bash
python3 scripts/prepare-images.py   # 生成三档尺寸 + 四张方形系列封面 + 苹果图标
node build.js                       # 重新生成页面（宽高与 srcset 取自图片本身）
.venv/bin/python scripts/build-fonts.py   # 按页面实际用到的字重切字体子集
```

脚本产出：

| 目录 | 长边 | 用在哪 |
| --- | --- | --- |
| `assets/images/thumb/` | 500px | 首页与作品页的系列入口、关于页照片 |
| `assets/images/` | 900px | 详情页、首页通栏大图 |
| `assets/images/full/` | 1600px | 「点击图片查看大图」打开的原图 |
| `assets/images/cover/` | 800px 正方 | 首页与作品页的系列封面 |
| `assets/images/cover/thumb/` | 400px 正方 | 手机端同一批封面 |

需要 Python + Pillow（`pip install pillow`）。不方便装的话，也可以直接把同名 JPEG 覆盖到上面几个目录，再跑 `node build.js`。

封面取自 `data/site.json` 里 `series[].cover` 指定的那张画，从 `originals/` 中心裁成正方形，四张都是 800 × 800（缩略 400 × 400），所以首页与作品页的四个入口一样大、底边齐在一条线上。要换封面就改 `cover` 字段再重跑两个脚本；裁剪逻辑在 `scripts/prepare-images.py` 的 `write_covers()`。

文件名清单（18 件作品 + 艺术家照片，均已到位）：

```
love-1  love-2  love-3  love-4  love-5
yixiang-1-iris  yixiang-2-lily  yixiang-3-lavender
yixiang-4-oleander  yixiang-5-lily-of-the-valley  yixiang-6-camellia
congzhong-1-sprite-1  congzhong-2-sprite-3  congzhong-3-sprite-4  congzhong-4-sprite-5
xuejing-1-snowscape  xuejing-2-snow-night  xuejing-3-cats-in-snow
artist-photo          # 关于页照片，不要裁掉猫
```

《雪中精灵》的文件名仍是 `xuejing-3-cats-in-snow`：它原名《雪中的猫》，2026-10-30 改名并把尺寸定为 30 × 30 cm，URL 保持不动以免旧链接失效。

原图建议正面拍摄、光线均匀、无水印，长边 2000px 以上。`yixiang-4-oleander`（1269px）取自 `艺术家网站需求1.3.docx`（2026-11-02 按需求换图），`love-5`（1270px）、`artist-photo`（978px）、`xuejing-3-cats-in-snow`（880px）三张取自 `艺术家网站需求更改.docx`，其余 14 张还是 PDF 里的对照图（长边约 1200px），都需要换成原图。

**再有缺图**：给作品加 `"pending": true` 与 `"slotLabel": "…待补"`，`build.js` 就不引用图片，改渲染一个虚线「待补位」，详情页用「画面 · …」那句描述顶上；艺术家照片同理，写在 `about.photo` 上。

## 文案与待确认项

除《LOVE》五的一句文案与完成日期外，文案一律按文档原样使用，未改写、未扩写。文档标【待核对】【待补】【待定】的地方，站内已按现有内容显示，缺口集中在 `data/site.json`（每条都写在各作品的 `verify` 字段里备查）：

- `love-5`：docx 只给了名称、尺寸与状态，**完成日期 2026.10.20 按《LOVE》系列时序推得、那句「靠得越近，中间越亮。」为代拟**（这句现在只出现在 meta 里，不上页面），两项都待艺术家确认
- `xuejing-3-cats-in-snow`：原名《雪中的猫》、尺寸 40 × 40 cm，docx 改名为《雪中精灵》、30 × 30 cm（同一幅，艺术家已确认）
- `love-2`：尺寸 40 × 60 cm 与图片比例不太相符
- `yixiang-3-lavender`：10 × 10 cm 是否准确
- `xuejing-1-snowscape`：原稿写作「5060cm」，此处按 50 × 60 处理
- `congzhong-3-sprite-4`：图片为横向，40 × 50 cm 的方向待确认（尺寸按「短边 × 长边」显示）
- `site.url`：**留空**。填上域名（如 `https://liujingwen.com` 或 `https://thea.com`）后重跑 `node build.js`，会自动补上每页 canonical、og:url、og:image，并生成 `sitemap.xml` 与 `robots.txt`
- 邮件订阅：功能【待定】，`contact.html` 末尾留了注释位；若启用，提示语为「有新作时，我会写信告诉你。」
- 英文版【待定】，现在不做；若做，姓名写作 Liu Jingwen (THEA)

改文字或改作品信息，只动 `data/site.json`，然后 `node build.js`。

## 从参考站借来的具体数值

版式参照 jennifermoses.com 与 jennifermoses.com/gallery。下面的数值是打开参考站的
`site.css` 和截图取色实测的，不是印象：

- `#canvas`：白底、`max-width:1100px`、`margin:50px auto`、边框 `1px solid rgba(0,0,0,.1)`。页面四周**没有**灰色背景，全站就一张白纸
- 站标 `#222`（hover `#444`），导航 `rgba(0,0,0,.5)`，正文 `rgba(34,34,34,.4)`～`#535050`——都是中性灰，不带绿调
- 全站一款 **Josefin Sans**，300/400 两档，字间距 3px，小写；站标 72px / 字间距 9px / 400；导航 22px；正文 16px / 行高 1.6em / 300
- 分类标题 `h2.project-title`：`font-size:2.2em`、左对齐、`border-bottom: rgba(0,0,0,.1)`、`padding-bottom:1.5em`，下划线只与文字等宽
- 缩略图**没有边框**，三列等宽方形，行距很大
- 悬停只变字色，不动边框、不缩放、不移位
- 每张缩略图下三行：标题 → `完成日期 · 尺寸` → `布面丙烯 · ● 可询价`；状态用「● + 文字」标记，不做按钮式色块

## 按文档做的取舍

- **作品图不裁切，只有系列封面裁方**：文档要求「手机端优先检查：图片不被裁切」，所以详情页与系列页都用图本身的比例，不做参考站那种方形裁切，也不套方形白格——`object-fit: contain` 会让横图（《意象·夹竹桃》1.50:1）和竖图（0.70:1）悬在一方块白里，看着像没加载完。首页与作品页的四张系列封面是唯一的例外：2026-10-30 要求「四个系列的封面图一样大、多余的部分裁掉、统一正方形」，于是从各自的封面原作中心裁出 800 × 800，`align-items: end` 让四组的系列名落在同一条基线上。
- **系列页单列竖排**：2026-10-31 要求把多列并排改成一张画接一张画的竖排（信息流/博客列表那种），画占满内容容器（`.frame` 1180 − 左右各 92 内边距 ≈ 996px），三行文字紧跟其下。因此 `sizes` 从 21vw 改成 `STACK_SIZES`，取图档位从 500px 缩略图换成 900/1600px 两档——体积见下。
- **系列的一句话总结只在 meta 里**：2026-10-31 要求去掉首页与作品页入口图下的「没有面孔的爱。」那四句，`series[].line` 字段保留，仍用于各系列页的 `<meta name="description">` 与 og:description；要放回页面就在 `build.js` 的 `homeMain()` 与 `worksMain()` 里补 `entry-line`。
- **作品的一句话总结也只在 meta 里**：2026-11-02 要求删掉 18 个详情页「完成日期 / 尺寸 / 媒材」下面那句（如《丛中精灵》一的「草很高，白猫探出了头。」）。`works[].caption` 字段保留，仍用于各详情页的 `<meta name="description">` 与 og:description；要放回页面就在 `build.js` 的 `workMain()` 里补回 `<p class="work-caption">${w.caption}</p>`，并在 `assets/styles.css` 恢复同名规则（衬线、淡灰、大行距），然后重跑字体子集。
- **关于页不放作品横幅**：2026-10-30 要求「去掉关于中的作品展示」，原先《意象·铃兰》局部那条横幅已删除。2026-10-31 又去掉页首那句「关于 about the artist」大标题，页面从陈述直接开始，英文副题并入「关于我」（该页唯一的 h1）。照片浮在右上，陈述绕着它排，窄屏自动落回一行。
- **关于页只留两段内容**：删掉第三人称「简介」与「履历」，正文是「关于我」和「展览 & 新闻 (Exhibitions & News)」；后者现在只有一句「目前我正处于独立艺术生涯的起步阶段……」，有展览再往里加条目。
- **字体**：自托管两个子集，不走 CDN，离线可用——`Noto Serif SC` 400 一档（页头名字、系列名、作品名、陈述），按页面实际用到的 110 个汉字切子集，22.2KB；`Josefin Sans` 300/400 管拉丁字母与数字（THEA、gallery、日期、尺寸、邮箱），各 3.3KB。中文正文仍用系统无衬线。改文案后要重跑 `scripts/build-fonts.py`，子集才会跟着变。
- **中文不用斜体**：文档说艺术家陈述「斜体、浅灰、行距大」。宋体没有真斜体，CSS 的合成倾斜会把笔画拉歪，比不斜更难看；这里用衬线 + 淡色 + 大行距落实同一个意思。
- **作品显示具体日期**：2026-10-30 要求「所有的画都放具体日期」，覆盖文档里「只显示年份」那条。网格图注与详情页都取 `data/site.json` 的 `date`（如 `2026.9.8`），`year` 只留在页面 `<title>` 里。
- **不显示价格**：16 件未售作品是 `mailto:` 询价按钮（主题自动填「询价：《作品标题》」，正文自动填那句问价的话），《意象·夹竹桃》《雪中精灵》只显示「已售」，没有按钮。《意象·夹竹桃》已不在艺术家身边，尺寸不显示。
- **《丛中精灵》编号为一、三、四、五**，不补「二」；2026-11-02 把系列页下方说明这件事的那句脚注删掉了（编号不变，只是不再在页面上解释），`series[].note` 字段与 `.footnote` 样式留着，要加回去就在 `data/site.json` 里补 `note`。《雪中精灵》（原名《雪中的猫》）归入《雪景》。
- **《LOVE》与「关于我」**用文档给的文字，没有补写公司、项目、年份或感情经历；唯一的代拟是《LOVE》五那句文案与它的完成日期，已列入上面的待确认项。站内不出现电话和工作室地址，也没有联系表单。
- **联系渠道同级同行**：邮箱、Instagram、小红书是同一级的信息——页脚排成一条线上的三个等间距线性图标（Instagram 相机 / 信封 / 摊开的书，账号写在 `title` 与 `aria-label` 里，悬停可见），联系页并成同一个列表，手机端也不把标签和内容拆成两行。没有 Facebook。
- **移动端**：首屏只放名字与一句话，通栏大图紧随其后；系列入口两列；跳转链接、询价按钮、导航项的触控面积都不小于 44px。

## 文案核对

`data/site.json` 的每一句都拿去和 PDF 提取出的正文比对过（PDF 的字体把「西页风见长青车长黄齐母」渲染成了部首码位，比对时先归一化）。改动的地方：

- 《LOVE》三的单件文案：「就成为一颗心」→ 文档原文「就成**了**一颗心」
- 联系页询价说明：改用文档原句「每件未售作品的详情页都有一个“询价”按钮；已售作品显示“已售”，没有按钮。」
- 其余不一致的都是 alt 文本（标题 + 画面描述拼起来）和站内自己的功能性标注

2026-10-30 一轮按《艺术家网站需求更改.docx》与当天对话原文照抄：《丛中精灵》《雪景》系列简介、关于页「关于我」四段、展览 & 新闻那句，都是艺术家写的，未作改动（数字与「年」之间也不加空格，保持原样）。《雪中精灵》没有单件文案，沿用《雪中的猫》那句「两只猫挨着，雪在下。」

## 体积

首页四张系列封面：手机端 143KB（400px 档），高分屏 640KB（800px 档）。系列页改成单列满宽之后，取的是 900/1600px 两档而不是缩略图：整页 0.7MB（《雪景》三件）～1.9MB（《意象》六件），390px 宽的 2x 屏约 1.0～1.2MB。字体共 29KB（宋体子集 22.2KB + Josefin 6.6KB），CSS 18.0KB。要再压封面，就调 `scripts/prepare-images.py` 顶部的 `COVER_EDGE` 与 `COVER_QUALITY`；要压系列页，就把 `build.js` 里 `STACK_SIZES` 的 996px 改小或换成 `DETAIL_SIZES`。
# LJW
# LJW
# LJW
# LJW
