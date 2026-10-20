import assert from 'node:assert';
import test from 'node:test';
import {
  decodeBase64ToBytes,
  detectMediaTypeFromBytes,
  validateResponseHeaders,
  validateFileIntegrity,
} from '../src/services/fileValidator.js';

test('decodeBase64ToBytes correctly converts base64 string to Uint8Array', () => {
  const bytes = decodeBase64ToBytes('SGVsbG8=');
  assert.strictEqual(bytes.length, 5);
  assert.strictEqual(String.fromCharCode(...bytes), 'Hello');
});

test('detectMediaTypeFromBytes identifies MP4 video magic bytes (ftyp)', () => {
  const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const res = detectMediaTypeFromBytes(bytes);
  assert.strictEqual(res.type, 'video');
  assert.strictEqual(res.mime, 'video/mp4');
  assert.strictEqual(res.ext, 'mp4');
});

test('detectMediaTypeFromBytes identifies WebM video magic bytes (EBML)', () => {
  const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
  const res = detectMediaTypeFromBytes(bytes);
  assert.strictEqual(res.type, 'video');
  assert.strictEqual(res.mime, 'video/webm');
  assert.strictEqual(res.ext, 'webm');
});

test('detectMediaTypeFromBytes identifies MP3 audio (ID3 header)', () => {
  const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const res = detectMediaTypeFromBytes(bytes);
  assert.strictEqual(res.type, 'audio');
  assert.strictEqual(res.mime, 'audio/mpeg');
  assert.strictEqual(res.ext, 'mp3');
});

test('detectMediaTypeFromBytes identifies MP3 audio (MPEG sync word)', () => {
  const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00]);
  const res = detectMediaTypeFromBytes(bytes);
  assert.strictEqual(res.type, 'audio');
  assert.strictEqual(res.mime, 'audio/mpeg');
  assert.strictEqual(res.ext, 'mp3');
});

test('detectMediaTypeFromBytes identifies JPEG image', () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const res = detectMediaTypeFromBytes(bytes);
  assert.strictEqual(res.type, 'image');
  assert.strictEqual(res.mime, 'image/jpeg');
  assert.strictEqual(res.ext, 'jpg');
});

test('detectMediaTypeFromBytes identifies PNG image', () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const res = detectMediaTypeFromBytes(bytes);
  assert.strictEqual(res.type, 'image');
  assert.strictEqual(res.mime, 'image/png');
  assert.strictEqual(res.ext, 'png');
});

test('detectMediaTypeFromBytes rejects HTML error page disguised as video', () => {
  const html = '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body>Error</body></html>';
  const bytes = new Uint8Array([...html].map(c => c.charCodeAt(0)));
  const res = detectMediaTypeFromBytes(bytes);
  assert.strictEqual(res.isCorrupt, true);
  assert.match(res.reason, /erreur ou une page web/);
});

test('detectMediaTypeFromBytes rejects JSON error response disguised as video', () => {
  const json = '{"error":"Video unavailable","code":404}';
  const bytes = new Uint8Array([...json].map(c => c.charCodeAt(0)));
  const res = detectMediaTypeFromBytes(bytes);
  assert.strictEqual(res.isCorrupt, true);
  assert.match(res.reason, /erreur ou une page web/);
});

test('validateResponseHeaders flags invalid HTML or JSON content types', () => {
  const htmlRes = validateResponseHeaders({ 'content-type': 'text/html; charset=utf-8' }, 'video');
  assert.strictEqual(htmlRes.valid, false);

  const jsonRes = validateResponseHeaders({ 'content-type': 'application/json' }, 'video');
  assert.strictEqual(jsonRes.valid, false);

  const validRes = validateResponseHeaders({ 'content-type': 'video/mp4' }, 'video');
  assert.strictEqual(validRes.valid, true);
});

test('validateFileIntegrity rejects non-existent or truncated files', async () => {
  const mockFS = {
    getInfoAsync: async () => ({ exists: true, size: 500 }), // 500 bytes is too small for video
    readAsStringAsync: async () => 'SGVsbG8=',
    EncodingType: { Base64: 'base64' },
  };

  const res = await validateFileIntegrity('/path/dummy.mp4', 'video', 0, mockFS);
  assert.strictEqual(res.valid, false);
  assert.match(res.error, /incomplet ou trop petit/);
});

test('validateFileIntegrity accepts valid MP4 mock file', async () => {
  // Base64 for 00 00 00 20 66 74 79 70 69 73 6f 6d: AA AAI2Z0eXBpc29t
  const base64Mp4 = 'AAAAIGZ0eXBpc29t';
  const mockFS = {
    getInfoAsync: async () => ({ exists: true, size: 1048576 }), // 1 MB
    readAsStringAsync: async () => base64Mp4,
    EncodingType: { Base64: 'base64' },
  };

  const res = await validateFileIntegrity('/path/valid.mp4', 'video', 1048576, mockFS);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.mimeType, 'video/mp4');
  assert.strictEqual(res.ext, 'mp4');
});
