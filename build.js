#!/usr/bin/env node
/*
 * Static site generator for 刘静文（THEA）.
 *   node build.js
 * Reads data/site.json + assets/images/, writes the HTML pages next to it.
 * Dimensions come from the image files themselves, so run scripts/prepare-images.py
 * first when new originals land in assets/images/originals/.
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8"));
const IMG_DIR = path.join(ROOT, "assets/images");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* Read a JPEG's dimensions from its SOF marker so images reserve space before loading. */
function jpegSize(file) {
  const buf = fs.readFileSync(file);
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { w: 1, h: 1 };
}

const tier = (name, file) => {
  const p = path.join(IMG_DIR, name, `${file}.jpg`);
  if (!fs.existsSync(p)) return null;
  return { src: `assets/images/${name}/${file}.jpg`, ...jpegSize(p) };
};

function image(file, alt) {
  const p = path.join(IMG_DIR, `${file}.jpg`);
  if (!fs.existsSync(p)) throw new Error(`missing image: ${p}`);
  return { file, alt, thumb: tier("thumb", file), full: tier("full", file), ...jpegSize(p) };
}

/* The doc asks every work image to carry "标题 + 画面描述" as its alt text. */
function workImage(file) {
  for (const s of SERIES) {
    const w = s.works.find((x) => x.file === file);
    if (w) return image(file, w.alt);
  }
  return image(file, "");
}

const A = DATA.artist;
const C = DATA.contact;
const SERIES = DATA.series;
const BASE = (DATA.site.url || "").replace(/\/+$/, "");

/* The doc names two images it never supplies. They render as an explicit 待补
   slot rather than a grey box, so nothing on the page pretends to be a picture. */
const PENDING = new Set();
for (const s of SERIES) for (const w of s.works) if (w.pending) PENDING.add(w.file);
if (DATA.about.photo.pending) PENDING.add(DATA.about.photo.file);

function slot({ file, label, ratio, cls = "", caption = "" }) {
  const box = `<span class="slot-box" aria-hidden="true">
            <span class="slot-label">${esc(label)}</span>
            <span class="slot-file">${esc(file)}.jpg</span>
          </span>`;
  const style = ratio ? ` style="--slot-ratio: ${ratio}"` : "";
  return caption
    ? `<figure class="slot ${cls}"${style}>
            ${box}
            <figcaption>${esc(caption)}</figcaption>
          </figure>`
    : `<span class="slot ${cls}"${style}>
            ${box}
          </span>`;
}

/* The doc's 画面 description for a work whose image has not arrived: better to
   say what the painting shows than to leave a large empty frame. */
function descLine(w) {
  const desc = (w.alt || "").replace(new RegExp(`^${w.title}[，,]`), "");
  if (!desc) return "";
  return `<figcaption class="work-desc">画面 · ${esc(desc)}</figcaption>`;
}

/* Series covers are square and all the same size — scripts/prepare-images.py
   centre-crops them from series[].cover. */
function coverImage(s) {
  const p = path.join(IMG_DIR, "cover", `${s.id}.jpg`);
  if (!fs.existsSync(p)) throw new Error(`missing cover: ${p} — run scripts/prepare-images.py`);
  const t = path.join(IMG_DIR, "cover", "thumb", `${s.id}.jpg`);
  const work = s.works.find((w) => w.file === s.cover);
  return {
    file: `cover/${s.id}`,
    alt: work ? work.alt : `${s.title}封面`,
    thumb: fs.existsSync(t) ? { src: `assets/images/cover/thumb/${s.id}.jpg`, ...jpegSize(t) } : null,
    ...jpegSize(p),
  };
}

const seriesPage = (id) => `series-${id}.html`;
const workPage = (file) => `${file}.html`;
const imgUrl = (file) => `assets/images/${file}.jpg`;
const imgFull = (file) => `assets/images/full/${file}.jpg`;

function inquiryLink(title) {
  const q = new URLSearchParams({
    subject: `询价：${title}`,
    body: C.inquiryBody,
  });
  return `mailto:${C.email}?${q.toString().replace(/\+/g, "%20")}`;
}

const NAV = [
  { cn: "作品", en: "gallery", href: "works.html", key: "works" },
  { cn: "关于", en: "about", href: "about.html", key: "about" },
  { cn: "联系", en: "contact", href: "contact.html", key: "contact" },
];

