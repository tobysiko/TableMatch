import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet } from 'react-native';
import { getFirestore, collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { fetchGameSessions } from '@/lib/gameSessions';

type GameSession = {
  id: string;
  sessionTitle: string | null;
  gameTitle: string | null;
  location?: string;
  gameTime?: string;
  boardgamegeekId: string;
  hosts: string[];
};

export default function SearchGameSessions() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<GameSession[]>([]);
  const [friends, setFriends] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        setFriends(userData.friends || []);
      }
    };

    fetchFriends();
  }, [user]);

  useEffect(() => {
    const db = getFirestore();
    const sessionsRef = collection(db, 'gameSessions');

    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      const sessionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSessions(sessionsData);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const lowerQuery = query.toLowerCase();
    if (!lowerQuery.trim()) {
      const friendSessions = sessions.filter((session) =>
        session.hosts.some((hostId) => friends.includes(hostId))
      );
      setFilteredSessions(friendSessions);
    } else {
      const filtered = sessions.filter((session) => {
        const title = session.title || `Game ${session.boardgamegeekID}`;
        return (
          title.toLowerCase().includes(lowerQuery) &&
          session.hosts.some((hostId) => friends.includes(hostId))
        );
      });
      setFilteredSessions(filtered);
    }
  }, [query, sessions, friends]);

  const renderItem = ({ item }: { item: GameSession }) => {
    const title = item.gameTitle || item.sessionTitle || `Game ${item.boardgamegeekId}`;
    const location = item.location || 'Unknown Location';
    const gameTime = item.gameTime || 'Time not set';

    return (
      <View style={styles.item}>
        <Text style={styles.itemTitle}>
          {item.sessionTitle ? `Session: ${item.sessionTitle}` : `Game: ${title}`}
        </Text>
        <Text>Location: {location}</Text>
        <Text>Time: {gameTime}</Text>
        <Text>BoardGameGeek ID: {item.boardgamegeekId}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search Game Sessions</Text>
      <TextInput
        style={styles.input}
        placeholder="Type game title..."
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No game sessions found hosted by your friends.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    marginBottom: 15,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
  item: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});