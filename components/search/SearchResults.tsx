/**
 * SearchResults Component
 * Displays search results organized by category:
 * - Messages
 * - Chats
 * - Users
 */

// @ts-nocheck
// TODO: Fix union type discrimination issues
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SearchResult, MessageSearchResult, UserSearchResult } from '@/services/search/SearchService';
import { Chat } from '@/types/chat';
import { formatTimestamp, getInitials } from '@/utils/formatters';

interface SearchResultsProps {
  results: SearchResult;
  searchQuery: string;
  onUserSelect?: (user: UserSearchResult) => void;
}

export function SearchResults({ results, searchQuery, onUserSelect }: SearchResultsProps) {
  const router = useRouter();
  const hasResults = 
    results.messages.length > 0 || 
    results.chats.length > 0 || 
    results.users.length > 0;

  if (!searchQuery) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search" size={64} color="#CCC" />
        <Text style={styles.emptyText}>Search messages, chats, and users</Text>
      </View>
    );
  }

  if (!hasResults) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="sad-outline" size={64} color="#CCC" />
        <Text style={styles.emptyText}>No results found</Text>
        <Text style={styles.emptySubtext}>Try a different search term</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={[
        { type: 'section', title: 'Messages', count: results.messages.length },
        ...results.messages.map(m => ({ type: 'message', data: m })),
        { type: 'section', title: 'Chats', count: results.chats.length },
        ...results.chats.map(c => ({ type: 'chat', data: c })),
        { type: 'section', title: 'Users', count: results.users.length },
        ...results.users.map(u => ({ type: 'user', data: u })),
      ].filter(item => 
        item.type === 'section' ? (item.count as number) > 0 : true
      )}
      keyExtractor={(item, index) => `${item.type}-${index}`}
      renderItem={({ item }) => {
        if (item.type === 'section') {
          return <SectionHeader title={item.title as string} count={item.count as number} />;
        }
        if (item.type === 'message') {
          return (
            <MessageResultItem
              result={item.data as MessageSearchResult}
              searchQuery={searchQuery}
              onPress={() => router.push(`/(tabs)/chats/${(item.data as MessageSearchResult).message.chatId}`)}
            />
          );
        }
        if (item.type === 'chat') {
          return (
            <ChatResultItem
              chat={item.data as Chat}
              onPress={() => router.push(`/(tabs)/chats/${(item.data as Chat).id}`)}
            />
          );
        }
        if (item.type === 'user') {
          return (
            <UserResultItem
              user={item.data as UserSearchResult}
              onPress={() => onUserSelect?.(item.data as UserSearchResult)}
            />
          );
        }
        return null;
      }}
      contentContainerStyle={styles.listContent}
    />
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

function MessageResultItem({ 
  result, 
  searchQuery, 
  onPress 
}: { 
  result: MessageSearchResult; 
  searchQuery: string; 
  onPress: () => void;
}) {
  const { message, chatName } = result;
  
  // Highlight search term in content
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <Text key={index} style={styles.highlight}>{part}</Text>
      ) : (
        part
      )
    );
  };

  return (
    <TouchableOpacity style={styles.resultItem} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Ionicons name="chatbubble-outline" size={24} color="#007AFF" />
      </View>
      
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{chatName}</Text>
        <Text style={styles.resultSubtitle} numberOfLines={2}>
          {highlightText(message.content, searchQuery)}
        </Text>
        <Text style={styles.resultTime}>
          {message.senderName} · {formatTimestamp(message.timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ChatResultItem({ chat, onPress }: { chat: Chat; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.resultItem} onPress={onPress}>
      <View style={[styles.iconContainer, styles.avatarContainer]}>
        <Text style={styles.avatarText}>{getInitials(chat.name || 'Chat')}</Text>
      </View>
      
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{chat.name || 'Chat'}</Text>
        {chat.lastMessage && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {chat.lastMessage.content || '📷 Image'}
          </Text>
        )}
        <Text style={styles.resultTime}>
          {chat.type === 'group' ? `${chat.participants.length} members` : 'Direct chat'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function UserResultItem({ user, onPress }: { user: UserSearchResult; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.resultItem} onPress={onPress}>
      <View style={[styles.iconContainer, styles.avatarContainer]}>
        <Text style={styles.avatarText}>{getInitials(user.displayName)}</Text>
        {user.online && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{user.displayName}</Text>
        {user.email && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {user.email}
          </Text>
        )}
        <Text style={styles.resultTime}>
          {user.online ? 'Online' : 'Offline'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 14,
    color: '#999',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarContainer: {
    backgroundColor: '#007AFF',
    position: 'relative',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  resultTime: {
    fontSize: 12,
    color: '#999',
  },
  highlight: {
    backgroundColor: '#FFEB3B',
    fontWeight: '600',
  },
});
