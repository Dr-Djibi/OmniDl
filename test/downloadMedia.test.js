import assert from 'node:assert';
import test from 'node:test';
import { downloadFileWeb } from '../src/services/webDownloader.js';

test('downloadFileWeb throws descriptive error when response is not ok', async () => {
  // Mock window & document
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalFetch = global.fetch;

  try {
    global.window = {};
    global.document = { body: { appendChild: () => {}, removeChild: () => {} }, createElement: () => ({}) };

    global.fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Media not found on remote server' }),
      text: async () => 'Media not found on remote server',
    });

    await assert.rejects(
      async () => {
        await downloadFileWeb({
          url: 'https://example.com/notfound.mp4',
          filename: 'video.mp4',
          mimeType: 'video/mp4',
        });
      },
      (err) => {
        assert.match(err.message, /Media not found on remote server/);
        return true;
      }
    );
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.fetch = originalFetch;
  }
});

test('downloadFileWeb throws error when response is HTML error page disguised as download', async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalFetch = global.fetch;

  try {
    global.window = {};
    global.document = { body: { appendChild: () => {}, removeChild: () => {} }, createElement: () => ({}) };

    global.fetch = async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
      },
      text: async () => '<!DOCTYPE html><html><body>Error 403 Forbidden</body></html>',
    });

    await assert.rejects(
      async () => {
        await downloadFileWeb({
          url: 'https://example.com/blocked.mp4',
          filename: 'video.mp4',
          mimeType: 'video/mp4',
        });
      },
      (err) => {
        assert.match(err.message, /Le lien a renvoyé du texte ou une page d’erreur/);
        return true;
      }
    );
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.fetch = originalFetch;
  }
});

test('downloadFileWeb triggers file download for valid binary blob', async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalFetch = global.fetch;

  try {
    let clicked = false;
    let appended = false;
    let removed = false;
    let downloadedFilename = '';

    global.window = {
      URL: {
        createObjectURL: (b) => 'blob:mock-url',
        revokeObjectURL: () => {},
      },
    };

    global.document = {
      createElement: (tag) => {
        if (tag === 'a') {
          return {
            set href(val) { this._href = val; },
            get href() { return this._href; },
            set download(val) { downloadedFilename = val; },
            click: () => { clicked = true; },
          };
        }
        return {};
      },
      body: {
        appendChild: () => { appended = true; },
        removeChild: () => { removed = true; },
      },
    };

    // Valid mock blob
    const mockBlob = new Blob(['sample binary audio/video content'], { type: 'video/mp4' });

    global.fetch = async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h.toLowerCase() === 'content-type' ? 'video/mp4' : null),
      },
      blob: async () => mockBlob,
    });

    const result = await downloadFileWeb({
      url: 'https://example.com/sample.mp4',
      filename: 'sample.mp4',
      mimeType: 'video/mp4',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(clicked, true);
    assert.strictEqual(appended, true);
    assert.strictEqual(removed, true);
    assert.strictEqual(downloadedFilename, 'sample.mp4');

    // Wait for the setTimeout revoke
    await new Promise((resolve) => setTimeout(resolve, 1100));
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.fetch = originalFetch;
  }
});
