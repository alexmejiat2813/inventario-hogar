const path   = require('path');
const fs     = require('fs');
const multer = require('multer');

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_PHOTOS     = 5;

// Persistent uploads root — overridable so it can point to a volume in production
const UPLOADS_DIR  = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'public', 'uploads');

const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'receipts');
if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

const receiptStorage = multer.diskStorage({
  destination: RECEIPTS_DIR,
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: MAX_PHOTO_SIZE },
  fileFilter(req, file, cb) {
    if (/^image\/(jpeg|jpg|png|webp|heic|heif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Formato de imagen no válido'));
  },
});

const PRODUCT_IMAGES_DIR = path.join(UPLOADS_DIR, 'products');
if (!fs.existsSync(PRODUCT_IMAGES_DIR)) fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });

const productImageStorage = multer.diskStorage({
  destination: PRODUCT_IMAGES_DIR,
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `prod-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

// Allowlist de rasterizados. SVG queda EXCLUIDO a proposito: un SVG puede
// contener <script> y, servido desde el mismo origin, seria XSS almacenado.
const RASTER_RE = /^image\/(jpe?g|png|webp|gif|heic|heif)$/i;
const RASTER_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const SVG_RE = /svg/i;

const uploadProductImage = multer({
  storage: productImageStorage,
  limits: { fileSize: MAX_PHOTO_SIZE },
  fileFilter(req, file, cb) {
    const isSvg = SVG_RE.test(file.mimetype) || /\.svgz?$/i.test(file.originalname);
    const ok    = RASTER_RE.test(file.mimetype) || RASTER_EXT_RE.test(file.originalname);
    if (!isSvg && ok) cb(null, true);
    else cb(new Error('Formato de imagen no válido'));
  },
}).array('photos', MAX_PHOTOS);

// Resolve a stored web path ('/uploads/products/x.jpg') to its physical file
// path inside UPLOADS_DIR (which may be a persistent volume in production).
function uploadFilePath(webPath) {
  if (!webPath) return null;
  const rel = String(webPath).replace(/^\/?uploads\//, '');
  return path.join(UPLOADS_DIR, rel);
}

// Validate file magic bytes — Content-Type header is client-controlled and
// can be spoofed. Reading actual bytes defends against disguised payloads.
function checkMagicBytes(filePath) {
  const fd  = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(12);
  const n   = fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  if (n < 2) return false;
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8) return true;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WebP: RIFF????WEBP
  if (n >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  // HEIC/HEIF: 'ftyp' at offset 4
  if (n >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true;
  return false;
}

function cleanupFiles(files) {
  for (const f of (files || [])) {
    try { fs.unlinkSync(f.path); } catch {}
  }
}

module.exports = { uploadReceipt, uploadProductImage, uploadFilePath, UPLOADS_DIR, checkMagicBytes, cleanupFiles };
