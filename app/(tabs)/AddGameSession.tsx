import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';

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

export default function AddGameSession() {
  const { user } = useAuth();
  const [boardgamegeekID, setBoardgamegeekID] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [gameTime, setGameTime] = useState('');
  const [minPlayers, setMinPlayers] = useState(2); // Default to 2
  const [maxPlayers, setMaxPlayers] = useState(4); // Default to 4
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [players, setPlayers] = useState<PlayerWithRoles[]>([]);
  const [bggSearchTerm, setBggSearchTerm] = useState('');
  const [bggResults, setBggResults] = useState<{ id: string; name: string; year?: number | null; rank?: number | null }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

    setIsSearching(true);
    try {
      const response = await fetch(`https://boardgamegeek.com/xmlapi2/search?query=${term}&type=boardgame`);
      const data = await response.text();

      // Parse the XML response to extract game IDs and names
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      const items = xmlDoc.getElementsByTagName('item');

      const results: { id: string; name: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        const id = items[i].getAttribute('id');
        const nameElement = items[i].getElementsByTagName('name')[0];
        const name = nameElement ? nameElement.getAttribute('value') : null;

        if (id && name) {
          results.push({ id, name });
        }
      }

      // Fetch additional details for each game
      const detailedResults = await Promise.all(
        results.map(async (game) => {
          try {
            const detailResponse = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${game.id}`);
            const detailData = await detailResponse.text();

            // Debug: Log the raw XML response
            console.log(`Details for game ID ${game.id}:`, detailData);

            // Extract rank and year
            const yearMatch = detailData.match(/<yearpublished\s+value="([^"]+)"\s*\/>/);
            const rankMatch = detailData.match(/<rank\s+type="subtype"\s+id="1"\s+value="([^"]+)"\s*\/>/);

            const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
            const rank = rankMatch && rankMatch[1] !== 'Not Ranked' ? parseInt(rankMatch[1], 10) : null;

            // Debug: Log the extracted rank and year
            console.log(`Game: ${game.name}, Rank: ${rank}, Year: ${year}`);

            return { ...game, year, rank };
          } catch (error) {
            console.error(`Error fetching details for game ID ${game.id}:`, error);
            return { ...game, year: null, rank: null };
          }
        })
      );

      // Sort results based on the new logic
      const sortedResults = detailedResults.sort((a, b) => {
        if (a.rank !== null && b.rank !== null) {
          // Both games have a rank
          if (a.rank < 10000 && b.rank < 10000) {
            return a.rank - b.rank; // Sort by rank (ascending)
          }
        }

        // One or both games have no rank or rank >= 10000
        if ((a.rank === null || a.rank >= 10000) && (b.rank === null || b.rank >= 10000)) {
          if (a.year !== null && b.year !== null) {
            return b.year - a.year; // Sort by year (descending)
          }
        }

        // Games with rank take precedence over games with no rank
        if (a.rank !== null && b.rank === null) return -1;
        if (a.rank === null && b.rank !== null) return 1;

        return 0; // Keep original order if no rank or year
      });

      setBggResults(sortedResults);
    } catch (error) {
      console.error('Error searching BoardGameGeek:', error);
      Alert.alert('Error', 'Could not search BoardGameGeek.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectBGGGame = async (game: { id: string; name: string }) => {
    setBoardgamegeekID(game.id);
    setTitle(game.name);

    try {
      const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${game.id}`);
      const data = await response.text();

      // Extract min and max players
      const minPlayersMatch = data.match(/<minplayers\s+value="([^"]+)"\s*\/>/);
      const maxPlayersMatch = data.match(/<maxplayers\s+value="([^"]+)"\s*\/>/);
      const recommendedMinPlayers = minPlayersMatch ? parseInt(minPlayersMatch[1], 10) : 2;
      const recommendedMaxPlayers = maxPlayersMatch ? parseInt(maxPlayersMatch[1], 10) : 4;

      setMinPlayers(recommendedMinPlayers);
      setMaxPlayers(recommendedMaxPlayers);
    } catch (error) {
      console.error('Error fetching game details from BGG:', error);
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
      const db = getFirestore();
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
      setGameTime('');
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
      <Text style={styles.title}>Add a New Game Session</Text>

      <Text style={styles.label}>Search BoardGameGeek</Text>
      <TextInput
        style={styles.input}
        placeholder="Search for a game"
        value={bggSearchTerm}
        onChangeText={searchBGG}
      />
      {isSearching && <Text>Searching...</Text>}
      {bggResults.length > 0 && (
        <FlatList
          data={bggResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.bggResultItem}
              onPress={() => selectBGGGame(item)}
            >
              <Text>{item.name}</Text>
              {item.year && <Text>Year: {item.year}</Text>}
              {item.rank && <Text>Rank: {item.rank}</Text>}
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

      <Text style={styles.label}>Game Time (optional, e.g., 2025-03-30 18:00)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter game time"
        value={gameTime}
        onChangeText={setGameTime}
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

      <Button title="Add Game Session" onPress={handleAddGame} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  label: { marginTop: 15, marginBottom: 5, fontWeight: 'bold' },
  input: { borderColor: '#ccc', borderWidth: 1, padding: 10, borderRadius: 5, marginBottom: 10 },
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
  bggResultItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' },
});