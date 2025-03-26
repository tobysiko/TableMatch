import React, { useEffect } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        if (user) {
          // If user is logged in, navigate to the main app (tabs)
          router.replace('/tabs/SearchGameSessions');
        } else {
          // Otherwise, navigate to the login screen
          router.replace('/login');
        }
      }, 0); // Delay navigation until after mount
    }
  }, [user, loading]);

  // Optionally, show a loading indicator while checking auth status
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null;
}