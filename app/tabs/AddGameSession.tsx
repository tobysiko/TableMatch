import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity, FlatList, Platform } from 'react-native';
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebaseConfig'; // Use shared Firebase instance
import pThrottle from 'p-throttle';
import DateTimePicker from '@react-native-community/datetimepicker';
import GameTimePicker from '@/app/GameTimePicker';
import { fetchBGGTitle, fetchBGGImage } from '@/lib/boardGameGeek';

type Friend = {
  uid: string;
  name: string;
};

type PlayerWithRoles = {
  uid: string;
  name: string;
  isHost: boolean;
  isTeacher: boolean;
  isOwner: boolean;
  isPlayer: boolean;
};

interface UserData {
  uid: string;
  name: string;
  email: string;
  description?: string;
  friends?: string[];
}

const PROXY_URL = 'http://localhost:3000/proxy?url=';
const BGG_API_URL = 'https://boardgamegeek.com/xmlapi2';
const maxRank = 100000; // Arbitrary large number for unranked games

const throttle = pThrottle({
  limit: 5, // Allow 5 requests
  interval: 10000, // Per 10 seconds
});

const fetchGameDetails = throttle(async (id: string) => {
  const detailResponse = await fetch(`${PROXY_URL}${encodeURIComponent(`${BGG_API_URL}/thing?id=${id}`)}`);
  const detailData = await detailResponse.text();

  // Check if the game is an expansion or promo
  const isExpansionOrPromo = detailData.includes('<link type="boardgameexpansion"') || detailData.includes('<link type="boardgamepromo"');
  if (isExpansionOrPromo) {
    console.log(`Skipping expansion or promo: ${id}`);
    return null; // Skip expansions and promos
  }

  // Extract rank from the detailed response
  const rankMatch = detailData.match(/<rank[^>]*value="([^"]+)"[^>]*>/);
  const rank = rankMatch && rankMatch[1] !== 'Not Ranked' ? parseInt(rankMatch[1], 10) : maxRank;

  return { rank, isExpansion: false };
});

