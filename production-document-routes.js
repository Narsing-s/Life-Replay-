const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { sha256 } = require('./production-services');

function installProductionDocumentRoutes({ app, q, auth, id, storage, enqueue }) {
  const upload = multer({
    dest: path.join(os.tmpdir(), 'life-replay-document-upload'),
    limits: { fileSize: Number(process.env.MAX_DOCUMENT_BYTES || process.env.MAX_MEDIA_BYTES || 250 * 1024 * 1024) },
    fileFilter: (_, file, cb) => cb(null, /^(application\/pdf|image\/(jpeg|png|webp|gif|heic|heif))$/.test(file.mimetype))
  });
  const text = (v, max = 5000) => String(v ?? '').trim().slice(0, max);

  app.post('/api/v1/documents', auth, upload.single('file'), async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'A PDF or supported image document is required' });
    const memoryId = id();
    const documentId = id();
    const mediaId = id();
    const checksum = sha256(fs.readFileSync(req.file.path));
    try {
      const duplicate = await q('SELECT id FROM media WHERE user_id=$1 AND checksum=$2 LIMIT 1', [req.user.id, checksum]);
      if (duplicate.rowCount) return res.status(409).json({ error: 'This document is already uploaded', mediaId: duplicate.rows[0].id });
      const stored = await storage.putFile({ userId: req.user.id, id: mediaId, filePath: req.file.path, originalName: req.file.originalname, mimeType: req.file.mimetype, checksum });
      await q('INSERT INTO memories(id,user_id,title,caption,place,date,media_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW())', [memoryId, req.user.id, text(req.body?.title, 200) || req.file.originalname, text(req.body?.caption, 2000), text(req.body?.place, 500), /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date || '') ? req.body.date : new Date().toISOString().slice(0, 10), stored.key]);
      await q('INSERT INTO memory_meta(memory_id,source,category,summary) VALUES($1,\'document\',\'document\',\'\') ON CONFLICT DO NOTHING', [memoryId]);
      await q('INSERT INTO media(id,memory_id,user_id,original_name,mime_type,size,storage_path,checksum,created_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW(),\'queued\')', [mediaId, memoryId, req.user.id, req.file.originalname, req.file.mimetype, req.file.size, stored.key, checksum]);
      await q('INSERT INTO documents(id,memory_id,user_id,media_id,status,mime_type,created_at,updated_at) VALUES($1,$2,$3,$4,\'queued\',$5,NOW(),NOW())', [documentId, memoryId, req.user.id, mediaId, req.file.mimetype]);
      try {
        await enqueue('document-processing', { documentId, memoryId, userId: req.user.id, objectKey: stored.key, mimeType: req.file.mimetype }, { jobId: `document-${documentId}` });
      } catch (error) {
        await q('UPDATE documents SET status=$1,error=$2,updated_at=NOW() WHERE id=$3', ['failed', String(error.message).slice(0, 2000), documentId]);
        throw error;
      }
      res.status(202).json({ document: { id: documentId, memoryId, status: 'queued' } });
    } catch (error) {
      try { fs.unlinkSync(req.file.path); } catch {}
      await storage.remove?.(memoryId).catch?.(() => {});
      return next(error);
    } finally {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
  });

  app.get('/api/v1/documents', auth, async (req, res) => {
    const rows = await q('SELECT id,memory_id,status,mime_type,extracted_text,error,created_at,updated_at,completed_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200', [req.user.id]);
    res.json({ documents: rows.rows });
  });

  app.get('/api/v1/documents/:id', auth, async (req, res) => {
    const row = await q('SELECT id,memory_id,status,mime_type,extracted_text,error,created_at,updated_at,completed_at FROM documents WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!row.rowCount) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: row.rows[0] });
  });
}

module.exports = { installProductionDocumentRoutes };
