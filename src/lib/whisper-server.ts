/**
 * Whisper Server API Client
 * Sends audio files to a remote Whisper server for transcription
 */

import { WHISPER_SERVER_CONFIG } from '../config/whisper-server';
import * as FileSystem from 'expo-file-system/legacy';

export interface WhisperOptions {
  language?: string;
  task?: 'transcribe' | 'translate';
  initialPrompt?: string; // Initial prompt to bias transcription
}

export interface WhisperServerConfig {
  baseUrl: string;
  timeout?: number;
}

class WhisperServerService {
  private config: WhisperServerConfig;
  private defaultTimeout = 300000; // 300 seconds (5 minutes) for base model CPU inference

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
   * @param fileSizeKB - File size in KB (for logging)
   * @param durationSeconds - Duration in seconds (for logging)
   * @param sampleRate - Sample rate in Hz (for headers)
   * @returns Transcribed text
   */
  async transcribe(
    audioUri: string,
    options: WhisperOptions = {},
    fileSizeKB?: number,
    durationSeconds?: number,
    sampleRate?: number
  ): Promise<string> {
    const { language = 'ar', task = 'transcribe', initialPrompt } = options;

    // Retry logic: try once, then retry once on failure
    const maxRetries = 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[RETRY] Attempt ${attempt + 1} of ${maxRetries + 1}`);
        }

        console.log('Transcribing audio via server:', audioUri);
        console.log('Server URL:', this.config.baseUrl);
        console.log('Language:', language);

        // Read the audio file
        const fileInfo = await this.readAudioFile(audioUri);
        
        if (!fileInfo.exists) {
          throw new Error('Audio file not found');
        }

        // Log file info before upload
        const sizeKB = fileSizeKB ?? (fileInfo.size ? Math.round(fileInfo.size / 1024) : 0);
        const duration = durationSeconds ?? 0;
        const sr = sampleRate ?? 16000; // Default to 16kHz
        console.log(`[UPLOAD] File size: ${sizeKB} KB`);
        console.log(`[UPLOAD] Duration: ${duration.toFixed(2)} seconds`);
        console.log(`[UPLOAD] Format: M4A/AAC-LC (mono, ${sr}Hz)`);
        
        // Create FormData for multipart upload (React Native format)
        // Using streaming upload - no base64 conversion
        const formData = new FormData();
        
        // Determine file type from URI - should be .m4a
        const fileExtension = audioUri.split('.').pop()?.toLowerCase() || 'm4a';
        // Use audio/mp4 for M4A files (M4A is MP4 container with AAC audio)
        // M4A with AAC-LC codec uses audio/mp4 MIME type
        const mimeType = fileExtension === 'm4a' ? 'audio/mp4' : 
                        fileExtension === 'mp4' ? 'audio/mp4' :
                        fileExtension === 'wav' ? 'audio/wav' :
                        fileExtension === 'mp3' ? 'audio/mpeg' :
                        'audio/mp4'; // Default to M4A
        
        // Append file with streaming (uri-based, not base64)
        formData.append('file', {
          uri: audioUri,
          type: mimeType,
          name: `audio.${fileExtension}`,
        } as any);
        
        // Build URL with query parameters
        const url = new URL(`${this.config.baseUrl}/transcribe`);
        url.searchParams.append('language', language);
        url.searchParams.append('task', task);
        if (initialPrompt) {
          url.searchParams.append('initial_prompt', initialPrompt);
        }

        // Prepare headers with duration and sampleRate
        const headers: { [key: string]: string } = {};
        if (duration > 0) {
          headers['X-Audio-Duration'] = duration.toFixed(3); // Duration in seconds
        }
        if (sr > 0) {
          headers['X-Audio-SampleRate'] = sr.toString(); // Sample rate in Hz
        }

        console.log('Sending request to:', url.toString());
        console.log(`[UPLOAD] Content-Type: multipart/form-data (boundary auto-set)`);
        console.log(`[UPLOAD] File MIME type: ${mimeType}`);
        if (duration > 0) {
          console.log(`[UPLOAD] Header X-Audio-Duration: ${duration.toFixed(3)}s`);
        }
        if (sr > 0) {
          console.log(`[UPLOAD] Header X-Audio-SampleRate: ${sr}Hz`);
        }

        // Hard timeout with AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn(`[TIMEOUT] Request timeout after ${this.config.timeout}ms`);
          controller.abort();
        }, this.config.timeout);

        try {
          const response = await fetch(url.toString(), {
            method: 'POST',
            body: formData,
            headers: {
              // Don't set Content-Type - let fetch set it with boundary for multipart/form-data
              // This ensures proper streaming upload
              // Include custom headers for duration and sampleRate
              ...headers,
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
            throw new Error(`Transcription timeout after ${this.config.timeout}ms - server took too long to respond`);
          }
          throw fetchError;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;
        
        console.error(`[TRANSCRIBE] Attempt ${attempt + 1} failed:`, errorMessage);
        
        // If this was the last attempt, throw the error
        if (attempt >= maxRetries) {
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
          
          throw lastError;
        }
        
        // Wait a bit before retrying (exponential backoff)
        const retryDelay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`[RETRY] Waiting ${retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Transcription failed after retries');
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

