import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';
import { C } from '../theme/colors';
import { AppHeader, Card, SectionTitle, Toggle } from '../components/UI';

export default function SettingsScreen() {
  const [wifiOnly, setWifiOnly] = useState(true);
  const [videoQuality, setVideoQuality] = useState('1080p Full HD');
  const [audioFormat, setAudioFormat] = useState('MP3 320 kbps');
  const [simultaneousDownloads, setSimultaneousDownloads] = useState('2 à la fois');
  const [cacheSize, setCacheSize] = useState('0 Mo');
  const [downloadFolder, setDownloadFolder] = useState('Auto');
  const [downloadFolderUri, setDownloadFolderUri] = useState(null);

  useEffect(() => {
    loadSettings();
    calculateCache();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('app_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setWifiOnly(parsed.wifiOnly ?? true);
        setVideoQuality(parsed.videoQuality ?? '1080p Full HD');
        setAudioFormat(parsed.audioFormat ?? 'MP3 320 kbps');
        setSimultaneousDownloads(parsed.simultaneousDownloads ?? '2 à la fois');
      }
      const folderUri = await AsyncStorage.getItem('custom_folder_uri');
      if (folderUri) {
        setDownloadFolder('Personnalisé');
        setDownloadFolderUri(folderUri);
      }
    } catch (e) {
      console.log("Erreur chargement paramètres");
    }
  };

  const handleSelectFolder = async () => {
    try {
      // Demande l'accès à un dossier (demande à l'utilisateur de choisir "Téléchargements")
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      
      if (permissions.granted) {
        let finalUri = permissions.directoryUri;
        
        // Essaie de créer un sous-dossier "OmniDL"
        try {
          // On vérifie si l'utilisateur n'a pas DÉJÀ sélectionné un dossier qui s'appelle OmniDL
          if (!decodeURIComponent(finalUri).endsWith('OmniDL')) {
            finalUri = await FileSystem.StorageAccessFramework.makeDirectoryAsync(permissions.directoryUri, 'OmniDL');
          }
        } catch (dirError) {
          // Le dossier existe peut-être déjà, on va devoir le chercher dans le contenu
          const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(permissions.directoryUri);
          const existingOmniDL = files.find(f => decodeURIComponent(f).endsWith('OmniDL'));
          if (existingOmniDL) {
            finalUri = existingOmniDL;
          }
        }

        await AsyncStorage.setItem('custom_folder_uri', finalUri);
        setDownloadFolder('Personnalisé');
        setDownloadFolderUri(finalUri);
        Toast.show({ type: 'success', text1: 'Dossier configuré', text2: 'Les fichiers iront dans le dossier OmniDL.' });
      }
    } catch (e) {
      console.log('Erreur SAF', e);
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de configurer le dossier.' });
    }
  };

  const updateSetting = async (key, value, setter) => {
    setter(value);
    try {
      const settings = await AsyncStorage.getItem('app_settings');
      const parsed = settings ? JSON.parse(settings) : {};
      parsed[key] = value;
      await AsyncStorage.setItem('app_settings', JSON.stringify(parsed));
    } catch (e) {
      console.log("Erreur sauvegarde paramètre", e);
    }
  };

  const calculateCache = async () => {
    try {
      const dir = FileSystem.cacheDirectory;
      const files = await FileSystem.readDirectoryAsync(dir);
      let total = 0;
      for (const f of files) {
        const info = await FileSystem.getInfoAsync(dir + f);
        if (info.exists && info.size) total += info.size;
      }
      setCacheSize((total / (1024 * 1024)).toFixed(1) + ' Mo');
    } catch (e) {
      console.log(e);
    }
  };

  const handleClearCache = async () => {
    try {
      const dir = FileSystem.cacheDirectory;
      const files = await FileSystem.readDirectoryAsync(dir);
      for (const f of files) {
        await FileSystem.deleteAsync(dir + f, { idempotent: true });
      }
      Toast.show({ type: 'success', text1: 'Cache vidé', text2: 'Les fichiers temporaires ont été supprimés.' });
      calculateCache();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de vider le cache.' });
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader
        subtitle="Paramètres"
        rightActions={
          <View style={s.statusBadge}>
            <View style={s.statusDot} />
            <Text style={s.statusText}>Prêt</Text>
          </View>
        }
      />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* Section: Téléchargements */}
        <View style={s.section}>
          <SectionTitle>Téléchargements</SectionTitle>
          <Card style={s.groupCard}>
            {/* Qualité vidéo */}
            <View style={s.row}>
              <View style={s.rowTextWrap}>
                <Text style={s.rowTitle}>Qualité vidéo par défaut</Text>
                <Text style={s.rowSubtitle}>Résolution préférée des vidéos</Text>
              </View>
              <TouchableOpacity style={s.selectPill} onPress={() => updateSetting('videoQuality', videoQuality === '1080p Full HD' ? '4K Ultra HD' : '1080p Full HD', setVideoQuality)}>
                <Text style={s.selectPillText}>{videoQuality}</Text>
              </TouchableOpacity>
            </View>

            <View style={s.divider} />

            {/* Format audio */}
            <View style={s.row}>
              <View style={s.rowTextWrap}>
                <Text style={s.rowTitle}>Format audio préféré</Text>
                <Text style={s.rowSubtitle}>Extraction de bande son</Text>
              </View>
              <TouchableOpacity style={s.selectPill} onPress={() => updateSetting('audioFormat', audioFormat === 'MP3 320 kbps' ? 'MP3 192 kbps' : 'MP3 320 kbps', setAudioFormat)}>
                <Text style={s.selectPillText}>{audioFormat}</Text>
              </TouchableOpacity>
            </View>

            <View style={s.divider} />

            {/* Destination */}
            <TouchableOpacity style={s.row} onPress={handleSelectFolder}>
              <View style={s.rowTextWrap}>
                <Text style={s.rowTitle}>Dossier de destination</Text>
                <Text style={s.rowSubtitle} numberOfLines={1}>
                  {downloadFolderUri ? decodeURIComponent(downloadFolderUri.split('/').pop()) : 'Documents / Stockage local'}
                </Text>
              </View>
              <View style={s.badgeDark}>
                <Text style={s.badgeDarkText}>{downloadFolder}</Text>
              </View>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Section: Réseau & Données */}
        <View style={s.section}>
          <SectionTitle>Réseau & Données</SectionTitle>
          <Card style={s.groupCard}>
            {/* Wi-Fi Uniquement */}
            <View style={s.row}>
              <View style={s.rowTextWrap}>
                <Text style={s.rowTitle}>Télécharger en Wi-Fi uniquement</Text>
                <Text style={s.rowSubtitle}>Évite d'utiliser le forfait données mobiles</Text>
              </View>
              <Toggle value={wifiOnly} onValueChange={(val) => updateSetting('wifiOnly', val, setWifiOnly)} />
            </View>

            <View style={s.divider} />

            {/* Simultanés */}
            <View style={s.row}>
              <View style={s.rowTextWrap}>
                <Text style={s.rowTitle}>Téléchargements simultanés</Text>
                <Text style={s.rowSubtitle}>Limite les flux simultanés</Text>
              </View>
              <TouchableOpacity style={s.selectPill} onPress={() => updateSetting('simultaneousDownloads', simultaneousDownloads === '2 à la fois' ? '4 à la fois' : '2 à la fois', setSimultaneousDownloads)}>
                <Text style={s.selectPillText}>{simultaneousDownloads}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Section: Général & Confidentialité */}
        <View style={s.section}>
          <SectionTitle>Général & Confidentialité</SectionTitle>
          <Card style={s.groupCard}>
            {/* Mode Sombre */}
            <View style={s.row}>
              <View style={s.rowTextWrap}>
                <Text style={s.rowTitle}>Mode sombre</Text>
                <Text style={s.rowSubtitle}>Thème Obsidian Stream</Text>
              </View>
              <View style={s.badgeDark}>
                <Text style={s.badgeDarkText}>Activé</Text>
              </View>
            </View>

            <View style={s.divider} />

            {/* Vider le cache */}
            <View style={s.row}>
              <View style={s.rowTextWrap}>
                <Text style={s.rowTitle}>Vider le cache</Text>
                <Text style={s.rowSubtitle}>Fichiers temporaires & aperçus</Text>
              </View>
              <TouchableOpacity style={s.clearCacheBtn} onPress={handleClearCache}>
                <Text style={s.clearCacheBtnText}>Vider {cacheSize}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>OmniDL by Dr Djibi</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 36,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.border,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.success,
  },
  statusText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    gap: 6,
  },
  groupCard: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: C.muted,
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(46, 50, 59, 0.4)',
  },
  selectPill: {
    backgroundColor: C.elevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(46, 50, 59, 0.6)',
  },
  selectPillText: {
    color: C.text,
    fontSize: 12,
    fontWeight: '500',
  },
  badgeDark: {
    backgroundColor: C.elevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeDarkText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  clearCacheBtn: {
    backgroundColor: C.elevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(46, 50, 59, 0.6)',
  },
  clearCacheBtnText: {
    color: C.text,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  footerText: {
    color: C.subtle,
    fontSize: 11,
  },
});
