/**
 * PersonalityEditor Component
 * Edit user's AI personality profile for IQT Mode
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

interface PersonalityData {
  tone: string;
  avgLength: number;
  phrases: string[];
  enabled: boolean;
  autoSend: boolean;
}

interface PersonalityEditorProps {
  onSave?: (personality: PersonalityData) => void;
}

export function PersonalityEditor({ onSave }: PersonalityEditorProps) {
  const { user } = useAuth();
  const [personality, setPersonality] = useState<PersonalityData>({
    tone: 'neutral',
    avgLength: 100,
    phrases: [],
    enabled: false,
    autoSend: false
  });
  const [phrasesText, setPhrasesText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPersonality();
  }, [user]);

  const loadPersonality = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        const personalityData = userDoc.data()?.personality as PersonalityData | undefined;
        if (personalityData) {
          setPersonality(personalityData);
          setPhrasesText((personalityData.phrases || []).join(', '));
        }
      }
    } catch (error) {
      console.error('Failed to load personality:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonality = async () => {
    if (!user) return;

    setSaving(true);

    try {
      const db = getFirestore();

      // Parse phrases from comma-separated text
      const parsedPhrases = phrasesText
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const updatedPersonality: PersonalityData = {
        ...personality,
        phrases: parsedPhrases
      };

      // Update personality field in user document
      await setDoc(doc(db, 'users', user.uid), {
        personality: updatedPersonality
      }, { merge: true });

      setPersonality(updatedPersonality);

      if (onSave) {
        onSave(updatedPersonality);
      }

      Alert.alert('Success', 'Personality profile saved successfully');
    } catch (error) {
      console.error('Failed to save personality:', error);
      Alert.alert('Error', 'Failed to save personality profile');
    } finally {
      setSaving(false);
    }
  };

  const toneOptions = [
    { value: 'professional', label: 'Professional', icon: 'briefcase' },
    { value: 'casual', label: 'Casual', icon: 'chatbubbles' },
    { value: 'friendly', label: 'Friendly', icon: 'happy' },
    { value: 'formal', label: 'Formal', icon: 'ribbon' },
    { value: 'neutral', label: 'Neutral', icon: 'remove' }
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading personality profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Communication Tone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Communication Tone</Text>
        <Text style={styles.sectionSubtitle}>How your AI persona should speak</Text>

        <View style={styles.toneGrid}>
          {toneOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.toneOption,
                personality.tone === option.value && styles.toneOptionSelected
              ]}
              onPress={() => setPersonality({ ...personality, tone: option.value })}
            >
              <Ionicons
                name={option.icon as any}
                size={24}
                color={personality.tone === option.value ? '#007AFF' : '#666'}
              />
              <Text
                style={[
                  styles.toneOptionText,
                  personality.tone === option.value && styles.toneOptionTextSelected
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Response Length */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Average Response Length</Text>
        <Text style={styles.sectionSubtitle}>Target word count for responses</Text>

        <View style={styles.lengthContainer}>
          <TouchableOpacity
            style={styles.lengthButton}
            onPress={() =>
              setPersonality({
                ...personality,
                avgLength: Math.max(20, personality.avgLength - 20)
              })
            }
          >
            <Ionicons name="remove-circle" size={32} color="#007AFF" />
          </TouchableOpacity>

          <View style={styles.lengthDisplay}>
            <Text style={styles.lengthValue}>{personality.avgLength}</Text>
            <Text style={styles.lengthLabel}>words</Text>
          </View>

          <TouchableOpacity
            style={styles.lengthButton}
            onPress={() =>
              setPersonality({
                ...personality,
                avgLength: Math.min(300, personality.avgLength + 20)
              })
            }
          >
            <Ionicons name="add-circle" size={32} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.lengthGuide}>
          <View style={styles.lengthGuideItem}>
            <Text style={styles.lengthGuideValue}>20-50</Text>
            <Text style={styles.lengthGuideLabel}>Brief</Text>
          </View>
          <View style={styles.lengthGuideItem}>
            <Text style={styles.lengthGuideValue}>50-150</Text>
            <Text style={styles.lengthGuideLabel}>Moderate</Text>
          </View>
          <View style={styles.lengthGuideItem}>
            <Text style={styles.lengthGuideValue}>150+</Text>
            <Text style={styles.lengthGuideLabel}>Detailed</Text>
          </View>
        </View>
      </View>

      {/* Common Phrases */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Common Phrases</Text>
        <Text style={styles.sectionSubtitle}>
          Phrases you commonly use (comma-separated)
        </Text>

        <TextInput
          style={styles.phrasesInput}
          value={phrasesText}
          onChangeText={setPhrasesText}
          placeholder="e.g., Sounds good!, Let's dive in, Great point"
          placeholderTextColor="#999"
          multiline
        />

        <Text style={styles.phrasesHint}>
          💡 Add phrases that match your style to make responses more authentic
        </Text>
      </View>

      {/* Auto-Send Toggle */}
      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>Auto-Send Responses</Text>
            <Text style={styles.toggleSubtitle}>
              Send responses automatically without approval
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.toggle,
              personality.autoSend && styles.toggleActive
            ]}
            onPress={() =>
              setPersonality({ ...personality, autoSend: !personality.autoSend })
            }
          >
            <View
              style={[
                styles.toggleThumb,
                personality.autoSend && styles.toggleThumbActive
              ]}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSavePersonality}
        disabled={saving}
      >
        <Ionicons name="checkmark-circle" size={20} color="#FFF" />
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : 'Save Personality'}
        </Text>
      </TouchableOpacity>

      {/* Info Note */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
        <Text style={styles.infoText}>
          Your personality profile helps the AI mimic your communication style. The
          more accurate your profile, the better the responses.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  loadingText: {
    fontSize: 16,
    color: '#666'
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12
  },
  toneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  toneOption: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  toneOptionSelected: {
    backgroundColor: '#F0F8FF',
    borderColor: '#007AFF'
  },
  toneOptionText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
    color: '#666'
  },
  toneOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600'
  },
  lengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16
  },
  lengthButton: {
    padding: 8
  },
  lengthDisplay: {
    alignItems: 'center'
  },
  lengthValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  lengthLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4
  },
  lengthGuide: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12
  },
  lengthGuideItem: {
    alignItems: 'center'
  },
  lengthGuideValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000'
  },
  lengthGuideLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2
  },
  phrasesInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#000',
    minHeight: 80,
    textAlignVertical: 'top'
  },
  phrasesHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    lineHeight: 16
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4
  },
  toggleSubtitle: {
    fontSize: 13,
    color: '#666'
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: '#E5E5EA',
    padding: 2
  },
  toggleActive: {
    backgroundColor: '#34C759'
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }]
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC'
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600'
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18
  }
});
