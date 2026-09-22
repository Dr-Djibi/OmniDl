# OmniDL — Contexte du Projet (App Mobile)

> ⚠️ Ce fichier est dans `.gitignore` — il ne sera jamais committé.
> Il sert de mémoire projet pour le développeur et les agents AI.

---

## 🎯 Vue d'ensemble

**OmniDL** est une application mobile React Native (Expo) qui permet à l'utilisateur de télécharger des vidéos et audios depuis des liens de réseaux sociaux.

Elle consomme l'API **MENMA DLX** déployée sur Vercel.

---

## 🏗️ Stack technique

| Technologie      | Version       | Rôle                              |
|------------------|---------------|-----------------------------------|
| React Native     | 0.74.5        | Framework mobile                  |
| Expo             | ~51.0.28      | Toolchain / build                 |
| NativeWind       | —             | Tailwind CSS pour React Native    |
| @expo/vector-icons (MaterialIcons) | — | Icônes |
| babel-preset-expo | —            | Transpilation                     |

---

## 📁 Structure du projet

```
downloader-app/
├── App.js                          ← Entry point — importe MainScreen
├── app.json                        ← Config Expo (nom: OmniDL, dark, splash #121318)
├── package.json                    ← Dépendances (voir section deps)
├── babel.config.js                 ← Preset expo + plugin nativewind/babel
├── tailwind.config.js              ← Thème couleurs Material You dark
├── assets/                         ← icon.png, splash.png, adaptive-icon.png
├── src/
│   ├── components/
│   │   └── MainScreen.js           ← Composant principal COMPLET (UI + logique API)
│   └── screens/
│       └── HomeScreen.js           ← Version alternative de l'écran (similaire à MainScreen)
└── context.md                      ← CE FICHIER
```

> **Note :** `App.js` importe directement `MainScreen` (pas de navigation encore).
> `HomeScreen.js` est une version légèrement simplifiée de `MainScreen.js` (sans header/bottom nav).
> Le composant actif en prod est `MainScreen`.

---

## 🎨 Thème / Design System

Dark theme Material You — couleurs définies dans `tailwind.config.js` :

| Token                         | Valeur hex  | Usage                         |
|-------------------------------|-------------|-------------------------------|
| `surface`                     | `#121318`   | Fond principal                |
| `surface-container-low`       | `#1a1b21`   | Cards, inputs                 |
| `surface-container-high`      | `#292a2f`   | Boutons secondaires           |
| `surface-container-lowest`    | `#0d0e13`   | Thumbnail bg                  |
| `primary`                     | `#d0bcff`   | CTA principal (violet clair)  |
| `on-primary`                  | `#3c0091`   | Texte sur primary             |
| `on-surface`                  | `#e3e1e9`   | Texte principal               |
| `on-surface-variant`          | `#cbc3d7`   | Texte secondaire              |
| `outline`                     | `#958ea0`   | Placeholders, bordures        |
| `outline-variant`             | `#494454`   | Bordures subtiles             |

> Les styles sont écrits en `StyleSheet.create()` inline (pas encore de classes Tailwind utilisées dans les composants actuels).

---

## 🔌 API consommée — MENMA DLX

**Base URL :** `https://menma-dlx.vercel.app`

**Endpoint principal :** `POST /api/download`

### Headers requis
```
Content-Type: application/json
X-Tenant-Key: key_app
```

### Body
```json
{
  "url":     "https://youtube.com/watch?v=...",
  "format":  "video" | "audio",
  "quality": "hd" | "sd"
}
```

### Réponse succès (`200`)
```json
{
  "success":      true,
  "platform":     "YouTube",
  "title":        "Titre de la vidéo",
  "thumbnail":    "https://...",
  "media_type":   "video" | "audio" | "image",
  "format":       "mp4" | "mp3" | null,
  "quality":      "hd" | "sd" | "360p" | "...",
  "download_url": "https://...",
  "all_media":    [ { "url": "...", "type": "image" } ] | null
}
```

### Réponse erreur
```json
{
  "success": false,
  "error":   "Message lisible",
  "code":    "INVALID_URL" | "PLATFORM_UNSUPPORTED" | "EXTRACTION_FAILED" | "TIMEOUT" | "AUTH_REQUIRED"
}
```

### Plateformes supportées
YouTube, TikTok, Instagram, Facebook, Twitter/X

> `all_media` est non-null uniquement pour TikTok (slides), Instagram (carrousel), Pinterest (galerie).
> Les URLs YouTube via Innertube expirent en ~6h.

---

## 📱 État actuel de l'app (septembre 2026)

### ✅ Fait
- UI principale dessinée (`MainScreen.js`) :
  - Header avec logo OmniDL + icônes historique/settings
  - Input URL + bouton "Coller"
  - Toggle Vidéo / Audio
  - Bouton CTA "Télécharger le média"
  - Preview card : thumbnail 16/9, titre, plateforme, badge durée, bouton Enregistrer
  - Bottom nav : Téléchargeur / Historique / Fichiers / Paramètres (statique, non fonctionnel)
- Appel API branché (`handleExtract`) — fetch vers `/api/download` avec `X-Tenant-Key: key_app`
- `handleSave` — ouvre `download_url` via `Linking.openURL` (workaround temporaire)

### ❌ Pas encore fait (TODO)
- [ ] **Clipboard réel** — `handlePaste` met une URL hardcodée au lieu de lire le presse-papier → installer `expo-clipboard`
- [ ] **Téléchargement réel** — `handleSave` ouvre juste un lien → implémenter avec `expo-file-system` + `expo-media-library`
- [ ] **Navigation** — Bottom nav non fonctionnel, pas de React Navigation installé
- [ ] **Écran Historique** — Stocker les téléchargements passés (AsyncStorage ou SQLite)
- [ ] **Écran Fichiers** — Lister les fichiers téléchargés
- [ ] **Écran Paramètres** — Réglages (qualité par défaut, dossier de sauvegarde, etc.)
- [ ] **Gestion carrousels** — Afficher/télécharger `all_media` (grille d'images pour Instagram/TikTok slides)
- [ ] **Toast / snackbar** — Remplacer les `alert()` natifs par des notifications UI
- [ ] **Animation** — Icône "sync" en rotation pendant `isExtracting`
- [ ] **Gestion d'erreurs enrichie** — Mapper `code` API vers messages FR lisibles
- [ ] **Splash screen / icône finale** — Assets provisoires dans `assets/`

---

## 📦 Dépendances à installer (quand on avancera)

```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context

# Clipboard
npx expo install expo-clipboard

# Téléchargement fichiers
npx expo install expo-file-system expo-media-library

# Stockage local
npx expo install @react-native-async-storage/async-storage

# Toast
# Option : react-native-toast-message
```

---

## 🚀 Lancer l'app

```bash
cd ~/downloader-app
npm start         # ou: expo start
# Puis scanner le QR avec Expo Go (Android/iOS)
# ou appuyer sur 'a' pour Android émulateur, 'i' pour iOS simulateur
```

---

## 🔗 Repos liés

- **API (backend) :** `~/downloader-api` → déployée sur `https://menma-dlx.vercel.app`
- **App (ce repo) :** `~/downloader-app`
