import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Button, Alert, Image, ScrollView, Linking, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig'; // Use the shared Firebase instance
import { useAuth } from '@/hooks/useAuth';

// Interface for additional BoardGameGeek info.
interface BGGInfo {
  title: string | null;
  yearpublished: string | null;
  minplayers: string | null;
  maxplayers: string | null;
  playingtime: string | null;
  description: string | null;
  image: string | null;
}

// Helper function to decode HTML entities.
function decodeHTMLEntities(text: string): string {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

// Helper function to fetch BoardGameGeek info via XML.
// In production consider using a proper XML parser.
async function fetchBGGInfo(bggId: string): Promise<BGGInfo | null> {
  try {
    const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${bggId}`);
    const data = await response.text();
    // Extract fields using regex:
    const titleMatch = data.match(/<name\s+type="primary"\s+value="([^"]+)"\s*\/>/);
    const yearMatch = data.match(/<yearpublished\s+value="([^"]+)"\s*\/>/);
    const minplayersMatch = data.match(/<minplayers\s+value="([^"]+)"\s*\/>/);
    const maxplayersMatch = data.match(/<maxplayers\s+value="([^"]+)"\s*\/>/);
    const playingtimeMatch = data.match(/<playingtime\s+value="([^"]+)"\s*\/>/);
    const descriptionMatch = data.match(/<description>([\s\S]*?)<\/description>/);
    const imageMatch = data.match(/<image>([\s\S]*?)<\/image>/);

    const description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim().replace(/&#10;/g, '\n')) : null;
    const image = imageMatch ? imageMatch[1].trim() : null;

    return {
      title: titleMatch ? titleMatch[1] : null,
      yearpublished: yearMatch ? yearMatch[1] : null,
      minplayers: minplayersMatch ? minplayersMatch[1] : null,
      maxplayers: maxplayersMatch ? maxplayersMatch[1] : null,
      playingtime: playingtimeMatch ? playingtimeMatch[1] : null,
      description: description,
      image: image,
    };
  } catch (error) {
    console.error("Error fetching BGG info:", error);
    return null;
  }
}

type GameSession = {
  sessionTitle: string | null;
  gameTitle: string | null;
  location?: string | null;
  gameTime?: string | null;
  boardgamegeekId: string;
  participants: string[];
  creator: { uid: string; email: string } | null;
  createdAt: any;
};

export default function GameSessionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  console.log("Details route id:", id);
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  // Store the additional fetched info from BGG.
  const [bggInfo, setBggInfo] = useState<BGGInfo | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  // Editable state for owner fields.
  const [editLocation, setEditLocation] = useState('');
  const [editGameTime, setEditGameTime] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Fetch the session details from Firestore.
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const docRef = doc(db, "gameSessions", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSession(docSnap.data() as GameSession);
        }
      } catch (error) {
        console.error("Error fetching session details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [id]);

  // After session loads, populate editable fields.
  useEffect(() => {
    if (session) {
      setEditLocation(session.location || '');
      setEditGameTime(session.gameTime || '');
    }
  }, [session]);

  // After session loads, fetch additional BoardGameGeek info.
  useEffect(() => {
    if (session && session.boardgamegeekId) {
      fetchBGGInfo(session.boardgamegeekId).then((info) => {
        if (info) {
          setBggInfo(info);
        }
      });
    }
  }, [session]);

  const handleDelete = async () => {
    const sessionTitleText = session?.sessionTitle ? `Session: ${session.sessionTitle}` : '';
    const gameTitleText = session?.gameTitle ? `Game: ${session.gameTitle}` : `Game ${session?.boardgamegeekId}`;
    const combinedTitle = [sessionTitleText, gameTitleText].filter(Boolean).join(' - ');

    Alert.alert(
      "Delete Session",
      `Are you sure you want to delete the session "${combinedTitle}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            console.log("Delete button pressed.");
            try {
              console.log("Attempting to delete session with ID:", id);
              const docRef = doc(db, "gameSessions", id);
              await deleteDoc(docRef);
              console.log("Session deleted successfully.");
              Alert.alert("Session deleted", `Session "${combinedTitle}" has been deleted.`);
              router.replace("/(tabs)/ListMyGames");
            } catch (error: any) {
              console.error("Error deleting session:", error);
              Alert.alert("Error", error.message);
            }
          }
        }
      ],
      { cancelable: false }
    );
  };

  const handleSaveChanges = async () => {
    try {
      const sessionDocRef = doc(db, 'gameSessions', id);
      await updateDoc(sessionDocRef, {
        location: editLocation,
        gameTime: editGameTime,
      });
      Alert.alert('Success', 'Session updated.');
      setSession({ ...session, location: editLocation, gameTime: editGameTime });
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating session:', error);
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  
  if (!session) {
    return (
      <View style={styles.center}>
        <Text>Session not found.</Text>
      </View>
    );
  }

  // Prepare the BoardGameGeek page URL.
  const bggPageUrl = `https://boardgamegeek.com/boardgame/${session.boardgamegeekId}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {session.sessionTitle ? `Session: ${session.sessionTitle}` : `Session Details`}
      </Text>
      {session.gameTitle && <Text>Game: {session.gameTitle}</Text>}
      {session.location && !isEditing && <Text>Location: {session.location}</Text>}
      {session.gameTime && !isEditing && <Text>Time: {session.gameTime}</Text>}
      <Text>BoardGameGeek ID: {session.boardgamegeekId}</Text>
      <Text>
        Players: {Array.isArray(session.players) ? session.players.join(', ') : 'No players'}
      </Text>
      {session.creator && <Text>Created by: {session.creator.email}</Text>}
      <Text>
        Created at:{" "}
        {session.createdAt?.toDate ? session.createdAt.toDate().toString() : session.createdAt?.toString()}
      </Text>

      {/* Display additional BoardGameGeek info if available */}
      {bggInfo && (
        <View style={styles.bggContainer}>
          {bggInfo.title && <Text style={styles.bggTitle}>BGG Title: {bggInfo.title}</Text>}
          {bggInfo.yearpublished && <Text>Year Published: {bggInfo.yearpublished}</Text>}
          {bggInfo.minplayers && bggInfo.maxplayers && (
            <Text>Players: {bggInfo.minplayers} - {bggInfo.maxplayers}</Text>
          )}
          {bggInfo.playingtime && <Text>Playing Time: {bggInfo.playingtime} minutes</Text>}
          {bggInfo.description && (
            <Text style={styles.description}>
              {decodeHTMLEntities(bggInfo.description)}
            </Text>
          )}
          {bggInfo.image && (
            <Image source={{ uri: bggInfo.image }} style={styles.largeImage} />
          )}
        </View>
      )}
      
      <Button title="View on BoardGameGeek" onPress={() => Linking.openURL(bggPageUrl)} />
      {/* Only show edit fields if the user is the creator */}
      {user && session.creator && user.uid === session.creator.uid && (
        <>
          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.input}
                placeholder="Update Location"
                value={editLocation}
                onChangeText={setEditLocation}
              />
              <TextInput
                style={styles.input}
                placeholder="Update Time"
                value={editGameTime}
                onChangeText={setEditGameTime}
              />
              <Button title="Save Changes" onPress={handleSaveChanges} />
              <Button title="Cancel" onPress={() => setIsEditing(false)} />
            </View>
          ) : (
            <Button title="Edit Session" onPress={() => setIsEditing(true)} />
          )}
        </>
      )}
      {user && session.creator && user.uid === session.creator.uid ? (
        <Button title="Delete Session" color="red" onPress={handleDelete} />
      ) : user ? (
        <Text style={styles.infoText}>
          Only the creator of this session can delete it.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 24,
    marginBottom: 15,
    textAlign: 'center'
  },
  bggContainer: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  bggTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5
  },
  description: {
    marginTop: 10,
    fontStyle: 'italic',
    color: '#555'
  },
  largeImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
    marginBottom: 15
  },
  infoText: {
    color: 'gray',
    fontStyle: 'italic',
    marginVertical: 10,
    textAlign: 'center'
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    marginVertical: 10,
    borderRadius: 5,
  },
  editContainer: {
    marginVertical: 15,
    padding: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
  },
});