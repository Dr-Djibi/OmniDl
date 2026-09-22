import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { C } from '../theme/colors';

const LOGO = require('../../assets/icon.png');

// Mapping tab name → MaterialIcons icon name
const TAB_ICONS = {
  Downloader: { icon: 'file-download',  label: 'Téléchargeur' },
  History:    { icon: 'history',         label: 'Historique'   },
  Files:      { icon: 'folder',          label: 'Fichiers'     },
  Settings:   { icon: 'settings',        label: 'Paramètres'   },
};

// ── App Header ────────────────────────────────────────────────────────────
export function AppHeader({ subtitle, rightActions }) {
  return (
    <View style={s.header}>
      <View style={s.headerLeft}>
        <Image source={LOGO} style={s.logo} />
        <View>
          <Text style={s.appName}>OmniDL</Text>
          {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightActions ? <View style={s.headerRight}>{rightActions}</View> : null}
    </View>
  );
}

// ── Bottom Tab Bar (custom tabBar prop for @react-navigation/bottom-tabs) ──
export function BottomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.tabBar, { paddingBottom: insets.bottom + 4 }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const { icon, label } = TAB_ICONS[route.name] || { icon: 'circle', label: route.name };

        return (
          <TouchableOpacity
            key={route.key}
            style={s.tabItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(route.name)}
          >
            {/* Active dot indicator */}
            {isFocused && <View style={s.tabDot} />}
            <MaterialIcons
              name={icon}
              size={22}
              color={isFocused ? C.text : C.muted}
            />
            <Text style={[s.tabLabel, isFocused && s.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Icon button (header actions) ──────────────────────────────────────────
export function IconBtn({ name, onPress, color, size = 22 }) {
  return (
    <TouchableOpacity style={s.iconBtn} onPress={onPress} activeOpacity={0.7}>
      <MaterialIcons name={name} size={size} color={color || C.muted} />
    </TouchableOpacity>
  );
}

// ── Generic card ──────────────────────────────────────────────────────────
export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

// ── Section title ─────────────────────────────────────────────────────────
export function SectionTitle({ children }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

// ── Filter Pills ──────────────────────────────────────────────────────────
export function Pill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[s.pill, active && s.pillActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Primary Button ────────────────────────────────────────────────────────
export function PrimaryButton({ label, iconName, onPress, disabled, loading }) {
  return (
    <TouchableOpacity
      style={[s.primaryBtn, (disabled || loading) && s.primaryBtnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {iconName && !loading && (
        <MaterialIcons name={iconName} size={18} color="#fff" style={{ marginRight: 6 }} />
      )}
      {loading && (
        <MaterialIcons name="sync" size={18} color="#fff" style={{ marginRight: 6 }} />
      )}
      <Text style={s.primaryBtnText}>{loading ? 'Chargement...' : label}</Text>
    </TouchableOpacity>
  );
}

// ── Ghost Button ──────────────────────────────────────────────────────────
export function GhostButton({ label, iconName, onPress, destructive }) {
  return (
    <TouchableOpacity
      style={[s.ghostBtn, destructive && s.ghostBtnDestructive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {iconName && (
        <MaterialIcons
          name={iconName}
          size={16}
          color={destructive ? C.error : C.muted}
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[s.ghostBtnText, destructive && s.ghostBtnTextDestructive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Toggle (iOS-style) ────────────────────────────────────────────────────
export function Toggle({ value, onValueChange }) {
  return (
    <TouchableOpacity
      style={[s.toggleTrack, value && s.toggleTrackActive]}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.8}
    >
      <View style={[s.toggleThumb, value && s.toggleThumbActive]} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 24, height: 24, borderRadius: 6 },
  appName: { color: C.text, fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  headerSub: { color: C.muted, fontSize: 11, marginTop: 1 },
  headerRight: { flexDirection: 'row', gap: 2 },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(17,19,23,0.97)',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
    position: 'relative',
  },
  tabDot: {
    position: 'absolute',
    top: 0,
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.brand,
  },
  tabLabel: { color: C.muted, fontSize: 10, fontWeight: '500' },
  tabLabelActive: { color: C.text, fontWeight: '600' },

  // ── Icon button ──
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },

  // ── Card ──
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(46,50,59,0.6)',
    overflow: 'hidden',
  },

  // ── Section title ──
  sectionTitle: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 2,
    marginBottom: 8,
  },

  // ── Pill ──
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(46,50,59,0.6)',
  },
  pillActive: { backgroundColor: C.brand, borderColor: C.brand },
  pillText: { color: C.muted, fontSize: 12, fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  // ── Primary button ──
  primaryBtn: {
    backgroundColor: C.brand,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Ghost button ──
  ghostBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnDestructive: { borderColor: C.errorSoft },
  ghostBtnText: { color: C.text, fontSize: 13, fontWeight: '500' },
  ghostBtnTextDestructive: { color: C.error },

  // ── Toggle ──
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleTrackActive: { backgroundColor: C.brand, borderColor: C.brand },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.muted,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
});
