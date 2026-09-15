const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const path = require('path');
const featureRoutes = require('./feature-routes');
const productionHardening = require('./production-hardening');

const originalListen = express.application.listen;
let installed = false;
express.application.listen = function patchedListen(...args) {
  if (!installed) {
    installed = true;
    const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const db = new Database(path.join(DATA_DIR, 'life-replay.db'));
    const secret = process.env.JWT_SECRET || 'change-me-in-production';
    const auth = (req, res, next) => {
      const value = req.headers.authorization || '';
      if (!value.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
      try {
        const payload = jwt.verify(value.slice(7), secret);
        req.user = db.prepare('SELECT * FROM users WHERE id=?').get(payload.sub);
        if (!req.user) throw new Error('user');
        next();
      } catch { res.status(401).json({ error: 'Invalid or expired session' }); }
    };
    featureRoutes({ app: this, db, auth });
    productionHardening({ app: this, db, auth, jwtSecret: secret });
  }
  return originalListen.apply(this, args);
};
