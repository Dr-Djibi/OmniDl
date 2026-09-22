import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure l'affichage des notifs quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

/**
 * Demande la permission et retourne true si accordée.
 * À appeler au démarrage de l'app (dans App.js).
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('downloads', {
      name: 'Téléchargements',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Envoie une notification locale immédiate.
 */
export async function sendNotification({ title, body, data = {} }) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'downloads' } : {}),
      },
      trigger: null, // Immédiat
    });
  } catch (e) {
    console.log('Notification error:', e.message);
  }
}
