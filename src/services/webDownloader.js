/**
 * Web download implementation:
 * Fetches stream as binary blob, ensures no HTML/JSON errors are disguised as media,
 * and triggers browser file download cleanly.
 */
export async function downloadFileWeb({ url, filename, mimeType }) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Le téléchargement Web est disponible uniquement dans un environnement navigateur.');
  }

  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    let errorDetail = `Erreur HTTP ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && (errorJson.error || errorJson.message)) {
        errorDetail = errorJson.error || errorJson.message;
      }
    } catch {
      try {
        const errorText = await response.text();
        if (errorText) errorDetail = errorText.slice(0, 120);
      } catch {
        // Fallback to HTTP status
      }
    }
    throw new Error(`Téléchargement impossible : ${errorDetail}`);
  }

  // Check headers to reject error pages masquerading as valid downloads
  const contentType = (response.headers.get ? response.headers.get('content-type') : response.headers['content-type']) || '';
  const lowerContentType = contentType.toLowerCase();
  if (
    lowerContentType.includes('text/html') ||
    lowerContentType.includes('application/json') ||
    lowerContentType.includes('text/plain')
  ) {
    const errorText = await response.text();
    let parsedMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error || parsed.message) {
        parsedMessage = parsed.error || parsed.message;
      }
    } catch {
      // Keep plain text
    }
    const errorPrefix = 'Le lien a renvoyé du texte ou une page d’erreur au lieu du fichier binaire attendu.';
    throw new Error(
      parsedMessage && parsedMessage.length < 200 && !parsedMessage.includes('<')
        ? parsedMessage
        : errorPrefix
    );
  }

  const blob = await response.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Le fichier téléchargé est vide.');
  }

  const resolvedMime = mimeType || blob.type || 'application/octet-stream';
  const finalBlob = blob.type ? blob : new Blob([blob], { type: resolvedMime });
  const objectUrl = window.URL.createObjectURL(finalBlob);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => {
    if (typeof window !== 'undefined' && window?.URL?.revokeObjectURL) {
      window.URL.revokeObjectURL(objectUrl);
    }
  }, 1000);

  return { success: true, size: blob.size, mimeType: resolvedMime };
}
