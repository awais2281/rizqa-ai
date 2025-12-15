// Whisper Integration Service using whisper.rn
// This service handles loading and running the Whisper GGML model on-device

// Try to import whisper.rn - requires development build
// Note: The warning about exports is harmless - it falls back to file-based resolution
let initWhisper: any = null;
let WhisperContext: any = null;
try {
  // Use direct require - the warning is expected and harmless
  // The module will work via file-based resolution fallback
  const whisperModule = require('whisper.rn');
  initWhisper = whisperModule.initWhisper;
  WhisperContext = whisperModule.WhisperContext;
} catch (error) {
  console.warn('whisper.rn not available - requires development build:', error);
}
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

// Ensure model asset is bundled by Metro
// Metro requires static require() paths (cannot use variables)
// Try to require the primary model, fallback will be handled at runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
let _bundledWhisperModel: any = null;
try {
  // Primary: pytorch_model.bin from assets/models/
  _bundledWhisperModel = require('../../assets/models/pytorch_model.bin');
} catch (e1) {
  try {
    // Fallback: pytorch_model.bin from models/
    _bundledWhisperModel = require('../../models/pytorch_model.bin');
  } catch (e2) {
    try {
      // Fallback: ggml-small-q5_1.bin from assets/models/
      _bundledWhisperModel = require('../../assets/models/ggml-small-q5_1.bin');
    } catch (e3) {
      try {
        // Fallback: ggml-small-q5_1.bin from models/
        _bundledWhisperModel = require('../../models/ggml-small-q5_1.bin');
      } catch (e4) {
        // If all require() calls fail, model will be loaded via FileSystem at runtime
        // This is fine - the model loading logic will handle it
      }
    }
  }
}

export interface WhisperOptions {
  language?: string;
  task?: 'transcribe' | 'translate';
}

export class WhisperService {
  private modelLoaded: boolean = false;
  private whisperContext: any = null;
  private modelPath: string = '';
  private loadError: Error | null = null; // Cache load errors to avoid repeated attempts

