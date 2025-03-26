import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';

type GameSession = {
  id: string;
  title?: string;
  location?: string;
  gameTime?: any; // Firestore Timestamp or raw object
  boardgamegeekID?: string;
  creator?: string;
  owner?: string;
  hosts?: string[];
  players?: string[];
  teachers?: string[];
};

type Player = {
  uid: string;
  name: string;
};

export default function GameSessionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [bggDetails, setBggDetails] = useState<any>(null);
  const [playerNames, setPlayerNames] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const db = getFirestore();
        const docRef = doc(db, "gameSessions", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSession({ id: docSnap.id, ...docSnap.data() } as GameSession);
        } else {
          console.error("No such document!");
        }
      } catch (error) {
        console.error("Error fetching game session:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  useEffect(() => {
    const fetchBGGDetails = async () => {
      if (session?.boardgamegeekID) {
        try {
          const response = await fetch(
            `https://boardgamegeek.com/xmlapi2/thing?id=${session.boardgamegeekID}`
          );
          const data = await response.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(data, "text/xml");

          const description = xmlDoc.getElementsByTagName("description")[0]?.textContent;
          const yearPublished = xmlDoc.getElementsByTagName("yearpublished")[0]?.getAttribute("value");
          const minPlayers = xmlDoc.getElementsByTagName("minplayers")[0]?.getAttribute("value");
          const maxPlayers = xmlDoc.getElementsByTagName("maxplayers")[0]?.getAttribute("value");
          const playingTime = xmlDoc.getElementsByTagName("playingtime")[0]?.getAttribute("value");
          const weight = xmlDoc.getElementsByTagName("averageweight")[0]?.getAttribute("value");
          const image = xmlDoc.getElementsByTagName("image")[0]?.textContent;

          setBggDetails({
            description,
            yearPublished,
            minPlayers,
            maxPlayers,
            playingTime,
            weight,
            image,
          });
        } catch (error) {
          console.error("Error fetching BGG details:", error);
        }
      }
    };

    fetchBGGDetails();
  }, [session?.boardgamegeekID]);

  useEffect(() => {
    const fetchPlayerNames = async () => {
      if (!session?.players) return;

      const db = getFirestore();
      const playerNamesMap: { [key: string]: string } = {};

      for (const uid of session.players) {
        try {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            playerNamesMap[uid] = userDoc.data().name || "Unknown";
          } else {
            playerNamesMap[uid] = "Unknown";
          }
        } catch (error) {
          console.error(`Error fetching user data for UID ${uid}:`, error);
          playerNamesMap[uid] = "Unknown";
        }
      }

      setPlayerNames(playerNamesMap);
    };

    fetchPlayerNames();
  }, [session?.players]);

  const toggleRole = async (uid: string, role: "hosts" | "teachers" | "players") => {
    if (!session) return;

    // Check if the player is about to lose their last role
    const isLastRole =
      session.hosts?.includes(uid) +
      session.teachers?.includes(uid) +
      session.players?.includes(uid) === 1;

    if (isLastRole && session[role]?.includes(uid)) {
      Alert.alert("Error", "A player must have at least one role.");
      return;
    }

    const updatedRoles = session[role]?.includes(uid)
      ? session[role]?.filter((id) => id !== uid)
      : [...(session[role] || []), uid];

    try {
      const db = getFirestore();
      const docRef = doc(db, "gameSessions", session.id);
      await updateDoc(docRef, { [role]: updatedRoles });
      setSession((prev) => (prev ? { ...prev, [role]: updatedRoles } : prev));
    } catch (error) {
      console.error("Error updating roles:", error);
      Alert.alert("Error", "Could not update roles.");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Game session not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TableMatch</Text>
      </View>
      <Text style={styles.title}>{session.title || "Game Session Details"}</Text>
      {bggDetails?.image && <Image source={{ uri: bggDetails.image }} style={styles.coverImage} />}
      {session.location && <Text>Location: {session.location}</Text>}
      {session.gameTime && (
        <Text>
          Time:{" "}
          {session.gameTime.toDate
            ? session.gameTime.toDate().toLocaleString()
            : new Date(session.gameTime.seconds * 1000).toLocaleString()}
        </Text>
      )}
      <Text>BGG ID: {session.boardgamegeekID}</Text>
      <Text>Creator: {playerNames[session.creator || ""] || "Unknown"}</Text>
      <Text>Owner: {playerNames[session.owner || ""] || "Unknown"}</Text>

      {/* BGG Details */}
      {bggDetails && (
        <>
          <Text style={styles.subtitle}>Game Details</Text>
          <Text>Year Published: {bggDetails.yearPublished}</Text>
          <Text>Players: {bggDetails.minPlayers} - {bggDetails.maxPlayers}</Text>
          <Text>Playing Time: {bggDetails.playingTime} minutes</Text>
          <Text>Weight: {bggDetails.weight}</Text>
          <Text>Description: {bggDetails.description}</Text>
        </>
      )}

      {/* Players and Roles */}
      <Text style={styles.subtitle}>Players</Text>
      <FlatList
        data={session.players}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.playerItem}>
            <Text>{playerNames[item] || "Unknown"}</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  session.hosts?.includes(item) && styles.roleButtonActive,
                ]}
                onPress={() => toggleRole(item, "hosts")}
              >
                <Text style={styles.roleButtonText}>Host</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  session.teachers?.includes(item) && styles.roleButtonActive,
                ]}
                onPress={() => toggleRole(item, "teachers")}
              >
                <Text style={styles.roleButtonText}>Teacher</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  session.players?.includes(item) && styles.roleButtonActive,
                ]}
                onPress={() => toggleRole(item, "players")}
              >
                <Text style={styles.roleButtonText}>Player</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#FFFFFF' },
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
  subtitle: { fontSize: 20, fontWeight: "bold", marginTop: 20, marginBottom: 10 },
  errorText: { fontSize: 18, color: "red" },
  playerItem: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  roleButtons: { flexDirection: "row" },
  roleButton: {
    padding: 5,
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 5,
    marginRight: 5,
  },
  roleButtonActive: { backgroundColor: "#007AFF" },
  roleButtonText: { color: "#007AFF" },
  coverImage: { width: "100%", height: 200, resizeMode: "cover", marginBottom: 10 },
});