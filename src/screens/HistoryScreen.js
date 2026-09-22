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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { C } from '../theme/colors';
import { AppHeader, IconBtn, Card } from '../components/UI';

export default function HistoryScreen() {
  const [filter, setFilter] = useState('all'); // 'all' | 'video' | 'audio'
  const [historyItems, setHistoryItems] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem('download_history');
      if (stored) {
        setHistoryItems(JSON.parse(stored));
      } else {
        setHistoryItems([]);
      }
    } catch (e) {
      setHistoryItems([]);
    }
  };

  const handleClearAll = () => {
    if (historyItems.length === 0) return;
    Alert.alert(
      'Effacer l’historique',
      'Voulez-vous vraiment supprimer tout l’historique ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('download_history');
            setHistoryItems([]);
          },
        },
      ]
    );
  };

  const handleRemoveItem = async (id) => {
    const newHistory = historyItems.filter(item => item.id !== id);
    setHistoryItems(newHistory);
    await AsyncStorage.setItem('download_history', JSON.stringify(newHistory));
  };

  const filteredItems = historyItems.filter((item) => {
    if (filter === 'all') return true;
    return item.format === filter;
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader
        subtitle="Historique"
        rightActions={
          <>
            <IconBtn name="delete-outline" color={C.error} onPress={handleClearAll} />
          </>
        }
      />

      <View style={s.tabSelectorWrap}>
        <View style={s.tabSelector}>
          <TouchableOpacity
            style={[s.tabBtn, filter === 'all' && s.tabBtnActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[s.tabText, filter === 'all' && s.tabTextActive]}>
              Tous
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, filter === 'video' && s.tabBtnActive]}
            onPress={() => setFilter('video')}
          >
            <Text style={[s.tabText, filter === 'video' && s.tabTextActive]}>
              Vidéos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, filter === 'audio' && s.tabBtnActive]}
            onPress={() => setFilter('audio')}
          >
            <Text style={[s.tabText, filter === 'audio' && s.tabTextActive]}>
              Audios
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <MaterialIcons name="history" size={48} color={C.subtle} />
            <Text style={s.emptyText}>Aucun téléchargement dans l'historique</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isVideo = item.format === 'video';
          return (
            <Card style={s.historyCard}>
              <View style={s.thumbBox}>
                <View
                  style={[
                    s.iconBackground,
                    {
                      backgroundColor: isVideo
                        ? 'rgba(94, 106, 210, 0.15)'
                        : 'rgba(52, 211, 153, 0.15)',
                    },
                  ]}
                >
                  <MaterialIcons
                    name={isVideo ? 'play-circle-outline' : 'audiotrack'}
                    size={26}
                    color={isVideo ? C.brand : C.success}
                  />
                </View>
                <View style={s.formatBadge}>
                  <Text style={s.formatBadgeText}>{item.ext || (isVideo ? 'MP4' : 'MP3')}</Text>
                </View>
              </View>

              <View style={s.metaWrap}>
                <Text style={s.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={s.itemMeta}>
                  {item.resolution} • {item.size}
                </Text>
                <Text style={s.itemTime}>{item.time}</Text>
              </View>

              <TouchableOpacity style={s.moreBtn} onPress={() => handleRemoveItem(item.id)}>
                <MaterialIcons name="delete-outline" size={20} color={C.errorSoft} />
              </TouchableOpacity>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  tabSelectorWrap: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(46, 50, 59, 0.4)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: C.elevated,
  },
  tabText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: C.text,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  thumbBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: C.elevated,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(46, 50, 59, 0.5)',
  },
  iconBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  formatBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  metaWrap: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
  itemMeta: {
    color: C.muted,
    fontSize: 11,
  },
  itemTime: {
    color: C.subtle,
    fontSize: 10,
  },
  moreBtn: {
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
  },
});
