import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/firebase/auth';
import { NetworkStatus } from '@/components/ui/NetworkStatus';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { PersonalityEditor } from '@/components/iqt/PersonalityEditor';
import { DocumentUploader } from '@/components/iqt/DocumentUploader';
import { SavedMessages } from '@/components/iqt/SavedMessages';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [iqtEnabled, setIqtEnabled] = useState(false);
  const [showPersonalityEditor, setShowPersonalityEditor] = useState(false);
  const [showDocumentUploader, setShowDocumentUploader] = useState(false);
  const [showSavedMessages, setShowSavedMessages] = useState(false);

  useEffect(() => {
    loadIQTStatus();
  }, [user]);

  const loadIQTStatus = async () => {
    if (!user) return;

    try {
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        const personality = userDoc.data()?.personality;
        setIqtEnabled(personality?.enabled || false);
      }
    } catch (error) {
      console.error('Failed to load IQT status:', error);
    }
  };

  const handleToggleIQT = async (value: boolean) => {
    if (!user) return;

    try {
      const db = getFirestore();
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const currentPersonality = userDoc.data()?.personality || {};
        await setDoc(userRef, {
          personality: {
            ...currentPersonality,
            enabled: value
          }
        }, { merge: true });
      } else {
        await setDoc(userRef, {
          personality: {
            tone: 'neutral',
            avgLength: 100,
            phrases: [],
            enabled: value,
            autoSend: false
          }
        }, { merge: true });
      }

      setIqtEnabled(value);

      if (value) {
        Alert.alert(
          'IQT Mode Enabled',
          'Your AI persona will now monitor incoming messages and suggest responses based on your knowledge base.'
        );
      }
    } catch (error) {
      console.error('Failed to toggle IQT:', error);
      Alert.alert('Error', 'Failed to update IQT Mode');
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await signOut();
              // Navigation handled by AuthContext
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <NetworkStatus />
      <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.displayName?.[0]?.toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.displayName || 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      
      <View style={styles.content}>
        {/* IQT Mode Section */}
        <View style={styles.iqtSection}>
          <View style={styles.iqtHeader}>
            <View style={styles.iqtHeaderLeft}>
              <Ionicons name="sparkles" size={24} color="#007AFF" />
              <Text style={styles.iqtTitle}>IQT Mode</Text>
            </View>
            <Switch
              value={iqtEnabled}
              onValueChange={handleToggleIQT}
              trackColor={{ false: '#E5E5EA', true: '#34C759' }}
              thumbColor="#FFF"
            />
          </View>

          <Text style={styles.iqtDescription}>
            Let your AI persona handle repetitive questions based on your knowledge bank
          </Text>

          {iqtEnabled && (
            <View style={styles.iqtControls}>
              <TouchableOpacity
                style={styles.iqtButton}
                onPress={() => setShowPersonalityEditor(true)}
              >
                <Ionicons name="person-outline" size={20} color="#007AFF" />
                <Text style={styles.iqtButtonText}>Edit Personality</Text>
                <Ionicons name="chevron-forward" size={20} color="#CCC" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iqtButton}
                onPress={() => setShowDocumentUploader(true)}
              >
                <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                <Text style={styles.iqtButtonText}>Manage Documents</Text>
                <Ionicons name="chevron-forward" size={20} color="#CCC" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iqtButton}
                onPress={() => setShowSavedMessages(true)}
              >
                <Ionicons name="bookmark-outline" size={20} color="#007AFF" />
                <Text style={styles.iqtButtonText}>Saved Messages</Text>
                <Ionicons name="chevron-forward" size={20} color="#CCC" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Account Info */}
        <View style={styles.accountInfo}>
          <Text style={styles.infoLabel}>User ID</Text>
          <Text style={styles.infoValue}>{user?.uid}</Text>
        </View>
      </View>

      {/* Modals */}
      <Modal
        visible={showPersonalityEditor}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Personality</Text>
            <TouchableOpacity onPress={() => setShowPersonalityEditor(false)}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <PersonalityEditor onSave={() => setShowPersonalityEditor(false)} />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showDocumentUploader}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Documents</Text>
            <TouchableOpacity onPress={() => setShowDocumentUploader(false)}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <DocumentUploader />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showSavedMessages}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Saved Messages</Text>
            <TouchableOpacity onPress={() => setShowSavedMessages(false)}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <SavedMessages />
          </View>
        </SafeAreaView>
      </Modal>

      <TouchableOpacity
        style={[styles.signOutButton, loading && styles.buttonDisabled]}
        onPress={handleSignOut}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#FFF" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </>
        )}
      </TouchableOpacity>
      </ScrollView>
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
    alignItems: 'center',
    padding: 32,
    borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C8',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFF',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#000',
  },
  email: {
    fontSize: 14,
    color: '#8E8E93',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    gap: 12,
  },
  info: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  accountInfo: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'Courier',
  },
  signOutButton: {
    margin: 20,
    height: 50,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  signOutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  iqtSection: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  iqtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iqtHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iqtTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  iqtDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 16,
  },
  iqtControls: {
    gap: 8,
  },
  iqtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 10,
    gap: 12,
  },
  iqtButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C8',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
});

