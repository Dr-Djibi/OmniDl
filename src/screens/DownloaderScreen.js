import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { C } from '../theme/colors';
import { AppHeader, IconBtn, Card } from '../components/UI';
import { enqueueDownload, getQueue, retryDownload } from '../services/downloadQueue';

export default function DownloaderScreen({ navigation }) {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('video'); // 'video' | 'audio'
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [downloadResult, setDownloadResult] = useState(null);
  const [error, setError] = useState(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [queueItems, setQueueItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    const loadQueue = async () => {
      const queue = await getQueue();
      if (!mounted) return;
      const activeItems = queue.filter(item => item.status !== 'completed');
      setQueueItems(activeItems);
      setQueuedCount(activeItems.filter(item => item.status === 'pending' || item.status === 'downloading').length);
    };
    loadQueue();
    const interval = setInterval(loadQueue, 700);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isSaved]);


  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setUrl(text);
    } catch {
      // Silence if clipboard fails
    }
  };

  const handleExtract = async () => {
    if (!url.trim()) return;
    setIsExtracting(true);
    setDownloadResult(null);
    setIsSaved(false);
    setError(null);
    try {
      const response = await fetch('https://menma-dlx.vercel.app/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Key': 'key_app',
        },
        body: JSON.stringify({ url: url.trim(), format, quality: 'hd' }),
      });
      
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (_parseError) {
        // Le backend n'a pas renvoyé de JSON, on crée un objet d'erreur avec le texte brut reçu
        data = { success: false, error: responseText || "Le serveur a renvoyé une réponse invalide." };
      }

      if (data.success) {
        setDownloadResult(data);
      } else {
        setError('Impossible de préparer ce téléchargement. Vérifiez le lien et réessayez.');
      }
    } catch (_e) {
      setError('Connexion impossible. Vérifiez Internet et réessayez.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!downloadResult?.download_url && !downloadResult?.downloadUrl) return;
    setIsSaving(true);
    setError(null);
    try {
      await enqueueDownload({ downloadResult, format });
      setIsSaved(true);
      setQueuedCount(count => count + 1);

    } catch (_e) {
      setError('Impossible d’ajouter ce téléchargement. Réessayez.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = async (id) => {
    await retryDownload(id);
    const queue = await getQueue();
    setQueueItems(queue.filter(item => item.status !== 'completed'));
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader
        rightActions={
          <>
            <IconBtn
              name="history"
              onPress={() => navigation.navigate('History')}
            />
            <IconBtn
              name="settings"
              onPress={() => navigation.navigate('Settings')}
            />
          </>
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.titleRow}>
          <Text style={s.h1}>Téléchargement</Text>
          <Text style={s.subtitle}>Téléchargez vidéos et audios depuis un lien.</Text>
          {queuedCount > 0 && (
            <View style={s.queueStatus}>
              <MaterialIcons name="cloud-download" size={15} color={C.brand} />
              <Text style={s.queueStatusText}>{queuedCount} téléchargement{queuedCount > 1 ? 's' : ''} en attente</Text>
            </View>
          )}
        </View>

        <View style={[s.inputRow, url.length > 0 && s.inputRowFocused]}>
          <MaterialIcons name="link" size={20} color={C.muted} style={s.inputIcon} />
          <TextInput
            style={s.input}
            value={url}
            onChangeText={t => { setUrl(t); setError(null); }}
            placeholder="Coller un lien..."
            placeholderTextColor={C.subtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {url.length > 0 ? (
            <TouchableOpacity onPress={() => setUrl('')} style={s.inputAction}>
              <MaterialIcons name="close" size={18} color={C.muted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handlePaste} style={s.pasteBtn}>
              <Text style={s.pasteBtnText}>Coller</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.formatWrap}>
          {['video', 'audio'].map(f => (
            <TouchableOpacity
              key={f}
              style={[s.formatBtn, format === f && s.formatBtnActive]}
              onPress={() => setFormat(f)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={f === 'video' ? 'videocam' : 'audiotrack'}
                size={16}
                color={format === f ? '#fff' : C.muted}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.formatText, format === f && s.formatTextActive]}>
                {f === 'video' ? 'Vidéo' : 'Audio'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <View style={s.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={C.error} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.cta, (isExtracting || !url.trim()) && s.ctaDisabled]}
          onPress={handleExtract}
          disabled={isExtracting || !url.trim()}
          activeOpacity={0.85}
        >
          {isExtracting ? (
            <ActivityIndicator size="small" color={C.bg} style={{ marginRight: 8 }} />
          ) : (
            <MaterialIcons name="file-download" size={20} color={C.bg} style={{ marginRight: 8 }} />
          )}
          <Text style={s.ctaText}>
            {isExtracting ? 'Extraction en cours...' : 'Télécharger le média'}
          </Text>
        </TouchableOpacity>

        {downloadResult && (
          <Card style={s.resultCard}>
            <View style={s.meta}>
              <View style={s.fileIconBox}>
                <MaterialIcons
                  name={format === 'audio' ? 'audiotrack' : 'movie'}
                  size={24}
                  color={format === 'audio' ? C.success : C.brand}
                />
              </View>
              <View style={s.details}>
                <Text style={s.resultTitle} numberOfLines={2}>
                  {downloadResult.title}
                </Text>
                <View style={s.chips}>
                  <View style={s.chip}>
                    <Text style={s.chipText}>{downloadResult.format?.toUpperCase() || (format === 'audio' ? 'MP3' : 'MP4')}</Text>
                  </View>
                  {downloadResult.quality && (
                    <View style={s.chip}>
                      <Text style={s.chipText}>{downloadResult.quality === 'hd' ? '1080p' : '480p'}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, isSaved && s.saveBtnDone]}
              onPress={handleSave}
              disabled={isSaving || isSaved}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={isSaved ? 'done-all' : (isSaving ? 'downloading' : 'save-alt')}
                size={18}
                color={isSaved ? C.success : C.text}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.saveBtnText, isSaved && { color: C.success }]}>
                {isSaved ? 'Ajouté à la file' : isSaving ? 'Ajout à la file...' : 'Ajouter à la file'}
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {queueItems.length > 0 && (
          <View style={s.queueList}>
            <Text style={s.sectionTitle}>File d’attente</Text>
            {queueItems.map(item => {
              const isFailed = item.status === 'failed';
              const progress = Math.max(0, Math.min(1, item.progress || 0));
              return (
                <Card key={item.id} style={s.queueCard}>
                  <View style={s.queueIcon}>
                    <MaterialIcons
                      name={item.format === 'audio' ? 'audiotrack' : 'movie'}
                      size={20}
                      color={isFailed ? C.error : item.format === 'audio' ? C.success : C.brand}
                    />
                  </View>
                  <View style={s.queueDetails}>
                    <Text style={s.queueTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={[s.queueMeta, isFailed && s.queueMetaError]} numberOfLines={1}>
                      {isFailed ? 'Téléchargement impossible. Réessayez.' : item.status === 'downloading' ? `${Math.round(progress * 100)} %` : 'En attente'}
                    </Text>
                    {!isFailed && (
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
                      </View>
                    )}
                  </View>
                  {isFailed && (
                    <TouchableOpacity style={s.retryBtn} onPress={() => handleRetry(item.id)}>
                      <MaterialIcons name="refresh" size={18} color={C.brand} />
                      <Text style={s.retryText}>Réessayer</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  titleRow: { gap: 4 },
  h1: { color: C.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: C.muted, fontSize: 13 },
  queueStatus: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.brandSoft,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  queueStatusText: { color: C.brand, fontSize: 12, fontWeight: '600' },
  queueList: { gap: 8 },
  sectionTitle: { color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  queueCard: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  queueIcon: { width: 38, height: 38, borderRadius: 9, backgroundColor: C.elevated, alignItems: 'center', justifyContent: 'center' },
  queueDetails: { flex: 1, gap: 5 },
  queueTitle: { color: C.text, fontSize: 13, fontWeight: '600' },
  queueMeta: { color: C.muted, fontSize: 11 },
  queueMetaError: { color: C.error },
  progressTrack: { height: 5, borderRadius: 5, overflow: 'hidden', backgroundColor: C.elevated },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: C.brand },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 5 },
  retryText: { color: C.brand, fontSize: 11, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  inputRowFocused: { borderColor: C.brand },
  inputIcon: { marginRight: 6 },
  input: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    height: 44,
  },
  inputAction: { padding: 6 },
  pasteBtn: {
    backgroundColor: C.elevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pasteBtnText: { color: C.text, fontSize: 12, fontWeight: '600' },
  formatWrap: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  formatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  formatBtnActive: { backgroundColor: C.brand },
  formatText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  formatTextActive: { color: '#fff' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: C.errorSoft,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: C.error, fontSize: 13, flex: 1 },
  cta: {
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resultCard: { gap: 0 },
  meta: { padding: 14, gap: 8, flexDirection: 'row', alignItems: 'center' },
  details: { flex: 1, gap: 8 },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: C.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { color: C.text, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    backgroundColor: C.elevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipText: { color: C.muted, fontSize: 11, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.elevated,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingVertical: 14,
  },
  saveBtnDone: { backgroundColor: 'rgba(52,211,153,0.1)' },
  saveBtnText: { color: C.text, fontWeight: '600', fontSize: 14 },
});
