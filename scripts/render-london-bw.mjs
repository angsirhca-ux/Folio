import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Central London — Kensington to Docklands, Regent's Park to south of Thames
const LAT_N = 51.545;
const LAT_S = 51.455;
const LON_W = -0.22;
const LON_E = 0.02;
const ZOOM = 13;

function latLonToTile(lat, lon, zoom) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
  );
  return [x, y];
}

function latLonToPixel(lat, lon, zoom, tileX0, tileY0) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
  return [(x - tileX0) * 256, (y - tileY0) * 256];
}

let [x0, y0] = latLonToTile(LAT_N, LON_W, ZOOM);
let [x1, y1] = latLonToTile(LAT_S, LON_E, ZOOM);
if (x1 < x0) [x0, x1] = [x1, x0];
if (y1 < y0) [y0, y1] = [y1, y0];

const xs = [];
for (let x = x0; x <= x1; x++) xs.push(x);
const ys = [];
for (let y = y0; y <= y1; y++) ys.push(y);
console.log(`tiles ${xs.length}x${ys.length} = ${xs.length * ys.length}`);

const tileW = 256;
const tileH = 256;
const composites = [];

for (let i = 0; i < xs.length; i++) {
  for (let j = 0; j < ys.length; j++) {
    const x = xs[i];
    const y = ys[j];
    const url = `https://basemaps.cartocdn.com/light_all/${ZOOM}/${x}/${y}.png`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FolioStoryMap/1.0 (author tooling)" },
    });
    if (!res.ok) throw new Error(`tile ${x},${y} HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    composites.push({ input: buf, left: i * tileW, top: j * tileH });
    process.stdout.write(".");
  }
}
console.log(" fetched");

const width = xs.length * tileW;
const height = ys.length * tileH;
const stitched = await sharp({
  create: {
    width,
    height,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
})
  .composite(composites)
  .png()
  .toBuffer();

const [left, top] = latLonToPixel(LAT_N, LON_W, ZOOM, x0, y0);
const [right, bottom] = latLonToPixel(LAT_S, LON_E, ZOOM, x0, y0);
const l = Math.max(0, Math.floor(Math.min(left, right)));
const t = Math.max(0, Math.floor(Math.min(top, bottom)));
const r = Math.min(width, Math.ceil(Math.max(left, right)));
const b = Math.min(height, Math.ceil(Math.max(top, bottom)));

const cropped = sharp(stitched).extract({
  left: l,
  top: t,
  width: r - l,
  height: b - t,
});

const meta = await cropped.metadata();
const maxEdge = 2200;
const scale = Math.min(1, maxEdge / Math.max(meta.width, meta.height));
const outW = Math.round(meta.width * scale);
const outH = Math.round(meta.height * scale);

const outDir = path.join(__dirname, "..", "public", "basemaps");
fs.mkdirSync(outDir, { recursive: true });
const pngPath = path.join(outDir, "london-bw.png");
const jpgPath = path.join(outDir, "london-bw.jpg");

await cropped
  .resize(outW, outH, { fit: "fill" })
  .greyscale()
  .normalize()
  .linear(1.35, -(128 * 0.35))
  .png({ compressionLevel: 9 })
  .toFile(pngPath);

await sharp(pngPath).jpeg({ quality: 88, mozjpeg: true }).toFile(jpgPath);

const st = fs.statSync(pngPath);
const stj = fs.statSync(jpgPath);
console.log(
  "saved",
  pngPath,
  `${outW}x${outH}`,
  `${(st.size / 1024).toFixed(0)}KB`,
);
console.log("saved", jpgPath, `${(stj.size / 1024).toFixed(0)}KB`);
