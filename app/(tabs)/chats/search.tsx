/**
 * Search Screen
 * Full-screen search interface for:
 * - Messages
 * - Chats
 * - Users
 */

import { useState, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { searchService, SearchResult, UserSearchResult } from '@/services/search/SearchService';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
// TODO: Implement createDirectChat function
// import { createDirectChat } from '@/services/firebase/firestore';
import { db } from '@/services/database/sqlite';

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResult>({
    messages: [],
    chats: [],
    users: [],
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (!query || query.trim().length < 2) {
      setResults({
        messages: [],
        chats: [],
        users: [],
      });
      return;
    }

    if (!user) return;

    setLoading(true);

    try {
      const searchResults = await searchService.searchAll(query, user.uid);
      setResults(searchResults);
      
      // Save search query (for history)
      await searchService.saveSearchQuery(user.uid, query);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleUserSelect = async (selectedUser: UserSearchResult) => {
    if (!user) return;

    try {
      // Create or get existing direct chat
      const chatId = [user.uid, selectedUser.uid].sort().join('-');
      
      // Check if chat exists in SQLite
      const existingChat = await db.getChat(chatId);
      
      if (existingChat) {
        // Navigate to existing chat
        router.push(`/(tabs)/chats/${chatId}`);
      } else {
        // Create new direct chat
        Alert.alert(
          'Start Chat',
          `Start a conversation with ${selectedUser.displayName}?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Start Chat',
              onPress: async () => {
                try {
                  // TODO: Implement direct chat creation
                  // await createDirectChat([user.uid, selectedUser.uid]);
                  Alert.alert('Not Implemented', 'Direct chat creation not yet implemented');
                  // const chatId = 'generated-chat-id';
                  // router.push(`/(tabs)/chats/${chatId}`);
                } catch (error) {
                  console.error('Error creating chat:', error);
                  Alert.alert('Error', 'Failed to create chat. Please try again.');
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error selecting user:', error);
      Alert.alert('Error', 'Failed to open chat. Please try again.');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Search bar */}
        <SearchBar
          onSearch={handleSearch}
          onCancel={handleCancel}
          placeholder="Search messages, chats, users..."
          loading={loading}
        />

        {/* Results */}
        <SearchResults
          results={results}
          searchQuery={searchQuery}
          onUserSelect={handleUserSelect}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
  },
});