  /**
   * Load the Whisper model from local storage
   */
  async loadModel(silent: boolean = false): Promise<void> {
    if (this.modelLoaded && this.whisperContext) {
      return;
    }

    // If we've already failed to load and this is a silent attempt, don't retry
    if (this.loadError && silent) {
      throw this.loadError;
    }

    try {
      if (!silent) {
        console.log('Loading Whisper model...');
      }

      // Check if Whisper is available (requires development build)
      if (!initWhisper) {
        const error = new Error(
          'Whisper requires a development build. Run: eas build --profile development --platform android'
        );
        this.loadError = error;
        throw error;
      }

      // Load model using Asset API and copy to document directory
      // This is the most reliable approach for bundled assets
      // Prioritize pytorch_model.bin (new model), fallback to ggml-small-q5_1.bin if needed
      const modelFileNames = ['pytorch_model.bin', 'ggml-small-q5_1.bin'];
      let modelFileName = '';
      let docPath = '';
      let copied = false;
      
      // First, check if any model already exists in document directory
      for (const fileName of modelFileNames) {
        const checkPath = `${FileSystem.documentDirectory}${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(checkPath);
        if (fileInfo.exists) {
          modelFileName = fileName;
          docPath = checkPath;
          this.modelPath = docPath;
          if (!silent) {
            console.log(`✓ Model found in document directory: ${fileName}`);
          }
          copied = true;
          break;
        }
      }
      
      // If not found in document directory, try to copy from bundle
      if (!copied) {
        if (!silent) {
          console.log('Copying model from bundle to document directory...');
        }
        
        // Try each model filename until we find one
        // Metro requires static require() paths, so we use try-catch with static paths
        for (const fileName of modelFileNames) {
          modelFileName = fileName;
          docPath = `${FileSystem.documentDirectory}${fileName}`;
          
          // Method 1: Try Asset API with static require() paths
          // Try pytorch_model.bin first, then ggml-small-q5_1.bin
          if (!silent) {
            console.log(`Trying to load ${fileName} via Asset API...`);
          }
          
          let assetModule: any = null;
          
          // Try assets/models/ location with static require paths
          if (fileName === 'pytorch_model.bin') {
            try {
              assetModule = require('../../assets/models/pytorch_model.bin');
            } catch (e) {
              // Try models/ folder
              try {
                assetModule = require('../../models/pytorch_model.bin');
              } catch (e2) {
                // Continue to bundle paths
              }
            }
          } else if (fileName === 'ggml-small-q5_1.bin') {
            try {
              assetModule = require('../../assets/models/ggml-small-q5_1.bin');
            } catch (e) {
              // Try models/ folder
              try {
                assetModule = require('../../models/ggml-small-q5_1.bin');
              } catch (e2) {
                // Continue to bundle paths
              }
            }
          }
          
          if (assetModule) {
            try {
              if (!silent) {
                console.log(`✓ Found model via require() for ${fileName}`);
              }
              const modelAsset = Asset.fromModule(assetModule);
              
              // Try to download the asset
              try {
                await modelAsset.downloadAsync();
              } catch (downloadError) {
                if (!silent) {
                  console.log(`Asset download failed (may already be available):`, downloadError instanceof Error ? downloadError.message : String(downloadError));
                }
                // Continue - asset might already be available
              }
              
              if (modelAsset.localUri) {
                let sourceUri = modelAsset.localUri;
                if (!silent) {
                  console.log('Asset localUri:', sourceUri);
                }
                
                // Try multiple copy strategies
                let copySuccess = false;
                
                // Strategy 1: Try with full URI (including file:// if present)
                try {
                  if (!silent) {
                    console.log('Attempting copy with URI:', sourceUri);
                  }
                  await FileSystem.copyAsync({
                    from: sourceUri,
                    to: docPath,
                  });
                  copySuccess = true;
                  if (!silent) {
                    console.log(`✓ Model copied via Asset API (URI) (${fileName})`);
                  }
                } catch (uriError) {
                  if (!silent) {
                    console.log(`Copy with URI failed:`, uriError instanceof Error ? uriError.message : String(uriError));
                  }
                  
                  // Strategy 2: Try removing file:// prefix
                  let sourcePath = sourceUri;
                  if (sourcePath.startsWith('file://')) {
                    sourcePath = sourcePath.slice(7);
                  }
                  try {
                    if (!silent) {
                      console.log('Attempting copy with path (no file://):', sourcePath);
                    }
                    await FileSystem.copyAsync({
                      from: sourcePath,
                      to: docPath,
                    });
                    copySuccess = true;
                    if (!silent) {
                      console.log(`✓ Model copied via Asset API (path) (${fileName})`);
                    }
                  } catch (pathError) {
                    if (!silent) {
                      console.log(`Copy with path failed:`, pathError instanceof Error ? pathError.message : String(pathError));
                    }
                    // Strategy 3: Check if file exists first, then copy
                    const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
                    if (sourceInfo.exists) {
                      try {
                        await FileSystem.copyAsync({
                          from: sourceUri,
                          to: docPath,
                        });
                        copySuccess = true;
                        if (!silent) {
                          console.log(`✓ Model copied after existence check (${fileName})`);
                        }
                      } catch (finalError) {
                        if (!silent) {
                          console.log(`Final copy attempt failed:`, finalError instanceof Error ? finalError.message : String(finalError));
                        }
                      }
                    } else {
                      // Check path version
                      const pathInfo = await FileSystem.getInfoAsync(sourcePath);
                      if (pathInfo.exists) {
                        try {
                          await FileSystem.copyAsync({
                            from: sourcePath,
                            to: docPath,
                          });
                          copySuccess = true;
                          if (!silent) {
                            console.log(`✓ Model copied with path after existence check (${fileName})`);
                          }
                        } catch (finalPathError) {
                          if (!silent) {
                            console.log(`Final path copy failed:`, finalPathError instanceof Error ? finalPathError.message : String(finalPathError));
                          }
                        }
                      }
                    }
                  }
                }
                
                if (copySuccess) {
                  this.modelPath = docPath;
                  copied = true;
                  break;
                } else {
                  if (!silent) {
                    console.log(`All copy strategies failed for ${fileName}`);
                  }
                }
              } else {
                if (!silent) {
                  console.log('Asset localUri is null after download');
                }
              }
            } catch (assetError) {
              if (!silent) {
                console.log(`Asset API processing failed for ${fileName}:`, assetError instanceof Error ? assetError.message : String(assetError));
              }
              // Continue to bundle paths
            }
          }
          
          // Method 2: Try direct bundle paths (if Asset API failed for this filename)
          if (!copied) {
            if (!silent) {
              console.log(`Trying direct bundle paths for ${fileName}...`);
              console.log('Bundle directory:', FileSystem.bundleDirectory);
            }
            const bundlePaths = [
              `${FileSystem.bundleDirectory}assets/models/${fileName}`,
              `${FileSystem.bundleDirectory}models/${fileName}`,
              `${FileSystem.bundleDirectory}${fileName}`,
            ];
            
            for (const bundlePath of bundlePaths) {
              try {
                if (!silent) {
                  console.log('Checking bundle path:', bundlePath);
                }
                const bundleInfo = await FileSystem.getInfoAsync(bundlePath);
                if (bundleInfo.exists) {
                  if (!silent) {
                    console.log('✓ Found model at:', bundlePath);
                  }
                  await FileSystem.copyAsync({
                    from: bundlePath,
                    to: docPath,
                  });
                  this.modelPath = docPath;
                  copied = true;
                  if (!silent) {
                    console.log(`✓ Model copied from bundle (${fileName})`);
                  }
                  break;
                } else {
                  if (!silent) {
                    console.log('  Path does not exist');
                  }
                }
              } catch (err) {
                if (!silent) {
                  console.log('  Error checking path:', err instanceof Error ? err.message : String(err));
                }
                continue;
              }
            }
            
            // If we found it via bundle paths, break out of filename loop
            if (copied) {
              break;
            }
          }
        }
        
        if (!copied) {
          // Model not found - cache the error
          const triedFiles = modelFileNames.join(', ');
          const errorMsg = 
            `Whisper model not found in app bundle.\n\n` +
            `Tried: ${triedFiles}\n\n` +
            `Expected locations:\n` +
            `- assets/models/pytorch_model.bin (primary)\n` +
            `- models/pytorch_model.bin\n` +
            `- assets/models/ggml-small-q5_1.bin (fallback)\n` +
            `- models/ggml-small-q5_1.bin\n\n` +
            `To fix:\n` +
            `1. Place the model file (pytorch_model.bin) in assets/models/ folder\n` +
            `2. Rebuild: eas build --profile development --platform android --clear-cache\n` +
            `3. Make sure app.json includes "assets/**" in assetBundlePatterns`;
          const error = new Error(errorMsg);
          this.loadError = error;
          if (!silent) {
            console.error(errorMsg);
          }
          throw error;
        }
      }
      
      const modelPathOrAsset = this.modelPath;

      // Initialize Whisper with the model
      // Use the file path (always a string after copying to document directory)
      // Note: whisper.rn requires GGML/GGUF format models, not PyTorch models
      try {
        this.whisperContext = await initWhisper({
          filePath: modelPathOrAsset,
          isBundleAsset: false, // Always false since we copy to document directory
        });
      } catch (initError) {
        const initErrorMsg = initError instanceof Error ? initError.message : String(initError);
        
        // Check if this is a model format error (PyTorch vs GGML)
        if (initErrorMsg.includes('Failed to initialize') || 
            initErrorMsg.includes('initialize context') ||
            initErrorMsg.includes('invalid model') ||
            initErrorMsg.includes('unsupported format')) {
          
          // Check if we're trying to use a PyTorch model
          if (modelFileName.includes('pytorch') || modelFileName.includes('PyTorch')) {
            const formatError = new Error(
              `Model format incompatible: whisper.rn requires GGML/GGUF format models, but found PyTorch model (${modelFileName}).\n\n` +
              `Solutions:\n` +
              `1. Convert your PyTorch model to GGML/GGUF format using whisper.cpp tools\n` +
              `2. Use a GGML model instead (e.g., ggml-base.bin, ggml-small.bin, ggml-tiny.bin)\n` +
              `3. Download a GGML model from: https://huggingface.co/ggerganov/whisper.cpp\n\n` +
              `Recommended: Use ggml-base.bin or ggml-small.bin for better accuracy.\n` +
              `Place the GGML model file in assets/models/ and update the code to use it.`
            );
            this.loadError = formatError;
            if (!silent) {
              console.error(formatError.message);
            }
            throw formatError;
          }
        }
        
