import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity, FlatList, Image } from 'react-native';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { fetchGameSessions } from '@/lib/gameSessions';
import { useRouter } from 'expo-router';

type Friend = {
  uid: string;
  name: string;
};

type GameSession = {
  id: string;
  title?: string;
  location?: string;
  gameTime?: string;
  boardgamegeekID?: string;
  creator?: string;
  owner?: string;
  hosts?: string[];
  players?: string[];
  teachers?: string[];
};

// A helper function to fetch the game title from BoardGameGeek using its XML endpoint.
async function fetchBGGTitle(bggId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${bggId}`);
    const data = await response.text();
    const match = data.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"\s*\/?>/);
    return match && match[1] ? match[1] : null;
  } catch (error) {
    console.error("Error fetching game title from BGG:", error);
    return null;
  }
}

// Helper function to fetch BoardGameGeek images via XML.
async function fetchBGGImage(bggId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${bggId}`);
    const data = await response.text();
    const match = data.match(/<image>([^<]+)<\/image>/);
    return match && match[1] ? match[1] : null;
  } catch (error) {
    console.error("Error fetching game image from BGG:", error);
    return null;
  }
}

export default function ListMyGames() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [images, setImages] = useState<{ [key: string]: string | null }>({});
  const router = useRouter();

  useEffect(() => {
    if (!user) return; // Wait until the user is available
    const db = getFirestore();
    const sessionsRef = collection(db, "gameSessions");
    const q = query(
      sessionsRef,
      where("players", "array-contains", user.uid) // Fetch sessions where the user is a participant
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: GameSession[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as GameSession);
      });
      setSessions(data);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchImages = async () => {
      const newImages: { [key: string]: string | null } = {};
      for (const session of sessions) {
        if (session.boardgamegeekID) {
          const imageUrl = await fetchBGGImage(session.boardgamegeekID);
          newImages[session.id] = imageUrl;
        }
      }
      setImages(newImages);
    };
    fetchImages();
  }, [sessions]);

  const filterSessions = (role: 'all' | 'creator' | 'owner' | 'host' | 'player' | 'teacher') => {
    if (role === 'all') return sessions;
    return sessions.filter((session) => {
      if (role === 'creator') return session.creator === user.uid;
      if (role === 'owner') return session.owner === user.uid;
      if (role === 'host') return session.hosts.includes(user.uid);
      if (role === 'player') return session.players.includes(user.uid);
      if (role === 'teacher') return session.teachers.includes(user.uid);
    });
  };

  const renderItem = ({ item }: { item: GameSession }) => {
    const imageUrl = images[item.id];
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => router.push(`/GameSessionDetails/${item.id}`)}
      >
        <View style={styles.itemContent}>
          {imageUrl && <Image source={{ uri: imageUrl }} style={styles.image} />}
          <View style={styles.itemText}>
            <Text style={styles.itemTitle}>{item.title || `Game ${item.boardgamegeekID}`}</Text>
            {item.location && <Text>Location: {item.location}</Text>}
            {item.gameTime && <Text>Time: {new Date(item.gameTime).toLocaleString()}</Text>}
            <Text>BoardGameGeek ID: {item.boardgamegeekID}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Game Sessions</Text>

      {/* All Game Sessions */}
      <Text style={styles.sectionTitle}>All Game Sessions</Text>
      <FlatList
        data={filterSessions('all')}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No game sessions found.</Text>}
      />

      {/* As Creator */}
      <Text style={styles.sectionTitle}>As Creator</Text>
      <FlatList
        data={filterSessions('creator')}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No game sessions found as creator.</Text>}
      />

      {/* As Owner */}
      <Text style={styles.sectionTitle}>As Owner</Text>
      <FlatList
        data={filterSessions('owner')}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No game sessions found as owner.</Text>}
      />

      {/* As Host */}
      <Text style={styles.sectionTitle}>As Host</Text>
      <FlatList
        data={filterSessions('host')}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No game sessions found as host.</Text>}
      />

      {/* As Player */}
      <Text style={styles.sectionTitle}>As Player</Text>
      <FlatList
        data={filterSessions('player')}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No game sessions found as player.</Text>}
      />

      {/* As Teacher */}
      <Text style={styles.sectionTitle}>As Teacher</Text>
      <FlatList
        data={filterSessions('teacher')}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No game sessions found as teacher.</Text>}
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    marginTop: 20,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  item: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  itemContent: {
    flexDirection: 'row',
  },
  image: {
    resizeMode: 'cover',
    height: 100,
    width: 100,
  },
  itemTitle: {
    marginBottom: 5,
    fontWeight: 'bold',
    fontSize: 18,
  },
  itemText: {
    marginLeft: 10,
    flex: 1,
  },
});