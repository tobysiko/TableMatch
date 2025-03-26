import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Button, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function SignUp() {
  const { user, loading, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!loading && user) {
      // If signUp is successful, redirect to the main app
      router.replace('/tabs/SearchGameSessions');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const handleSignUp = async () => {
    try {
      await signUp(email, password);
      // Once signed up, the auth state will update and the useEffect redirects
    } catch (error) {
      console.error('Failed to sign up:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
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
      <Button title="Sign Up" onPress={handleSignUp} />
      <Text style={styles.link} onPress={() => router.replace('/login')}>
        Already have an account? Log In
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', padding: 10, marginVertical: 10 },
  title: { fontSize: 24, marginBottom: 20 },
  link: { color: 'blue', marginTop: 15 }
});