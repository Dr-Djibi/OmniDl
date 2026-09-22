import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import DownloaderScreen from '../screens/DownloaderScreen';
import HistoryScreen from '../screens/HistoryScreen';
import FilesScreen from '../screens/FilesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { BottomTabBar } from '../components/UI';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen name="Downloader" component={DownloaderScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Files" component={FilesScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
