import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { whisperService } from '../lib/whisper';

const quranData = require('../../qurandata/quran (1).json');

interface Verse {
  chapter: number;
  verse: number;
  text: string;
}

interface TestScreenProps {
  navigation: any;
  route?: any;
}

export default function TestScreen({ navigation, route }: TestScreenProps) {
  const [currentSurah, setCurrentSurah] = useState(1);
  const [currentAyah, setCurrentAyah] = useState(1);
  const [verseText, setVerseText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null);
  const [transcribedText, setTranscribedText] = useState('');

  useEffect(() => {
    loadProgress();
  }, []);

  useEffect(() => {
    loadCurrentVerse();
  }, [currentSurah, currentAyah]);

  const loadProgress = async () => {
    try {
      const savedSurah = await AsyncStorage.getItem('currentSurah');
      const savedAyah = await AsyncStorage.getItem('currentAyah');
      if (savedSurah) setCurrentSurah(parseInt(savedSurah));
      if (savedAyah) setCurrentAyah(parseInt(savedAyah));
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const saveProgress = async (surah: number, ayah: number) => {
    try {
      await AsyncStorage.setItem('currentSurah', surah.toString());
      await AsyncStorage.setItem('currentAyah', ayah.toString());
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const loadCurrentVerse = () => {
    const chapterKey = currentSurah.toString();
    const verses: Verse[] = quranData[chapterKey] || [];
    const verse = verses.find((v) => v.verse === currentAyah);
    if (verse) {
      setVerseText(verse.text);
    }
  };

  const normalizeArabic = (text: string): string => {
    // Remove diacritics (harakat) and normalize
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Arabic diacritics
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '') // Keep only Arabic characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const calculateSimilarity = (text1: string, text2: string): number => {
    const normalized1 = normalizeArabic(text1);
    const normalized2 = normalizeArabic(text2);

    if (normalized1 === normalized2) return 100;

    // Levenshtein distance
    const len1 = normalized1.length;
    const len2 = normalized2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (normalized1[i - 1] === normalized2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          );
        }
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    const similarity = ((maxLen - distance) / maxLen) * 100;
    return similarity;
  };

  const transcribeAudio = async (audioUri: string): Promise<string> => {
    try {
      // Use Whisper service to transcribe
      const transcription = await whisperService.transcribe(audioUri, {
        language: 'ar',
        task: 'transcribe',
      });
      return transcription;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Microphone permission is required to record audio');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Configure for 16kHz mono WAV
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.wav',
            outputFormat: Audio.AndroidOutputFormat.DEFAULT,
            audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/wav',
            bitsPerSecond: 128000,
          },
        }
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      setIsProcessing(true);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (!uri) {
        throw new Error('No recording URI');
      }

      // Convert to WAV 16kHz mono if needed
      // For now, use the recording as-is
      
      // Transcribe with Whisper
      const transcription = await transcribeAudio(uri);
      setTranscribedText(transcription);

      // Compare with verse text
      const similarity = calculateSimilarity(transcription, verseText);
      const passed = similarity >= 70;

      setTestResult(passed ? 'pass' : 'fail');
      
      if (passed) {
        // Wait a bit before moving to next verse
        setTimeout(async () => {
          await moveToNextVerse();
          setTestResult(null);
          setTranscribedText('');
        }, 2000);
      }
    } catch (error) {
      // In placeholder mode, transcription errors are expected
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Model file not found') || errorMessage.includes('Whisper')) {
        console.log('Transcription in placeholder mode (expected):', errorMessage);
        // Still show fail result since transcription didn't work
        setTestResult('fail');
        setTranscribedText('');
      } else {
        console.error('Error processing recording:', error);
        Alert.alert('Error', 'Failed to process recording');
        setTestResult('fail');
      }
    } finally {
      setIsProcessing(false);
      setRecording(null);
    }
  };

  const moveToNextVerse = async () => {
    const chapterKey = currentSurah.toString();
    const verses: Verse[] = quranData[chapterKey] || [];
    const maxAyah = verses.length;

    if (currentAyah < maxAyah) {
      // Move to next ayah in same surah
      const nextAyah = currentAyah + 1;
      setCurrentAyah(nextAyah);
      await saveProgress(currentSurah, nextAyah);
    } else {
      // Move to next surah
      if (currentSurah < 114) {
        const nextSurah = currentSurah + 1;
        setCurrentSurah(nextSurah);
        setCurrentAyah(1);
        await saveProgress(nextSurah, 1);
      } else {
        Alert.alert('Congratulations!', 'You have completed all verses!');
      }
    }
  };

  const handleCloseModal = () => {
    setTestResult(null);
    setTranscribedText('');
    if (recording) {
      recording.stopAndUnloadAsync();
      setRecording(null);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Test Modal - Always visible based on design */}
      <Modal
        visible={true}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Test Your Recitation</Text>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Verse Display */}
            <View style={styles.verseContainer}>
              <Text style={styles.verseText}>{verseText}</Text>
            </View>

            {/* Instruction */}
            <Text style={styles.instruction}>
              Tap the button and begin reciting.
            </Text>

            {/* Recording Button */}
            <View style={styles.buttonContainer}>
              {isProcessing ? (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color="#4A90E2" />
                  <Text style={styles.processingText}>Processing...</Text>
                </View>
              ) : isRecording ? (
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={stopRecording}
                >
                  <Text style={styles.stopButtonText}>Stop & Test</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={startRecording}
                >
                  <Text style={styles.recordButtonIcon}>🎙️</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Result Display */}
            {testResult && (
              <View style={styles.resultContainer}>
                {testResult === 'pass' ? (
                  <>
                    <Text style={styles.resultTextSuccess}>Correct! ✓</Text>
                    <Text style={styles.resultSubtext}>
                      Moving to next verse...
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.resultTextFail}>Try again</Text>
                    {transcribedText && (
                      <Text style={styles.transcriptionText}>
                        Heard: {transcribedText}
                      </Text>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Recording Indicator */}
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Recording...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  verseContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  verseText: {
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 45,
  },
  verseReference: {
    fontSize: 16,
    color: '#999999',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    paddingBottom: 40,
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  instruction: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  recordButtonActive: {
    backgroundColor: '#E74C3C',
  },
  recordButtonIcon: {
    fontSize: 50,
    color: '#FFFFFF',
  },
  stopButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 150,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    marginTop: 15,
    fontSize: 16,
  },
  resultContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  resultTextSuccess: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  resultTextFail: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 10,
  },
  resultSubtext: {
    fontSize: 16,
    color: '#999999',
  },
  transcriptionText: {
    fontSize: 14,
    color: '#999999',
    marginTop: 10,
    textAlign: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E74C3C',
    marginRight: 8,
  },
  recordingText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: '600',
  },
});

