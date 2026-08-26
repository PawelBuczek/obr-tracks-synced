const fs = require("fs");
const path = require("path");

const domains = [
  "abc.com", "bcd.com", "cde.net", "defgh.org", "efghi.io", "fileshare.co", "mediahost.dev", "soundvault.app",
  "trackbin.xyz", "audiodrop.info", "clipstore.me", "sonicbase.tv", "musichive.cloud", "waveport.site",
  "echoserve.online", "notevault.pro", "tunebox.biz", "ridgehost.live", "loopstash.fun", "beatrack.digital",
  "ambientdock.store", "riffcache.tech", "drumline.media", "hushline.audio", "chordwell.net", "pixelnote.com",
  "stagehold.org", "murmurbox.io", "glowtrack.co", "driftfile.dev",
];

function randChars(len, charset) {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += charset[Math.floor(Math.random() * charset.length)];
  }
  return s;
}

const lowerNum = "abcdefghijklmnopqrstuvwxyz0123456789";

const tagsPool = [
  "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Ambient", "Battle", "Calm", "Dark", "Epic", "Forest", "Ghost", "Haunt", "Ice", "Jungle",
];

const rows = [];
const usedUrls = new Set();

function buildUrl(domain, seg1, seg2, filename) {
  return `https://www.${domain}/${seg1}/file/${seg2}/${filename}.mp3`;
}

for (let i = 1; i <= 100; i++) {
  const domain = domains[i % domains.length];
  const seg1 = randChars(6 + (i % 5), lowerNum);
  const seg2 = randChars(10, lowerNum);
  let filename = randChars(30, lowerNum);
  let url = buildUrl(domain, seg1, seg2, filename);

  while (url.length < 96) {
    filename += randChars(1, lowerNum);
    url = buildUrl(domain, seg1, seg2, filename);
  }
  while (url.length > 104) {
    filename = filename.slice(0, -1);
    url = buildUrl(domain, seg1, seg2, filename);
  }

  if (usedUrls.has(url)) {
    filename += randChars(3, lowerNum);
    url = buildUrl(domain, seg1, seg2, filename);
  }
  usedUrls.add(url);

  const title = "Track " + String(i).padStart(3, "0");
  const numTags = 1 + (i % 2);
  const tags = [];
  for (let t = 0; t < numTags; t++) {
    tags.push(tagsPool[(i + t * 7) % tagsPool.length]);
  }

  rows.push({ url, title, tags: tags.join("|") });
}

const lengths = rows.map(r => r.url.length);
console.log("min", Math.min(...lengths), "max", Math.max(...lengths));
console.log("unique urls", usedUrls.size, "of", rows.length);

const escape = v => {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
};

const lines = ["url,title,tags"];
for (const r of rows) {
  lines.push([escape(r.url), escape(r.title), escape(r.tags)].join(","));
}

const outDir = path.join(__dirname, "..", "src", "vitests", "simulation", "fixtures");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "large-import-100-tracks.csv");
fs.writeFileSync(outPath, lines.join("\n") + "\n");
console.log("wrote", outPath);
