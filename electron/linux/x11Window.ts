// Linux (X11 / XWayland) twin of the Win32 calls in electron/gameWindow.ts. Deadlock under Proton is an XWayland
// window, and the app runs with --ozone-platform=x11, so both live on the same X server: find the game by its exact
// title on _NET_CLIENT_LIST, read its root-relative rect, check _NET_ACTIVE_WINDOW, and read small regions of its
// pixels with XGetImage. libX11 through koffi (prebuilt FFI, no node-gyp), on our own Display connection.
// Nothing here reads game memory or touches game files: X window properties and pixels only.
import koffi from 'koffi';
import type { Rect } from '../gameWindow';

type Ptr = unknown;
const ZPixmap = 2;
const AllPlanes = 0xffffffffffffffffn;
const XA_WINDOW = 33n;
const XA_ATOM = 4n;
const AnyPropertyType = 0n;

// Only the leading fields of XImage that we read (64-bit layout).
const XImage = koffi.struct('BrawlXImage', {
  width: 'int',
  height: 'int',
  xoffset: 'int',
  format: 'int',
  data: 'void *',
  byte_order: 'int',
  bitmap_unit: 'int',
  bitmap_bit_order: 'int',
  bitmap_pad: 'int',
  depth: 'int',
  bytes_per_line: 'int',
  bits_per_pixel: 'int',
});
const ErrorHandler = koffi.proto('int BrawlXErrorHandler(void *dpy, void *ev)');

function loadX11() {
  const lib = koffi.load('libX11.so.6');
  return {
    XOpenDisplay: lib.func('void *XOpenDisplay(const char *name)'),
    XDefaultRootWindow: lib.func('unsigned long XDefaultRootWindow(void *dpy)'),
    XInternAtom: lib.func('unsigned long XInternAtom(void *dpy, const char *name, int onlyIfExists)'),
    XGetWindowProperty: lib.func(
      'int XGetWindowProperty(void *dpy, unsigned long w, unsigned long prop, long offset, long length, int del, unsigned long reqType, _Out_ unsigned long *actualType, _Out_ int *actualFormat, _Out_ unsigned long *nitems, _Out_ unsigned long *bytesAfter, _Out_ void **prop)',
    ),
    XGetGeometry: lib.func(
      'int XGetGeometry(void *dpy, unsigned long d, _Out_ unsigned long *root, _Out_ int *x, _Out_ int *y, _Out_ unsigned int *w, _Out_ unsigned int *h, _Out_ unsigned int *border, _Out_ unsigned int *depth)',
    ),
    XTranslateCoordinates: lib.func(
      'int XTranslateCoordinates(void *dpy, unsigned long src, unsigned long dst, int x, int y, _Out_ int *dx, _Out_ int *dy, _Out_ unsigned long *child)',
    ),
    XGetImage: lib.func(
      'BrawlXImage *XGetImage(void *dpy, unsigned long d, int x, int y, unsigned int w, unsigned int h, unsigned long planeMask, int format)',
    ),
    XFree: lib.func('int XFree(void *p)'),
    XSync: lib.func('int XSync(void *dpy, int discard)'),
    XSetErrorHandler: lib.func('void *XSetErrorHandler(BrawlXErrorHandler *handler)'),
    // the same call, to put back whatever handler was there before (an opaque pointer we only hand back)
    XRestoreErrorHandler: lib.func('XSetErrorHandler', 'void *', ['void *']),
  };
}

let x: ReturnType<typeof loadX11> | null = null;
let dpy: Ptr = null;
let root = 0n;
const atoms = new Map<string, bigint>();
let cached: { title: string; xid: bigint; rect: Rect } | null = null;

// X errors (a window closing between two calls, a region off the window) would hit Xlib's default handler, which
// exits the process. Ours only counts them, and it is installed just around our own calls, then the previous one
// (Chromium's, if any) is put back.
let xErrors = 0;
const onXError = koffi.register(() => {
  xErrors++;
  return 0;
}, koffi.pointer(ErrorHandler));

function open(): boolean {
  if (dpy) return true;
  if (process.platform !== 'linux' || !process.env.DISPLAY) return false;
  try {
    x ??= loadX11();
    dpy = x.XOpenDisplay(null);
    if (!dpy) return false;
    root = BigInt(x.XDefaultRootWindow(dpy));
    return true;
  } catch {
    dpy = null;
    return false;
  }
}

/** Runs `fn` with our error handler installed; null when it threw or an X error happened during it. */
function guarded<T>(fn: () => T): T | null {
  if (!open() || !x) return null;
  const prev = x.XSetErrorHandler(onXError);
  const before = xErrors;
  try {
    const v = fn();
    x.XSync(dpy, 0);
    return xErrors === before ? v : null;
  } catch {
    return null;
  } finally {
    x.XRestoreErrorHandler(prev);
  }
}

function atom(name: string): bigint {
  let a = atoms.get(name);
  if (a === undefined) {
    a = BigInt(x!.XInternAtom(dpy, name, 0));
    atoms.set(name, a);
  }
  return a;
}

/** A window property as raw bytes plus its format (8, 16 or 32; 32 means C longs, 8 bytes each here). */
function prop(
  win: bigint,
  name: string,
  type: bigint = AnyPropertyType,
): { format: number; n: number; bytes: Buffer } | null {
  const actualType = [0n],
    actualFormat = [0],
    nitems = [0n],
    after = [0n],
    data: Ptr[] = [null];
  const rc = x!.XGetWindowProperty(
    dpy,
    win,
    atom(name),
    0,
    4096,
    0,
    type,
    actualType,
    actualFormat,
    nitems,
    after,
    data,
  );
  if (rc !== 0 || !data[0]) return null;
  try {
    const format = actualFormat[0]!;
    const n = Number(nitems[0]);
    if (!format || !n) return null;
    const size = n * (format === 32 ? 8 : format / 8);
    const bytes = Buffer.from(koffi.decode(data[0], 'uint8', size) as number[]);
    return { format, n, bytes };
  } finally {
    x!.XFree(data[0]);
  }
}