function nav(current) {
  const items = NAV.map(
    (n) => `<a class="nav-item${n.key === current ? " is-current" : ""}" href="${n.href}"${
      n.key === current ? ' aria-current="page"' : ""
    }><span class="nav-cn">${n.cn}</span><span class="nav-en">${n.en}</span></a>`
  ).join("\n        ");
  return `      <nav class="nav" aria-label="主导航">
        <span class="nav-edge" aria-hidden="true"></span>
        ${items}
        <span class="nav-edge" aria-hidden="true"></span>
      </nav>`;
}

function header(current, withSubtitle) {
  return `    <header class="site-head">
      <a class="brand" href="index.html">
        <span class="brand-cn">${A.nameCn}</span>
        <span class="brand-en">${A.nameEn}</span>
      </a>
${withSubtitle ? `      <p class="brand-sub">${A.subtitle}</p>\n` : ""}${nav(current)}
    </header>`;
}

const IG_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="17.4" cy="6.6" r="1.15" fill="currentColor"/></svg>`;

const MAIL_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5.5" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3.7 6.7 12 12.9l8.3-6.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* 小红书没有合适的单色线性标记，用一本摊开的书代替。 */
const XHS_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 7.4C10.2 5.7 7.6 5.1 4.6 5.3v11.3c3-.2 5.6.4 7.4 2.1 1.8-1.7 4.4-2.3 7.4-2.1V5.3c-3-.2-5.6.4-7.4 2.1Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 7.4v11.3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`;

/* 邮箱、Instagram、小红书是同一级的联系渠道，一律用图标，等间距排在同一条线上。 */
function footer() {
  const channels = [
    { icon: IG_ICON, href: C.instagramUrl, label: `Instagram：${C.instagram}`, external: true },
    { icon: MAIL_ICON, href: `mailto:${C.email}`, label: `邮箱：${C.email}`, external: false },
  ];
  if (C.xiaohongshuUrl) {
    channels.push({
      icon: XHS_ICON,
      href: C.xiaohongshuUrl,
      label: `小红书：${C.xiaohongshu}`,
      external: true,
    });
  }
  const links = channels
    .map(
      (ch) =>
        `<a class="foot-icon" href="${ch.href}" title="${esc(
          ch.label
        )}" aria-label="${esc(ch.label)}"${
          ch.external ? ' target="_blank" rel="noopener"' : ""
        }>${ch.icon}</a>`
    )
    .join("\n        ");
  return `    <footer class="site-foot">
      <p class="foot-links">
        ${links}
      </p>
      <p class="foot-name">${A.nameCn}<span class="foot-name-en">${A.nameEn}</span></p>
      <p class="foot-copy">${DATA.footer.copyright}</p>
    </footer>`;
}

