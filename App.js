import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import { requestNotificationPermission } from './src/services/notifications';
import { registerQueueTask } from './src/services/downloadQueue';

export default function App() {
  useEffect(() => {
    requestNotificationPermission().catch(error => {
      console.warn('Notification permission unavailable:', error.message);
    });
    registerQueueTask().catch(error => {
      console.warn('Queue registration unavailable:', error.message);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
      <Toast />
    </SafeAreaProvider>
  );
}
