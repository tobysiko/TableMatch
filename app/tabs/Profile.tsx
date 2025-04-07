import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Modal, TextInput, FlatList, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getFirestore, doc, onSnapshot, updateDoc, getDocs, collection, query, where, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig'; // Use shared Firebase instance
import { Ionicons } from '@expo/vector-icons';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';

interface UserData {
  uid: string;
  name: string;
  email: string;
  description?: string;
  friends?: string[];
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [friends, setFriends] = useState<{ uid: string; name: string; email: string; description?: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ uid: string; name: string; email: string }[]>([]);

  useEffect(() => {
    console.log('Checking user state:', user); // Debugging log
    if (!user?.uid) {
      console.log('User not found. Redirecting to login...'); // Debugging log
      router.replace('/login');
      return;
    }

    const userDocRef = doc(db, 'users', user?.uid || '');

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Fetched user data:', data); // Debugging log
        setUserData(data);
        setName(data.name || '');
        setDescription(data.description || '');
        console.log('Fetched friends:', data.friends || []); // Debugging log
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (userData?.friends) {
      const fetchFriendsDetails = async () => {
        try {
          const friendsDetails = await Promise.all(
            userData.friends.map(async (friendUid: string) => {
              const friendDoc = await getDoc(doc(db, 'users', friendUid));
              return friendDoc.exists()
                ? { uid: friendUid, ...friendDoc.data() }
                : null;
            })
          );
          const filteredFriends = friendsDetails.filter(Boolean);
          console.log('Fetched friends details:', filteredFriends); // Debugging log
          setFriends(filteredFriends);
        } catch (error) {
          console.error('Error fetching friends details:', error);
        }
      };

      fetchFriendsDetails();
    }
  }, [userData?.friends]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      Alert.alert('Error', 'Please enter a search term.');
      return;
    }

    try {
      const q = query(
        collection(db, 'users'),
        where('email', '>=', searchTerm.trim()),
        where('email', '<=', searchTerm.trim() + '\uf8ff')
      );

      const nameQuery = query(
        collection(db, 'users'),
        where('name', '>=', searchTerm.trim()),
        where('name', '<=', searchTerm.trim() + '\uf8ff')
      );

      const [emailSnapshot, nameSnapshot] = await Promise.all([getDocs(q), getDocs(nameQuery)]);

      const results: { uid: string; name: string; email: string }[] = [];

      emailSnapshot.forEach((docSnap) => {
        if (docSnap.id !== user?.uid && !friends.some((friend) => friend.uid === docSnap.id)) {
          const data = docSnap.data();
          results.push({ uid: docSnap.id, name: data.name, email: data.email });
        }
      });

      nameSnapshot.forEach((docSnap) => {
        if (
          docSnap.id !== user?.uid &&
          !friends.some((friend) => friend.uid === docSnap.id) &&
          !results.some((result) => result.uid === docSnap.id)
        ) {
          const data = docSnap.data();
          results.push({ uid: docSnap.id, name: data.name, email: data.email });
        }
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching for users:', error);
      Alert.alert('Error', 'Failed to search for users.');
    }
  };

  const handleAddFriend = async (friendUid: string) => {
    console.log('Adding friend with UID:', friendUid); // Debugging log
    const userRef = doc(db, 'users', user?.uid || '');

    try {
      if (userData.friends?.includes(friendUid)) {
        Alert.alert('Error', 'This friend is already in your list.');
        return;
      }

      const updatedFriends = [...(userData.friends || []), friendUid];
      console.log('Updated friends list after adding:', updatedFriends); // Debugging log
      await updateDoc(userRef, { friends: updatedFriends });

      const newFriend = searchResults.find((result) => result.uid === friendUid);
      if (newFriend) {
        setFriends((prev) => {
          const uniqueFriends = [...prev, newFriend].filter(
            (friend, index, self) => self.findIndex((f) => f.uid === friend.uid) === index
          );
          console.log('Updated friends state:', uniqueFriends); // Debugging log
          return uniqueFriends;
        });
      }

      setSearchResults([]);
      setSearchTerm('');
      Alert.alert('Success', 'Friend added.');
    } catch (error: any) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleRemoveFriend = async (friendUid: string) => {
    if (!userData || !user) {
      Alert.alert('Error', 'Not logged in');
      return;
    }

    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const userRef = doc(db, 'users', user.uid);

              // Use a transaction to ensure data consistency
              await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) {
                  throw new Error('Your user profile was not found.');
                }

                // Get the current friends list
                const currentFriends: string[] = userDoc.data().friends || [];
                if (!currentFriends.includes(friendUid)) {
                  throw new Error('This friend is not in your friend list.');
                }

                // Remove the friend from the list
                const updatedFriends = currentFriends.filter((uid) => uid !== friendUid);

                // Update Firestore
                transaction.update(userRef, { friends: updatedFriends });
              });