function longs(p: { format: number; n: number; bytes: Buffer } | null): bigint[] {
  if (!p || p.format !== 32) return [];
  const out: bigint[] = [];
  for (let i = 0; i < p.n; i++) out.push(p.bytes.readBigUInt64LE(i * 8));
  return out;
}

function title(win: bigint): string {
  const net = prop(win, '_NET_WM_NAME');
  if (net) return net.bytes.toString('utf8');
  const old = prop(win, 'WM_NAME');
  return old ? old.bytes.toString('latin1') : '';
}

function rectOf(win: bigint): Rect | null {
  const r = [0n],
    gx = [0],
    gy = [0],
    w = [0],
    h = [0],
    b = [0],
    d = [0];
  if (!x!.XGetGeometry(dpy, win, r, gx, gy, w, h, b, d)) return null;
  const dx = [0],
    dy = [0],
    child = [0n];
  if (!x!.XTranslateCoordinates(dpy, win, root, 0, 0, dx, dy, child)) return null;
  return { x: dx[0]!, y: dy[0]!, width: w[0]!, height: h[0]! };
}

function isHidden(win: bigint): boolean {
  return longs(prop(win, '_NET_WM_STATE', XA_ATOM)).includes(atom('_NET_WM_STATE_HIDDEN'));
}

/** Same contract as gameWindow.ts#findGameWindow: exact title match, `exclude` skips our own windows, `only` accepts
 *  just that one window (test mode's dummy). Null when there is none, or it is minimised. */
export function findGameWindowX11(
  wanted: string,
  isTitle: (t: string, n: string) => boolean,
  exclude?: Set<bigint>,
  only?: bigint,
): Rect | null {
  return guarded(() => {
    let xid: bigint | null = null;
    if (
      cached &&
      cached.title === wanted &&
      !exclude?.has(cached.xid) &&
      (only === undefined || cached.xid === only) &&
      isTitle(title(cached.xid), wanted)
    )
      xid = cached.xid;
    if (xid === null) {
      for (const w of longs(prop(root, '_NET_CLIENT_LIST', XA_WINDOW))) {
        if (exclude?.has(w)) continue;
        if (only !== undefined && w !== only) continue;
        if (isTitle(title(w), wanted)) {
          xid = w;
          break;
        }
      }
    }
    if (xid === null) {
      cached = null;
      return null;
    }
    const rect = rectOf(xid);
    if (!rect) {
      cached = null;
      return null;
    }
    cached = { title: wanted, xid, rect };
    return isHidden(xid) ? null : rect;
  });
}

export function isGameForegroundX11(): boolean {
  if (!cached) return false;
  const c = cached;
  return guarded(() => longs(prop(root, '_NET_ACTIVE_WINDOW', XA_WINDOW))[0] === c.xid) ?? false;
}

/** Borderless: fullscreen state, or Motif hints asking for no decorations. Null when there is no game window. */
export function gameWindowIsBorderlessX11(): boolean | null {
  if (!cached) return null;
  const c = cached;
  return guarded(() => {
    if (longs(prop(c.xid, '_NET_WM_STATE', XA_ATOM)).includes(atom('_NET_WM_STATE_FULLSCREEN'))) return true;
    const m = longs(prop(c.xid, '_MOTIF_WM_HINTS'));
    if (m.length >= 3 && (m[0]! & 2n) !== 0n) return m[2] === 0n;
    return false;
  });
}

/** A screen rectangle (root px) of the game window as top-down BGRA, like the GDI grab. Read from the game window
 *  itself, so whatever covers it on screen is never read. Null when it fails or falls outside the window. */
export function grabScreenRegionX11(sx: number, sy: number, width: number, height: number): Uint8Array | null {
  if (!cached || width <= 0 || height <= 0) return null;
  const c = cached;
  const wx = sx - c.rect.x,
    wy = sy - c.rect.y;
  if (wx < 0 || wy < 0 || wx + width > c.rect.width || wy + height > c.rect.height) return null;
  return guarded(() => {
    const img = x!.XGetImage(dpy, c.xid, wx, wy, width, height, AllPlanes, ZPixmap) as Ptr;
    if (!img) return null;
    try {
      const im = koffi.decode(img, XImage) as {
        data: Ptr;
        bytes_per_line: number;
        bits_per_pixel: number;
        byte_order: number;
      };
      if (im.bits_per_pixel !== 32 || im.byte_order !== 0) return null; // only the usual 24/32-bit LSB-first visual
      const raw = Buffer.from(koffi.decode(im.data, 'uint8', im.bytes_per_line * height) as number[]);
      const out = new Uint8Array(width * height * 4);
      for (let j = 0; j < height; j++) {
        out.set(raw.subarray(j * im.bytes_per_line, j * im.bytes_per_line + width * 4), j * width * 4);
        for (let i = j * width * 4 + 3; i < (j + 1) * width * 4; i += 4) out[i] = 255;
      }
      return out;
    } finally {
      // XDestroyImage is a macro; for a plain XGetImage result it frees the pixel data and the struct.
      const im = koffi.decode(img, XImage) as { data: Ptr };
      if (im.data) x!.XFree(im.data);
      x!.XFree(img);
    }
  });
}
