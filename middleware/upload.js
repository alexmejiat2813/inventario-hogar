const path   = require('path');
const fs     = require('fs');
const multer = require('multer');

const RECEIPTS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'receipts');
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

const PRODUCT_IMAGES_DIR = path.join(__dirname, '..', 'public', 'uploads', 'products');
if (!fs.existsSync(PRODUCT_IMAGES_DIR)) fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });

const productImageStorage = multer.diskStorage({
  destination: PRODUCT_IMAGES_DIR,
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `prod-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadProductImage = multer({
  storage: productImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (/^image\//i.test(file.mimetype) || /\.heic$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato de imagen no válido'));
  },
}).array('photos', 5);

module.exports = { uploadReceipt, uploadProductImage };
