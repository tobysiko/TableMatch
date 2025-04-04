import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, StatusBar, TouchableOpacity, Alert, Picker } from 'react-native';
import { getFirestore, collection, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { fetchBGGTitle, fetchBGGImage } from '@/lib/boardGameGeek';

type GameSession = {
  id: string;
  sessionTitle: string | null;
  gameTitle: string | null;
  location?: string;
  gameTime?: any; // Firestore Timestamp or string
  boardgamegeekId: string;
  hosts: string[];
  players: string[];
  maxPlayers: number;
  creator: string;
  gameOwner?: string;
  teacher?: string;
};

const fetchSearchResults = async (gameId: string) => {
  try {
    const title = await fetchBGGTitle(gameId);
    const imageUrl = await fetchBGGImage(gameId);

    console.log('Fetched title:', title);
    console.log('Fetched image URL:', imageUrl);

    return { title, imageUrl };
  } catch (error) {
    console.error('Error fetching search result details:', error);
    return null;
  }
};

export default function SearchGameSessions() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<GameSession[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [friendNames, setFriendNames] = useState<{ [key: string]: string }>({});
  const [filter, setFilter] = useState<'all' | 'openSlots' | 'completed'>('all');
  const [sortOption, setSortOption] = useState<'time' | 'title'>('time');

  useEffect(() => {
    const fetchFriends = async () => {
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        setFriends(userData.friends || []);
        console.log('Friends:', userData.friends); // Debugging
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
      console.log('Game Sessions:', sessionsData); // Debugging
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const lowerQuery = query.toLowerCase();
    const filtered = sessions.filter((session) => {
      const isCreatedByFriend = friends.includes(session.creator || '');
      const isNotAPlayer = !session.players?.includes(user.uid || '');
      const matchesQuery =
        (session.sessionTitle?.toLowerCase().includes(lowerQuery) || false) ||
        (session.gameTitle?.toLowerCase().includes(lowerQuery) || false);

      let passesFilter = true;
      if (filter === 'openSlots') {
        passesFilter = (session.players?.length || 0) < (session.maxPlayers || 0);
      } else if (filter === 'completed') {
        passesFilter = (session.players?.length || 0) >= (session.maxPlayers || 0);
      }

      const result = Boolean(isCreatedByFriend && isNotAPlayer && matchesQuery && passesFilter);
      console.log('Session:', session, 'Included:', result); // Debugging
      return result;
    });

    setFilteredSessions(filtered);
  }, [query, sessions, friends, user, filter, sortOption]);

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
      <Picker
        selectedValue={filter}
        style={styles.picker}
        onValueChange={(itemValue) => setFilter(itemValue as 'all' | 'openSlots' | 'completed')}
      >
        <Picker.Item label="All Sessions" value="all" />
        <Picker.Item label="Open Slots" value="openSlots" />
        <Picker.Item label="Completed Sessions" value="completed" />
      </Picker>
      <Picker
        selectedValue={sortOption}
        style={styles.picker}
        onValueChange={(itemValue) => setSortOption(itemValue as 'time' | 'title')}
      >
        <Picker.Item label="Sort by Time" value="time" />
        <Picker.Item label="Sort by Title" value="title" />
      </Picker>
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
  picker: {
    marginHorizontal: 15,
    marginBottom: 10,
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