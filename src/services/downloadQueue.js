import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { sendDownloadNotification } from './notifications';

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
    .slice(0, 80);
  return `${safeTitle}_${Date.now()}.${ext}`;
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

  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: downloadResult.title || 'Média sans titre',
    downloadUrl: rawDownloadUrl.startsWith('http')
      ? rawDownloadUrl
      : `${API_ORIGIN}${rawDownloadUrl.startsWith('/') ? '' : '/'}${rawDownloadUrl}`,
    quality: downloadResult.quality,
    format: downloadResult.format || format,
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
  };
  const queue = await readQueue();
  await writeQueue([...queue, item]);
  processQueue();
  return item;
}

async function saveHistory(item, uri, size) {
  const stored = await AsyncStorage.getItem(HISTORY_KEY);
  const history = stored ? JSON.parse(stored) : [];
  history.unshift({
    id: item.id,
    title: item.title,
    format: item.format,
    ext: item.ext.toUpperCase(),
    resolution: item.quality === 'hd' ? '1080p' : '480p',
    size: size ? `${(size / (1024 * 1024)).toFixed(1)} Mo` : 'Inconnu',
    time: new Date().toLocaleString(),
    uri,
  });
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
}

async function moveToDestination(sourceUri, filename, ext) {
  const customFolderUri = await AsyncStorage.getItem('custom_folder_uri');
  if (!customFolderUri) return sourceUri;

  try {
    await FileSystem.StorageAccessFramework.readDirectoryAsync(customFolderUri);
    const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
      customFolderUri,
      filename,
      ext === 'mp3' ? 'audio/mpeg' : 'video/mp4'
    );
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
    await FileSystem.deleteAsync(sourceUri, { idempotent: true });
    return destinationUri;
  } catch (_storageError) {
    await AsyncStorage.removeItem('custom_folder_uri');
    return sourceUri;
  }
}

async function processItem(item) {
  const ext = item.format === 'audio' ? 'mp3' : 'mp4';
  const filename = item.filename || makeSafeFilename(item.title, ext);
  const temporaryUri = `${FileSystem.documentDirectory}${filename}`;
  await updateQueueItem(item.id, { status: 'downloading', filename, ext, error: null });

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
  if (storedResumeData) {
    try {
      const savable = JSON.parse(storedResumeData);
      resumable = new FileSystem.DownloadResumable(
        savable.url,
        savable.fileUri,
        savable.options,
        callback,
        savable.resumeData
      );
    } catch {
      resumable = FileSystem.createDownloadResumable(
        item.downloadUrl,
        temporaryUri,
        { headers: { 'X-Tenant-Key': 'key_app' } },
        callback
      );
    }
  } else {
    resumable = FileSystem.createDownloadResumable(
      item.downloadUrl,
      temporaryUri,
      { headers: { 'X-Tenant-Key': 'key_app' } },
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

  if (!result) throw new Error('Le téléchargement a été interrompu.');
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Le serveur a refusé le téléchargement (${result.status}).`);
  }
  const info = await FileSystem.getInfoAsync(result.uri);
  const finalUri = await moveToDestination(result.uri, filename, ext);
  await saveHistory({ ...item, ext }, finalUri, info.size);
  await sendDownloadNotification('Téléchargement terminé', item.title, { id: item.id });

  const latestQueue = await readQueue();
  await writeQueue(latestQueue.map(entry => entry.id === item.id
    ? { ...entry, status: 'completed', progress: 1, uri: finalUri, size: info.size, error: null }
    : entry));
}

export async function retryDownload(id) {
  const queue = await readQueue();
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
    const ext = targetItem.format === 'audio' ? 'mp3' : 'mp4';
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
    const ext = item.format === 'audio' ? 'mp3' : 'mp4';
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
      } catch (_error) {
        const latestQueue = await readQueue();
        await writeQueue(latestQueue.map(item => item.id === next.id
          ? { ...item, status: 'failed', progress: 0, error: 'Téléchargement impossible. Appuyez sur Réessayer.' }
          : item));
        await sendDownloadNotification('Téléchargement impossible', next.title, { id: next.id });
      }

      queue = await readQueue();
      next = queue.find(item => item.status === 'pending' || item.status === 'downloading');
    }
  } finally {
    isProcessing = false;
  }
}

export async function registerQueueTask() {
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
