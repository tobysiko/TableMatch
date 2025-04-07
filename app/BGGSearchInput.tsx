import React, { useState, useRef } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';

type BGGSearchInputProps = {
  onSelectGame: (game: { id: string; name: string }) => void;
};

export default function BGGSearchInput({ onSelectGame }: BGGSearchInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; year?: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestIdRef = useRef(0);

  const searchBGG = async (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    const currentRequestId = ++searchRequestIdRef.current;
    setIsSearching(true);

    try {
      const response = await fetch(
        `http://localhost:3000/proxy?url=${encodeURIComponent(`https://boardgamegeek.com/xmlapi2/search?query=${term}&type=boardgame`)}`
      );
      const data = await response.text();

      if (currentRequestId !== searchRequestIdRef.current) return;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      const items = Array.from(xmlDoc.getElementsByTagName('item')).slice(0, 10);

      const results = items.map((item) => {
        const id = item.getAttribute('id')!;
        const name = item.getElementsByTagName('name')[0]?.getAttribute('value') || '';
        const year = item.getElementsByTagName('yearpublished')[0]?.getAttribute('value');
        return { id, name, year: year ? parseInt(year, 10) : undefined };
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching BoardGameGeek:', error);
      Alert.alert('Error', 'Could not search BoardGameGeek.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="Search for a game"
        value={searchTerm}
        onChangeText={searchBGG}
      />
      {isSearching && <Text style={styles.infoText}>Searching...</Text>}
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultItem}
            onPress={() => {
              onSelectGame({ id: item.id, name: item.name });
              setSearchTerm('');
              setSearchResults([]);
            }}
          >
            <Text style={styles.resultText}>{item.name}</Text>
            {item.year && <Text style={styles.resultText}>Year: {item.year}</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  infoText: {
    color: '#888',
    marginBottom: 10,
  },
  resultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultText: {
    fontSize: 16,
  },
});