import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function HomeScreen() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('video'); // 'video' | 'audio'
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [downloadResult, setDownloadResult] = useState(null);

  const handlePaste = () => {
    // In a real app, read from clipboard
    setUrl('https://tiktok.com/@cyber/video/729104882194');
  };

  const handleExtract = async () => {
    if (!url) return;
    setIsExtracting(true);
    setDownloadResult(null);
    try {
      const response = await fetch('https://menma-dlx.vercel.app/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Key': 'key_app'
        },
        body: JSON.stringify({ url, format, quality: 'hd' }),
      });
      
      const data = await response.json();
      if (data.success) {
        setDownloadResult(data);
      } else {
        alert('Erreur: ' + data.error);
      }
    } catch (error) {
      alert('Erreur de connexion API: ' + error.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = () => {
    if (!downloadResult || !downloadResult.download_url) return;
    setIsSaved(true);
    import('react-native').then(({ Linking }) => {
      Linking.openURL(downloadResult.download_url);
    });
    setTimeout(() => {
      setIsSaved(false);
    }, 2000);
  };

  return (
    <ScrollView style={styles.mainContent} contentContainerStyle={styles.scrollContent}>
      {/* Titre */}
      <View style={styles.titleSection}>
        <Text style={styles.h1}>Téléchargement</Text>
        <Text style={styles.subtitle}>Téléchargez vidéos et audios à partir d'un lien.</Text>
      </View>

      {/* Input */}
      <View style={styles.inputSection}>
        <MaterialIcons name="link" size={24} color="#958ea0" />
        <TextInput 
          style={styles.input} 
          value={url} 
          onChangeText={setUrl} 
          placeholder="Coller un lien..." 
          placeholderTextColor="#958ea0"
        />
        <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
          <Text style={styles.pasteText}>Coller</Text>
        </TouchableOpacity>
      </View>

      {/* Format Select */}
      <View style={styles.formatSelect}>
        <TouchableOpacity 
          style={[styles.formatBtn, format === 'video' && styles.formatBtnActive]}
          onPress={() => setFormat('video')}
        >
          <Text style={[styles.formatText, format === 'video' && styles.formatTextActive]}>Vidéo</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.formatBtn, format === 'audio' && styles.formatBtnActive]}
          onPress={() => setFormat('audio')}
        >
          <Text style={[styles.formatText, format === 'audio' && styles.formatTextActive]}>Audio</Text>
        </TouchableOpacity>
      </View>

      {/* Extract CTA */}
      <TouchableOpacity style={styles.extractCta} onPress={handleExtract}>
        <MaterialIcons name={isExtracting ? "sync" : "file-download"} size={20} color="#3c0091" />
        <Text style={styles.extractText}>{isExtracting ? "Extraction en cours..." : "Télécharger le média"}</Text>
      </TouchableOpacity>

      {/* Preview Card */}
      <View style={styles.previewCard}>
        <View style={styles.imageContainer}>
          <Image 
            source={{uri: downloadResult?.thumbnail || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXAp71ZlGNZ0NUAeL8O7kn2OPTF2x4JkKOPif65SvW66Qia89K1jIBb0D1UBrv5CffPpCLC0QAIGQt_5vGUhFoZ4IXtqaV0GBJOqOovgyj0zvydloBdop93tXncgG11ADuy10YUQJKjPzP41HOtWOXsglGhAZ-Q1IljOCQSsHxPuTYB4nnuoFmCyDMdf1tMUAih50A6yP4h7p4mchK96_J-icwEuPX8gehhoAH_yNqwLtWeUmqPkZTkw'}}
            style={styles.previewImage}
          />
          {downloadResult?.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{downloadResult.duration}</Text>
            </View>
          )}
        </View>
        <View style={styles.previewInfo}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {downloadResult?.title || 'Cyberpunk Neo-Tokyo Cityscape'}
          </Text>
          <Text style={styles.previewSubtitle}>
            {downloadResult?.platform || 'NeoVisions'} • {downloadResult?.format || 'MP4'} ({downloadResult?.quality || '1080p'})
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.saveBtn, (!downloadResult?.download_url) && {opacity: 0.5}]} 
          onPress={handleSave}
          disabled={!downloadResult?.download_url}
        >
          <MaterialIcons name={isSaved ? "done-all" : "download-done"} size={20} color="#e3e1e9" />
          <Text style={styles.saveText}>{isSaved ? "Fichier Enregistré" : "Enregistrer"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainContent: {
    flex: 1,
    backgroundColor: '#121318',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 20,
  },
  titleSection: {
    gap: 4,
  },
  h1: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e3e1e9',
  },
  subtitle: {
    fontSize: 12,
    color: '#cbc3d7',
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1b21',
    borderWidth: 1,
    borderColor: 'rgba(73, 68, 84, 0.3)',
    borderRadius: 12,
    padding: 6,
    paddingHorizontal: 8,
  },
  input: {
    flex: 1,
    color: '#e3e1e9',
    fontSize: 14,
    marginHorizontal: 8,
    height: 40,
  },
  pasteButton: {
    backgroundColor: '#292a2f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pasteText: {
    color: '#e3e1e9',
    fontSize: 12,
    fontWeight: 'bold',
  },
  formatSelect: {
    flexDirection: 'row',
    backgroundColor: '#1a1b21',
    borderRadius: 12,
    padding: 4,
    gap: 8,
  },
  formatBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  formatBtnActive: {
    backgroundColor: '#292a2f',
  },
  formatText: {
    color: '#cbc3d7',
    fontSize: 12,
    fontWeight: 'bold',
  },
  formatTextActive: {
    color: '#e3e1e9',
  },
  extractCta: {
    flexDirection: 'row',
    backgroundColor: '#d0bcff',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  extractText: {
    color: '#3c0091',
    fontWeight: 'bold',
    fontSize: 14,
  },
  previewCard: {
    backgroundColor: '#1a1b21',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(73, 68, 84, 0.2)',
    padding: 12,
    gap: 12,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16/9,
    borderRadius: 8,
    backgroundColor: '#0d0e13',
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  previewInfo: {
    gap: 2,
  },
  previewTitle: {
    color: '#e3e1e9',
    fontSize: 15,
    fontWeight: 'bold',
  },
  previewSubtitle: {
    color: '#cbc3d7',
    fontSize: 12,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#292a2f',
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveText: {
    color: '#e3e1e9',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