        // Re-throw other initialization errors
        throw initError;
      }

      this.modelLoaded = true;
      this.loadError = null; // Clear any previous errors
      if (!silent) {
        console.log('✓ Whisper model loaded successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.loadError = error instanceof Error ? error : new Error(String(error));
      if (!silent) {
        console.error('Error loading Whisper model:', errorMsg);
      }
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
    if (!this.modelLoaded || !this.whisperContext) {
      await this.loadModel();
    }

    try {
      const { language = 'ar' } = options;

      console.log('Transcribing audio:', audioUri);
      console.log('Language:', language);

      if (!this.whisperContext) {
        throw new Error('Whisper not initialized');
      }

      // Transcribe the audio file using WhisperContext
      // The transcribe method returns { stop, promise }
      // Remove file:// prefix if present
      let audioPath = audioUri;
      if (audioPath.startsWith('file://')) {
        audioPath = audioPath.slice(7);
      }
      
      console.log('Calling Whisper transcribe with audio path:', audioPath);
      console.log('Language:', language);
      
      const { promise } = this.whisperContext.transcribe(audioPath, {
        language: language,
        translate: false, // We want transcription, not translation
      });

      console.log('Waiting for Whisper transcription to complete...');
      // Wait for transcription to complete
      const result = await promise;
      console.log('Whisper transcription completed. Raw result:', JSON.stringify(result, null, 2));

      // Extract text from result
      // The result should have a result property with segments
      let transcribedText = '';
      
      if (result && result.result) {
        // result.result is an array of segments
        if (Array.isArray(result.result)) {
          console.log(`Extracting text from ${result.result.length} segments`);
          transcribedText = result.result
            .map((segment: any) => segment.text || '')
            .join(' ')
            .trim();
        } else if (typeof result.result === 'string') {
          console.log('Result.result is a string');
          transcribedText = result.result;
        }
      } else if (result && result.text) {
        console.log('Using result.text');
        transcribedText = result.text;
      } else if (typeof result === 'string') {
        console.log('Result is a string');
        transcribedText = result;
      } else {
        console.warn('Unexpected result format:', result);
      }

      console.log('Final transcribed text:', transcribedText);

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
    if (this.whisperContext) {
      try {
        await this.whisperContext.release();
      } catch (error) {
        console.error('Error releasing Whisper:', error);
      }
      this.whisperContext = null;
      this.modelLoaded = false;
    }
  }
}

// Export singleton instance
export const whisperService = new WhisperService();

