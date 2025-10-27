import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator, Alert, Platform, StatusBar, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useChats } from '@/hooks/useChats';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { NetworkStatus } from '@/components/ui/NetworkStatus';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { SearchFilters } from '@/components/search/SearchFilters';
import { BasicSearchResults } from '@/components/search/BasicSearchResults';
import { searchService, SearchResult, SearchFilters as SearchFiltersType } from '@/services/search/SearchService';
import { BasicSearchResult } from '@/services/search/BasicSearchService';

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { chats, loading, refreshChats } = useChats(user?.uid || '');

  // Inline basic search state
  const [inlineSearchQuery, setInlineSearchQuery] = useState('');
  const [inlineSearchActive, setInlineSearchActive] = useState(false);
  const [basicSearchResults, setBasicSearchResults] = useState<BasicSearchResult>({
    messages: [],
    chats: [],
    users: [],
    photos: [],
    links: [],
    documents: [],
  });
  const [basicSearchLoading, setBasicSearchLoading] = useState(false);

  // AI search modal state (existing)
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult>({
    messages: [],
    chats: [],
    users: [],
  });
  const [searchLoading, setSearchLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersType>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // 🚨 Separate urgent chats from regular chats
  const chatSections = useMemo(() => {
    const urgentChats = chats.filter(chat => 
      chat.lastMessage?.priority?.isPriority && 
      chat.lastMessage.priority.score >= 0.6 // High or critical only
    );
    
    const sections = [];
    
    // Add urgent section if there are urgent chats
    if (urgentChats.length > 0) {
      sections.push({
        title: 'Urgent Messages',
        data: urgentChats,
        urgent: true
      });
    }
    
    // Add all chats section
    sections.push({
      title: 'All Chats',
      data: chats,
      urgent: false
    });
    
    return sections;
  }, [chats]);
  
  const handleNewChat = () => {
    // Show options: New Direct Chat or New Group
    Alert.alert(
      'New Chat',
      'Choose chat type',
      [
        {
          text: 'New Group',
          onPress: () => router.push('/groups/create'),
        },
        {
          text: 'New Direct Chat',
          onPress: () => {
            // Navigate to search to find users
            router.push('/(tabs)/chats/search');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };
  
  const handleSearchPress = () => {
    setShowSearch(true);
  };
  
  const handleSearchClose = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults({
      messages: [],
      chats: [],
      users: [],
    });
    setFilters({});
    setShowFilters(false);
  };
  
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (!user || !query || query.trim().length < 2) {
      setSearchResults({
        messages: [],
        chats: [],
        users: [],
      });
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    try {
      const results = await searchService.searchAll(query, user.uid, filters, true);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({
        messages: [],
        chats: [],
        users: [],
      });
    } finally {
      setSearchLoading(false);
    }
  }, [user, filters]);

  const handleFiltersChange = useCallback((newFilters: SearchFiltersType) => {
    setFilters(newFilters);
    if (searchQuery && searchQuery.trim().length >= 2) {
      handleSearch(searchQuery);
    }
  }, [searchQuery, handleSearch]);

  // Inline basic search handler
  const handleInlineSearch = useCallback(async (query: string) => {
    if (!user || !query || query.trim().length < 2) {
      setBasicSearchResults({
        messages: [],
        chats: [],
        users: [],
        photos: [],
        links: [],
        documents: [],
      });
      setBasicSearchLoading(false);
      return;
    }

    setBasicSearchLoading(true);

    try {
      const results = await searchService.searchBasic(query, user.uid);
      setBasicSearchResults(results);
    } catch (error) {
      console.error('Basic search error:', error);
      setBasicSearchResults({
        messages: [],
        chats: [],
        users: [],
        photos: [],
        links: [],
        documents: [],
      });
    } finally {
      setBasicSearchLoading(false);
    }
  }, [user]);

  // Debounced inline search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inlineSearchQuery.trim().length >= 2) {
        handleInlineSearch(inlineSearchQuery);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [inlineSearchQuery, handleInlineSearch]);

  const handleInlineSearchCancel = () => {
    setInlineSearchActive(false);
    setInlineSearchQuery('');
    setBasicSearchResults({
      messages: [],
      chats: [],
      users: [],
      photos: [],
      links: [],
      documents: [],
    });
  };
  
  if (loading) {
      return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <NetworkStatus />
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Chats</Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
                  <Ionicons name="search-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
                  <Ionicons name="create-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading chats...</Text>
            </View>
          </View>
        </SafeAreaView>
      );
  }
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <NetworkStatus />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={handleSearchPress} style={styles.searchButton}>
              <Ionicons name="sparkles" size={24} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
              <Ionicons name="create-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Inline Search Bar (Always Visible) */}
        <View style={styles.inlineSearchContainer}>
          <View style={styles.inlineSearchBar}>
            <Ionicons name="search" size={20} color="#999" style={styles.inlineSearchIcon} />
            <TextInput
              style={styles.inlineSearchInput}
              placeholder="Search"
              placeholderTextColor="#999"
              value={inlineSearchQuery}
              onChangeText={setInlineSearchQuery}
              onFocus={() => setInlineSearchActive(true)}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {inlineSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setInlineSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
            {inlineSearchActive && (
              <TouchableOpacity onPress={handleInlineSearchCancel} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Results Overlay (when search is active) */}
        {inlineSearchActive ? (
          <View style={styles.searchOverlay}>
            <BasicSearchResults
              results={basicSearchResults}
              searchQuery={inlineSearchQuery}
              loading={basicSearchLoading}
              onUserSelect={(user) => {
                // Handle user selection - create direct chat
                handleInlineSearchCancel();
                // TODO: Navigate to chat with user
              }}
            />
          </View>
        ) : (
          <>
            {/* Chat List with Urgent Section */}
            {chats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No chats yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation or wait for someone to message you
            </Text>
          </View>
        ) : (
          <SectionList
            sections={chatSections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatListItem chat={item} />}
            renderSectionHeader={({ section }) => (
              <View style={[
                styles.sectionHeader,
                section.urgent && styles.urgentSectionHeader
              ]}>
                {section.urgent && (
                  <Ionicons name="alert-circle" size={20} color="#FF3B30" style={styles.urgentIcon} />
                )}
                <Text style={[
                  styles.sectionHeaderText,
                  section.urgent && styles.urgentSectionHeaderText
                ]}>
                  {section.title}
                  {section.urgent && ` (${section.data.length})`}
                </Text>
              </View>
            )}
            onRefresh={refreshChats}
            refreshing={loading}
            stickySectionHeadersEnabled={true}
          />
        )}
          </>
        )}
      </View>

      {/* AI Search Modal (Advanced Search) */}
      <Modal
        visible={showSearch}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleSearchClose}
      >
        <SafeAreaView style={styles.searchModalContainer}>
          {/* Search Header */}
          <View style={styles.searchHeader}>
            <TouchableOpacity onPress={handleSearchClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
            
            <View style={styles.searchInputContainer}>
              <SearchBar
                placeholder="Search by meaning..."
                onSearch={handleSearch}
                debounceMs={500}
                autoFocus={true}
              />
            </View>

            <TouchableOpacity 
              onPress={() => setShowFilters(!showFilters)} 
              style={styles.filterButton}
            >
              <Ionicons 
                name={showFilters ? 'funnel' : 'funnel-outline'} 
                size={24} 
                color={Object.keys(filters).length > 0 ? '#007AFF' : '#666'}
              />
            </TouchableOpacity>
          </View>

          {/* AI Search Badge */}
          {searchQuery && (
            <View style={styles.aiSearchBadge}>
              <Ionicons name="sparkles" size={14} color="#007AFF" />
              <Text style={styles.aiSearchText}>AI-powered semantic search</Text>
            </View>
          )}

          {/* Filters */}
          {showFilters && (
            <SearchFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          )}

          {/* Search Results */}
          <SearchResults
            results={searchResults}
            loading={searchLoading}
            searchQuery={searchQuery}
          />
        </SafeAreaView>
      </Modal>
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
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButton: {
    padding: 8,
  },
  newChatButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  urgentSectionHeader: {
    backgroundColor: '#FFE5E5',
    borderBottomColor: '#FFB8B8',
  },
  urgentIcon: {
    marginRight: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urgentSectionHeaderText: {
    color: '#FF3B30',
  },
  searchModalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    gap: 8,
  },
  closeButton: {
    padding: 8,
  },
  searchInputContainer: {
    flex: 1,
  },
  filterButton: {
    padding: 8,
  },
  aiSearchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F0F8FF',
    gap: 6,
  },
  aiSearchText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  inlineSearchContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  inlineSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineSearchIcon: {
    marginRight: 8,
  },
  inlineSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
  cancelButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  searchOverlay: {
    flex: 1,
    backgroundColor: '#FFF',
  },
});

