// Whisper Integration Service using whisper.rn
// This service handles loading and running the Whisper GGML model on-device

import { Whisper } from 'whisper.rn';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

export interface WhisperOptions {
  language?: string;
  task?: 'transcribe' | 'translate';
}

export class WhisperService {
  private modelLoaded: boolean = false;
  private whisper: Whisper | null = null;
  private modelPath: string = '';

  /**
   * Load the Whisper model from local storage
   */
  async loadModel(): Promise<void> {
    if (this.modelLoaded && this.whisper) {
      return;
    }

    try {
      console.log('Loading Whisper GGML model...');

      // Initialize Whisper
      this.whisper = new Whisper();

      // Get the model file path
      // The model should be copied to document directory for whisper.rn to access
      const modelFileName = 'ggml-tiny.bin';
      const docPath = `${FileSystem.documentDirectory}${modelFileName}`;
      
      // Check if model exists in document directory
      const fileInfo = await FileSystem.getInfoAsync(docPath);
      
      if (!fileInfo.exists) {
        // Try to copy from assets/bundle to document directory
        // First, check if it's in the bundle
        try {
          // For Expo, we need to copy the model file to document directory
          // The model file should be in the models folder
          const bundlePath = `${FileSystem.bundleDirectory}../models/${modelFileName}`;
          const bundleInfo = await FileSystem.getInfoAsync(bundlePath);
          
          if (bundleInfo.exists) {
            // Copy to document directory
            await FileSystem.copyAsync({
              from: bundlePath,
              to: docPath,
            });
            console.log('Model copied to document directory');
          } else {
            // Try using Asset
            try {
              const asset = Asset.fromModule(require('../../models/ggml-tiny.bin'));
              await asset.downloadAsync();
              if (asset.localUri) {
                await FileSystem.copyAsync({
                  from: asset.localUri,
                  to: docPath,
                });
                console.log('Model copied from assets to document directory');
              }
            } catch (assetError) {
              throw new Error(`Model file not found. Please ensure ${modelFileName} is accessible.`);
            }
          }
        } catch (copyError) {
          console.error('Error copying model:', copyError);
          throw new Error(`Could not access model file. Please ensure ${modelFileName} is in the models folder.`);
        }
      }
      
      this.modelPath = docPath;

      // Initialize Whisper with the model
      await this.whisper.init(this.modelPath);

      this.modelLoaded = true;
      console.log('Whisper model loaded successfully from:', this.modelPath);
    } catch (error) {
      console.error('Error loading Whisper model:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio file using Whisper
   * @param audioUri - URI of the audio file to transcribe
   * @param options - Transcription options
   * @returns Transcribed text
   */
  async transcribe(audioUri: string, options: WhisperOptions = {}): Promise<string> {
    if (!this.modelLoaded || !this.whisper) {
      await this.loadModel();
    }

    try {
      const { language = 'ar' } = options;

      console.log('Transcribing audio:', audioUri);
      console.log('Language:', language);

      if (!this.whisper) {
        throw new Error('Whisper not initialized');
      }

      // Transcribe the audio file
      // whisper.rn transcribe method returns the transcription
      const result = await this.whisper.transcribe(audioUri, {
        language: language,
        translate: false, // We want transcription, not translation
      });

      // Extract text from result
      // The format may vary, so we handle different possible return types
      let transcribedText = '';
      
      if (typeof result === 'string') {
        transcribedText = result;
      } else if (result && result.text) {
        transcribedText = result.text;
      } else if (result && Array.isArray(result) && result.length > 0) {
        // If result is an array of segments, join them
        transcribedText = result.map((segment: any) => 
          segment.text || segment
        ).join(' ');
      }

      console.log('Transcription result:', transcribedText);

      return transcribedText.trim();
    } catch (error) {
      console.error('Transcription error:', error);
      // Return empty string on error to allow UI to show "Try again"
      return '';
    }
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  /**
   * Release resources
   */
  async release(): Promise<void> {
    if (this.whisper) {
      try {
        await this.whisper.release();
      } catch (error) {
        console.error('Error releasing Whisper:', error);
      }
      this.whisper = null;
      this.modelLoaded = false;
    }
  }
}

// Export singleton instance
export const whisperService = new WhisperService();
