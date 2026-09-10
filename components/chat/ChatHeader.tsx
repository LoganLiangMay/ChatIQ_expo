/**
 * ChatHeader component
 * Displays chat name/title and online status
 */

// @ts-nocheck
// TODO: Fix type compatibility issues
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getInitials, formatLastSeen } from '@/utils/formatters';

interface ChatHeaderProps {
  chatId: string;
  chatName: string;
  chatType: 'direct' | 'group';
  online?: boolean;
  lastSeen?: number;
  participantCount?: number;
}

export function ChatHeader({ chatId, chatName, chatType, online, lastSeen, participantCount }: ChatHeaderProps) {
  const router = useRouter();
  
  const handleBack = () => {
    router.back();
  };
  
  const handleInfo = () => {
    // Navigate to group info for group chats
    if (chatType === 'group') {
      router.push(`/groups/${chatId}/info`);
    } else {
      // Direct chat info (will implement in later PRs)
      console.log('Navigate to direct chat info:', chatId);
    }
  };
  
  const getStatusText = () => {
    if (chatType === 'group') {
      return `${participantCount || 0} members`;
    }
    
    if (online) {
      return 'Online';
    }
    
    if (lastSeen) {
      return formatLastSeen(lastSeen, false);
    }
    
    return 'Offline';
  };
  
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#007AFF" />
      </TouchableOpacity>
      
      <View style={styles.center}>
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(chatName)}</Text>
        </View>
        
        {/* Title and status */}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {chatName}
          </Text>
          
          <View style={styles.statusRow}>
            {chatType === 'direct' && online && (
              <View style={styles.onlineDot} />
            )}
            <Text style={[styles.subtitle, online && styles.onlineText]}>
              {getStatusText()}
            </Text>
          </View>
        </View>
      </View>
      
      <TouchableOpacity onPress={handleInfo} style={styles.infoButton}>
        <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    minHeight: 60,
  },
  backButton: {
    padding: 8,
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759', // iOS green
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
  },
  onlineText: {
    color: '#34C759', // iOS green for online status
  },
  infoButton: {
    padding: 8,
  },
});

