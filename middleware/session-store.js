const { Store } = require('express-session');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '..', 'inventario.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid        TEXT    PRIMARY KEY,
    data       TEXT    NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

class SQLiteStore extends Store {
  get(sid, cb) {
    try {
      const row = db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?').get(sid);
      if (!row) return cb(null, null);
      if (Date.now() > row.expires_at) {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data));
    } catch (err) { cb(err); }
  }

  set(sid, session, cb) {
    try {
      const ttl = session.cookie?.maxAge
        ? Date.now() + session.cookie.maxAge
        : Date.now() + 7 * 24 * 60 * 60 * 1000;
      db.prepare(`
        INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
      `).run(sid, JSON.stringify(session), ttl);
      cb(null);
    } catch (err) { cb(err); }
  }

  destroy(sid, cb) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb(null);
    } catch (err) { cb(err); }
  }

  touch(sid, session, cb) {
    try {
      const ttl = session.cookie?.maxAge
        ? Date.now() + session.cookie.maxAge
        : Date.now() + 7 * 24 * 60 * 60 * 1000;
      db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?').run(ttl, sid);
      cb(null);
    } catch (err) { cb(err); }
  }

  length(cb) {
    try {
      const { count } = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?').get(Date.now());
      cb(null, count);
    } catch (err) { cb(err); }
  }

  clear(cb) {
    try {
      db.prepare('DELETE FROM sessions').run();
      cb(null);
    } catch (err) { cb(err); }
  }
}

// Purge expired sessions every hour — unref so it doesn't block process exit
const pruneTimer = setInterval(() => {
  try { db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()); }
  catch {}
}, 60 * 60 * 1000);
pruneTimer.unref();

module.exports = SQLiteStore;
