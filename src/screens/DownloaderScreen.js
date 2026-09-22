import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Image, StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../theme/colors';
import { AppHeader, IconBtn, Card } from '../components/UI';

export default function DownloaderScreen({ navigation }) {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('video'); // 'video' | 'audio'
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [downloadResult, setDownloadResult] = useState(null);
  const [error, setError] = useState(null);


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
      } catch (parseError) {
        // Le backend n'a pas renvoyé de JSON, on crée un objet d'erreur avec le texte brut reçu
        data = { success: false, error: responseText || "Le serveur a renvoyé une réponse invalide." };
      }

      if (data.success) {
        setDownloadResult(data);
      } else {
        setError(data.error || 'Extraction échouée');
      }
    } catch (e) {
      setError('Erreur de connexion : ' + e.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!downloadResult?.download_url) return;
    setIsSaving(true);
    setError(null);
    try {
      const ext = (downloadResult.format === 'audio' || format === 'audio') ? 'mp3' : 'mp4';
      const safeTitle = (downloadResult.title || 'OmniDL_Media').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeTitle}_${Date.now()}.${ext}`;
      const fileUri = FileSystem.documentDirectory + filename;

      // Téléchargement dans l'app
      const { uri } = await FileSystem.downloadAsync(downloadResult.download_url, fileUri);
      
      // Copie vers le dossier utilisateur s'il en a choisi un
      const customFolderUri = await AsyncStorage.getItem('custom_folder_uri');
      if (customFolderUri) {
        try {
          const mimeType = ext === 'mp3' ? 'audio/mpeg' : 'video/mp4';
          const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            customFolderUri,
            filename,
            mimeType
          );
          const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.writeAsStringAsync(newFileUri, content, { encoding: FileSystem.EncodingType.Base64 });
        } catch (safError) {
          console.log("Erreur de sauvegarde externe:", safError);
        }
      }

      setIsSaved(true);

      // Save to History
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const sizeMo = fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(1) + ' Mo' : 'Inconnu';
      
      const historyItem = {
        id: Date.now().toString(),
        title: downloadResult.title || 'Média sans titre',
        format: format,
        ext: ext.toUpperCase(),
        resolution: downloadResult.quality === 'hd' ? '1080p' : '480p',
        size: sizeMo,
        time: new Date().toLocaleString(),
        uri: uri
      };

      const existing = await AsyncStorage.getItem('download_history');
      const history = existing ? JSON.parse(existing) : [];
      history.unshift(historyItem);
      await AsyncStorage.setItem('download_history', JSON.stringify(history.slice(0, 50)));

    } catch (e) {
      setError('Erreur d\'enregistrement : ' + e.message);
    } finally {
      setIsSaving(false);
    }
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
            <View style={s.thumbWrap}>
              <Image
                source={{ uri: downloadResult.thumbnail }}
                style={s.thumb}
                resizeMode="cover"
              />
              {downloadResult.platform && (
                <View style={s.platformBadge}>
                  <Text style={s.platformBadgeText}>{downloadResult.platform}</Text>
                </View>
              )}
            </View>

            <View style={s.meta}>
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
                {isSaved ? 'Enregistré dans l\'app !' : isSaving ? 'Enregistrement en cours...' : 'Enregistrer sur l\'appareil'}
              </Text>
            </TouchableOpacity>
          </Card>
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
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: C.elevated,
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  platformBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  platformBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  meta: { padding: 14, gap: 8 },
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
