import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Button, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)/SearchGameSessions');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const handleLogin = async () => {
    try {
      await signIn(email, password);
      // signIn successful: the auth state will update, triggering the redirect from the useEffect
    } catch (error) {
      console.error('Failed to sign in:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text>Please log in</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Log In" onPress={handleLogin} />
      <Text style={styles.link} onPress={() => router.replace('/signUp')}>
        Don't have an account? Sign Up
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', padding: 10, marginVertical: 10 }
});