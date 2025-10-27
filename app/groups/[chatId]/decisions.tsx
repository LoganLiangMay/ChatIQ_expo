/**
 * Project-Specific Decisions Screen
 * Shows all decisions tracked for a specific project with enhanced details
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { decisionsService } from '@/services/ai/DecisionsService';
import { scanTracker } from '@/services/ai/ScanTracker';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/services/firebase/config';
import type { Decision } from '@/services/ai/types';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

export default function ProjectDecisionsScreen() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user } = useAuth();
  const { trackDecisions } = require('@/hooks/useAI').useAI();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Load decisions with real-time updates
  useEffect(() => {
    if (!user?.uid || !chatId) return;

    let unsubscribe: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      if (!isMounted) return;

      try {
        const firestore = await getFirebaseFirestore();

        if (!isMounted) return;

        const q = query(
          collection(firestore, 'decisions'),
          where('userId', '==', user.uid),
          where('chatId', '==', chatId),
          orderBy('timestamp', 'desc')
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;

          const decisionsData: Decision[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            decisionsData.push({
              id: doc.id,
              decision: data.decision,
              context: data.context,
              participants: data.participants || [],
              timestamp: data.timestamp,
              extractedFrom: data.extractedFrom,
              topic: data.topic,
              relatedProject: data.relatedProject,
              sentiment: data.sentiment,
            });
          });

          if (isMounted) {
            setDecisions(decisionsData);
            setLoading(false);
            console.log('📋 Loaded', decisionsData.length, 'decisions for project');
          }
        });
      } catch (error) {
        if (isMounted) {
          console.error('Error setting up decisions listener:', error);
          setLoading(false);
        }
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid, chatId]);

  const scanForDecisions = async () => {
    if (!user?.uid || !chatId) return;

    setScanning(true);

    try {
      console.log(`🔍 Scanning project ${chatId} for decisions...`);

      // Extract decisions (scan last 50 messages for projects)
      const extractedDecisions = await trackDecisions(chatId, 50);

      if (extractedDecisions && extractedDecisions.length > 0) {
        await decisionsService.saveDecisions(user.uid, chatId, extractedDecisions);
        console.log(`✅ Found ${extractedDecisions.length} decisions in project`);
        Alert.alert('Scan Complete', `Found ${extractedDecisions.length} decisions`);
      } else {
        console.log('📋 No new decisions found');
        Alert.alert('Scan Complete', 'No new decisions found in recent messages');
      }

      // Update scan timestamp
      await scanTracker.updateLastScanTimestamp(
        user.uid,
        chatId,
        'decisions',
        Date.now(),
        extractedDecisions?.length || 0
      );
    } catch (error: any) {
      console.error('❌ Error scanning for decisions:', error);
      Alert.alert('Error', `Failed to scan: ${error?.message || 'Unknown error'}`);
    } finally {
      setScanning(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await scanForDecisions();
    setRefreshing(false);
  };

  const handleItemPress = (decision: Decision) => {
    // Navigate back to chat and optionally scroll to the message
    Alert.alert(
      'Decision Details',
      `Decision: ${decision.decision}\n\nContext: ${decision.context || 'No context available'}\n\nParticipants: ${decision.participants?.join(', ') || 'None'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go to Message',
          onPress: () => {
            router.back(); // Go back to chat
            // TODO: Implement scroll to message if needed
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const renderDecisionItem = ({ item }: { item: Decision }) => (
    <TouchableOpacity
      style={styles.decisionCard}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="git-branch" size={24} color="#007AFF" />
        </View>

        <View style={styles.cardHeaderInfo}>
          <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
          {item.topic && (
            <View style={styles.topicBadge}>
              <Text style={styles.topicText}>{item.topic}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.decisionText}>{item.decision}</Text>

      {item.context && (
        <View style={styles.contextContainer}>
          <Ionicons name="document-text-outline" size={16} color="#666" />
          <Text style={styles.contextText} numberOfLines={3}>
            {item.context}
          </Text>
        </View>
      )}

      {item.participants && item.participants.length > 0 && (
        <View style={styles.participantsContainer}>
          <Ionicons name="people-outline" size={16} color="#666" />
          <Text style={styles.participantsText}>
            {item.participants.join(', ')}
          </Text>
        </View>
      )}

      {item.sentiment && (
        <View style={styles.sentimentContainer}>
          <View
            style={[
              styles.sentimentDot,
              {
                backgroundColor:
                  item.sentiment === 'positive'
                    ? '#34C759'
                    : item.sentiment === 'negative'
                    ? '#FF3B30'
                    : '#FF9500',
              },
            ]}
          />
          <Text style={styles.sentimentText}>
            {item.sentiment && item.sentiment.length > 0
              ? item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)
              : 'Neutral'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#007AFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Project Decisions</Text>
              <Text style={styles.headerSubtitle}>{decisions.length} tracked</Text>
            </View>

            <TouchableOpacity
              onPress={scanForDecisions}
              style={styles.scanButton}
              disabled={scanning}
            >
              <Ionicons
                name={scanning ? 'hourglass' : 'refresh'}
                size={24}
                color="#007AFF"
              />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading decisions...</Text>
            </View>
          ) : decisions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="git-branch-outline" size={80} color="#CCC" />
              <Text style={styles.emptyText}>No Decisions Tracked</Text>
              <Text style={styles.emptySubtext}>
                Scan your project conversations to track important decisions
              </Text>
              <TouchableOpacity
                onPress={scanForDecisions}
                style={styles.scanButtonLarge}
                disabled={scanning}
              >
                <Ionicons name="refresh" size={20} color="#FFF" />
                <Text style={styles.scanButtonText}>
                  {scanning ? 'Scanning...' : 'Scan for Decisions'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={decisions}
              renderItem={renderDecisionItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#007AFF"
                />
              }
              ListHeaderComponent={
                <View style={styles.statsHeader}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{decisions.length}</Text>
                    <Text style={styles.statLabel}>Total Decisions</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>
                      {decisions.filter((d) => d.sentiment === 'positive').length}
                    </Text>
                    <Text style={styles.statLabel}>Positive</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>
                      {
                        decisions.filter(
                          (d) => d.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000
                        ).length
                      }
                    </Text>
                    <Text style={styles.statLabel}>This Week</Text>
                  </View>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C8',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  scanButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  scanButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  listContent: {
    padding: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  decisionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  topicBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  topicText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  decisionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    lineHeight: 24,
  },
  contextContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  contextText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  participantsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sentimentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  sentimentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sentimentText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
});
