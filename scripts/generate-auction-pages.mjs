import { createRequire } from "node:module";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(process.env.SHARP_REQUIRE_FROM || import.meta.url);
const sharp = require("sharp");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://teamworkcomplex-sudo.github.io/propertyexchange";
const AUCTION = SITE + "/auction/";
const PROJECT = "property-auctions";
const LIST_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/properties`;
const PUBLIC_KEYS = ["title", "city", "size", "type", "exchangeWanted", "minBid", "increment", "endsAt", "status", "youtubeUrl", "currentHighest", "art"];

function fieldValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  return null;
}

function docFields(doc) {
  const out = {};
  for (const key of PUBLIC_KEYS) {
    if (doc.fields && doc.fields[key]) out[key] = fieldValue(doc.fields[key]);
  }
  out.id = String(doc.name || "").split("/").pop();
  out.updateTime = doc.updateTime || "";
  return out;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore ${res.status} for ${url}: ${text.slice(0, 240)}`);
  }
  return res.json();
}

async function listCollection(url) {
  const docs = [];
  let pageToken = "";
  do {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set("pageSize", "100");
    if (pageToken) pageUrl.searchParams.set("pageToken", pageToken);
    const data = await getJson(pageUrl.href);
    docs.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return docs;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatPKR(n) {
  const s = String(Math.round(Number(n) || 0));
  if (s.length <= 3) return "PKR " + s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts = [];
  while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
  if (rest) parts.unshift(rest);
  return "PKR " + parts.join(",") + "," + last3;
}

function formatDate(iso) {
  const ms = Date.parse(iso || "");
  if (!ms) return "";
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  }).format(new Date(ms)) + " PKT";
}

function statusLabel(prop) {
  if (prop.status === "closed") return "Closed";
  const end = Date.parse(prop.endsAt || "");
  if (end && Date.now() >= end) return "Ended";
  if (end && end - Date.now() < 12 * 3600000) return "Ending soon";
  return "Live";
}

function youtubeUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const ok = host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com" || host.endsWith(".youtube.com");
    return ok ? url.href : "";
  } catch {
    return "";
  }
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  return Buffer.from(match[1].replace(/\s/g, ""), "base64");
}

async function jpeg(input, width) {
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const target = Math.min(width, meta.width || width);
  const out = sharp(input, { failOn: "none" }).rotate();
  if ((meta.width || 0) > width) out.resize({ width, withoutEnlargement: true });
  const buf = await out.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const info = await sharp(buf).metadata();
  return { buf, width: info.width || target, height: info.height || 0 };
}

async function ogCrop(input) {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

function brandSvg(w, h, subtitle) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#0b2545"/>
  <rect x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.28)}" width="${Math.round(h * 0.44)}" height="${Math.round(h * 0.44)}" rx="${Math.round(h * 0.08)}" fill="#f4c430"/>
  <text x="${Math.round(w * 0.06 + h * 0.22)}" y="${Math.round(h * 0.55)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(h * 0.16)}" font-weight="700" fill="#0b2545">TWC</text>
  <text x="${Math.round(w * 0.34)}" y="${Math.round(h * 0.48)}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(h * 0.09)}" font-weight="700" fill="#ffffff">Team Work Complex</text>
  <text x="${Math.round(w * 0.34)}" y="${Math.round(h * 0.64)}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(h * 0.055)}" fill="#f4c430">${escapeXml(subtitle)}</text>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function cleanLabel(s) {
  return String(s || "")
    .replace(/(\d+)\s*bed\s*rooms?\b/gi, (_, n) => n + " Bedroom")
    .replace(/\bbed\s*rooms?\b/gi, "Bedroom")
    .replace(/\s+/g, " ")
    .trim();
}

function fitText(text, min, max, pads) {
  let t = cleanLabel(text);
  if (t.length > max) {
    let cut = t.slice(0, max);
    const sp = cut.lastIndexOf(" ");
    if (sp >= Math.min(min, max - 8)) cut = cut.slice(0, sp);
    t = cut.replace(/[\s,.:;-]+$/g, "");
  }
  for (const pad of pads || []) {
    if (t.length >= min) break;
    if (t.length + pad.length <= max) t += pad;
  }
  if (t.length > max) t = t.slice(0, max).replace(/[\s,.:;-]+$/g, "");
  return t;
}

function placeBits(prop) {
  const cleaned = cleanLabel(prop.title);
  const bed = cleaned.match(/\d+\s+Bedroom/);
  const type = cleanLabel(prop.type || "Property");
  const size = cleanLabel(prop.size || "");
  const city = cleanLabel(prop.city);
  const what = bed ? bed[0] + " " + type : [size, type].filter(Boolean).join(" ");
  return { cleaned, city, what: what || "Property" };
}

