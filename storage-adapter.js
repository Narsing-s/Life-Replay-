const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { productionConfig } = require('./platform-config');

function createStorage() {
  const cfg = productionConfig();
  const remote = Boolean(cfg.objectStorage.endpoint && cfg.objectStorage.bucket && cfg.objectStorage.accessKeyId && cfg.objectStorage.secretAccessKey);
  const localRoot = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'media');
  fs.mkdirSync(localRoot, { recursive: true });
  const client = remote ? new S3Client({ endpoint: cfg.objectStorage.endpoint, region: cfg.objectStorage.region, forcePathStyle: cfg.objectStorage.forcePathStyle, credentials: { accessKeyId: cfg.objectStorage.accessKeyId, secretAccessKey: cfg.objectStorage.secretAccessKey } }) : null;

  const keyFor = ({ userId, id, originalName = '' }) => {
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
    return `users/${userId}/${id}${ext}`;
  };

  async function putFile({ userId, id, filePath, originalName, mimeType, checksum }) {
    const key = keyFor({ userId, id, originalName });
    if (!remote) {
      const target = path.join(localRoot, path.basename(key));
      fs.copyFileSync(filePath, target);
      return { key: target, url: `/media/${path.basename(target)}` };
    }
    const body = fs.createReadStream(filePath);
    await client.send(new PutObjectCommand({ Bucket: cfg.objectStorage.bucket, Key: key, Body: body, ContentType: mimeType, Metadata: { checksum: checksum || '' }, ServerSideEncryption: cfg.objectStorage.endpoint.includes('amazonaws.com') ? 'AES256' : undefined }));
    return { key, url: null };
  }

  async function putBuffer({ userId, id, buffer, originalName, mimeType, checksum }) {
    const tmp = path.join(localRoot, `.upload-${crypto.randomUUID()}`);
    fs.writeFileSync(tmp, buffer);
    try { return await putFile({ userId, id, filePath: tmp, originalName, mimeType, checksum }); } finally { try { fs.unlinkSync(tmp); } catch {} }
  }

  async function signedReadUrl(key, expiresIn = 300) {
    if (!remote) return `/api/v1/media/file/${encodeURIComponent(path.basename(key))}`;
    return getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.objectStorage.bucket, Key: key }), { expiresIn });
  }

  async function remove(key) {
    if (!key) return;
    if (!remote) { try { fs.unlinkSync(key); } catch {} return; }
    await client.send(new DeleteObjectCommand({ Bucket: cfg.objectStorage.bucket, Key: key }));
  }

  async function exists(key) {
    if (!remote) return fs.existsSync(key);
    try { await client.send(new HeadObjectCommand({ Bucket: cfg.objectStorage.bucket, Key: key })); return true; } catch { return false; }
  }

  return { provider: remote ? 's3-compatible' : 'filesystem', remote, keyFor, putFile, putBuffer, signedReadUrl, remove, exists };
}

module.exports = { createStorage };
