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
import { getFirestore, doc, getDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';
import { fetchBGGTitle, fetchBGGImage } from '@/lib/boardGameGeek';

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
  const [friends, setFriends] = useState<string[]>([]);
  const [user, setUser] = useState<{ uid: string }>({ uid: '' });

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
          const title = await fetchBGGTitle(session.boardgamegeekID);
          const imageUrl = await fetchBGGImage(session.boardgamegeekID);

          console.log('Fetched title:', title);
          console.log('Fetched image URL:', imageUrl);

          const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${session.boardgamegeekID}`);
          const data = await response.text();
          console.log('Raw BGG API response:', data); // Debugging log

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(data, 'text/xml');

          const yearPublished = xmlDoc.getElementsByTagName('yearpublished')[0]?.getAttribute('value');
          const minPlayers = xmlDoc.getElementsByTagName('minplayers')[0]?.getAttribute('value');
          const maxPlayers = xmlDoc.getElementsByTagName('maxplayers')[0]?.getAttribute('value');
          const playingTime = xmlDoc.getElementsByTagName('playingtime')[0]?.getAttribute('value');
          const weight = xmlDoc.getElementsByTagName('averageweight')[0]?.getAttribute('value');
          const description = xmlDoc.getElementsByTagName('description')[0]?.textContent;

          console.log('Parsed BGG details:', {
            yearPublished,
            minPlayers,
            maxPlayers,
            playingTime,
            weight,
            description,
          }); // Debugging log

          setBggDetails({
            title,
            image: imageUrl,
            yearPublished,
            minPlayers,
            maxPlayers,
            playingTime,
            weight,
            description,
          });
        } catch (error) {
          console.error('Error fetching BGG details:', error);
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

    const isRemovingPlayerRole = role === "players" && session.players?.includes(uid);

    // Check if the player is about to lose their last role
    const isLastRole =
      (session.hosts?.includes(uid) ? 1 : 0) +
      (session.teachers?.includes(uid) ? 1 : 0) +
      (session.players?.includes(uid) ? 1 : 0) === 1;

    if (isLastRole && session[role]?.includes(uid)) {
      Alert.alert(
        "Error",
        "A player must have at least one role. Assign another role before removing this one."
      );
      return;
    }

    const updatedRoles = session[role]?.includes(uid)
      ? session[role]?.filter((id) => id !== uid)
      : [...(session[role] || []), uid];

    try {
      const db = getFirestore();
      const docRef = doc(db, "gameSessions", session.id);

      // If removing the "Player" role, ask if the user wants to remove the player from the session
      if (isRemovingPlayerRole && !updatedRoles.includes(uid)) {
        Alert.alert(
          "Remove Player",
          "Do you want to remove this player from the session?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: async () => {
                await removePlayer(uid); // Call the removePlayer function
              },
            },
          ]
        );
        return; // Exit early to avoid updating roles
      }

      await updateDoc(docRef, { [role]: updatedRoles });
      setSession((prev) => (prev ? { ...prev, [role]: updatedRoles } : prev));
    } catch (error) {
      console.error("Error updating roles:", error);
      Alert.alert("Error", "Could not update roles.");
    }
  };

  const removePlayer = async (uid: string) => {
    if (!session) {
      Alert.alert('Error', 'Session not found');
      return;
    }

    try {
      const db = getFirestore();
      const docRef = doc(db, "gameSessions", session.id);

      // Use a transaction to ensure data consistency
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
          throw new Error("Game session not found");
        }

        const data = docSnap.data();
        const updatedPlayers = (data.players || []).filter(
          (playerId: string) => playerId !== uid
        );

        // Also remove from roles
        const updatedHosts = (data.hosts || []).filter(
          (hostId: string) => hostId !== uid
        );
        const updatedTeachers = (data.teachers || []).filter(
          (teacherId: string) => teacherId !== uid
        );

        // Update all roles at once
        transaction.update(docRef, {
          players: updatedPlayers,
          hosts: updatedHosts,
          teachers: updatedTeachers
        });
      });

      // Update local state
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players?.filter(id => id !== uid) || [],
          hosts: prev.hosts?.filter(id => id !== uid) || [],
          teachers: prev.teachers?.filter(id => id !== uid) || []
        };
      });

      Alert.alert('Success', 'Player removed from all roles');
    } catch (error: any) {
      console.error('Error removing player:', error);
      Alert.alert(
        'Error',
        error.message || 'Could not remove player. Please try again.'
      );
    }
  };

  const inviteFriend = async (uid: string) => {
    if (!session) {
      console.error("Session is null. Cannot invite friend.");
      return;
    }

    try {
      const db = getFirestore();
      const docRef = doc(db, "gameSessions", session.id);

      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
          throw new Error("Game session does not exist.");
        }

        const data = docSnap.data();
        const players = data.players || [];

        if (players.includes(uid)) {
          throw new Error("This friend is already a player.");
        }

        transaction.update(docRef, {
          players: [...players, uid],
        });
      });

      console.log("Firestore transaction completed successfully."); // Debugging log

      // Update local state
      setSession((prev) => {
        const updatedSession = prev ? { ...prev, players: [...(prev.players || []), uid] } : prev;
        console.log("Updated session state:", updatedSession); // Debugging log
        return updatedSession;
      });

      Alert.alert("Success", "Friend invited.");
    } catch (error: any) {
      console.error("Error inviting friend:", error);
      Alert.alert("Error", error.message || "Could not invite friend. Please try again.");
    }
  };

  const isCreatedByFriend = friends.includes(session?.creator || '');
  const isNotAPlayer = !session?.players?.includes(user.uid || '');

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
          {bggDetails.yearPublished && <Text>Year Published: {bggDetails.yearPublished}</Text>}
          {bggDetails.minPlayers && bggDetails.maxPlayers && (
            <Text>Players: {bggDetails.minPlayers} - {bggDetails.maxPlayers}</Text>
          )}
          {bggDetails.playingTime && <Text>Playing Time: {bggDetails.playingTime} minutes</Text>}
          {bggDetails.weight && <Text>Weight: {bggDetails.weight}</Text>}
          {bggDetails.description && <Text>Description: {bggDetails.description}</Text>}
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
                <Text
                  style={[
                    styles.roleButtonText,
                    session.hosts?.includes(item) && styles.roleButtonTextActive,
                  ]}
                >
                  Host
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  session.teachers?.includes(item) && styles.roleButtonActive,
                ]}
                onPress={() => toggleRole(item, "teachers")}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    session.teachers?.includes(item) && styles.roleButtonTextActive,
                  ]}
                >
                  Teacher
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  session.players?.includes(item) && styles.roleButtonActive,
                ]}
                onPress={() => toggleRole(item, "players")}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    session.players?.includes(item) && styles.roleButtonTextActive,
                  ]}
                >
                  Player
                </Text>
              </TouchableOpacity>
              {session.creator === user.uid && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePlayer(item)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* Invite Friends */}
      <Text style={styles.subtitle}>Invite Friends</Text>
      <FlatList
        data={friends.filter((friendUid) => !session.players?.includes(friendUid))}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.friendItem}>
            <Text>{playerNames[item] || "Unknown"}</Text>
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => inviteFriend(item)}
            >
              <Text style={styles.inviteButtonText}>Invite</Text>
            </TouchableOpacity>
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
    borderColor: "#007AFF", // Blue border for deselected state
    borderRadius: 5,
    marginRight: 5,
    backgroundColor: "#FFFFFF", // White background for deselected state
  },
  roleButtonActive: {
    backgroundColor: "#007AFF", // Blue background for selected state
    borderColor: "#005BB5", // Slightly darker blue border for selected state
  },
  roleButtonText: {
    color: "#007AFF", // Blue text for deselected state
  },
  roleButtonTextActive: {
    color: "#FFFFFF", // White text for selected state
  },
  coverImage: { width: "100%", height: 200, resizeMode: "cover", marginBottom: 10 },
  removeButton: {
    padding: 5,
    borderWidth: 1,
    borderColor: "red",
    borderRadius: 5,
    marginLeft: 5,
  },
  removeButtonText: { color: "red" },
  inviteButton: {
    padding: 5,
    borderWidth: 1,
    borderColor: "#4CAF50",
    borderRadius: 5,
  },
  inviteButtonText: {
    color: "#4CAF50",
  },
  friendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
});