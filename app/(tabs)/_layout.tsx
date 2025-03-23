import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false, // Hides the header containing "(tabs)"
        tabBarIcon: ({ color, size }) => {
          let iconName = '';
          if (route.name === 'SearchGameSessions') {
            iconName = 'search';
          } else if (route.name === 'AddGameSession') {
            iconName = 'add-circle';
          } else if (route.name === 'ListMyGames') {
            iconName = 'list';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'tomato',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tabs.Screen 
        name="SearchGameSessions" 
        options={{ headerShown: false, title: 'Search' }} 
      />
      <Tabs.Screen 
        name="AddGameSession" 
        options={{ headerShown: false, title: 'Add' }} 
      />
      <Tabs.Screen 
        name="ListMyGames" 
        options={{ headerShown: false, title: 'My Games' }} 
      />
      <Tabs.Screen 
        name="Profile" 
        options={{ headerShown: false, title: 'Profile' }} 
      />
    </Tabs>
  );
}