/**
 * Whisper Server API Client
 * Sends audio files to a remote Whisper server for transcription
 */

import { WHISPER_SERVER_CONFIG } from '../config/whisper-server';
import * as FileSystem from 'expo-file-system/legacy';

export interface WhisperOptions {
  language?: string;
  task?: 'transcribe' | 'translate';
}

export interface WhisperServerConfig {
  baseUrl: string;
  timeout?: number;
}

class WhisperServerService {
  private config: WhisperServerConfig;
  private defaultTimeout = 120000; // 120 seconds (2 minutes) for CPU inference

  constructor(config?: WhisperServerConfig) {
    this.config = {
      baseUrl: config?.baseUrl || WHISPER_SERVER_CONFIG.baseUrl,
      timeout: config?.timeout || WHISPER_SERVER_CONFIG.timeout || this.defaultTimeout,
    };
  }

  /**
   * Check if server is available and model is loaded
   */
  async checkHealth(): Promise<{ healthy: boolean; modelLoaded: boolean }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { healthy: false, modelLoaded: false };
      }

      const data = await response.json();
      return {
        healthy: true,
        modelLoaded: data.model_loaded === true,
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return { healthy: false, modelLoaded: false };
    }
  }

  /**
   * Transcribe audio file using the Whisper server
   * @param audioUri - URI of the audio file to transcribe
   * @param options - Transcription options
   * @returns Transcribed text
   */
  async transcribe(
    audioUri: string,
    options: WhisperOptions = {}
  ): Promise<string> {
    const { language = 'ar', task = 'transcribe' } = options;

    try {
      console.log('Transcribing audio via server:', audioUri);
      console.log('Server URL:', this.config.baseUrl);
      console.log('Language:', language);

      // Read the audio file
      const fileInfo = await this.readAudioFile(audioUri);
      
      if (!fileInfo.exists) {
        throw new Error('Audio file not found');
      }
      
      // Create FormData for multipart upload (React Native format)
      const formData = new FormData();
      
      // React Native FormData format
      formData.append('file', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'audio.wav',
      } as any);
      
      // Build URL with query parameters
      const url = new URL(`${this.config.baseUrl}/transcribe`);
      url.searchParams.append('language', language);
      url.searchParams.append('task', task);

      console.log('Sending request to:', url.toString());

      // Send request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(url.toString(), {
          method: 'POST',
          body: formData,
          headers: {
            // Don't set Content-Type - let fetch set it with boundary
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Server error: ${response.status}`;
          
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.detail || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }

          throw new Error(errorMessage);
        }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Transcription failed');
      }

      // Handle both old and new API response formats
      const transcribedText = result.text || '';
      console.log('Transcription result:', transcribedText);

      return transcribedText.trim();
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Transcription timeout - server took too long to respond');
        }
        throw fetchError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Transcription error:', errorMessage);
      
      // Provide helpful error messages
      if (errorMessage.includes('Network request failed') || 
          errorMessage.includes('Failed to fetch')) {
        throw new Error(
          'Cannot connect to Whisper server. Please check:\n' +
          `1. Server is running at ${this.config.baseUrl}\n` +
          '2. Your device has internet connection\n' +
          '3. Server URL is correct in app configuration\n' +
          '4. Try restarting the app to reload configuration'
        );
      }
      
      throw error;
    }
  }

  /**
   * Read audio file and get file info
   */
  private async readAudioFile(uri: string): Promise<{ exists: boolean; size?: number }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return {
        exists: fileInfo.exists,
        size: fileInfo.size,
      };
    } catch (error) {
      console.warn('Could not read file info:', error);
      return { exists: false };
    }
  }

  /**
   * Update server configuration
   */
  updateConfig(config: Partial<WhisperServerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current server URL
   */
  getServerUrl(): string {
    return this.config.baseUrl;
  }
}

// Create singleton instance with default config
export const whisperServerService = new WhisperServerService();

