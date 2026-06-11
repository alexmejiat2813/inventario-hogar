'use strict';

const router  = require('express').Router();
const crypto  = require('node:crypto');
const fs      = require('node:fs');
const path    = require('node:path');
const logger  = require('../logger');

const DB_PATH  = process.env.DB_PATH  || './inventario.db';
const DATA_DIR = path.dirname(DB_PATH);

// ── AWS Sig V4 minimal PutObject ──────────────────────────────

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function sha256hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function s3Put({ endpoint, bucket, region, accessKey, secretKey, key, body }) {
  const now  = new Date();
  const date = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const day  = date.slice(0, 8);

  const url     = new URL(`${endpoint}/${bucket}/${key}`);
  const host    = url.host;
  const urlPath = url.pathname;
  const bodyHash = sha256hex(body);

  const hdrs = {
    host,
    'content-length':        String(body.length),
    'content-type':          'application/octet-stream',
    'x-amz-content-sha256': bodyHash,
    'x-amz-date':           date,
  };
  const sortedKeys    = Object.keys(hdrs).sort();
  const canonHdrs     = sortedKeys.map(k => `${k}:${hdrs[k]}`).join('\n') + '\n';
  const signedHdrs    = sortedKeys.join(';');
  const canonRequest  = `PUT\n${urlPath}\n\n${canonHdrs}\n${signedHdrs}\n${bodyHash}`;
  const scope         = `${day}/${region}/s3/aws4_request`;
  const strToSign     = `AWS4-HMAC-SHA256\n${date}\n${scope}\n${sha256hex(canonRequest)}`;

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), 's3'), 'aws4_request');
  const sig        = crypto.createHmac('sha256', signingKey).update(strToSign).digest('hex');
  hdrs.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHdrs}, Signature=${sig}`;
  delete hdrs.host;

  const res = await fetch(url.toString(), { method: 'PUT', headers: hdrs, body });
  return { ok: res.ok, status: res.status };
}

// ── Local backup ──────────────────────────────────────────────

function createLocalBackup() {
  const backupsDir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(backupsDir, `backup-${ts}.db`);
  fs.copyFileSync(DB_PATH, dest);

  // Keep last 7 backups only
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
    .sort();
  while (files.length > 7) fs.unlinkSync(path.join(backupsDir, files.shift()));

  return dest;
}

// ── Route ─────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  // Accept either session-based admin OR a dedicated BACKUP_SECRET header
  const secret = process.env.BACKUP_SECRET;
  if (secret) {
    if (req.headers['x-backup-secret'] !== secret) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } else if (!req.isAuthenticated?.() || !require('../middleware/auth').isAdmin(req.user)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const localFile = createLocalBackup();
    const result    = { local: path.basename(localFile), uploaded: false };

    const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = process.env;
    if (S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
      const body = fs.readFileSync(localFile);
      const key  = `backups/${path.basename(localFile)}`;
      const r    = await s3Put({
        endpoint:  S3_ENDPOINT,
        bucket:    S3_BUCKET,
        region:    S3_REGION || 'auto',
        accessKey: S3_ACCESS_KEY_ID,
        secretKey: S3_SECRET_ACCESS_KEY,
        key,
        body,
      });
      result.uploaded = r.ok;
      result.s3Status = r.status;
      if (!r.ok) logger.warn({ s3Status: r.status }, 'backup: S3 upload failed');
    }

    logger.info({ file: result.local, uploaded: result.uploaded }, 'backup: completed');
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, 'backup: failed');
    res.status(500).json({ error: 'Backup failed' });
  }
});

module.exports = router;
