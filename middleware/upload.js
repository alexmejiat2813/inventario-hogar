const path   = require('path');
const fs     = require('fs');
const multer = require('multer');

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
  limits: { fileSize: 5 * 1024 * 1024 },
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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const isSvg = SVG_RE.test(file.mimetype) || /\.svgz?$/i.test(file.originalname);
    const ok    = RASTER_RE.test(file.mimetype) || RASTER_EXT_RE.test(file.originalname);
    if (!isSvg && ok) cb(null, true);
    else cb(new Error('Formato de imagen no válido'));
  },
}).array('photos', 5);

// Resolve a stored web path ('/uploads/products/x.jpg') to its physical file
// path inside UPLOADS_DIR (which may be a persistent volume in production).
function uploadFilePath(webPath) {
  if (!webPath) return null;
  const rel = String(webPath).replace(/^\/?uploads\//, '');
  return path.join(UPLOADS_DIR, rel);
}

module.exports = { uploadReceipt, uploadProductImage, uploadFilePath, UPLOADS_DIR };