              // Update local state after successful Firestore update
              setFriends((prev) => prev.filter((friend) => friend.uid !== friendUid));
              setUserData((prev) =>
                prev
                  ? { ...prev, friends: prev.friends?.filter((uid) => uid !== friendUid) || [] }
                  : null
              );

              Alert.alert('Success', 'Friend removed successfully');
            } catch (error: any) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', error.message || 'Could not remove friend. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }

    try {
      const userRef = doc(db, 'users', user?.uid || '');
      await updateDoc(userRef, { name, description });
      Alert.alert('Success', 'Profile updated successfully.');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred.');
    }
  };

  const handleLogout = async () => {
    console.log('Logging out...'); // Debugging log
    try {
      await signOut();
      console.log('Sign out successful. Redirecting to login...'); // Debugging log
      router.replace('/login');
    } catch (error: any) {
      console.error('Error during logout:', error); // Debugging log
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const renderFriendItem = ({ item }: { item: { uid: string; name: string; email: string; description?: string } }) => (
    <View style={styles.userRow}>
      <View>
        <Text style={styles.userText}>{item.name}</Text>
        <Text style={styles.userSubText}>{item.description || 'No description available'}</Text>
        <Text style={styles.userSubText}>{item.email}</Text>
      </View>
      <TouchableOpacity
        accessible={true}
        accessibilityRole="button"
        onPress={() => handleRemoveFriend(item.uid)}
      >
        <Ionicons name="trash" size={24} color="#E65100" />
      </TouchableOpacity>
    </View>
  );

  const renderSearchResultItem = ({ item }: { item: { uid: string; name: string; email: string } }) => (
    <View style={styles.userRow}>
      <Text style={styles.userText}>{item.name} ({item.email})</Text>
      <Button title="Add" onPress={() => handleAddFriend(item.uid)} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TableMatch</Text>
      </View>
      <Text style={styles.title}>Profile</Text>
      {userData ? (
        <>
          <Text style={styles.label}>Email: {userData.email}</Text>
          {!isEditing ? (
            <>
              <Text style={styles.label}>Name: {userData.name || 'No name set'}</Text>
              <Text style={styles.label}>Description: {userData.description || 'No description set'}</Text>
              <Button title="Edit Profile" onPress={() => setIsEditing(true)} color="#E65100" />
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your description"
                value={description}
                onChangeText={setDescription}
              />
              <Button title="Save" onPress={handleSaveProfile} color="#4CAF50" />
              <Button title="Cancel" onPress={() => setIsEditing(false)} color="#E65100" />
            </>
          )}
          <Button title="Manage Friends" onPress={() => setShowFriends(true)} color="#E65100" />
          <Button title="Log Out" onPress={handleLogout} color="#E65100" />
        </>
      ) : (
        <Text style={styles.infoText}>No user information available.</Text>
      )}

      <Modal visible={showFriends} transparent={false} animationType="slide" onRequestClose={() => setShowFriends(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Manage Friends</Text>
          <FlatList
            data={friends}
            keyExtractor={(item) => item.uid}
            renderItem={renderFriendItem}
            ListEmptyComponent={<Text style={styles.infoText}>No friends found.</Text>}
          />
          <TextInput
            style={styles.input}
            placeholder="Search by email or name"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <Button title="Search" onPress={handleSearch} color="#E65100" />
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.uid}
            renderItem={renderSearchResultItem}
            ListEmptyComponent={<Text style={styles.infoText}>No users found.</Text>}
          />
          <Button title="Close" onPress={() => setShowFriends(false)} color="#E65100" />
        </View>
      </Modal>
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
  label: { fontSize: 18, marginBottom: 10, color: '#4A148C' },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E65100',
    paddingHorizontal: 10,
    marginBottom: 15,
    borderRadius: 5,
    backgroundColor: '#FFF3E0',
    color: '#4A148C',
  },
  modalContainer: { flex: 1, padding: 20, backgroundColor: '#FFFFFF' },
  infoText: { color: '#B39DDB', textAlign: 'center', marginTop: 10 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  userText: { fontSize: 16, fontWeight: 'bold' },
  userSubText: { fontSize: 14, color: '#757575' },
});