import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { sendDownloadNotification } from './notifications.js';
import { validateFileIntegrity, validateResponseHeaders } from './fileValidator.js';

const QUEUE_KEY = 'download_queue';
const HISTORY_KEY = 'download_history';
const RESUME_KEY_PREFIX = 'download_resume_';
const TASK_NAME = 'omnidl-download-queue';
const API_ORIGIN = 'https://menma-dlx.vercel.app';
let isProcessing = false;
const activeResumables = new Map();

if (!TaskManager.isTaskDefined(TASK_NAME)) {
  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      const queue = await readQueue();
      const hasPending = queue.some(item => item.status === 'pending' || item.status === 'downloading');
      if (hasPending) {
        await processQueue();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

const makeSafeFilename = (title, ext) => {
  const safeTitle = (title || 'OmniDL_Media')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  return `${safeTitle || 'Media'}_${Date.now()}.${ext}`;
};

async function readQueue() {
  const stored = await AsyncStorage.getItem(QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function writeQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function updateQueueItem(id, changes) {
  const queue = await readQueue();
  await writeQueue(queue.map(item => item.id === id ? { ...item, ...changes } : item));
}

export async function getQueue() {
  return readQueue();
}

export async function enqueueDownload({ downloadResult, format }) {
  const rawDownloadUrl = downloadResult.download_url || downloadResult.downloadUrl;
  if (!rawDownloadUrl) throw new Error('Le serveur n’a fourni aucun lien de téléchargement.');

  const itemFormat = downloadResult.format || format || 'video';
  const itemExt = itemFormat === 'audio' ? 'mp3' : 'mp4';

  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: downloadResult.title || 'Média sans titre',
    downloadUrl: rawDownloadUrl.startsWith('http')
      ? rawDownloadUrl
      : `${API_ORIGIN}${rawDownloadUrl.startsWith('/') ? '' : '/'}${rawDownloadUrl}`,
    quality: downloadResult.quality,
    format: itemFormat,
    ext: itemExt,
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
  };
  const queue = await readQueue();
  await writeQueue([...queue, item]);
  processQueue();
  return item;
}

async function saveHistory(item, uri, size, mimeType) {
  const stored = await AsyncStorage.getItem(HISTORY_KEY);
  const history = stored ? JSON.parse(stored) : [];
  history.unshift({
    id: item.id,
    title: item.title,
    format: item.format,
    ext: (item.ext || 'mp4').toUpperCase(),
    mimeType: mimeType || (item.format === 'audio' ? 'audio/mpeg' : 'video/mp4'),
    resolution: item.quality === 'hd' ? '1080p' : '480p',
    size: size ? `${(size / (1024 * 1024)).toFixed(1)} Mo` : 'Inconnu',
    bytesSize: size || 0,
    time: new Date().toLocaleString(),
    uri,
  });
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
}

async function moveToDestination(sourceUri, filename, ext, mimeType) {
  const customFolderUri = await AsyncStorage.getItem('custom_folder_uri');
  if (!customFolderUri) return sourceUri;

  let createdSafUri = null;
  try {
    const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
    if (!sourceInfo.exists || (sourceInfo.size !== undefined && sourceInfo.size === 0)) {
      return sourceUri;
    }

    const targetMime = mimeType || (ext === 'mp3' ? 'audio/mpeg' : 'video/mp4');

    await FileSystem.StorageAccessFramework.readDirectoryAsync(customFolderUri);
    const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
      customFolderUri,
      filename,
      targetMime
    );
    createdSafUri = destinationUri;

    // Android copyAsync cannot copy from file:// to content:// SAF URI without leaving 0 bytes.
    // Read binary data in Base64 and write into the SAF content URI:
    const base64Data = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64Data || base64Data.length === 0) {
      throw new Error('Données source vides lors de la lecture Base64.');
    }

    await FileSystem.StorageAccessFramework.writeAsStringAsync(destinationUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await FileSystem.deleteAsync(sourceUri, { idempotent: true });
    return destinationUri;
  } catch (_storageError) {
    if (createdSafUri) {
      try {
        await FileSystem.deleteAsync(createdSafUri, { idempotent: true });
      } catch (_cleanupError) {
        // Ignore
      }
    }
    // If custom folder access fails, safely retain local file
    return sourceUri;
  }
}

async function processItem(item) {
  const initialExt = item.ext || (item.format === 'audio' ? 'mp3' : 'mp4');
  const filename = item.filename || makeSafeFilename(item.title, initialExt);
  const temporaryUri = `${FileSystem.documentDirectory}${filename}`;
  await updateQueueItem(item.id, { status: 'downloading', filename, ext: initialExt, error: null });

  let lastProgressUpdate = 0;
  let lastProgressValue = item.progress || 0;

  const callback = ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    const progress = totalBytesExpectedToWrite > 0
      ? totalBytesWritten / totalBytesExpectedToWrite
      : 0;
    const now = Date.now();
    if (now - lastProgressUpdate >= 500 || Math.abs(progress - lastProgressValue) >= 0.05 || progress >= 1) {
      lastProgressUpdate = now;
      lastProgressValue = progress;
      updateQueueItem(item.id, { progress }).catch(() => {});
    }
  };

  const resumeKey = `${RESUME_KEY_PREFIX}${item.id}`;
  const storedResumeData = await AsyncStorage.getItem(resumeKey);

  let resumable;
  const isDirectApi = item.downloadUrl.startsWith(API_ORIGIN);
  const downloadHeaders = isDirectApi ? { 'X-Tenant-Key': 'key_app' } : {};

  if (storedResumeData) {
    try {
      const savable = JSON.parse(storedResumeData);
      resumable = new FileSystem.DownloadResumable(
        savable.url,
        savable.fileUri,
        savable.options || (Object.keys(downloadHeaders).length > 0 ? { headers: downloadHeaders } : {}),
        callback,
        savable.resumeData
      );
    } catch {
      resumable = FileSystem.createDownloadResumable(
        item.downloadUrl,
        temporaryUri,
        Object.keys(downloadHeaders).length > 0 ? { headers: downloadHeaders } : {},
        callback
      );
    }
  } else {
    resumable = FileSystem.createDownloadResumable(
      item.downloadUrl,
      temporaryUri,
      Object.keys(downloadHeaders).length > 0 ? { headers: downloadHeaders } : {},
      callback
    );
  }

  try {
    const savable = resumable.savable();
    if (savable) {
      await AsyncStorage.setItem(resumeKey, JSON.stringify(savable));
    }
  } catch (_e) {
    // Ignore if savable state is unavailable
  }

  activeResumables.set(item.id, resumable);
  let result;
  try {
    result = await resumable.downloadAsync();
  } finally {
    activeResumables.delete(item.id);
  }
  await AsyncStorage.removeItem(resumeKey);

  if (!result) {
    throw new Error('Le téléchargement a été interrompu.');
  }

  if (result.status < 200 || result.status >= 300) {
    try {
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
    } catch (_e) {
      // Ignore
    }
    throw new Error(`Le serveur a refusé le téléchargement (Code HTTP ${result.status}).`);
  }

  // Header validation
  if (result.headers) {
    const headerCheck = validateResponseHeaders(result.headers, item.format);
    if (!headerCheck.valid) {
      try {
        await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
      } catch (_e) {
        // Ignore
      }
      throw new Error(headerCheck.error);
    }
  }

  // File Integrity & Magic Byte Validation
  const validation = await validateFileIntegrity(result.uri, item.format);
  if (!validation.valid) {
    try {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
    } catch (_e) {
      // Ignore
    }
    throw new Error(validation.error || 'Le fichier téléchargé est corrompu.');
  }

  const finalExt = validation.ext || initialExt;
  const mimeType = validation.mimeType || (item.format === 'audio' ? 'audio/mpeg' : 'video/mp4');

  const finalUri = await moveToDestination(result.uri, filename, finalExt, mimeType);
  await saveHistory({ ...item, ext: finalExt }, finalUri, validation.size, mimeType);
  await sendDownloadNotification('Téléchargement terminé', item.title, { id: item.id });

  const latestQueue = await readQueue();
  await writeQueue(latestQueue.map(entry => entry.id === item.id
    ? {
        ...entry,
        status: 'completed',
        progress: 1,
        uri: finalUri,
        size: validation.size,
        ext: finalExt,
        mimeType,
        error: null,
      }
    : entry));
}

export async function retryDownload(id) {
  const queue = await readQueue();
  const targetItem = queue.find(item => item.id === id);

  if (targetItem) {
    const ext = targetItem.ext || (targetItem.format === 'audio' ? 'mp3' : 'mp4');
    const filename = targetItem.filename || makeSafeFilename(targetItem.title, ext);
    const temporaryUri = `${FileSystem.documentDirectory}${filename}`;
    try {
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
    } catch (_e) {
      // Ignore
    }
  }

  await AsyncStorage.removeItem(`${RESUME_KEY_PREFIX}${id}`);
  await writeQueue(queue.map(item => item.id === id
    ? { ...item, status: 'pending', progress: 0, error: null }
    : item));
  processQueue();
}

export async function removeQueueItem(id) {
  if (activeResumables.has(id)) {
    const resumable = activeResumables.get(id);
    try {
      await resumable.pauseAsync();
    } catch (_e) {
      // Ignore errors if pause fails
    }
    activeResumables.delete(id);
  }

  const queue = await readQueue();
  const targetItem = queue.find(item => item.id === id);
  if (targetItem) {
    const ext = targetItem.ext || (targetItem.format === 'audio' ? 'mp3' : 'mp4');
    const filename = targetItem.filename || makeSafeFilename(targetItem.title, ext);
    const temporaryUri = `${FileSystem.documentDirectory}${filename}`;
    try {
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
    } catch (_e) {
      // Ignore file deletion error
    }
  }

  await AsyncStorage.removeItem(`${RESUME_KEY_PREFIX}${id}`);
  const updatedQueue = queue.filter(item => item.id !== id);
  await writeQueue(updatedQueue);
}

export async function clearQueue() {
  for (const [id, resumable] of activeResumables.entries()) {
    try {
      await resumable.pauseAsync();
    } catch (_e) {
      // Ignore errors if pause fails
    }
    await AsyncStorage.removeItem(`${RESUME_KEY_PREFIX}${id}`);
  }
  activeResumables.clear();

  const queue = await readQueue();
  for (const item of queue) {
    const ext = item.ext || (item.format === 'audio' ? 'mp3' : 'mp4');
    const filename = item.filename || makeSafeFilename(item.title, ext);
    const temporaryUri = `${FileSystem.documentDirectory}${filename}`;
    try {
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
    } catch (_e) {
      // Ignore file deletion error
    }
    await AsyncStorage.removeItem(`${RESUME_KEY_PREFIX}${item.id}`);
  }

  await writeQueue([]);
}

export async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    let queue = await readQueue();
    let next = queue.find(item => item.status === 'pending' || item.status === 'downloading');

    while (next) {
      try {
        await processItem(next);
      } catch (error) {
        const errorMsg = error.message || 'Téléchargement impossible. Appuyez sur Réessayer.';
        const latestQueue = await readQueue();
        await writeQueue(latestQueue.map(item => item.id === next.id
          ? { ...item, status: 'failed', progress: 0, error: errorMsg }
          : item));
        await sendDownloadNotification('Téléchargement échoué', next.title, { id: next.id });
      }

      queue = await readQueue();
      next = queue.find(item => item.status === 'pending' || item.status === 'downloading');
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Web download implementation:
 * Fetches stream as binary blob, ensures no HTML/JSON errors are disguised as media,
 * and triggers browser file download cleanly.
 */
import { downloadFileWeb } from './webDownloader.js';
export { downloadFileWeb };

/**
 * Universal media downloader function for both Web and Mobile.
 */
export async function downloadMediaFile({ downloadResult, format }) {
  const rawDownloadUrl = downloadResult?.download_url || downloadResult?.downloadUrl;
  if (!rawDownloadUrl) {
    throw new Error('Le serveur n’a fourni aucun lien de téléchargement.');
  }

  const itemFormat = downloadResult?.format || format || 'video';
  const itemExt = itemFormat === 'audio' ? 'mp3' : 'mp4';
  const filename = makeSafeFilename(downloadResult?.title, itemExt);
  const mimeType = itemFormat === 'audio' ? 'audio/mpeg' : 'video/mp4';

  const finalUrl = rawDownloadUrl.startsWith('http')
    ? rawDownloadUrl
    : `${API_ORIGIN}${rawDownloadUrl.startsWith('/') ? '' : '/'}${rawDownloadUrl}`;

  if (Platform.OS === 'web') {
    return downloadFileWeb({
      url: finalUrl,
      filename,
      mimeType,
    });
  }

  return enqueueDownload({ downloadResult, format: itemFormat });
}

export async function registerQueueTask() {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status !== BackgroundFetch.BackgroundFetchStatus.Denied) {
      const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (!registered) {
        await BackgroundFetch.registerTaskAsync(TASK_NAME, {
          minimumInterval: 15 * 60,
          stopOnTerminate: false,
          startOnBoot: true,
        });
      }
    }
  } catch (error) {
    console.warn('Background queue unavailable:', error.message);
  }
  processQueue();
}
