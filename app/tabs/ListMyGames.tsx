import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { fetchGameSessions } from '@/lib/gameSessions';

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
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'creator' | 'owner' | 'host' | 'player' | 'teacher'>('all');
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    const sessionsRef = collection(db, "gameSessions");
    const q = query(
      sessionsRef,
      where("players", "array-contains", user.uid)
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
      if (role === 'host') return session.hosts && session.hosts.includes(user.uid);
      if (role === 'player') return session.players && session.players.includes(user.uid);
      if (role === 'teacher') return session.teachers && session.teachers.includes(user.uid);
      return false;
    });
  };

  const filteredSessions = filterSessions(selectedFilter);

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
            {item.gameTime && (
              <Text>
                Time:{" "}
                {typeof item.gameTime === "object" && item.gameTime.seconds
                  ? new Date(item.gameTime.seconds * 1000).toLocaleString()
                  : new Date(item.gameTime).toLocaleString()}
              </Text>
            )}
            <Text>BGG ID: {item.boardgamegeekID}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TableMatch</Text>
      </View>
      <Text style={styles.title}>My Game Sessions</Text>
      
      {/* Filter Options */}
      <View style={styles.filterContainer}>
        {(['all', 'creator', 'owner', 'host', 'player', 'teacher'] as const).map((role) => (
          <TouchableOpacity
            key={role}
            style={[
              styles.filterButton,
              selectedFilter === role && styles.filterButtonSelected,
            ]}
            onPress={() => setSelectedFilter(role)}
          >
            <Text
              style={[
                styles.filterText,
                selectedFilter === role && styles.filterTextSelected,
              ]}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Single List of Filtered Sessions */}
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.infoText}>No game sessions found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    backgroundColor: '#4A148C',
    paddingVertical: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center', color: '#4A148C' },
  infoText: { color: '#B39DDB', textAlign: 'center', marginTop: 10 },
  filterContainer: { flexDirection: 'row', marginBottom: 10, flexWrap: 'wrap' },
  filterButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginRight: 5,
    marginBottom: 5,
  },
  filterButtonSelected: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    color: '#007AFF',
  },
  filterTextSelected: {
    color: '#fff',
  },
  item: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  itemContent: { flexDirection: 'row' },
  image: { resizeMode: 'cover', height: 100, width: 100 },
  itemTitle: { marginBottom: 5, fontWeight: 'bold', fontSize: 18 },
  itemText: { marginLeft: 10, flex: 1 },
});