import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
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

function InnerRootLayout() {
  const { user, loading } = useAuth();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded || loading) return null;

  return (
    <ThemeProvider value={user?.theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen 
          name="GameSessionDetails/[id]" 
          options={{ headerShown: true, title: 'Game Session Details' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <InnerRootLayout />
    </AuthProvider>
  );
}