/* Absolute URLs only once the domain is decided (site.url in data/site.json). */
function page({ name, title, desc, current, bodyClass = "", main }) {
  const abs = BASE
    ? `
    <link rel="canonical" href="${BASE}/${name === "index.html" ? "" : name}">
    <meta property="og:url" content="${BASE}/${name}">
    <meta property="og:image" content="${BASE}/assets/images/${DATA.home.hero.file}.jpg">`
    : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <meta name="theme-color" content="#ffffff">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${esc(A.nameFull)}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">${abs}
    <link rel="icon" href="assets/favicon.svg">
    <link rel="apple-touch-icon" href="assets/images/apple-touch-icon.png">
    <link rel="stylesheet" href="assets/styles.css">
  </head>
  <body${bodyClass ? ` class="${bodyClass}"` : ""}>
    <a class="skip" href="#main">跳到主要内容</a>
    <div class="frame">
${header(current, current === "home")}
      <main class="page" id="main">
${main}
      </main>
${footer()}
    </div>
  </body>
</html>
`;
}

/* Smallest useful file becomes src, the rest go in srcset. */
function imgTag(im, cls, { sizes, tiers = [], eager = false } = {}) {
  const list = [{ src: imgUrl(im.file), w: im.w }, ...tiers.map((k) => im[k]).filter(Boolean)]
    .sort((a, b) => a.w - b.w)
    .filter((t, i, all) => i === 0 || t.w > all[i - 1].w);
  const srcset =
    list.length > 1 ? ` srcset="${list.map((t) => `${t.src} ${t.w}w`).join(", ")}"` : "";
  const sizesAttr = srcset && sizes ? ` sizes="${sizes}"` : "";
  return `<img src="${list[0].src}"${srcset}${sizesAttr} width="${im.w}" height="${im.h}" alt="${esc(
    im.alt ?? ""
  )}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${
    cls ? ` class="${cls}"` : ""
  }>`;
}

/* Square cells span half the sheet on a phone, a quarter on a desktop. */
const CELL_SIZES = "(max-width: 640px) 44vw, (max-width: 880px) 29vw, 21vw";
const WIDE_SIZES = "(max-width: 640px) 100vw, 1060px";
const DETAIL_SIZES = "(max-width: 640px) 92vw, 760px";
/* 系列页单列竖排：画占满内容容器（.frame 1180 − 左右各 92 的内边距）。 */
const STACK_SIZES = "(max-width: 640px) 93vw, (max-width: 880px) 87vw, 996px";

/* ---------- 首页：页头 → 一句话定位 → 通栏大图 → 四个系列入口 ---------- */
function homeMain() {
  const H = DATA.home;
  const hero = workImage(H.hero.file);
  const entries = SERIES.map((s) => {
    const im = coverImage(s);
    return `        <a class="entry" href="${seriesPage(s.id)}">
          <span class="entry-cell">${imgTag(im, "entry-img", { tiers: ["thumb"], sizes: CELL_SIZES })}</span>
          <span class="entry-name">${s.title}</span>
        </a>`;
  }).join("\n");

  return `        <section class="lede">
          <h1 class="lede-title">${H.statement}</h1>
          <p class="lede-body">${H.lead}</p>
        </section>

        <section class="hero">
          <a class="hero-link" href="${workPage(hero.file)}" aria-label="查看 ${esc(H.hero.label)} 的作品页">
            ${imgTag(hero, "hero-img", { tiers: ["full"], sizes: WIDE_SIZES, eager: true })}
          </a>
          <p class="hero-cap"><a href="${workPage(hero.file)}">${H.hero.label}</a></p>
        </section>

        <section class="section" aria-labelledby="home-series">
          <h2 class="section-title" id="home-series"><span>${H.seriesHeading}</span></h2>
          <div class="entries">
${entries}
          </div>
        </section>`;
}

/* ---------- 作品总览 ---------- */
function worksMain() {
  const W = DATA.worksPage;
  const entries = SERIES.map((s) => {
    const im = coverImage(s);
    return `        <a class="entry" href="${seriesPage(s.id)}">
          <span class="entry-cell">${imgTag(im, "entry-img", { tiers: ["thumb"], sizes: CELL_SIZES })}</span>
          <span class="entry-name">${s.title}</span>
          <span class="entry-count">${s.count} 件 · ${A.medium}</span>
        </a>`;
  }).join("\n");

  return `        <h1 class="page-title"><span>${W.title}</span><small>${W.titleEn}</small></h1>
        <div class="entries">
${entries}
        </div>`;
}

/* ---------- 系列页：单列竖排，画占满容器，图下紧跟三行文字 ---------- */
function seriesMain(s, index) {
  const intro = s.intro.map((p) => `          <p>${p}</p>`).join("\n");
  const cells = s.works
    .map((w) => {
      const status = w.status === "sold" ? "已售" : "可询价";
      const visual = w.pending
        ? slot({ file: w.file, label: w.slotLabel || "图片待补", cls: "slot--cell" })
        : (() => {
            const im = workImage(w.file);
            return `<span class="cell-frame">${imgTag(im, "cell-img", { tiers: ["full"], sizes: STACK_SIZES })}</span>`;
          })();
      return `          <a class="cell" href="${workPage(w.file)}">
            ${visual}
            <span class="cell-cap">
              <span class="cell-title">${w.title}</span>
              <span class="cell-meta">${[w.date, w.size].filter(Boolean).join(" · ")}</span>
              <span class="cell-meta">${A.medium} · <span class="cell-status${
                w.status === "sold" ? " is-sold" : ""
              }">${status}</span></span>
            </span>
          </a>`;
    })
    .join("\n");

  const before = SERIES[index - 1];
  const after = SERIES[index + 1];
  const seriesNav = `        <nav class="siblings" aria-label="其他系列">
          ${before ? `<a class="sib" href="${seriesPage(before.id)}"><span aria-hidden="true">←</span>${before.title}</a>` : "<span></span>"}
          <a class="sib sib-back" href="works.html">全部作品</a>
          ${after ? `<a class="sib" href="${seriesPage(after.id)}">${after.title}<span aria-hidden="true">→</span></a>` : "<span></span>"}
        </nav>`;

  return `        <nav class="crumbs" aria-label="面包屑"><a href="works.html">作品</a><span class="crumb-sep" aria-hidden="true">/</span><span>${s.title}</span></nav>
        <h1 class="page-title"><span>${s.title}</span><small>${s.count} works</small></h1>
        <section class="series-intro">
