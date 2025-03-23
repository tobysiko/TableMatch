import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Modal, TextInput, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { getFirestore, doc, onSnapshot, updateDoc, getDocs, collection, query, where, getDoc } from 'firebase/firestore';

export default function Profile() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [showFriends, setShowFriends] = useState(false);
  const [friends, setFriends] = useState<{ uid: string; name: string; email: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ uid: string; name: string; email: string }[]>([]);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    const db = getFirestore();
    const userDocRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);

        // Fetch friend details
        const fetchFriends = async () => {
          try {
            const friendDetails = await Promise.all(
              (data.friends || []).map(async (friendUid: string) => {
                const friendDoc = await getDoc(doc(db, 'users', friendUid));
                return friendDoc.exists() ? { uid: friendUid, ...friendDoc.data() } : null;
              })
            );
            setFriends(friendDetails.filter(Boolean));
          } catch (error) {
            console.error('Error fetching friends:', error);
          }
        };

        fetchFriends();
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    const db = getFirestore();
    const q = query(collection(db, 'users'), where('email', '==', searchTerm.trim()));
    const querySnapshot = await getDocs(q);

    const results: { uid: string; name: string; email: string }[] = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.id !== user?.uid && !friends.some((friend) => friend.uid === docSnap.id)) {
        const data = docSnap.data();
        results.push({ uid: docSnap.id, name: data.name, email: data.email });
      }
    });
    setSearchResults(results);
  };

  const handleAddFriend = async (friendUid: string) => {
    const db = getFirestore();
    const userRef = doc(db, 'users', user.uid);

    try {
      const updatedFriends = [...(userData.friends || []), friendUid];
      await updateDoc(userRef, { friends: updatedFriends });
      setFriends((prev) => [...prev, searchResults.find((result) => result.uid === friendUid)!]);
      setSearchResults([]);
      setSearchTerm('');
      Alert.alert('Success', 'Friend added.');
    } catch (error: any) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', error.message);
    }
  };

  const renderFriendItem = ({ item }: { item: { uid: string; name: string; email: string } }) => (
    <View style={styles.userRow}>
      <Text style={styles.userText}>{item.name} ({item.email})</Text>
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
      <Text style={styles.title}>Profile</Text>
      {userData ? (
        <>
          <Text style={styles.label}>Email: {userData.email}</Text>
          <Button title="Manage Friends" onPress={() => setShowFriends(true)} />
        </>
      ) : (
        <Text>No user information available.</Text>
      )}

      {/* Modal for managing friends */}
      <Modal visible={showFriends} transparent={false} animationType="slide" onRequestClose={() => setShowFriends(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Manage Friends</Text>
          <FlatList
            data={friends}
            keyExtractor={(item) => item.uid}
            renderItem={renderFriendItem}
            ListEmptyComponent={<Text>No friends found.</Text>}
          />
          <TextInput
            style={styles.input}
            placeholder="Search by email"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <Button title="Search" onPress={handleSearch} />
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.uid}
            renderItem={renderSearchResultItem}
            ListEmptyComponent={<Text>No users found.</Text>}
          />
          <Button title="Close" onPress={() => setShowFriends(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  modalContainer: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 18, marginBottom: 10 },
  input: { height: 40, borderWidth: 1, borderColor: '#ccc', paddingHorizontal: 10, marginBottom: 15, borderRadius: 5 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  userText: { fontSize: 16 }
});