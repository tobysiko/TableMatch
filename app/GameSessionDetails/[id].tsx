import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import BGGSearchInput from '@/app/BGGSearchInput';
import GameTimePicker from '@/app/GameTimePicker';
import { fetchBGGGameDetails } from '@/lib/boardGameGeek';
import { useRouter } from 'expo-router';

type GameSession = {
  id: string;
  title?: string;
  location?: string;
  gameTime?: any; // Firestore Timestamp or raw object
  boardgamegeekID?: string;
  description?: string;
  image?: string;
  creator?: string;
  owner?: string;
  hosts?: string[];
  players?: string[];
  teachers?: string[];
};

type User = {
  uid: string;
  name: string;
};

type BGGGameDetails = {
  image: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
};

export default function GameSessionDetails() {
  const { user } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updatedDetails, setUpdatedDetails] = useState({
    title: '',
    location: '',
    gameTime: new Date(),
    boardgamegeekID: '',
    description: '',
    image: '',
  });
  const [bggDetails, setBggDetails] = useState<BGGGameDetails | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [participants, setParticipants] = useState<User[]>([]);
  const [creatorName, setCreatorName] = useState<string>('Unknown');
  const [ownerName, setOwnerName] = useState<string>('Unknown');
  const [newParticipant, setNewParticipant] = useState('');
  const [friendList, setFriendList] = useState<User[]>([]); // Full friends list
  const [filteredFriends, setFilteredFriends] = useState<User[]>([]); // Filtered suggestions

  const { id } = useLocalSearchParams<{ id: string }>();
  const db = getFirestore();

  useEffect(() => {
    console.log('Current user:', user); // Debugging log
  }, [user]);

  useEffect(() => {
    const fetchSession = async () => {
      if (!id) {
        Alert.alert('Error', 'Invalid session ID.');
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'gameSessions', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as GameSession;
          setSession({ id: docSnap.id, ...data });
          setUpdatedDetails({
            title: data.title || '',
            location: data.location || '',
            gameTime: data.gameTime
              ? new Date(data.gameTime.seconds * 1000)
              : new Date(),
            boardgamegeekID: data.boardgamegeekID || '',
            description: data.description || '',
            image: data.image || '',
          });

          // Fetch creator and owner names
          if (data.creator) {
            const creatorDoc = await getDoc(doc(db, 'users', data.creator));
            if (creatorDoc.exists()) {
              setCreatorName(creatorDoc.data().name || 'Unknown');
            }
          }

          if (data.owner) {
            const ownerDoc = await getDoc(doc(db, 'users', data.owner));
            if (ownerDoc.exists()) {
              setOwnerName(ownerDoc.data().name || 'Unknown');
            }
          }

          // Fetch participant details (names instead of IDs)
          const participantIds = [
            ...(data.hosts || []),
            ...(data.players || []),
            ...(data.teachers || []),
          ];
          const uniqueIds = Array.from(new Set(participantIds));
          const fetchedParticipants = await Promise.all(
            uniqueIds.map(async (uid) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              return userDoc.exists() ? { uid, name: userDoc.data().name || 'Unknown' } : null;
            })
          );
          setParticipants(fetchedParticipants.filter(Boolean) as User[]);

          // Fetch BGG game details if boardgamegeekID is set
          if (data.boardgamegeekID) {
            fetchBGGDetails(data.boardgamegeekID);
          }
        } else {
          Alert.alert('Error', 'Game session not found.');
        }
      } catch (error) {
        console.error('Error fetching game session:', error);
        Alert.alert('Error', 'Failed to fetch game session details.');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user) return;

      try {
        const friendsRef = collection(db, 'users', user.uid, 'friends');
        const friendDocs = await getDocs(friendsRef);
        const friends = friendDocs.docs.map((doc) => ({
          uid: doc.id,
          name: doc.data().name || 'Unknown',
        }));
        console.log('Fetched friends:', friends); // Debugging log
        setFriendList(friends);
        setFilteredFriends(friends); // Initialize filtered list
      } catch (error) {
        console.error('Error fetching friends:', error);
        Alert.alert('Error', 'Failed to fetch friend list.');
      }
    };

    fetchFriends();
  }, [user]);

  const fetchBGGDetails = async (bggID: string) => {
    try {
      const details = await fetchBGGGameDetails(bggID);
      setBggDetails(details);
    } catch (error) {
      console.error('Error fetching BGG details:', error);
    }
  };

  const toggleDescription = () => {
    setShowFullDescription((prev) => !prev);
  };

  const handleSaveChanges = async () => {
    if (!session) {
      Alert.alert('Error', 'Session data is missing.');
      return;
    }

    try {
      const docRef = doc(db, 'gameSessions', session.id);

      // Update Firestore
      await updateDoc(docRef, {
        title: updatedDetails.title || 'Unspecified game session',
        location: updatedDetails.location || null,
        gameTime: updatedDetails.gameTime || null,
        boardgamegeekID: updatedDetails.boardgamegeekID || null,
        description: updatedDetails.description || null,
        image: updatedDetails.image || null,
        hosts: session.hosts || [],
        players: session.players || [],
        teachers: session.teachers || [],
      });

      // Update local state
      setSession((prev) => (prev ? { ...prev, ...updatedDetails } : prev));
      setIsEditing(false);

      Alert.alert('Success', 'Game session details updated successfully.');

      // Navigate back to the previous screen
      router.back();
    } catch (error) {
      console.error('Error updating game session:', error);
      Alert.alert('Error', 'Failed to update game session details.');
    }
  };

  const toggleRole = (uid: string, role: keyof GameSession) => {
    if (!session) return;

    setSession((prev) => {
      if (!prev) return null;

      const updatedRoleList = prev[role]?.includes(uid)
        ? prev[role]?.filter((id) => id !== uid)
        : [...(prev[role] || []), uid];

      return { ...prev, [role]: updatedRoleList };
    });
  };

  const toggleOwner = (uid: string) => {
    if (!session) return;

    setSession((prev) => {
      if (!prev) return null;

      // Ensure only one participant can be the owner
      return {
        ...prev,
        owner: prev.owner === uid ? null : uid, // Toggle owner role
      };
    });
  };

  const handleAddParticipant = async () => {
    if (!newParticipant.trim()) {
      Alert.alert('Error', 'Participant name or ID cannot be empty.');
      return;
    }

    // Simulate adding a new participant (in a real app, you'd fetch the user by ID or name)
    const newUser: User = { uid: newParticipant, name: newParticipant };
    setParticipants((prev) => [...prev, newUser]);
    setNewParticipant('');
  };

  const handleRemoveParticipant = (uid: string) => {
    setParticipants((prev) => prev.filter((participant) => participant.uid !== uid));
    setSession((prev) => {
      if (!prev) return null;

      return {
        ...prev,
        hosts: prev.hosts?.filter((id) => id !== uid) || [],
        players: prev.players?.filter((id) => id !== uid) || [],
        teachers: prev.teachers?.filter((id) => id !== uid) || [],
      };
    });
  };

  const handleSearchChange = (text: string) => {
    setNewParticipant(text);

    // Filter friends list based on the search input
    const filtered = friendList.filter((friend) =>
      friend.name.toLowerCase().includes(text.toLowerCase())
    );

    console.log('Search input:', text); // Debugging log
    console.log('Filtered friends:', filtered); // Debugging log

    setFilteredFriends(filtered);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Text>Game session not found.</Text>
      </View>
    );
  }

  const isCreator = session.creator === user?.uid;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled" // Ensures taps do not block scrolling
      scrollEventThrottle={16} // Improves scroll performance by throttling events
    >
      {bggDetails && (
        <View style={styles.bggSection}>
          <Image source={{ uri: bggDetails.image }} resizeMode="contain" style={styles.bggImage} />
          <Text style={styles.bggTitle}>{session.title || 'Game Details'}</Text>
          <Text style={styles.bggStats}>
            Players: {bggDetails.minPlayers} - {bggDetails.maxPlayers}
          </Text>
          <Text style={styles.bggDescription}>
            {showFullDescription
              ? bggDetails.description
              : `${bggDetails.description.slice(0, 200)}...`}
          </Text>
          <TouchableOpacity onPress={toggleDescription}>
            <Text style={styles.toggleDescription}>
              {showFullDescription ? 'Show Less' : 'Read More'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.title}>{session.title || 'Unspecified Game Session'}</Text>

      {session.image && (
        <Image source={{ uri: session.image }} style={styles.image} />
      )}

      {isEditing ? (
        <>
          <Text style={styles.label}>Search BoardGameGeek</Text>
          <BGGSearchInput onSelectGame={(game) => setUpdatedDetails((prev) => ({ ...prev, boardgamegeekID: game.id, title: game.name }))} />

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Title"
            value={updatedDetails.title}
            onChangeText={(text) => setUpdatedDetails((prev) => ({ ...prev, title: text }))}
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="Location"
            value={updatedDetails.location}
            onChangeText={(text) => setUpdatedDetails((prev) => ({ ...prev, location: text }))}
          />

          <Text style={styles.label}>Game Time</Text>
          <GameTimePicker
            gameTime={updatedDetails.gameTime}
            onChangeGameTime={(event, selectedDate) => {
              if (selectedDate) {
                setUpdatedDetails((prev) => ({ ...prev, gameTime: selectedDate }));
              }
            }}
            showDatePicker={showDatePicker}
            setShowDatePicker={setShowDatePicker}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="Description"
            value={updatedDetails.description}
            onChangeText={(text) => setUpdatedDetails((prev) => ({ ...prev, description: text }))}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants</Text>
            {participants.map((participant) => (
              <View key={participant.uid} style={styles.participantRow}>
                <Text style={styles.participantName}>{participant.name}</Text>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    session.hosts?.includes(participant.uid) && styles.roleButtonActive,
                  ]}
                  onPress={() => toggleRole(participant.uid, 'hosts')}
                >
                  <Text>Host</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    session.players?.includes(participant.uid) && styles.roleButtonActive,
                  ]}
                  onPress={() => toggleRole(participant.uid, 'players')}
                >
                  <Text>Player</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    session.teachers?.includes(participant.uid) && styles.roleButtonActive,
                  ]}
                  onPress={() => toggleRole(participant.uid, 'teachers')}
                >
                  <Text>Teacher</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    session.owner === participant.uid && styles.roleButtonActive,
                  ]}
                  onPress={() => toggleOwner(participant.uid)}
                >
                  <Text>Owner</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveParticipant(participant.uid)}
                >
                  <Text>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add Participant</Text>
              <TextInput
                style={styles.input}
                placeholder="Search friends by name"
                value={newParticipant}
                onChangeText={(text) => {
                  console.log('Search input:', text); // Debugging log
                  handleSearchChange(text);
                }}
              />
              {filteredFriends.length > 0 && (
                <>
                  {console.log('Rendering suggestions:', filteredFriends)} {/* Debugging log */}
                  <FlatList
                    data={filteredFriends}
                    keyExtractor={(item) => item.uid}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => {
                          setNewParticipant(item.name); // Set the selected friend's name
                          setFilteredFriends([]); // Clear suggestions
                        }}
                      >
                        <Text style={styles.suggestionText}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              )}
              <TouchableOpacity style={styles.addButton} onPress={handleAddParticipant}>
                <Text style={styles.buttonText}>Add Participant</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.saveButton, styles.button]} onPress={handleSaveChanges}>
            <Text style={styles.buttonText}>Save Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cancelButton, styles.button]} onPress={() => setIsEditing(false)}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Game Details</Text>
            <Text style={styles.detailLabel}>Title:</Text>
            <Text style={styles.detailValue}>{session.title || 'Not specified'}</Text>

            <Text style={styles.detailLabel}>Location:</Text>
            <Text style={styles.detailValue}>{session.location || 'Not specified'}</Text>

            <Text style={styles.detailLabel}>Game Time:</Text>
            <Text style={styles.detailValue}>
              {session.gameTime ? new Date(session.gameTime.seconds * 1000).toLocaleString() : 'Not specified'}
            </Text>

            <Text style={styles.detailLabel}>Description:</Text>
            <Text style={styles.detailValue}>{session.description || 'No description available'}</Text>

            <Text style={styles.detailLabel}>Creator:</Text>
            <Text style={styles.detailValue}>{creatorName}</Text>

            <Text style={styles.detailLabel}>Owner:</Text>
            <Text style={styles.detailValue}>{ownerName}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants</Text>
            {participants.map((participant) => (
              <View key={participant.uid} style={styles.participantRow}>
                <Text style={styles.participantName}>{participant.name}</Text>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    session.hosts?.includes(participant.uid) && styles.roleButtonActive,
                  ]}
                  onPress={() => toggleRole(participant.uid, 'hosts')}
                >
                  <Text>Host</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    session.players?.includes(participant.uid) && styles.roleButtonActive,
                  ]}
                  onPress={() => toggleRole(participant.uid, 'players')}
                >
                  <Text>Player</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    session.teachers?.includes(participant.uid) && styles.roleButtonActive,
                  ]}
                  onPress={() => toggleRole(participant.uid, 'teachers')}
                >
                  <Text>Teacher</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    session.owner === participant.uid && styles.roleButtonActive,
                  ]}
                  onPress={() => toggleOwner(participant.uid)}
                >
                  <Text>Owner</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveParticipant(participant.uid)}
                >
                  <Text>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add Participant</Text>
              <TextInput
                style={styles.input}
                placeholder="Search friends by name"
                value={newParticipant}
                onChangeText={(text) => {
                  console.log('Search input:', text); // Debugging log
                  handleSearchChange(text);
                }}
              />
              {filteredFriends.length > 0 && (
                <>
                  {console.log('Rendering suggestions:', filteredFriends)} {/* Debugging log */}
                  <FlatList
                    data={filteredFriends}
                    keyExtractor={(item) => item.uid}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => {
                          setNewParticipant(item.name); // Set the selected friend's name
                          setFilteredFriends([]); // Clear suggestions
                        }}
                      >
                        <Text style={styles.suggestionText}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              )}
              <TouchableOpacity style={styles.addButton} onPress={handleAddParticipant}>
                <Text style={styles.buttonText}>Add Participant</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  bggSection: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  bggImage: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  bggTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#4A148C',
  },
  bggStats: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333333',
  },
  bggDescription: {
    fontSize: 14,
    color: '#333333',
    textAlign: 'justify',
  },
  toggleDescription: {
    fontSize: 14,
    color: '#2196F3',
    marginTop: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#4A148C',
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#4A148C',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A148C',
  },
  detailValue: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333333',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  participantName: {
    flex: 1,
    fontSize: 16,
  },
  roleButton: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginHorizontal: 5,
  },
  roleButtonActive: {
    backgroundColor: '#d0f0c0', // Highlight active roles
  },
  removeButton: {
    padding: 5,
    backgroundColor: '#E65100',
    borderRadius: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#E65100',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
  },
});