${intro}
        </section>
        ${s.note ? `<p class="footnote">${s.note}</p>` : ""}
        <div class="grid">
${cells}
        </div>
${seriesNav}`;
}

/* ---------- 单件作品 ---------- */
function workMain(s, w, prev, next) {
  const sold = w.status === "sold";
  const im = w.pending ? null : workImage(w.file);
  const meta = [
    [`完成日期`, w.date],
    w.size ? [`尺寸`, w.size] : "",
    [`媒材`, A.medium],
  ]
    .filter(Boolean)
    .map(([k, v]) => `<div class="meta-row"><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("\n            ");

  const action = sold
    ? `          <p class="sold">已售</p>`
    : `          <a class="btn" href="${inquiryLink(w.title)}">询价</a>
          <p class="btn-note">${C.inquiryNote}</p>`;

  const figure = im
    ? `        <figure class="work">
          <a class="work-link" href="${imgFull(w.file)}" rel="noopener" target="_blank" aria-label="放大查看 ${esc(w.title)}">
            ${imgTag(im, "work-img", { tiers: ["full"], sizes: DETAIL_SIZES })}
          </a>
          <figcaption class="work-hint">点击图片查看大图</figcaption>
        </figure>`
    : `        <figure class="work">
          ${slot({ file: w.file, label: w.slotLabel || "图片待补", ratio: "1 / 1", cls: "slot--work" })}
          ${descLine(w)}
        </figure>`;

  const sib = (other, side) =>
    other
      ? `<a class="sib sib-${side}" href="${workPage(other.file)}">${
          side === "prev"
            ? `<span aria-hidden="true">←</span>${other.title}`
            : `${other.title}<span aria-hidden="true">→</span>`
        }</a>`
      : "<span></span>";

  return `        <nav class="crumbs" aria-label="面包屑"><a href="works.html">作品</a><span class="crumb-sep" aria-hidden="true">/</span><a href="${seriesPage(s.id)}">${s.title}</a><span class="crumb-sep" aria-hidden="true">/</span><span>${w.title}</span></nav>
${figure}
        <section class="work-info">
          <h1 class="work-title">${w.title}</h1>
          <dl class="work-meta">
            ${meta}
          </dl>
${action}
        </section>
        <nav class="siblings" aria-label="上一件与下一件">
          ${sib(prev, "prev")}
          <a class="sib sib-back" href="${seriesPage(s.id)}">回到${s.title}</a>
          ${sib(next, "next")}
        </nav>`;
}

/* ---------- 关于 ---------- */
function aboutMain() {
  const P = DATA.about;
  const photo = P.photo.pending
    ? null
    : image(P.photo.file, `${A.nameFull}与她的灰色虎斑猫`);
  const portrait = photo
    ? `          <figure class="portrait portrait--float">
            ${imgTag(photo, "portrait-img", {
              tiers: ["thumb", "full"],
              sizes: "(max-width: 640px) 92vw, 270px",
            })}
            <figcaption>${P.photo.caption}</figcaption>
          </figure>`
    : `          ${slot({
        file: P.photo.file,
        label: P.photo.slotLabel || "照片待补",
        ratio: P.photo.ratio,
        caption: P.photo.caption,
        cls: "portrait--float",
      })}`;

  return `        <section class="prose about-body">
${portrait}
          <p class="statement">${P.statement}</p>

          <h1 class="sub-title"><span>${esc(P.meHeading)}</span><small>${esc(P.meHeadingEn)}</small></h1>
${P.me.map((p) => `          <p>${p}</p>`).join("\n")}

          <h2 class="sub-title">${esc(P.newsHeading)}</h2>
          <p>${P.newsText}</p>
        </section>`;
}

