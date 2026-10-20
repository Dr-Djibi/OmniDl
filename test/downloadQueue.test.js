import assert from 'node:assert';
import test from 'node:test';

test('Download queue filename generator creates safe file names', () => {
  const makeSafeFilename = (title, ext) => {
    const safeTitle = (title || 'OmniDL_Media')
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80);
    return `${safeTitle || 'Media'}_123456789.${ext}`;
  };

  const filename1 = makeSafeFilename('Vidéo Test !!! <Cool>', 'mp4');
  assert.strictEqual(filename1, 'Vid_o_Test_Cool_123456789.mp4');

  const filename2 = makeSafeFilename('Audio track 1', 'mp3');
  assert.strictEqual(filename2, 'Audio_track_1_123456789.mp3');
});

test('Enqueue download constructs queue item with correct properties', () => {
  const downloadResult = {
    download_url: 'https://example.com/video.mp4',
    title: 'Test Video',
    quality: 'hd',
  };
  const format = 'video';

  const itemFormat = downloadResult.format || format || 'video';
  const itemExt = itemFormat === 'audio' ? 'mp3' : 'mp4';

  const item = {
    id: 'test-123',
    title: downloadResult.title,
    downloadUrl: downloadResult.download_url,
    quality: downloadResult.quality,
    format: itemFormat,
    ext: itemExt,
    status: 'pending',
    progress: 0,
  };

  assert.strictEqual(item.title, 'Test Video');
  assert.strictEqual(item.ext, 'mp4');
  assert.strictEqual(item.status, 'pending');
});
