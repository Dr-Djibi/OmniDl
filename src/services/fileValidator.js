let defaultFileSystem = null;
try {
  defaultFileSystem = require('expo-file-system/legacy');
} catch (_e) {
  // Expo FileSystem not available in plain Node environment
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeBase64ToBytes(base64) {
  const clean = (base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  let i = 0;
  while (i < clean.length) {
    const enc1 = BASE64_CHARS.indexOf(clean.charAt(i++));
    const enc2 = BASE64_CHARS.indexOf(clean.charAt(i++));
    const enc3 = BASE64_CHARS.indexOf(clean.charAt(i++));
    const enc4 = BASE64_CHARS.indexOf(clean.charAt(i++));

    if (enc1 === -1 || enc2 === -1) break;

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes.push(chr1);
    if (enc3 !== -1 && enc3 !== 64) bytes.push(chr2);
    if (enc4 !== -1 && enc4 !== 64) bytes.push(chr3);
  }
  return new Uint8Array(bytes);
}

function bytesToAscii(bytes, start = 0, length = bytes.length) {
  let str = '';
  const end = Math.min(bytes.length, start + length);
  for (let i = start; i < end; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

export function detectMediaTypeFromBytes(bytes) {
  if (!bytes || bytes.length < 4) {
    return { isCorrupt: true, reason: 'Taille du fichier insuffisante ou vide.' };
  }

  const asciiHeader = bytesToAscii(bytes, 0, Math.min(bytes.length, 128)).toLowerCase();

  // Reject HTML or JSON response disguised as file
  if (
    asciiHeader.includes('<html') ||
    asciiHeader.includes('<!doc') ||
    asciiHeader.includes('<?xml') ||
    asciiHeader.startsWith('{') ||
    asciiHeader.startsWith('[') ||
    asciiHeader.includes('"error"') ||
    asciiHeader.includes('"message"') ||
    asciiHeader.includes('404 not found') ||
    asciiHeader.includes('403 forbidden') ||
    asciiHeader.includes('access denied')
  ) {
    return {
      isCorrupt: true,
      reason: 'Le serveur a renvoyé une erreur ou une page web au lieu du fichier multimédia.',
    };
  }

  // Check Magic Bytes
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: 'image', mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { type: 'image', mime: 'image/png', ext: 'png' };
  }

  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { type: 'image', mime: 'image/gif', ext: 'gif' };
  }

  // WEBP: RIFF ... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x42
  ) {
    return { type: 'image', mime: 'image/webp', ext: 'webp' };
  }

  // WebM / MKV: 1A 45 DF A3 (EBML)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { type: 'video', mime: 'video/webm', ext: 'webm' };
  }

  // MP4 / MOV / M4A: check ftyp or ISOBMFF boxes at offset 4
  if (bytes.length >= 8) {
    const boxType = bytesToAscii(bytes, 4, 4);
    if (['ftyp', 'moov', 'mdat', 'free', 'wide', 'styp', 'skip'].includes(boxType)) {
      const brand = bytes.length >= 12 ? bytesToAscii(bytes, 8, 4) : '';
      if (brand.includes('M4A') || brand.includes('m4a')) {
        return { type: 'audio', mime: 'audio/mp4', ext: 'm4a' };
      }
      return { type: 'video', mime: 'video/mp4', ext: 'mp4' };
    }
  }

  // MP3: ID3
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { type: 'audio', mime: 'audio/mpeg', ext: 'mp3' };
  }

  // MP3: MPEG sync word 0xFF 0xFB / 0xFF 0xF3 / 0xFF 0xF2 / 0xFF 0xFA / 0xFF 0xE3
  if (
    bytes[0] === 0xff &&
    (
      (bytes[1] & 0xe0) === 0xe0 ||
      bytes[1] === 0xfb ||
      bytes[1] === 0xf3 ||
      bytes[1] === 0xf2 ||
      bytes[1] === 0xfa
    )
  ) {
    return { type: 'audio', mime: 'audio/mpeg', ext: 'mp3' };
  }

  // FLAC: fLaC (66 4C 61 43)
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { type: 'audio', mime: 'audio/flac', ext: 'flac' };
  }

  // OGG: OggS (4F 67 67 53)
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { type: 'audio', mime: 'audio/ogg', ext: 'ogg' };
  }

  // WAV: RIFF ... WAVE
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
  ) {
    return { type: 'audio', mime: 'audio/wav', ext: 'wav' };
  }

  return { isCorrupt: true, reason: 'Format de fichier non reconnu ou en-tête invalide.' };
}

export function validateResponseHeaders(headers = {}, expectedFormat = 'video') {
  const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();

  if (
    contentType.includes('text/html') ||
    contentType.includes('application/json') ||
    contentType.includes('text/plain') ||
    contentType.includes('application/xml')
  ) {
    return {
      valid: false,
      error: 'Le serveur n’a pas renvoyé un fichier média valide (réponse texte/erreur).',
    };
  }

  return { valid: true };
}

export async function validateFileIntegrity(
  fileUri,
  expectedFormat = 'video',
  expectedSize = 0,
  customFileSystem = null
) {
  const fs = customFileSystem || defaultFileSystem;
  if (!fs) {
    return { valid: false, error: 'Module FileSystem indisponible.' };
  }

  try {
    const info = await fs.getInfoAsync(fileUri);
    if (!info.exists) {
      return { valid: false, error: 'Le fichier n’a pas été créé sur le stockage.' };
    }

    const size = info.size || 0;
    const minSize = expectedFormat === 'audio' ? 5120 : expectedFormat === 'image' ? 500 : 10240;

    if (size < minSize) {
      return {
        valid: false,
        size,
        error: `Le fichier téléchargé est incomplet ou trop petit (${(size / 1024).toFixed(1)} Ko).`,
      };
    }

    if (expectedSize > 0 && size < expectedSize * 0.9) {
      return {
        valid: false,
        size,
        error: `Téléchargement interrompu : taille reçue (${(size / (1024 * 1024)).toFixed(1)} Mo) inférieure à la taille attendue (${(expectedSize / (1024 * 1024)).toFixed(1)} Mo).`,
      };
    }

    // Read first 512 bytes in Base64
    const base64Chunk = await fs.readAsStringAsync(fileUri, {
      encoding: fs.EncodingType ? fs.EncodingType.Base64 : 'base64',
      position: 0,
      length: 512,
    });

    const bytes = decodeBase64ToBytes(base64Chunk);
    const mediaInfo = detectMediaTypeFromBytes(bytes);

    if (mediaInfo.isCorrupt) {
      return { valid: false, size, error: mediaInfo.reason };
    }

    return {
      valid: true,
      size,
      mimeType: mediaInfo.mime,
      ext: mediaInfo.ext,
      detectedType: mediaInfo.type,
    };
  } catch (err) {
    return { valid: false, error: `Erreur lors de la vérification de l'intégrité : ${err.message}` };
  }
}
