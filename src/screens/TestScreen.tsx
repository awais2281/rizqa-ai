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
import * as FileSystem from 'expo-file-system/legacy';
import { whisperServerService } from '../lib/whisper-server';

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
    // Don't preload - model will load on first transcription attempt
    // This prevents console spam when model isn't bundled
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
      // Check server health first
      const health = await whisperServerService.checkHealth();
      
      if (!health.healthy) {
        throw new Error(
          'Whisper server is not available. Please check:\n' +
          `1. Server is running at ${whisperServerService.getServerUrl()}\n` +
          '2. Your device has internet connection\n' +
          '3. Server URL is correct in app configuration'
        );
      }

      if (!health.modelLoaded) {
        throw new Error(
          'Whisper model is not loaded on the server. Please check server logs.'
        );
      }

      // Use Whisper server to transcribe
      const transcription = await whisperServerService.transcribe(audioUri, {
        language: 'ar',
        task: 'transcribe',
      });
      
      return transcription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Transcription failed: ${errorMessage}`);
    }
  };

  const startRecording = async () => {
    try {
      console.log('Requesting microphone permission...');
      const permission = await Audio.requestPermissionsAsync();
      console.log('Permission result:', permission);
      
      if (!permission.granted) {
        Alert.alert(
          'Permission Required', 
          'Microphone permission is required to record audio. Please enable it in your device settings.'
        );
        return;
      }

      console.log('Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      console.log('Creating recording...');
      // Configure for PCM WAV format: 16kHz, mono, 16-bit PCM
      // Whisper model expects PCM WAV format (uncompressed, linear PCM)
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.wav',
            // On Android, .wav extension with DEFAULT format produces PCM WAV
            // MediaRecorder automatically uses PCM encoding for .wav files
            outputFormat: Audio.AndroidOutputFormat.DEFAULT,
            audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
            sampleRate: 16000, // 16kHz sample rate (required by Whisper)
            numberOfChannels: 1, // Mono channel (required by Whisper)
            bitRate: 256000, // 16-bit PCM at 16kHz mono = 256 kbps (16 bits * 16000 samples/sec)
          },
          ios: {
            extension: '.wav',
            // iOS explicitly uses LINEARPCM for PCM WAV format
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000, // 16kHz sample rate (required by Whisper)
            numberOfChannels: 1, // Mono channel (required by Whisper)
            bitRate: 256000, // 16-bit PCM at 16kHz mono = 256 kbps
            linearPCMBitDepth: 16, // 16-bit PCM (required for Whisper)
            linearPCMIsBigEndian: false, // Little-endian byte order
            linearPCMIsFloat: false, // Integer PCM, not float
          },
          web: {
            mimeType: 'audio/wav', // WAV format
            bitsPerSecond: 256000, // 16-bit PCM at 16kHz mono
          },
        }
      );

      console.log('Recording started successfully');
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to start recording:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Recording Error', 
        `Failed to start recording: ${errorMessage}\n\nPlease check:\n1. Microphone permission is granted\n2. No other app is using the microphone\n3. Try restarting the app`
      );
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      console.warn('No recording to stop');
      return;
    }

    try {
      console.log('Stopping recording...');
      setIsRecording(false);
      setIsProcessing(true);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      console.log('Recording URI:', uri);
      
      if (!uri) {
        throw new Error('No recording URI - recording may have failed');
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('Recording file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Recording file does not exist');
      }

      console.log('Starting transcription...');
      console.log('Audio file URI:', uri);
      console.log('Expected verse text:', verseText);
      
      // Transcribe with Whisper
      const transcription = await transcribeAudio(uri);
      console.log('Transcription received from Whisper:', transcription);
      
      if (!transcription || transcription.trim().length === 0) {
        console.warn('Empty transcription - Whisper may not be working');
        Alert.alert(
          'Transcription Failed',
          'Could not transcribe audio. This may be because:\n\n' +
          '1. Whisper model is not loaded\n' +
          '2. Audio quality is too poor\n' +
          '3. Development build is required (not Expo Go)\n\n' +
          'Please check the console logs for more details.'
        );
        setTestResult('fail');
        setTranscribedText('');
        return;
      }

      setTranscribedText(transcription);

      // Compare with verse text
      console.log('=== COMPARISON ===');
      console.log('Expected verse:', verseText);
      console.log('Model transcription:', transcription);
      
      const similarity = calculateSimilarity(transcription, verseText);
      console.log(`Similarity: ${similarity.toFixed(2)}%`);
      console.log('Threshold: 70%');
      console.log('==================');
      
      const passed = similarity >= 70;

      setTestResult(passed ? 'pass' : 'fail');
      
      if (passed) {
        console.log('Test passed! Moving to next verse...');
        // Wait a bit before moving to next verse
        setTimeout(async () => {
          await moveToNextVerse();
          setTestResult(null);
          setTranscribedText('');
        }, 2000);
      } else {
        console.log('Test failed - similarity below 70%');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error processing recording:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      if (errorMessage.includes('Model file not found') || 
          errorMessage.includes('Whisper') || 
          errorMessage.includes('not available')) {
        Alert.alert(
          'Whisper Not Available',
          'Whisper transcription requires a development build.\n\n' +
          'To fix this:\n' +
          '1. Run: eas build --profile development --platform android\n' +
          '2. Install the APK on your device\n' +
          '3. Open the app from the installed APK (not Expo Go)\n\n' +
          'The model file must be bundled in the app.'
        );
        setTestResult('fail');
        setTranscribedText('');
      } else {
        Alert.alert(
          'Processing Error', 
          `Failed to process recording: ${errorMessage}\n\nPlease try recording again.`
        );
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

