// Linux name reader helper: tesseract.js over stdin/stdout, the same line protocol as electron/winocr-helper.ps1 so
// electron/nameReader.ts drives it unchanged. Run with Electron's own Node (ELECTRON_RUN_AS_NODE=1).
// In:  one line per read, "<id> <width> <height> <base64 of width*height*4 RGBA bytes>".
// Out: one JSON line per read, {"id":n,"text":"...","ms":n}; first a {"ready":true,"ms":n,"lang":"eng"} line.
// The English model is read from the local @tesseract.js-data/eng package: nothing is downloaded at runtime.
'use strict';
const path = require('node:path');
const readline = require('node:readline');

const t0 = Date.now();
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');

/** RGBA -> 8-bit grey BMP (bottom-up rows, 300 dpi), the format tesseract.js reads without any image library. */
function greyBmp(rgba, width, height) {
  const stride = (width + 3) & ~3;
  const head = 54 + 1024;
  const buf = Buffer.alloc(head + stride * height);
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(head, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(8, 28);
  buf.writeUInt32LE(stride * height, 34);
  buf.writeInt32LE(11811, 38);
  buf.writeInt32LE(11811, 42);
  buf.writeUInt32LE(256, 46);
  for (let i = 0; i < 256; i++) buf.fill(i, 54 + i * 4, 54 + i * 4 + 3);
  for (let y = 0; y < height; y++) {
    let o = head + (height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      buf[o++] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114 + 500) / 1000;
    }
  }
  return buf;
}

async function main() {
  let T;
  try {
    T = require('tesseract.js');
  } catch (e) {
    out({ fatal: `tesseract.js missing: ${e.message}` });
    process.exit(3);
  }
  const langDir = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
  const worker = await T.createWorker('eng', T.OEM.LSTM_ONLY, {
    langPath: langDir,
    gzip: true,
    cacheMethod: 'none', // read the model straight from langPath; never write a copy into the working directory
  });
  await worker.setParameters({
    tessedit_pageseg_mode: T.PSM.SINGLE_LINE,
    user_defined_dpi: '300',
  });
  out({ ready: true, ms: Date.now() - t0, lang: 'eng' });

  // Reads run one at a time, in order (the worker is single-threaded anyway).
  let chain = Promise.resolve();
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line) return;
    chain = chain.then(async () => {
      const t = Date.now();
      const [id, w, h, b64] = line.split(' ');
      try {
        const width = Number(w),
          height = Number(h);
        const rgba = Buffer.from(b64, 'base64');
        if (rgba.length < width * height * 4) throw new Error('short crop');
        const r = await worker.recognize(greyBmp(rgba, width, height));
        out({ id: Number(id), text: String(r.data.text).trim(), ms: Date.now() - t });
      } catch (e) {
        out({ id: Number(id), text: '', ms: Date.now() - t, error: String(e && e.message) });
      }
    });
  });
  rl.on('close', () => chain.then(() => worker.terminate()).then(() => process.exit(0)));
}

main().catch((e) => {
  out({ fatal: String(e && e.message) });
  process.exit(3);
});