export default function AddGameSession() {
  const { user } = useAuth();
  const [boardgamegeekID, setBoardgamegeekID] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [gameTime, setGameTime] = useState(new Date());
  const [minPlayers, setMinPlayers] = useState(2); // Default to 2
  const [maxPlayers, setMaxPlayers] = useState(4); // Default to 4
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [players, setPlayers] = useState<PlayerWithRoles[]>([]);
  const [bggSearchTerm, setBggSearchTerm] = useState('');
  const [bggResults, setBggResults] = useState<{ id: string; name: string; year?: number | null }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestIdRef = useRef(0);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      try {
        const db = getFirestore();
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const friendUIDs = userData.friends || []; // Assuming `friends` is an array of friend UIDs.

          // Fetch friend details for each UID.
          const friendDetails = await Promise.all(
            friendUIDs.map(async (friendUID: string) => {
              const friendDocRef = doc(db, 'users', friendUID);
              const friendDoc = await getDoc(friendDocRef);
              return friendDoc.exists() ? { uid: friendUID, name: friendDoc.data().name } : null;
            })
          );

          setFriends(friendDetails.filter(Boolean) as Friend[]);
        }
      } catch (error) {
        console.error('Error fetching friends:', error);
        Alert.alert('Error', 'Could not fetch friends.');
      }
    };

    fetchFriends();

    // Add the creating user to the players list with default roles.
    setPlayers((prev) => [
      ...prev,
      {
        uid: user.uid,
        name: user.displayName || 'You',
        isHost: false,
        isTeacher: false,
        isOwner: true, // Default to owner
        isPlayer: true, // Default to player
      },
    ]);
  }, [user]);

  useEffect(() => {
    // Filter friends based on the search term.
    setFilteredFriends(
      friends.filter((friend) =>
        friend.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, friends]);

  const searchBGG = async (term: string) => {
    setBggSearchTerm(term);
    if (!term.trim()) {
      setBggResults([]);
      return;
    }

    // Increment the request ID (each call gets a unique ID)
    const currentRequestId = ++searchRequestIdRef.current;

    setIsSearching(true);
    try {
      const response = await fetch(
        `${PROXY_URL}${encodeURIComponent(`${BGG_API_URL}/search?query=${term}&type=boardgame`)}`
      );
      const data = await response.text();

      // Check if this response is outdated
      if (currentRequestId !== searchRequestIdRef.current) {
        // Outdated response; ignore it.
        return;
      }

      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      const items = Array.from(xmlDoc.getElementsByTagName('item')).slice(0, 10);

      // Build results based on substring matching.
      const results: {
        id: string;
        name: string;
        year?: number | null;
        matchIndex: number;
        titleLength: number;
      }[] = [];

      const lowerTerm = term.toLowerCase();

      for (const item of items) {
        const id = item.getAttribute("id");
        const nameElement = item.getElementsByTagName("name")[0];
        const yearElement = item.getElementsByTagName("yearpublished")[0];

        const name = nameElement ? nameElement.getAttribute("value") : null;
        const year = yearElement
          ? parseInt(yearElement.getAttribute("value") || "", 10)
          : null;

        if (id && name) {
          const lowerName = name.toLowerCase();
          // Skip promo cards
          if (lowerName.includes("promo")) {
            continue;
          }
          const matchIndex = lowerName.indexOf(lowerTerm);
          if (matchIndex >= 0) {
            results.push({
              id,
              name,
              year,
              matchIndex,
              titleLength: name.length,
            });
          }
        }
      }

      // Sort the results:
      // 1. Lower matchIndex is better.
      // 2. Higher year (newer) is better.
      // 3. Shorter title is better.
      const sortedResults = results
        .sort((a, b) => {
          if (a.matchIndex !== b.matchIndex) {
            return a.matchIndex - b.matchIndex;
          }
          if ((b.year || 0) !== (a.year || 0)) {
            return (b.year || 0) - (a.year || 0);
          }
          return a.titleLength - b.titleLength;
        })
        // Remove extra fields before setting the state.
        .map((r) => ({ id: r.id, name: r.name, year: r.year }));

      console.log("Sorted Results:", sortedResults);
      setBggResults(sortedResults);
    } catch (error) {
      console.error("Error searching BoardGameGeek:", error);
      Alert.alert("Error", "Could not search BoardGameGeek.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectBGGGame = async (game: { id: string; name: string }) => {
    setBoardgamegeekID(game.id);
    setTitle(game.name);
    setBggSearchTerm(''); // Clear the search field
    setBggResults([]); // Clear the search results

    try {
      const title = await fetchBGGTitle(game.id);
      const imageUrl = await fetchBGGImage(game.id);

      console.log('Fetched title:', title);
      console.log('Fetched image URL:', imageUrl);

      setTitle(title);

      // Optionally, store the image URL if needed
      // setImageUrl(imageUrl);

      // Fetch additional details like min/max players
      const response = await fetch(`${PROXY_URL}${encodeURIComponent(`${BGG_API_URL}/thing?id=${game.id}`)}`);
      const data = await response.text();

      const minPlayersMatch = data.match(/<minplayers\s+value="([^"]+)"\s*\/>/);
      const maxPlayersMatch = data.match(/<maxplayers\s+value="([^"]+)"\s*\/>/);
      const recommendedMinPlayers = minPlayersMatch ? parseInt(minPlayersMatch[1], 10) : 2;
      const recommendedMaxPlayers = maxPlayersMatch ? parseInt(maxPlayersMatch[1], 10) : 4;

      setMinPlayers(recommendedMinPlayers);
      setMaxPlayers(recommendedMaxPlayers);
    } catch (error) {
      console.error('Error fetching game details:', error);
      Alert.alert('Error', 'Could not fetch game details from BoardGameGeek.');
    }
  };

  const addPlayer = (friend: Friend) => {
    if (players.some((player) => player.uid === friend.uid)) {
      Alert.alert('Error', 'This player is already added.');
      return;
    }
    setPlayers((prev) => [
      ...prev,
      { ...friend, isHost: false, isTeacher: false, isOwner: false, isPlayer: true }
    ]);
    setSearchTerm('');
  };

  const toggleRole = (uid: string, role: keyof PlayerWithRoles) => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.uid === uid ? { ...player, [role]: !player[role] } : player
      )
    );
  };

  const onChangeGameTime = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setGameTime(selectedDate);
    }
    // For Android, always close the picker after selection
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const handleAddGame = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }
    if (!boardgamegeekID.trim()) {
      Alert.alert('Validation Error', 'A BoardGameGeek ID is required.');
      return;
    }
    if (minPlayers > maxPlayers) {
      Alert.alert('Validation Error', 'Min players cannot be greater than max players.');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'gameSessions'), {
        boardgamegeekID,
        createdAt: serverTimestamp(),
        creator: user.uid,
        gameTime: gameTime ? new Date(gameTime) : null,
        location: location || null,
        owner: user.uid,
        title,
        minPlayers,
        maxPlayers,
        hosts: players.filter((player) => player.isHost).map((player) => player.uid),
        players: players.filter((player) => player.isPlayer).map((player) => player.uid),
        teachers: players.filter((player) => player.isTeacher).map((player) => player.uid),
      });

      Alert.alert('Success', `Game session created with ID: ${docRef.id}`);
      setTitle('');
      setLocation('');
      setGameTime(new Date());
      setBoardgamegeekID('');
      setPlayers([]);
      setMinPlayers(2); // Reset to default
      setMaxPlayers(4); // Reset to default
    } catch (error: any) {
      console.error('Error adding game session:', error);
      Alert.alert('Error', 'Could not add game session: ' + error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TableMatch</Text>
      </View>
      <Text style={styles.title}>Add a New Game Session</Text>

      <Text style={styles.label}>Search BoardGameGeek</Text>
      <TextInput
        style={styles.input}
        placeholder="Search for a game"
        value={bggSearchTerm}
        onChangeText={searchBGG}
      />
      {isSearching && <Text style={styles.infoText}>Searching...</Text>}
      {bggResults.length > 0 && (
        <FlatList
          data={bggResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.bggResultItem}
              onPress={() => selectBGGGame(item)}
            >
              <Text style={styles.bggResultText}>{item.name}</Text>
              {item.year && <Text style={styles.bggResultText}>Year: {item.year}</Text>}
            </TouchableOpacity>
          )}
        />
      )}

      <Text style={styles.label}>BoardGameGeek ID</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter BoardGameGeek ID"
        value={boardgamegeekID}
        editable={false} // Make this field read-only since it's auto-filled
      />

      <Text style={styles.label}>Game Title</Text>
      <TextInput
        style={styles.input}
        placeholder="Game title"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Location (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter location"
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.label}>Game Time</Text>
      <GameTimePicker
        gameTime={gameTime}
        onChangeGameTime={onChangeGameTime}
        showDatePicker={showDatePicker}
        setShowDatePicker={setShowDatePicker}
      />

      <Text style={styles.label}>Player Count</Text>
      <View style={styles.row}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Min</Text>
          <TextInput
            style={styles.input}
            placeholder="Min"
            value={minPlayers.toString()}
            keyboardType="numeric"
            onChangeText={(value) => setMinPlayers(Number(value))}
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Max</Text>
          <TextInput
            style={styles.input}
            placeholder="Max"
            value={maxPlayers.toString()}
            keyboardType="numeric"
            onChangeText={(value) => setMaxPlayers(Number(value))}
          />
        </View>
      </View>

      <Text style={styles.label}>Search and Add Players</Text>
      <TextInput
        style={styles.input}
        placeholder="Search friends"
        value={searchTerm}
        onChangeText={setSearchTerm}
      />
      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.friendItem}
            onPress={() => addPlayer(item)}
          >
            <Text style={styles.friendText}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>No friends found.</Text>}
      />

      <Text style={styles.label}>Added Players</Text>
      {players.map((player) => (
        <View key={player.uid} style={styles.playerRow}>
          <Text style={styles.playerName}>{player.name}</Text>
          <TouchableOpacity
            onPress={() => toggleRole(player.uid, 'isHost')}
            style={[styles.roleButton, player.isHost && styles.roleButtonActive]}
          >
            <Text>Host</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleRole(player.uid, 'isTeacher')}
            style={[styles.roleButton, player.isTeacher && styles.roleButtonActive]}
          >
            <Text>Teacher</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleRole(player.uid, 'isOwner')}
            style={[styles.roleButton, player.isOwner && styles.roleButtonActive]}
          >
            <Text>Owner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleRole(player.uid, 'isPlayer')}
            style={[styles.roleButton, player.isPlayer && styles.roleButtonActive]}
          >
            <Text>Player</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Button title="Add Game Session" onPress={handleAddGame} color="#E65100" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#FFFFFF', flexGrow: 1 },
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
  label: { marginTop: 15, marginBottom: 5, fontWeight: 'bold', color: '#4A148C' },
  input: {
    borderColor: '#E65100',
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    backgroundColor: '#FFF3E0',
    color: '#4A148C',
  },
  friendItem: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 5 },
  friendText: { fontSize: 16 },
  playerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  playerName: { flex: 1, fontSize: 16 },
  roleButton: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginHorizontal: 5,
  },
  roleButtonActive: { backgroundColor: '#d0f0c0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inputContainer: { flex: 1, marginHorizontal: 5 },
  inputLabel: { fontWeight: 'bold', marginBottom: 5 },
  bggResultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  bggResultText: { color: '#4A148C' },
  infoText: { color: '#B39DDB', marginBottom: 10 },
});