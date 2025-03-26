import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, StatusBar, TouchableOpacity, Alert } from 'react-native';
import { getFirestore, collection, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';

type GameSession = {
  id: string;
  sessionTitle: string | null;
  gameTitle: string | null;
  location?: string;
  gameTime?: any; // Firestore Timestamp or string
  boardgamegeekId: string;
  hosts: string[];
  players: string[];
  creator: string;
};

export default function SearchGameSessions() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<GameSession[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [friendNames, setFriendNames] = useState<{ [key: string]: string }>({});

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
    const fetchFriendNames = async () => {
      const db = getFirestore();
      const names: { [key: string]: string } = {};

      for (const friendId of friends) {
        try {
          const friendDoc = await getDoc(doc(db, 'users', friendId));
          if (friendDoc.exists()) {
            names[friendId] = friendDoc.data().name || 'Unknown';
          }
        } catch (error) {
          console.error(`Error fetching friend name for ${friendId}:`, error);
        }
      }

      setFriendNames(names);
    };

    if (friends.length > 0) {
      fetchFriendNames();
    }
  }, [friends]);

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
    const filtered = sessions.filter((session) => {
      // Only show games created by friends and where the user is not a player
      const isCreatedByFriend = friends.includes(session.creator);
      const isNotAPlayer = !session.players.includes(user.uid);
      const matchesQuery =
        session.sessionTitle?.toLowerCase().includes(lowerQuery) ||
        session.gameTitle?.toLowerCase().includes(lowerQuery);

      return isCreatedByFriend && isNotAPlayer && matchesQuery;
    });

    setFilteredSessions(filtered);
  }, [query, sessions, friends, user]);

  const joinGame = async (sessionId: string) => {
    try {
      const db = getFirestore();
      const sessionRef = doc(db, 'gameSessions', sessionId);

      await updateDoc(sessionRef, {
        players: [...(sessions.find((s) => s.id === sessionId)?.players || []), user.uid],
      });

      Alert.alert('Success', 'You have joined the game!');
    } catch (error) {
      console.error('Error joining game:', error);
      Alert.alert('Error', 'Could not join the game.');
    }
  };

  const renderItem = ({ item }: { item: GameSession }) => {
    const title = item.gameTitle || item.sessionTitle || `Game ${item.boardgamegeekId}`;
    const location = item.location || 'Unknown Location';
    const gameTime =
      item.gameTime && typeof item.gameTime === 'object' && item.gameTime.seconds
        ? new Date(item.gameTime.seconds * 1000).toLocaleString()
        : item.gameTime || 'Time not set';
    const creatorName = friendNames[item.creator] || 'Unknown';

    return (
      <View style={styles.item}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text>Location: {location}</Text>
        <Text>Time: {gameTime}</Text>
        <Text>Creator: {creatorName}</Text>
        <TouchableOpacity style={styles.joinButton} onPress={() => joinGame(item.id)}>
          <Text style={styles.joinButtonText}>Join Game</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#4A148C" barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TableMatch</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Search for a game session..."
        placeholderTextColor="#B39DDB"
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>No game sessions found hosted by your friends.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#4A148C', // Purple
    paddingVertical: 20,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF', // White
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E65100', // Orange
    paddingHorizontal: 10,
    margin: 15,
    borderRadius: 5,
    color: '#4A148C', // Purple
    backgroundColor: '#FFF3E0', // Light Orange
  },
  item: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A148C', // Purple
  },
  joinButton: {
    marginTop: 10,
    backgroundColor: '#E65100', // Orange
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF', // White
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#B39DDB', // Light Purple
  },
});