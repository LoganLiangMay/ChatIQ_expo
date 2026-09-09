// @ts-nocheck
// TODO: Fix prop type compatibility
/**
 * Search Screen
 * Search across messages, chats, and users
 */

import { useState, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { searchService, SearchResult } from '@/services/search/SearchService';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';

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

    if (!user || !query || query.trim().length < 2) {
      setResults({
        messages: [],
        chats: [],
        users: [],
      });
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const searchResults = await searchService.searchAll(query, user.uid);
      setResults(searchResults);
      
      // Save to search history
      if (query.trim().length >= 2) {
        await searchService.saveSearchQuery(user.uid, query);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults({
        messages: [],
        chats: [],
        users: [],
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header with back button and search bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <View style={styles.searchBarContainer}>
            <SearchBar
              placeholder="Search messages, chats, users..."
              onSearch={handleSearch}
              debounceMs={300}
              autoFocus={true}
            />
          </View>
        </View>

        {/* Results */}
        <SearchResults
          results={results}
          loading={loading}
          searchQuery={searchQuery}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    gap: 8,
  },
  backButton: {
    padding: 8,
  },
  searchBarContainer: {
    flex: 1,
  },
});

