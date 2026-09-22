import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import { C } from '../theme/colors';
import { AppHeader, IconBtn, Card, Pill } from '../components/UI';

export default function FilesScreen() {
  const [filter, setFilter] = useState('all'); // 'all' | 'video' | 'audio'
  const [files, setFiles] = useState([]);
  const [storageInfo, setStorageInfo] = useState({ used: '0 Go', total: '0 Go', ratio: 0 });

  useFocusEffect(
    useCallback(() => {
      loadFiles();
    }, [])
  );

  const loadFiles = async () => {
    try {
      const dirUri = FileSystem.documentDirectory;
      const dirFiles = await FileSystem.readDirectoryAsync(dirUri);
      
      const fileStats = [];
      for (const f of dirFiles) {
        if (f.endsWith('.mp4') || f.endsWith('.mp3')) {
          const info = await FileSystem.getInfoAsync(dirUri + f);
          if (info.exists) {
            fileStats.push({
              id: f,
              name: f,
              type: f.endsWith('.mp4') ? 'video' : 'audio',
              size: (info.size / (1024 * 1024)).toFixed(1) + ' Mo',
              quality: f.endsWith('.mp4') ? 'Vidéo' : 'Audio',
              date: new Date(info.modificationTime * 1000).toLocaleDateString(),
              uri: info.uri,
              timestamp: info.modificationTime
            });
          }
        }
      }
      
      setFiles(fileStats.sort((a, b) => b.timestamp - a.timestamp));

      // Info de stockage
      const capacity = await FileSystem.getTotalDiskCapacityAsync();
      const free = await FileSystem.getFreeDiskStorageAsync();
      const usedBytes = capacity - free;
      
      setStorageInfo({
        used: (usedBytes / (1024 * 1024 * 1024)).toFixed(1) + ' Go',
        total: (capacity / (1024 * 1024 * 1024)).toFixed(0) + ' Go',
        ratio: Math.min((usedBytes / capacity) * 100, 100)
      });
    } catch (e) {
      console.log("Erreur lecture fichiers", e);
    }
  };

  const handleCleanCache = async () => {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      const cacheFiles = await FileSystem.readDirectoryAsync(cacheDir);
      let deletedSize = 0;
      for (const f of cacheFiles) {
        const info = await FileSystem.getInfoAsync(cacheDir + f);
        if (info.exists && info.size) deletedSize += info.size;
        await FileSystem.deleteAsync(cacheDir + f, { idempotent: true });
      }
      const sizeMo = (deletedSize / (1024 * 1024)).toFixed(1);
      Alert.alert('Nettoyage', `Cache système vidé avec succès. ${sizeMo} Mo libérés.`);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de vider le cache.');
    }
  };

  const handleShare = async (uri) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil.');
      }
    } catch (e) {
      console.log("Share err:", e);
    }
  };

  const handleDelete = (uri, name) => {
    Alert.alert('Supprimer', `Voulez-vous supprimer le fichier ${name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        loadFiles();
      }}
    ]);
  };

  const filteredFiles = files.filter((f) => {
    if (filter === 'all') return true;
    return f.type === filter;
  });

  const videoCount = files.filter((f) => f.type === 'video').length;
  const audioCount = files.filter((f) => f.type === 'audio').length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader
        subtitle="Fichiers Locaux"
      />

      <View style={s.container}>
        {/* Storage Summary Card */}
        <Card style={s.storageCard}>
          <View style={s.storageHeader}>
            <View>
              <Text style={s.storageLabel}>Stockage utilisé</Text>
              <Text style={s.storageValues}>
                {storageInfo.used} <Text style={s.storageMax}>/ {storageInfo.total}</Text>
              </Text>
            </View>
            <TouchableOpacity style={s.cleanBtn} onPress={handleCleanCache}>
              <Text style={s.cleanBtnText}>Nettoyer le cache</Text>
            </TouchableOpacity>
          </View>
          <View style={s.progressBarTrack}>
            <View style={[s.progressBarFill, { width: `${storageInfo.ratio}%` }]} />
          </View>
        </Card>

        {/* Filter Pills */}
        <View style={s.filtersRow}>
          <Pill
            label={`Tous (${files.length})`}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <Pill
            label={`Vidéos (${videoCount})`}
            active={filter === 'video'}
            onPress={() => setFilter('video')}
          />
          <Pill
            label={`Musiques (${audioCount})`}
            active={filter === 'audio'}
            onPress={() => setFilter('audio')}
          />
        </View>

        {/* Files List */}
        <FlatList
          data={filteredFiles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <MaterialIcons name="folder-open" size={48} color={C.subtle} />
              <Text style={s.emptyText}>Aucun fichier local</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isVideo = item.type === 'video';
            return (
              <Card style={s.fileCard}>
                <View style={s.fileInfoRow}>
                  <View style={s.fileIconBox}>
                    <MaterialIcons
                      name={isVideo ? 'videocam' : 'music-note'}
                      size={20}
                      color={isVideo ? C.brand : '#818cf8'}
                    />
                  </View>
                  <View style={s.fileNameWrap}>
                    <Text style={s.fileName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={s.fileDetails}>
                      {item.size} • {item.quality} • {item.date}
                    </Text>
                  </View>
                </View>

                <View style={s.actionsRow}>
                  <TouchableOpacity style={s.actionPlay} onPress={() => handleDelete(item.uri, item.name)}>
                    <MaterialIcons name="delete-outline" size={20} color={C.errorSoft} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionShare} onPress={() => handleShare(item.uri)}>
                    <MaterialIcons name="share" size={20} color={C.text} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 16,
  },
  storageCard: {
    padding: 16,
    gap: 12,
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageLabel: {
    color: C.muted,
    fontSize: 11,
  },
  storageValues: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  storageMax: {
    color: C.subtle,
    fontSize: 12,
    fontWeight: '400',
  },
  cleanBtn: {
    backgroundColor: C.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cleanBtnText: {
    color: C.brand,
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarTrack: {
    width: '100%',
    height: 5,
    backgroundColor: C.bg,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: C.brand,
    borderRadius: 99,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  fileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 8,
  },
  fileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: C.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(46, 50, 59, 0.6)',
  },
  fileNameWrap: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
  fileDetails: {
    color: C.muted,
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPlay: {
    padding: 10,
  },
  actionShare: {
    padding: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    color: C.muted,
    fontSize: 14,
  }
});
