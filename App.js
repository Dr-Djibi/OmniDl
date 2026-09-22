import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import AppNavigator from './src/navigation/AppNavigator';
import { requestNotificationPermission } from './src/services/notifications';
import { C } from './src/theme/colors';

// ── Toast config ─────────────────────────────────────────────────────────────
const ICON = {
  success: { name: 'check-circle',  color: '#34d399' },
  error:   { name: 'error-outline', color: '#f87171' },
  info:    { name: 'info-outline',  color: '#8e95a5' },
};

function OmniToast({ type = 'info', text1, text2 }) {
  const ic = ICON[type] ?? ICON.info;
  return (
    <View style={[t.wrap, t[type] ?? t.info]}>
      <MaterialIcons name={ic.name} size={18} color={ic.color} style={t.icon} />
      <View style={t.texts}>
        {text1 ? <Text style={t.title} numberOfLines={1}>{text1}</Text> : null}
        {text2 ? <Text style={t.sub}   numberOfLines={2}>{text2}</Text> : null}
      </View>
    </View>
  );
}

const toastConfig = {
  success: (props) => <OmniToast type="success" {...props} />,
  error:   (props) => <OmniToast type="error"   {...props} />,
  info:    (props) => <OmniToast type="info"     {...props} />,
};

const t = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    backgroundColor: '#1a1c20',
    borderColor: '#2e323b',
  },
  success: { borderLeftWidth: 3, borderLeftColor: '#34d399' },
  error:   { borderLeftWidth: 3, borderLeftColor: '#f87171' },
  info:    { borderLeftWidth: 3, borderLeftColor: '#8e95a5' },
  icon:  { flexShrink: 0 },
  texts: { flex: 1, gap: 2 },
  title: { color: '#e2e4e9', fontSize: 13, fontWeight: '600' },
  sub:   { color: '#8e95a5', fontSize: 12 },
});

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
      <Toast config={toastConfig} position="top" topOffset={60} visibilityTime={3000} />
    </SafeAreaProvider>
  );
}