function seoTitle(prop) {
  const { city, what } = placeBits(prop);
  const base = city
    ? what + " exchange auction in " + city + ", Pakistan"
    : what + " property exchange auction in Pakistan";
  return fitText(base, 50, 60, [" Pakistan"]);
}

function seoDescription(prop) {
  const { city, what } = placeBits(prop);
  const where = city ? city + ", Pakistan" : "Pakistan";
  const base = "Property exchange auction for this " + what.toLowerCase() + " in " + where + ". Bid on the property auction or offer another property in exchange.";
  return fitText(base, 150, 160, [" Bid now."]);
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function isLive(prop) {
  const label = statusLabel(prop);
  return label === "Live" || label === "Ending soon";
}

function pageUrlFor(id) {
  return AUCTION + "p/" + encodeURIComponent(id) + "/";
}

function pageHtml(prop, image, others) {
  const id = prop.id;
  const pageUrl = pageUrlFor(id);
  const appUrl = AUCTION + "#/property/" + encodeURIComponent(id);
  const heading = cleanLabel(prop.title) || "Property auction";
  const fullTitle = seoTitle(prop);
  const desc = seoDescription(prop);
  const imageUrl = image ? pageUrl + "og.jpg" : AUCTION + "og-default.jpg";
  const imageW = 1200;
  const imageH = 630;
  const when = formatDate(prop.endsAt);
  const video = youtubeUrl(prop.youtubeUrl);
  const status = statusLabel(prop);
  const city = cleanLabel(prop.city);
  const endDay = String(prop.endsAt || "").slice(0, 10);
  const price = String(Math.round(Number(prop.minBid) || 0));
  const availability = (status === "Ended" || status === "Closed")
    ? "https://schema.org/SoldOut"
    : "https://schema.org/InStock";
  const homeUrl = SITE + "/";
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl },
          { "@type": "ListItem", position: 2, name: "Auctions", item: AUCTION },
          { "@type": "ListItem", position: 3, name: heading, item: pageUrl }
        ]
      },
      {
        "@type": "RealEstateListing",
        name: heading,
        description: desc,
        url: pageUrl,
        image: image ? [imageUrl, pageUrl + "cover.jpg"] : imageUrl,
        address: {
          "@type": "PostalAddress",
          addressLocality: city || "Pakistan",
          addressCountry: "PK"
        },
        validThrough: prop.endsAt || undefined,
        offers: {
          "@type": "Offer",
          price: price,
          priceCurrency: "PKR",
          availability: availability,
          priceValidUntil: endDay || undefined,
          url: pageUrl
        }
      }
    ]
  };
  const rows = [
    ["Status", status],
    ["City", prop.city],
    ["Size", prop.size],
    ["Type", prop.type],
    ["Minimum bid", prop.minBid ? formatPKR(prop.minBid) : ""],
    ["Current highest", prop.currentHighest ? formatPKR(prop.currentHighest) : ""],
    ["Minimum increment", prop.increment ? formatPKR(prop.increment) : ""],
    ["Auction ends", when],
    ["Exchange wanted", prop.exchangeWanted]
  ].filter(([, v]) => v);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0b2545" />
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2DBH5L4NM1"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-2DBH5L4NM1');
  </script>
  <link rel="manifest" href="../../manifest.webmanifest" />
  <link rel="apple-touch-icon" href="../../icon-192.png" sizes="192x192" />
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <meta name="robots" content="index,follow" />
  <meta property="og:site_name" content="Team Work Complex Pvt Ltd" />
  <meta property="og:type" content="product" />
  <meta property="og:locale" content="en_PK" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:title" content="${escapeHtml(fullTitle)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="${imageW}" />
  <meta property="og:image:height" content="${imageH}" />
  <meta property="og:image:alt" content="${escapeHtml(heading)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <script type="application/ld+json">${jsonLd(ld)}</script>
  <style>
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; background: #eef2f6; color: #0b2545; }
    main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
    h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 8px; }
    .meta { color: #5c6b7a; margin: 0 0 16px; }
    img { width: 100%; height: auto; border-radius: 16px; background: #14325a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 16px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid #e2e8ef; vertical-align: top; }
    th { width: 38%; color: #5c6b7a; font-weight: 600; }
    a.btn { display: inline-block; margin: 18px 8px 0 0; background: #f4c430; color: #0b2545; font-weight: 700; text-decoration: none; padding: 12px 16px; border-radius: 12px; }
    a.btn.ghost { background: #fff; border: 1px solid #c9a227; }
    .crumbs { font-size: .92rem; color: #5c6b7a; margin: 0 0 12px; }
    .crumbs a { color: #0b2545; font-weight: 700; text-decoration: none; }
    .others a { color: #0b2545; font-weight: 700; }
    a.yt { display: inline-flex; align-items: center; gap: 8px; margin-top: 14px; color: #0b2545; font-weight: 700; text-decoration: none; }
    a.yt svg { width: 20px; height: 20px; flex: 0 0 20px; }
    a.yt small { display: block; font-weight: 600; color: #5c6b7a; font-size: .85rem; }
    p.note { color: #5c6b7a; font-size: .92rem; }
  </style>
</head>
<body>
  <main>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${escapeHtml(homeUrl)}">Home</a> › <a href="${escapeHtml(AUCTION)}">Auctions</a> › <span>Property</span></nav>
    <p class="meta">Team Work Complex Pvt Ltd · Property exchange auction · Pakistan</p>
    <h1>${escapeHtml(heading)}</h1>
    <p class="meta">${escapeHtml([city, cleanLabel(prop.size), cleanLabel(prop.type)].filter(Boolean).join(" · "))}</p>
    ${image ? `<p><img src="cover.jpg" alt="${escapeHtml(heading)}" width="${image.width}" height="${image.height}"></p>` : ""}
    <table>
      ${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(cleanLabel(v))}</td></tr>`).join("\n      ")}
    </table>
    ${video ? `<p><a href="${escapeHtml(video)}">Property video</a></p>` : ""}
    <p><a class="btn" href="${escapeHtml(pageUrl)}">View this property auction</a> <a class="btn ghost" href="${escapeHtml(appUrl)}">Open in the auction app</a></p>
    <p><a href="${escapeHtml(AUCTION)}">Back to all auctions</a></p>
    <h2>Other live auctions</h2>
    ${others.length ? `<ul class="others">${others.map((item) => `<li><a href="${escapeHtml(pageUrlFor(item.id))}">${escapeHtml(cleanLabel(item.title) || "Property auction")}</a></li>`).join("")}</ul>` : `<p class="note">No other live auctions right now.</p>`}
    <p><a class="yt" href="https://www.youtube.com/@teamworkcomplexpvtltd" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8z"/><path fill="#fff" d="M9.8 15.5v-7l6.2 3.5z"/></svg><span>Our YouTube Channel<small lang="ur">ہمارا یوٹیوب چینل</small></span></a></p>
    <p class="note">Bids are placed in the auction app. Owner names, CNIC numbers and documents are not shown.</p>
  </main>
  <script>
    (function () {
      var ua = navigator.userAgent || "";
      var bot = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|google|bing|embedly|quora|pinterest|slack|discord|twitter/i.test(ua);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("../../sw.js", { scope: "/propertyexchange/auction/" }).catch(function () {});
      }
      if (!bot) location.replace(${JSON.stringify(appUrl)});
    })();
  </script>
</body>
</html>
`;
}

async function writeRobots() {
  const path = join(ROOT, "robots.txt");
  const line = "Sitemap: " + AUCTION + "sitemap.xml";
  let text = "";
  try { text = await readFile(path, "utf8"); } catch { text = ""; }
  if (!text) {
    await writeFile(path, "User-agent: *\nAllow: /\n\n" + line + "\n");
    return;
  }
  if (!text.split(/\r?\n/).some((row) => row.trim() === line)) {
    if (!text.endsWith("\n")) text += "\n";
    await writeFile(path, text + line + "\n");
  }
}

async function main() {
  const docs = await listCollection(LIST_URL);
  const properties = [];
  for (const doc of docs) {
    const prop = docFields(doc);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(prop.id)) continue;
    const photos = await listCollection(LIST_URL + "/" + encodeURIComponent(prop.id) + "/photos");
    const rows = photos.map((p) => ({
      n: p.fields && p.fields.n ? Number(fieldValue(p.fields.n)) : Number(String(p.name).split("/").pop()),
      dataUrl: p.fields && p.fields.dataUrl ? fieldValue(p.fields.dataUrl) : ""
    })).sort((a, b) => a.n - b.n);
    let image = null;
    for (const row of rows) {
      const buf = decodeDataUrl(row.dataUrl);
      if (!buf) continue;
      image = await jpeg(buf, 1200);
      image.og = await ogCrop(buf);
      break;
    }
    properties.push({ prop, image });
  }

  const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#f4c430"/>
  <text x="64" y="78" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#0b2545">TWC</text>
</svg>`;
  const icon = await sharp(Buffer.from(iconSvg)).png().toBuffer();
  const icon32 = await sharp(icon).resize(32, 32).png().toBuffer();
  const card = await jpeg(Buffer.from(brandSvg(1200, 630, "Property exchange auctions in Pakistan")), 1200);
  await mkdir(join(ROOT, "auction"), { recursive: true });
  await writeFile(join(ROOT, "auction", "favicon.png"), icon);
  await writeFile(join(ROOT, "auction", "og-default.jpg"), card.buf);
  const ico = pngIco(icon32, 32);
  await writeFile(join(ROOT, "favicon.ico"), ico);

  const dir = join(ROOT, "auction", "p");
  await mkdir(dir, { recursive: true });
  const keep = new Set(properties.map((p) => p.prop.id));
  for (const name of await readdir(dir)) {
    if (!keep.has(name)) await rm(join(dir, name), { recursive: true, force: true });
  }
  const live = properties.filter(({ prop }) => isLive(prop));
  for (const { prop, image } of properties) {
    const folder = join(dir, prop.id);
    await mkdir(folder, { recursive: true });
    const others = live.filter((item) => item.prop.id !== prop.id).map((item) => item.prop);
    await writeFile(join(folder, "index.html"), pageHtml(prop, image, others));
    if (image) {
      await writeFile(join(folder, "cover.jpg"), image.buf);
      await writeFile(join(folder, "og.jpg"), image.og);
    } else {
      await rm(join(folder, "cover.jpg"), { force: true });
      await rm(join(folder, "og.jpg"), { force: true });
    }
  }
  await updateHomepage(live.map((item) => item.prop));

  const dates = properties.map(({ prop }) => (prop.updateTime || "").slice(0, 10)).filter(Boolean).sort();
  const homeLast = dates.length ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: AUCTION, lastmod: homeLast },
    ...properties.map(({ prop }) => ({
      loc: pageUrlFor(prop.id),
      lastmod: (prop.updateTime || "").slice(0, 10) || homeLast
    }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${escapeHtml(u.lastmod)}</lastmod>` : ""}</url>`).join("\n") +
    `\n</urlset>\n`;
  await writeFile(join(ROOT, "auction", "sitemap.xml"), xml);
  await writeRobots();
  console.log(`Wrote ${properties.length} property page(s).`);
}

function listingCards(props) {
  if (!props.length) {
    return `<section class="static-auctions"><h2>Live property auctions in Pakistan</h2><p>No live auctions are listed right now. <a href="${escapeHtml(AUCTION)}">See all auctions</a>.</p></section>`;
  }
  const cards = props.map((prop) => {
    const href = pageUrlFor(prop.id);
    const title = cleanLabel(prop.title) || seoTitle(prop);
    const meta = [prop.city, prop.size, prop.type].filter(Boolean).map(cleanLabel).join(" · ");
    return `<article class="static-card"><a href="${escapeHtml(href)}"><img src="${escapeHtml(href)}cover.jpg" alt="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(meta)}</p></a></article>`;
  }).join("\n");
  return `<section class="static-auctions" aria-label="Live auctions"><h2>Live property auctions in Pakistan</h2>\n${cards}\n</section>`;
}

function homepageGraph(props) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Team Work Complex Property Exchange",
        url: AUCTION,
        publisher: {
          "@type": "Organization",
          name: "Team Work Complex Pvt Ltd",
          logo: AUCTION + "icon-512.png"
        }
      },
      {
        "@type": "ItemList",
        name: "Live property auctions in Pakistan",
        itemListElement: props.map((prop, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: cleanLabel(prop.title) || seoTitle(prop),
          url: pageUrlFor(prop.id)
        }))
      }
    ]
  };
}

function replaceMarked(html, name, inner) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const pattern = new RegExp(start + "[\\s\\S]*?" + end);
  if (!pattern.test(html)) throw new Error("Missing homepage marker " + name);
  return html.replace(pattern, start + "\n" + inner.trim() + "\n" + end);
}

async function updateHomepage(props) {
  const path = join(ROOT, "auction", "index.html");
  let html = await readFile(path, "utf8");
  const cards = listingCards(props);
  const data = `<script type="application/ld+json">${jsonLd(homepageGraph(props))}</script>`;
  html = replaceMarked(html, "static-auctions", cards);
  html = replaceMarked(html, "static-auctions-noscript", cards);
  html = replaceMarked(html, "homepage-ld", data);
  await writeFile(path, html);
}

function pngIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
