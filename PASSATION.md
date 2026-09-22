# PASSATION — OmniDL (downloader-app)

> Ce fichier est destiné à un agent IA (ou développeur) qui reprend le projet.
> Lis `context.md` en premier pour le contexte complet. Ce fichier se concentre sur **quoi faire ensuite**.

---

## 🧭 Résumé en 3 lignes

Application mobile **React Native + Expo** qui télécharge des vidéos/audios depuis des liens sociaux (YouTube, TikTok, Instagram, Facebook, Twitter).
Elle appelle l'API `POST https://menma-dlx.vercel.app/api/download` avec le header `X-Tenant-Key: key_app`.
L'UI principale est dessinée et l'appel API est branché — il reste à implémenter la navigation, le vrai téléchargement fichier, l'historique et les carrousels.

---

## 📂 Fichiers importants à lire en premier

| Fichier | Pourquoi |
|---------|----------|
| `context.md` | Contexte complet (stack, API, design system, todo) |
| `src/components/MainScreen.js` | **Composant principal actif** — toute la logique et l'UI sont là |
| `App.js` | Entry point — importe `MainScreen` directement |
| `app.json` | Config Expo (nom app, couleurs, assets) |
| `tailwind.config.js` | Tokens de couleurs du design system |

---

## 🎯 Prochaines tâches prioritaires

### 1. 📋 Clipboard réel (facile, ~10 min)

**Problème :** `handlePaste` dans `MainScreen.js` met une URL hardcodée.
**Fix :**
```bash
npx expo install expo-clipboard
```
```js
import * as Clipboard from 'expo-clipboard';
const handlePaste = async () => {
  const text = await Clipboard.getStringAsync();
  setUrl(text);
};
```

---

### 2. 💾 Téléchargement réel (moyen, ~1h)

**Problème :** `handleSave` ouvre juste `Linking.openURL(download_url)` — le fichier n'est pas vraiment sauvegardé.
**Fix :**
```bash
npx expo install expo-file-system expo-media-library
```
```js
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const handleSave = async () => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') return alert('Permission refusée');

  const ext = downloadResult.format || 'mp4';
  const filename = `${FileSystem.documentDirectory}omnidl_${Date.now()}.${ext}`;

  const { uri } = await FileSystem.downloadAsync(downloadResult.download_url, filename);
  await MediaLibrary.saveToLibraryAsync(uri);
  setIsSaved(true);
};
```

> ⚠️ Sur Android, `expo-media-library` ne supporte que images et vidéos dans la galerie.
> Pour les MP3 (audio), utiliser `FileSystem.documentDirectory` + notifier l'user.

---

### 3. 🗺️ Navigation (moyen, ~2h)

**Problème :** Le bottom nav dans `MainScreen.js` a 4 onglets (Téléchargeur, Historique, Fichiers, Paramètres) mais ils ne font rien.
**Fix :**
```bash
npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
```

**Structure recommandée :**
```
src/
  navigation/
    AppNavigator.js          ← Bottom Tab Navigator
  screens/
    DownloaderScreen.js      ← Contenu de MainScreen (sans le header/nav)
    HistoryScreen.js         ← Liste des téléchargements passés
    FilesScreen.js           ← Fichiers sauvegardés
    SettingsScreen.js        ← Réglages
  components/
    MainScreen.js            ← Peut devenir le shell (header + nav)
```

**App.js** deviendrait :
```js
import AppNavigator from './src/navigation/AppNavigator';
export default function App() { return <AppNavigator />; }
```

---

### 4. 🕓 Historique (moyen, ~1h)

**Problème :** Pas de persistance — chaque téléchargement est perdu.
**Fix :**
```bash
npx expo install @react-native-async-storage/async-storage
```

Sauvegarder après chaque `handleSave` réussi :
```js
import AsyncStorage from '@react-native-async-storage/async-storage';

const saveToHistory = async (item) => {
  const existing = JSON.parse(await AsyncStorage.getItem('history') || '[]');
  const updated = [{ ...item, savedAt: Date.now() }, ...existing].slice(0, 50);
  await AsyncStorage.setItem('history', JSON.stringify(updated));
};
```

---

### 5. 🖼️ Carrousels `all_media` (moyen, ~1h)

**Problème :** Quand l'API retourne `all_media` (TikTok slides, Instagram carrousel), l'app affiche seulement la première image.
**Fix :** Détecter `all_media !== null` et afficher une FlatList horizontale de toutes les images avec un bouton "Tout télécharger".

---

### 6. 🔔 Toast UI (facile, ~15 min)

**Problème :** Les erreurs utilisent `alert()` natif — moche et bloquant.
**Fix :**
```bash
npm install react-native-toast-message
```
Remplacer tous les `alert(...)` par `Toast.show({ type: 'error', text1: '...', text2: '...' })`.

---

### 7. 🔄 Animation icône chargement (facile, ~20 min)

**Problème :** L'icône `"sync"` ne tourne pas pendant `isExtracting`.
**Fix :** Utiliser `Animated.loop` + `Animated.timing` sur `transform: [{ rotate: spin }]`.

---

## 🚫 Pièges à éviter

- **Ne pas appeler** `expo start --tunnel` sans raison — utilise du bandwidth.
- **NativeWind** est configuré (babel plugin) mais les composants actuels utilisent `StyleSheet.create()` inline — ne pas mixer les deux approches dans un même composant.
- **Les URLs YouTube** (`download_url`) expirent en ~6h — ne pas les mettre en cache longtemps.
- **`all_media`** est `null` pour YouTube/Facebook/Twitter — toujours vérifier avant d'itérer.
- **expo-media-library** sur Android demande une permission runtime — toujours demander avant `saveToLibraryAsync`.
- **`key_app`** est la clé tenant de l'API pour cette app — ne pas la committer en dur en production (mettre dans une variable d'env `.env`).

---

## 🔗 Contexte API (résumé)

```
POST https://menma-dlx.vercel.app/api/download
Headers: Content-Type: application/json, X-Tenant-Key: key_app
Body: { url: string, format: "video"|"audio", quality: "hd"|"sd" }
```

Réponse clé : `{ success, platform, title, thumbnail, download_url, all_media, format, quality }`

---

## ✅ Check-list de passation

- [x] UI principale dessinée (`MainScreen.js`)
- [x] Appel API branché et fonctionnel (`handleExtract`)
- [x] `handleSave` — workaround via `Linking.openURL`
- [ ] Clipboard réel (`expo-clipboard`)
- [ ] Téléchargement réel (`expo-file-system` + `expo-media-library`)
- [ ] Navigation (`@react-navigation/bottom-tabs`)
- [ ] Écran Historique
- [ ] Écran Fichiers
- [ ] Écran Paramètres
- [ ] Gestion carrousels `all_media`
- [ ] Toast / snackbar UI
- [ ] Animation icône sync
- [ ] Gestion d'erreurs enrichie (mapper codes API → messages FR)
- [ ] Assets finaux (icône app, splash screen)