/* ---------- 联系 ---------- */
function contactMain() {
  const P = DATA.contactPage;
  const xhs = C.xiaohongshuUrl
    ? `<a href="${C.xiaohongshuUrl}" rel="noopener" target="_blank" aria-label="小红书主页：${C.xiaohongshu}">${C.xiaohongshu}</a>`
    : `小红书号 ${C.xiaohongshu}`;
  return `        <h1 class="page-title"><span>${P.title}</span><small>${P.titleEn}</small></h1>
        <p class="contact-intro">${C.intro}</p>
        <dl class="cv">
          <div class="cv-row"><dt>邮箱</dt><dd><a href="mailto:${C.email}">${C.email}</a></dd></div>
          <div class="cv-row"><dt>Instagram</dt><dd><a href="${C.instagramUrl}" rel="noopener" target="_blank">${C.instagram}</a></dd></div>
          <div class="cv-row"><dt>小红书</dt><dd>${xhs}</dd></div>
          <div class="cv-row"><dt>所在地</dt><dd>${A.city}</dd></div>
        </dl>
        <section class="prose">
          <h2 class="sub-title">${P.inquiryHeading}</h2>
          <p>${P.inquiryExplain}</p>
          <p>${C.inquiryNote}</p>
        </section>
        <!-- 订阅功能【待定】。若启用，提示语为：有新作时，我会写信告诉你。 -->`;
}

/* ---------- 404 ---------- */
function notFoundMain() {
  return `        <h1 class="page-title"><span>没有找到这个页面</span><small>404</small></h1>
        <p class="contact-intro">地址可能改了，或者这幅画还没有上线。</p>
        <p class="contact-mail"><a href="index.html">回到首页</a></p>
        <dl class="cv">
          <div class="cv-row"><dt>作品</dt><dd><a href="works.html">四个系列</a></dd></div>
          <div class="cv-row"><dt>关于</dt><dd><a href="about.html">关于${A.nameFull}</a></dd></div>
          <div class="cv-row"><dt>联系</dt><dd><a href="contact.html">来信</a></dd></div>
        </dl>`;
}

/* ---------- 写文件 ---------- */
const flat = [];
for (const s of SERIES) for (const w of s.works) flat.push({ ...w, series: s });

const files = [];
const add = (name, opts) => files.push([name, page({ name, ...opts })]);

add("index.html", {
  title: DATA.site.title,
  desc: DATA.site.description,
  current: "home",
  bodyClass: "page-home",
  main: homeMain(),
});
add("works.html", {
  title: `作品｜${A.nameCn} ${A.nameEn}`,
  desc: DATA.worksPage.metaNote.replace("{n}", flat.length),
  current: "works",
  main: worksMain(),
});
SERIES.forEach((s, i) =>
  add(seriesPage(s.id), {
    title: `${s.title.replace(/[《》]/g, "")}｜${A.nameCn} ${A.nameEn}`,
    desc: `${s.title}，${s.line}共 ${s.count} 件，${A.medium}。`,
    current: "works",
    main: seriesMain(s, i),
  })
);
flat.forEach((w) => {
  const i = flat.indexOf(w);
  add(workPage(w.file), {
    title: `${w.title} ${w.year}｜${A.nameCn} ${A.nameEn}`,
    desc: `${w.title}，${w.date}，${A.medium}${w.size ? "，" + w.size : ""}。${w.caption}`,
    current: "works",
    bodyClass: "page-work",
    main: workMain(w.series, w, flat[i - 1] || null, flat[i + 1] || null),
  });
});
add("about.html", {
  title: `关于｜${A.nameCn} ${A.nameEn}`,
  desc: `${A.nameFull}，${A.subtitle}。${DATA.about.statement}`,
  current: "about",
  bodyClass: "page-about",
  main: aboutMain(),
});
add("contact.html", {
  title: `联系｜${A.nameCn} ${A.nameEn}`,
  desc: C.intro,
  current: "contact",
  bodyClass: "page-contact",
  main: contactMain(),
});
add("404.html", {
  title: `页面不存在｜${A.nameCn} ${A.nameEn}`,
  desc: `${A.nameFull}的个人网站。`,
  current: "",
  main: notFoundMain(),
});

for (const [name, html] of files) fs.writeFileSync(path.join(ROOT, name), html);

/* A sitemap needs a domain; skip it while that is still 【待定】. */
if (BASE) {
  const urls = files.map(([name]) => `${BASE}/${name === "index.html" ? "" : name}`);
  fs.writeFileSync(
    path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u}</loc></url>`)
      .join("\n")}\n</urlset>\n`
  );
  fs.writeFileSync(
    path.join(ROOT, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`
  );
}

console.log(
  `built ${files.length} pages${
    BASE ? " + sitemap.xml + robots.txt" : "（site.url 未定：跳过 canonical 与 sitemap）"
  }`
);
