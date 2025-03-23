import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Create a new game session
export const createGameSession = async (sessionData: {
  boardgamegeekID: string;
  creator: string;
  gameTime: Date;
  location: string;
  owner: string;
  title: string;
  hosts?: string[];
  players?: string[];
  teachers?: string[];
}) => {
  const db = getFirestore();
  const gameSessionsRef = collection(db, 'gameSessions');

  try {
    const newSession = {
      boardgamegeekID: sessionData.boardgamegeekID,
      createdAt: serverTimestamp(),
      creator: sessionData.creator,
      gameTime: sessionData.gameTime,
      location: sessionData.location,
      owner: sessionData.owner,
      title: sessionData.title,
      hosts: sessionData.hosts || [],
      players: sessionData.players || [],
      teachers: sessionData.teachers || [],
    };

    const docRef = await addDoc(gameSessionsRef, newSession);
    console.log('Game session created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating game session:', error);
    throw error;
  }
};

// Fetch all game sessions
export const fetchGameSessions = async () => {
  const db = getFirestore();
  const gameSessionsRef = collection(db, 'gameSessions');

  try {
    const querySnapshot = await getDocs(gameSessionsRef);
    const sessions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return sessions;
  } catch (error) {
    console.error('Error fetching game sessions:', error);
    throw error;
  }
};

// Update a game session
export const updateGameSession = async (sessionId: string, updatedData: Partial<{
  boardgamegeekID: string;
  gameTime: Date;
  location: string;
  title: string;
  hosts: string[];
  players: string[];
  teachers: string[];
}>) => {
  const db = getFirestore();
  const sessionRef = doc(db, 'gameSessions', sessionId);

  try {
    await updateDoc(sessionRef, updatedData);
    console.log('Game session updated successfully');
  } catch (error) {
    console.error('Error updating game session:', error);
    throw error;
  }
};