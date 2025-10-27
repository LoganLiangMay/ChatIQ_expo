/**
 * SavedMessages Component
 * Display all messages saved for IQT Mode
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

interface SavedMessage {
  id: string;
  text: string;
  chatName?: string;
  chatDescription?: string;
  enrichedContext?: string;
  specificTopic?: string;
  entities?: Array<{ type: string; value: string }>;
  relatedQuestions?: string[];
  tags?: string[];
  savedAt: any;
  chatId: string;
  messageId: string;
}

export function SavedMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Listen to user's saved messages
    const db = getFirestore();
    const messagesQuery = query(
      collection(db, `users/${user.uid}/keyMessages`),
      orderBy('savedAt', 'desc')
    );

    const unsubscribe = onSnapshot(messagesQuery, snapshot => {
      const msgs: SavedMessage[] = [];
      snapshot.forEach(doc => {
        msgs.push({
          id: doc.id,
          ...doc.data()
        } as SavedMessage);
      });
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDeleteMessage = async (msgId: string, text: string) => {
    Alert.alert(
      'Remove Saved Message',
      `Remove "${text.substring(0, 50)}..." from IQT knowledge?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getFirestore();
              await deleteDoc(doc(db, `users/${user!.uid}/keyMessages`, msgId));
              Alert.alert('Success', 'Message removed from IQT knowledge');
            } catch (error) {
              console.error('Failed to delete message:', error);
              Alert.alert('Error', 'Failed to remove message');
            }
          }
        }
      ]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderMessage = ({ item }: { item: SavedMessage }) => {
    const isExpanded = expandedId === item.id;

    return (
      <View style={styles.messageCard}>
        {/* Header */}
        <TouchableOpacity
          style={styles.messageHeader}
          onPress={() => toggleExpand(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.messageIcon}>
            <Ionicons name="bookmark" size={20} color="#007AFF" />
          </View>

          <View style={styles.messageHeaderContent}>
            {item.specificTopic && (
              <Text style={styles.messageTopic} numberOfLines={1}>
                {item.specificTopic}
              </Text>
            )}
            <Text style={styles.messageText} numberOfLines={isExpanded ? undefined : 2}>
              {item.text}
            </Text>
            {item.chatName && (
              <Text style={styles.messageChatName}>
                <Ionicons name="chatbubble-outline" size={12} color="#666" />{' '}
                {item.chatName}
              </Text>
            )}
          </View>

          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666"
            style={styles.expandIcon}
          />
        </TouchableOpacity>

        {/* Expanded Content */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Context Summary */}
            {item.enrichedContext && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="bulb-outline" size={14} color="#007AFF" /> Context
                </Text>
                <Text style={styles.sectionContent}>{item.enrichedContext}</Text>
              </View>
            )}

            {/* Entities */}
            {item.entities && item.entities.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="pricetag-outline" size={14} color="#007AFF" /> Entities
                </Text>
                <View style={styles.entitiesContainer}>
                  {item.entities.map((entity, idx) => (
                    <View key={idx} style={styles.entityChip}>
                      <Text style={styles.entityType}>{entity.type}:</Text>
                      <Text style={styles.entityValue}>{entity.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Related Questions */}
            {item.relatedQuestions && item.relatedQuestions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="help-circle-outline" size={14} color="#007AFF" /> Answers
                </Text>
                {item.relatedQuestions.map((question, idx) => (
                  <Text key={idx} style={styles.relatedQuestion}>
                    • {question}
                  </Text>
                ))}
              </View>
            )}

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="pricetags-outline" size={14} color="#007AFF" /> Tags
                </Text>
                <View style={styles.tagsContainer}>
                  {item.tags.map((tag, idx) => (
                    <View key={idx} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Metadata */}
            <View style={styles.metadata}>
              {item.chatDescription && (
                <Text style={styles.metadataText}>
                  <Ionicons name="information-circle-outline" size={12} /> {item.chatDescription}
                </Text>
              )}
              {item.savedAt && (
                <Text style={styles.metadataText}>
                  <Ionicons name="time-outline" size={12} /> Saved{' '}
                  {new Date(
                    item.savedAt.toDate?.() || item.savedAt
                  ).toLocaleDateString()}
                </Text>
              )}
            </View>

            {/* Delete Button */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteMessage(item.id, item.text)}
            >
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
              <Text style={styles.deleteButtonText}>Remove from IQT</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#007AFF" />
        <Text style={styles.loadingText}>Loading saved messages...</Text>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bookmark-outline" size={64} color="#CCC" />
        <Text style={styles.emptyText}>No Saved Messages</Text>
        <Text style={styles.emptySubtext}>
          Long-press any message and select "Save for IQT" to build your knowledge base
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{messages.length}</Text>
          <Text style={styles.statLabel}>Saved Messages</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {messages.filter(m => m.specificTopic).length}
          </Text>
          <Text style={styles.statLabel}>Topics</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {Array.from(new Set(messages.map(m => m.chatId))).length}
          </Text>
          <Text style={styles.statLabel}>Chats</Text>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messagesList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messagesContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    justifyContent: 'space-around'
  },
  stat: {
    alignItems: 'center'
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 2
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  messagesList: {
    flex: 1
  },
  messagesContent: {
    paddingBottom: 20
  },
  messageCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden'
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14
  },
  messageIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  messageHeaderContent: {
    flex: 1
  },
  messageTopic: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4
  },
  messageText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    marginBottom: 4
  },
  messageChatName: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  expandIcon: {
    marginLeft: 8
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7'
  },
  section: {
    marginTop: 12
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6
  },
  sectionContent: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18
  },
  entitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  entityChip: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4
  },
  entityType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase'
  },
  entityValue: {
    fontSize: 11,
    color: '#000'
  },
  relatedQuestion: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
    marginBottom: 4
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  tag: {
    backgroundColor: '#E8F5FF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  tagText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500'
  },
  metadata: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    gap: 4
  },
  metadataText: {
    fontSize: 11,
    color: '#999',
    lineHeight: 16
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 6
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF3B30'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20
  }
});
