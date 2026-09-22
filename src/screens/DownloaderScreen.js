import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../theme/colors';
import { AppHeader, IconBtn } from '../components/UI';

// ── Statuts possibles d'un item de la file ──────────────────────────────────
// pending | extracting | downloading | done | error

function QueueItem({ item, onRemove }) {
  const prog = item.progress ?? 0;

  const statusColor = {
    pending:     C.muted,
    extracting:  C.brand,
    downloading: C.cyan,
    done:        C.success,
    error:       C.error,
  }[item.status] ?? C.muted;

  const statusLabel = {
    pending:     'En attente',
    extracting:  'Extraction...',
    downloading: `Téléchargement ${Math.round(prog * 100)}%`,
    done:        'Terminé',
    error:       'Erreur',
  }[item.status] ?? item.status;

  const iconName = {
    pending:     'schedule',
    extracting:  'sync',
    downloading: 'downloading',
    done:        'check-circle',
    error:       'error-outline',
  }[item.status] ?? 'schedule';

  return (
    <View style={q.item}>
      {/* Barre de progression en fond */}
      <View style={[q.progressBg, { width: `${Math.round(prog * 100)}%` }]} />

      <View style={q.itemContent}>
        {/* Icône statut */}
        <View style={[q.iconWrap, { backgroundColor: statusColor + '22' }]}>
          {item.status === 'extracting' || item.status === 'downloading' ? (
            <ActivityIndicator size={14} color={statusColor} />
          ) : (
            <MaterialIcons name={iconName} size={16} color={statusColor} />
          )}
        </View>

        {/* Infos */}
        <View style={q.itemInfo}>
          <Text style={q.itemUrl} numberOfLines={1}>{item.url}</Text>
          <View style={q.itemMeta}>
            <Text style={[q.itemStatus, { color: statusColor }]}>{statusLabel}</Text>
            <Text style={q.itemDot}>·</Text>
            <Text style={q.itemFormat}>{item.format === 'audio' ? 'MP3' : 'MP4'}</Text>
            {item.error ? (
              <>
                <Text style={q.itemDot}>·</Text>
                <Text style={q.itemError} numberOfLines={1}>{item.error}</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Bouton supprimer (sauf en cours) */}
        {(item.status === 'done' || item.status === 'error' || item.status === 'pending') && (
          <TouchableOpacity onPress={() => onRemove(item.id)} style={q.removeBtn} hitSlop={8}>
            <MaterialIcons name="close" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Screen principal ─────────────────────────────────────────────────────────
export default function DownloaderScreen({ navigation }) {
  const [url, setUrl]       = useState('');
  const [format, setFormat] = useState('video');
  const [queue, setQueue]   = useState([]);
  const processingRef       = useRef(new Set()); // IDs en cours de traitement

  // ── Coller depuis clipboard ──────────────────────────────────────────────
  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setUrl(text);
    } catch {}
  };

  // ── Ajouter à la file ────────────────────────────────────────────────────
  const handleAddToQueue = () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    const id = Date.now().toString();
    const newItem = { id, url: trimmed, format, status: 'pending', progress: 0, error: null };

    setQueue(prev => [newItem, ...prev]);
    setUrl('');

    // Lance le téléchargement immédiatement
    processItem(newItem);
  };

  // ── Traitement d'un item : extract → download → save ─────────────────────
  const processItem = async (item) => {
    if (processingRef.current.has(item.id)) return;
    processingRef.current.add(item.id);

    const update = (patch) =>
      setQueue(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));

    try {
      // 1. Extraction
      update({ status: 'extracting' });
      const response = await fetch('https://menma-dlx.vercel.app/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Key': 'key_app' },
        body: JSON.stringify({ url: item.url, format: item.format, quality: 'hd' }),
      });

      let data;
      try { data = await response.json(); }
      catch { data = { success: false, error: 'Réponse invalide du serveur' }; }

      if (!data.success) {
        update({ status: 'error', error: data.error || 'Extraction échouée' });
        return;
      }

      // 2. Téléchargement avec suivi de progression
      update({ status: 'downloading', progress: 0 });

      const ext      = (data.format === 'audio' || item.format === 'audio') ? 'mp3' : 'mp4';
      const safeName = (data.title || 'OmniDL_Media').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeName}_${Date.now()}.${ext}`;
      const fileUri  = FileSystem.documentDirectory + filename;

      const dl = FileSystem.createDownloadResumable(
        data.download_url,
        fileUri,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            update({ progress: totalBytesWritten / totalBytesExpectedToWrite });
          }
        }
      );

      const { uri } = await dl.downloadAsync();

      // 3. Copie vers dossier personnalisé si défini
      const customFolderUri = await AsyncStorage.getItem('custom_folder_uri');
      if (customFolderUri) {
        try {
          const mimeType = ext === 'mp3' ? 'audio/mpeg' : 'video/mp4';
          const destUri  = await FileSystem.StorageAccessFramework.createFileAsync(
            customFolderUri, filename, mimeType
          );
          const content = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await FileSystem.writeAsStringAsync(destUri, content, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {}
      }

      // 4. Historique
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const sizeMo   = fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(1) + ' Mo' : '?';
      const histItem = {
        id: item.id,
        title: data.title || 'Média sans titre',
        format: item.format,
        ext: ext.toUpperCase(),
        resolution: data.quality === 'hd' ? '1080p' : '480p',
        size: sizeMo,
        time: new Date().toLocaleString(),
        uri,
      };
      const existing = await AsyncStorage.getItem('download_history');
      const history  = existing ? JSON.parse(existing) : [];
      history.unshift(histItem);
      await AsyncStorage.setItem('download_history', JSON.stringify(history.slice(0, 50)));

      update({ status: 'done', progress: 1 });

    } catch (e) {
      update({ status: 'error', error: e.message });
    } finally {
      processingRef.current.delete(item.id);
    }
  };

  // ── Supprimer un item ────────────────────────────────────────────────────
  const handleRemove = (id) => {
    setQueue(prev => prev.filter(i => i.id !== id));
  };

  // ── Relancer un item en erreur ───────────────────────────────────────────
  const handleRetry = (item) => {
    setQueue(prev => prev.map(i => i.id === item.id
      ? { ...i, status: 'pending', progress: 0, error: null }
      : i
    ));
    processItem({ ...item, status: 'pending', progress: 0, error: null });
  };

  const canAdd = url.trim().length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader
        rightActions={
          <>
            <IconBtn name="history"  onPress={() => navigation.navigate('History')} />
            <IconBtn name="settings" onPress={() => navigation.navigate('Settings')} />
          </>
        }
      />

      <View style={s.inputSection}>
        <View style={[s.inputRow, canAdd && s.inputRowActive]}>
          <MaterialIcons name="link" size={18} color={C.muted} style={{ marginRight: 6 }} />
          <TextInput
            style={s.input}
            value={url}
            onChangeText={setUrl}
            placeholder="Coller un lien..."
            placeholderTextColor={C.subtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {url.length > 0 ? (
            <TouchableOpacity onPress={() => setUrl('')} hitSlop={8}>
              <MaterialIcons name="close" size={16} color={C.muted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handlePaste} style={s.pasteBtn}>
              <Text style={s.pasteTxt}>Coller</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sélecteur format */}
        <View style={s.formatRow}>
          {['video', 'audio'].map(f => (
            <TouchableOpacity
              key={f}
              style={[s.formatBtn, format === f && s.formatBtnOn]}
              onPress={() => setFormat(f)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={f === 'video' ? 'videocam' : 'audiotrack'}
                size={14}
                color={format === f ? '#fff' : C.muted}
                style={{ marginRight: 4 }}
              />
              <Text style={[s.formatTxt, format === f && s.formatTxtOn]}>
                {f === 'video' ? 'Vidéo' : 'Audio'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bouton Ajouter */}
        <TouchableOpacity
          style={[s.addBtn, !canAdd && s.addBtnOff]}
          onPress={handleAddToQueue}
          disabled={!canAdd}
          activeOpacity={0.85}
        >
          <MaterialIcons name="add" size={18} color={canAdd ? '#fff' : C.muted} style={{ marginRight: 6 }} />
          <Text style={[s.addTxt, !canAdd && s.addTxtOff]}>Ajouter à la file</Text>
        </TouchableOpacity>
      </View>

      {/* File d'attente */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, queue.length === 0 && s.scrollEmpty]}
        keyboardShouldPersistTaps="handled"
      >
        {queue.length === 0 ? (
          <View style={s.empty}>
            <MaterialIcons name="download-for-offline" size={48} color={C.elevated} />
            <Text style={s.emptyTxt}>Aucun téléchargement en cours</Text>
            <Text style={s.emptySubTxt}>Collez un lien et appuyez sur « Ajouter à la file »</Text>
          </View>
        ) : (
          <>
            <View style={s.queueHeader}>
              <Text style={s.queueTitle}>File de téléchargement</Text>
              <Text style={s.queueCount}>{queue.length}</Text>
            </View>
            {queue.map(item => (
              <View key={item.id}>
                <QueueItem item={item} onRemove={handleRemove} />
                {item.status === 'error' && (
                  <TouchableOpacity style={s.retryBtn} onPress={() => handleRetry(item)}>
                    <MaterialIcons name="refresh" size={13} color={C.brand} style={{ marginRight: 4 }} />
                    <Text style={s.retryTxt}>Réessayer</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles principaux ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  inputSection:  { padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  inputRowActive: { borderColor: C.brand },
  input:   { flex: 1, color: C.text, fontSize: 14, height: 40 },
  pasteBtn: {
    backgroundColor: C.elevated, paddingHorizontal: 12,
    paddingVertical: 5, borderRadius: 8,
  },
  pasteTxt:    { color: C.text, fontSize: 12, fontWeight: '600' },
  formatRow:   { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 10, padding: 3, gap: 3 },
  formatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 8,
  },
  formatBtnOn:  { backgroundColor: C.brand },
  formatTxt:    { color: C.muted, fontSize: 12, fontWeight: '600' },
  formatTxtOn:  { color: '#fff' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.brand, borderRadius: 12, paddingVertical: 14,
  },
  addBtnOff:    { backgroundColor: C.elevated },
  addTxt:       { color: '#fff', fontWeight: '700', fontSize: 14 },
  addTxtOff:    { color: C.muted },
  scroll:       { flex: 1 },
  scrollContent: { padding: 12, gap: 8, paddingBottom: 40 },
  scrollEmpty:  { flex: 1 },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60,
  },
  emptyTxt:    { color: C.muted, fontSize: 15, fontWeight: '600' },
  emptySubTxt: { color: C.subtle, fontSize: 13, textAlign: 'center', maxWidth: 260 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  queueTitle:  { color: C.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  queueCount: {
    backgroundColor: C.elevated, color: C.text, fontSize: 11,
    fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8, marginTop: -4,
  },
  retryTxt: { color: C.brand, fontSize: 12, fontWeight: '600' },
});

// ── Styles des items de la file ──────────────────────────────────────────────
const q = StyleSheet.create({
  item: {
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', position: 'relative',
  },
  progressBg: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(56,189,248,0.08)',
  },
  itemContent: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, gap: 10,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  itemInfo:   { flex: 1, gap: 3 },
  itemUrl:    { color: C.text, fontSize: 13, fontWeight: '500' },
  itemMeta:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  itemStatus: { fontSize: 12, fontWeight: '600' },
  itemDot:    { color: C.subtle, fontSize: 10 },
  itemFormat: { color: C.muted, fontSize: 11, fontWeight: '500' },
  itemError:  { color: C.error, fontSize: 11, flex: 1 },
  removeBtn:  { padding: 4 },
});
