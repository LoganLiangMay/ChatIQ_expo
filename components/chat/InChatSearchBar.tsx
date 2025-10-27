/**
 * InChatSearchBar Component
 * Search bar for finding messages within a specific chat
 * Features:
 * - Search within conversation
 * - Highlight matches
 * - Navigate between matches (prev/next)
 * - Scroll to matching message
 */

import { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/types/message';

interface InChatSearchBarProps {
  messages: Message[];
  onSearchResults: (results: Message[], currentIndex: number) => void;
  onClose: () => void;
  onNavigateToMessage?: (messageId: string) => void;
}

export function InChatSearchBar({
  messages,
  onSearchResults,
  onClose,
  onNavigateToMessage
}: InChatSearchBarProps) {
  const [query, setQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Message[]>([]);

  // Search messages
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setCurrentIndex(0);
      onSearchResults([], 0);
      return;
    }

    const searchQuery = query.toLowerCase().trim();
    const matches = messages.filter((msg) =>
      msg.content?.toLowerCase().includes(searchQuery)
    );

    setResults(matches);
    setCurrentIndex(matches.length > 0 ? 0 : -1);
    onSearchResults(matches, matches.length > 0 ? 0 : -1);
  }, [query, messages, onSearchResults]);

  const handlePrevious = () => {
    if (results.length === 0) return;

    const newIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
    setCurrentIndex(newIndex);
    onSearchResults(results, newIndex);

    if (onNavigateToMessage && results[newIndex]) {
      onNavigateToMessage(results[newIndex].id);
    }
  };

  const handleNext = () => {
    if (results.length === 0) return;

    const newIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    onSearchResults(results, newIndex);

    if (onNavigateToMessage && results[newIndex]) {
      onNavigateToMessage(results[newIndex].id);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setCurrentIndex(0);
    onSearchResults([], 0);
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search in conversation"
          placeholderTextColor="#999"
          autoFocus={true}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results Counter & Navigation */}
      {results.length > 0 && (
        <View style={styles.navigation}>
          <Text style={styles.counter}>
            {currentIndex + 1} of {results.length}
          </Text>
          <View style={styles.navButtons}>
            <TouchableOpacity onPress={handlePrevious} style={styles.navButton}>
              <Ionicons name="chevron-up" size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={styles.navButton}>
              <Ionicons name="chevron-down" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Close Button */}
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={24} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 2,
  },
  clearButton: {
    padding: 2,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counter: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  navButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
});
