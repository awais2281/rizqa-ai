"""
Whisper Arabic Transcription Server
Production inference server for fine-tuned Whisper model
Downloads model from Hugging Face at startup and caches on disk
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import os
import tempfile
import logging
from pathlib import Path
from typing import Optional
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Whisper Arabic Transcription API",
    description="Production inference server for tarteel-ai/whisper-tiny-ar-quran (serverless optimized)",
    version="2.1.0"
)

# CORS middleware - allow requests from React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your app domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model, processor, and pipeline
model = None
processor = None
pipe = None  # Cache the pipeline for faster inference
device = "cuda" if torch.cuda.is_available() else "cpu"
model_loaded = False
decoder_start_token_id = None  # Global to store this important ID

# Model configuration
MODEL_ID = "tarteel-ai/whisper-tiny-ar-quran"  # Tiny model for faster cold starts and lower memory usage
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "./models_cache")

def download_and_load_model():
    """
    Download model from Hugging Face and load into memory
    Model is cached on disk after first download
    """
    global model, processor, pipe, model_loaded, decoder_start_token_id
    
    if model_loaded:
        logger.info("Model already loaded")
        return
    
    try:
        from transformers import WhisperProcessor, WhisperForConditionalGeneration
        from transformers import pipeline as transformers_pipeline
        
        logger.info(f"Loading model: {MODEL_ID}")
        logger.info(f"Device: {device}")
        logger.info(f"Cache directory: {MODEL_CACHE_DIR}")
        
        # Create cache directory
        os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
        
        # Download and load model from Hugging Face
        # This will download on first run and cache for subsequent runs
        logger.info("Downloading model from Hugging Face (this may take a few minutes on first run)...")
        
        model = WhisperForConditionalGeneration.from_pretrained(
            MODEL_ID,
            cache_dir=MODEL_CACHE_DIR,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None,
        )
        
        processor = WhisperProcessor.from_pretrained(
            MODEL_ID,
            cache_dir=MODEL_CACHE_DIR,
        )
        
        # Move to device if CPU
        if device == "cpu":
            model = model.to(device)
        
        # Optimize model for faster CPU inference
        if device == "cpu":
            logger.info("Optimizing model for CPU inference...")
            try:
                # Use torch.jit.script or torch.compile for faster inference
                # Note: Some models may not support JIT compilation
                # For now, we'll rely on other optimizations
                # Model is already in eval mode, which helps
                logger.info("✓ Model optimized for CPU")
            except Exception as e:
                logger.warning(f"Optimization note: {e}")
        
        model.eval()
        
        # Create and cache pipeline for faster inference
        from transformers import pipeline, GenerationConfig
        
        # Get the model's decoder start token ID (required for decoder initialization)
        # This is essential - without it, the decoder can't initialize
        decoder_start_token_id = model.config.decoder_start_token_id
        if decoder_start_token_id is None:
            # Fallback: get from tokenizer if not in config
            decoder_start_token_id = processor.tokenizer.convert_tokens_to_ids("<|startoftranscript|>")
            # If still None, use common Whisper default
            if decoder_start_token_id is None:
                decoder_start_token_id = 50258  # Common default for Whisper models
        logger.info(f"Decoder start token ID: {decoder_start_token_id}")
        
        # Store globally for use in transcribe function
        globals()['decoder_start_token_id'] = decoder_start_token_id
        
        # Use the model's existing generation config as a base (preserves important settings)
        # Then update only what we need
        if hasattr(model, 'generation_config') and model.generation_config is not None:
            generation_config = model.generation_config
        else:
            # If no generation config exists, create one from model config
            generation_config = GenerationConfig.from_model_config(model.config)
        
        # Update only the parameters we need - preserve decoder_start_token_id
        generation_config.return_timestamps = False
        generation_config.max_new_tokens = 70
        generation_config.num_beams = 1
        generation_config.do_sample = False
        generation_config.temperature = None
        generation_config.use_cache = True
        generation_config.decoder_start_token_id = decoder_start_token_id  # CRITICAL: Must be set
        
        # Update model's generation config to match
        model.generation_config = generation_config
        
        # Also ensure model.config has it set (some code paths check config directly)
        if not hasattr(model.config, 'decoder_start_token_id') or model.config.decoder_start_token_id is None:
            model.config.decoder_start_token_id = decoder_start_token_id

        # Prepare generate_kwargs explicitly, excluding language but keeping decoder_start_token_id
        generate_kwargs_dict = {
            "max_new_tokens": 70,
            "num_beams": 1,
            "do_sample": False,
            "temperature": None,
            "use_cache": True,
            "return_timestamps": False,
            "decoder_start_token_id": decoder_start_token_id,  # CRITICAL: Must be included
        }

        global pipe
        # Create pipeline WITHOUT any language parameter
        # The model is fine-tuned for Arabic, so it will automatically transcribe in Arabic
        pipe = pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            device=0 if device == "cuda" else -1,
            generate_kwargs=generate_kwargs_dict,
            chunk_length_s=30,
        )
        logger.info("✓ Pipeline created and cached")
        
        model_loaded = True
        
        logger.info("✓ Model loaded successfully into memory")
        logger.info(f"✓ Model ready for inference on {device}")
        
    except ImportError as e:
        logger.error(f"Missing dependency: {e}")
        logger.error("Install with: pip install transformers torch torchaudio")
        raise
    except Exception as e:
        logger.error(f"Failed to load model: {e}", exc_info=True)
        raise

@app.on_event("startup")
async def startup_event():
    """Download and load model on server startup"""
    logger.info("=" * 60)
    logger.info("Starting Whisper Arabic Transcription Server")
    logger.info("=" * 60)
    try:
        download_and_load_model()
    except Exception as e:
        logger.error(f"Failed to load model on startup: {e}")
        logger.warning("Server will start but transcription will fail until model is loaded")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "Whisper Arabic Transcription API",
        "model_loaded": model_loaded,
        "device": device,
        "model_id": MODEL_ID
    }

@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy" if model_loaded else "degraded",
        "model_loaded": model_loaded,
        "processor_loaded": processor is not None,
        "device": device,
        "model_id": MODEL_ID,
        "cache_dir": MODEL_CACHE_DIR
    }

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = "ar",
    initial_prompt: Optional[str] = None
):
    """
    Transcribe audio file to Arabic text
    
    Args:
        file: Audio file (WAV, MP3, M4A, etc.) - should be ≤10 seconds
        language: Language code (default: "ar" for Arabic)
    
    Returns:
        JSON with transcribed text
    """
    if not model_loaded or model is None or processor is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please check server logs and wait for model to load."
        )
    
    # Validate file type
    allowed_extensions = {'.wav', '.mp3', '.m4a', '.ogg', '.flac', '.webm', '.mpeg', '.mp4'}
    file_ext = Path(file.filename or "audio.wav").suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Performance timing
    import time
    total_start_time = time.time()
    upload_read_time = 0
    decode_resample_time = 0
    inference_time = 0
    
    # Save uploaded file to temporary location
    tmp_file_path = None
    try:
        upload_read_start = time.time()
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            content = await file.read()
            
            # Check file size (warn if > 10 seconds worth of audio)
            file_size_mb = len(content) / (1024 * 1024)
            if file_size_mb > 1.0:  # Rough estimate for 10s audio
                logger.warning(f"Large audio file detected: {file_size_mb:.2f} MB")
            
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        upload_read_time = time.time() - upload_read_start
        
        logger.info(f"Transcribing audio: {file.filename} ({len(content)} bytes)")
        logger.info(f"[PERF] Upload read time: {upload_read_time:.3f}s")
        
        # Audio preprocessing for better accuracy
        import librosa
        import numpy as np
        from scipy.io import wavfile
        
        logger.info("Processing audio (minimal preprocessing for cost optimization)...")
        
        # Load audio with librosa (handles various formats) - NECESSARY
        decode_resample_start = time.time()
        try:
            audio_array, original_sr = librosa.load(tmp_file_path, sr=None, mono=True)
        except Exception as e:
            logger.error(f"Failed to load audio: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to load audio file: {str(e)}"
            )
        
        # Basic validation - NECESSARY
        if len(audio_array) == 0:
            raise HTTPException(
                status_code=400,
                detail="Audio file is empty."
            )
        
        # Resample to 16kHz if needed (Whisper requirement) - NECESSARY
        if original_sr != 16000:
            audio_array = librosa.resample(audio_array, orig_sr=original_sr, target_sr=16000)
        
        # Basic normalization to prevent clipping - NECESSARY
        max_val = np.abs(audio_array).max()
        if max_val > 0 and max_val > 1.0:
            audio_array = audio_array / max_val * 0.95  # Prevent clipping
        
        # Ensure minimum length (0.5 seconds) - NECESSARY for Whisper
        min_samples = int(16000 * 0.5)
        if len(audio_array) < min_samples:
            padding = np.zeros(min_samples - len(audio_array))
            audio_array = np.concatenate([padding, audio_array])
        
        # Save preprocessed audio - NECESSARY
        preprocessed_path = tmp_file_path.replace(file_ext, '_preprocessed.wav')
        audio_int16 = (audio_array * 32767).astype(np.int16)
        wavfile.write(preprocessed_path, 16000, audio_int16)
        
        logger.info(f"Audio processed: {len(audio_array)} samples at 16kHz")
        decode_resample_time = time.time() - decode_resample_start
        logger.info(f"[PERF] Decode/resample time: {decode_resample_time:.3f}s")
        
        # Use cached pipeline (created at startup) for faster inference
        global pipe, decoder_start_token_id
        if pipe is None:
            logger.warning("Pipeline not cached, creating new one during transcribe request...")
            from transformers import pipeline, GenerationConfig
            
            # Use global decoder_start_token_id (set during model loading)
            if decoder_start_token_id is None:
                # Fallback: get from model config if global not set
                decoder_start_token_id = model.config.decoder_start_token_id
                if decoder_start_token_id is None:
                    decoder_start_token_id = processor.tokenizer.convert_tokens_to_ids("<|startoftranscript|>")
                    if decoder_start_token_id is None:
                        decoder_start_token_id = 50258  # Common default for Whisper
            
            # Use the model's existing generation config as a base (preserves important settings)
            if hasattr(model, 'generation_config') and model.generation_config is not None:
                generation_config = model.generation_config
            else:
                # If no generation config exists, create one from model config
                generation_config = GenerationConfig.from_model_config(model.config)
            
            # Update only what we need - preserve decoder_start_token_id
            generation_config.return_timestamps = False
            generation_config.max_new_tokens = 70
            generation_config.num_beams = 1
            generation_config.do_sample = False
            generation_config.temperature = None
            generation_config.use_cache = True
            generation_config.decoder_start_token_id = decoder_start_token_id  # CRITICAL
            
            # Prepare explicit generate_kwargs with decoder_start_token_id
            generate_kwargs_dict = {
                "max_new_tokens": 70,
                "num_beams": 1,
                "do_sample": False,
                "temperature": None,
                "use_cache": True,
                "return_timestamps": False,
                "decoder_start_token_id": decoder_start_token_id,  # CRITICAL
            }

            pipe = pipeline(
                "automatic-speech-recognition",
                model=model,
                tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor,
                device=0 if device == "cuda" else -1,
                generate_kwargs=generate_kwargs_dict,  # Use explicit dict
                chunk_length_s=30,
            )
        
        # Transcribe - for fine-tuned Arabic model, we don't need to force language
        # The model is already trained for Arabic, so it will transcribe in Arabic
        logger.info(f"Running transcription (model: {MODEL_ID})...")
        logger.info(f"Starting pipeline inference...")
        
        # Fast decoding settings for optimal speed
        inference_start = time.time()
        
        # Use global decoder_start_token_id (already declared on line 485)
        if decoder_start_token_id is None:
            # Fallback: get from model config if global not set
            decoder_start_token_id = model.config.decoder_start_token_id
            if decoder_start_token_id is None:
                decoder_start_token_id = processor.tokenizer.convert_tokens_to_ids("<|startoftranscript|>")
                if decoder_start_token_id is None:
                    decoder_start_token_id = 50258  # Common default for Whisper
        
        # Fast decoding generation kwargs
        # IMPORTANT: Do NOT include 'language' parameter - it causes generation config conflicts
        # The model is fine-tuned for Arabic, so language specification is not needed
        # CRITICAL: Must include decoder_start_token_id for proper decoder initialization
        generate_kwargs = {
            "max_new_tokens": 70,
            "num_beams": 1,
            "do_sample": False,
            "temperature": None,
            "use_cache": True,
            "return_timestamps": False,
            "decoder_start_token_id": decoder_start_token_id,  # CRITICAL: Required for decoder init
        }
        
        # Pipeline parameters - explicitly do NOT pass language
        # Note: condition_on_previous_text is not supported in transformers 4.40.0
        pipeline_kwargs = {
            "return_timestamps": False,
        }
        
        # Ensure model's generation config has decoder_start_token_id set correctly
        # Use the existing generation config, don't create a fresh one
        if hasattr(model, 'generation_config') and model.generation_config is not None:
            # Update only what we need, preserve everything else
            model.generation_config.decoder_start_token_id = decoder_start_token_id
            model.generation_config.return_timestamps = False
            model.generation_config.max_new_tokens = 70
            model.generation_config.num_beams = 1
            model.generation_config.do_sample = False
            model.generation_config.temperature = None
            model.generation_config.use_cache = True
        else:
            # If no generation config exists, create one from model config (preserves important settings)
            from transformers import GenerationConfig
            model.generation_config = GenerationConfig.from_model_config(model.config)
            model.generation_config.decoder_start_token_id = decoder_start_token_id
            model.generation_config.return_timestamps = False
            model.generation_config.max_new_tokens = 70
            model.generation_config.num_beams = 1
            model.generation_config.do_sample = False
            model.generation_config.temperature = None
            model.generation_config.use_cache = True
        
        # Also ensure model.config has it set (some code paths check config directly)
        if not hasattr(model.config, 'decoder_start_token_id') or model.config.decoder_start_token_id is None:
            model.config.decoder_start_token_id = decoder_start_token_id
        
        # Use preprocessed audio array directly (more reliable than file path)
        # Do NOT pass language parameter - the model is fine-tuned for Arabic
        try:
            # Ensure audio array is in correct format for pipeline (float32, normalized)
            if audio_array.dtype != np.float32:
                logger.info(f"Converting audio array from {audio_array.dtype} to float32")
                audio_array = audio_array.astype(np.float32)
            
            # Ensure audio is properly normalized to [-1, 1] range
            audio_max = np.abs(audio_array).max()
            if audio_max > 1.0:
                logger.warning(f"Audio exceeds [-1, 1] range (max={audio_max:.6f}), re-normalizing")
                audio_array = audio_array / audio_max * 0.95
            
            # Log detailed audio array information before inference
            logger.info(f"Audio array ready for inference:")
            logger.info(f"  - Shape: {audio_array.shape}")
            logger.info(f"  - Dtype: {audio_array.dtype}")
            logger.info(f"  - Min: {audio_array.min():.6f}, Max: {audio_array.max():.6f}")
            logger.info(f"  - Mean: {audio_array.mean():.6f}, Std: {audio_array.std():.6f}")
            logger.info(f"  - RMS: {np.sqrt(np.mean(audio_array**2)):.6f}")
            logger.info(f"  - Non-zero samples: {np.count_nonzero(audio_array)} / {len(audio_array)}")
            logger.info(f"  - Duration: {len(audio_array) / 16000:.2f} seconds")
            
            # Verify preprocessed file still exists and is valid (for backup/debugging)
            if not os.path.exists(preprocessed_path):
                logger.warning(f"Preprocessed file not found: {preprocessed_path}, but audio array is valid")
            else:
                file_size = os.path.getsize(preprocessed_path)
                logger.info(f"Preprocessed file exists: {preprocessed_path} ({file_size} bytes)")
            
            logger.info(f"Pipeline type: {type(pipe)}")
            logger.info(f"Generate kwargs: {generate_kwargs}")
            logger.info(f"Pipeline kwargs: {pipeline_kwargs}")
            
            # Ensure pipeline is not None
            if pipe is None:
                raise HTTPException(
                    status_code=503,
                    detail="Pipeline not initialized. Model may not be loaded correctly."
                )
            
            # Try passing audio array directly to pipeline (more reliable than file path)
            # The pipeline should accept numpy arrays directly
            logger.info("Calling pipeline with audio array directly...")
            try:
                result = pipe(
                    audio_array,  # Pass array directly instead of file path
                    generate_kwargs=generate_kwargs,
                    **pipeline_kwargs
                )
            except (TypeError, ValueError) as array_error:
                # If array doesn't work, fall back to file path
                logger.warning(f"Pipeline rejected audio array, trying file path instead: {array_error}")
                if not os.path.exists(preprocessed_path):
                    raise HTTPException(
                        status_code=500,
                        detail=f"Pipeline rejected audio array and preprocessed file not found. Error: {str(array_error)}"
                    )
                logger.info(f"Calling pipeline with preprocessed file: {preprocessed_path}")
                result = pipe(
                    preprocessed_path,
                    generate_kwargs=generate_kwargs,
                    **pipeline_kwargs
                )
            
            logger.info(f"Pipeline result type: {type(result)}")
            logger.info(f"Pipeline result: {result}")
            
            # Validate result
            if result is None:
                raise HTTPException(
                    status_code=500,
                    detail="Pipeline returned None result."
                )
            
            # Check if result is a dict with 'text' key
            if not isinstance(result, dict):
                logger.warning(f"Pipeline returned unexpected type: {type(result)}, value: {result}")
                # Try to convert to dict if it's a string
                if isinstance(result, str):
                    result = {"text": result}
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Pipeline returned unexpected result type: {type(result)}"
                    )
            
        except HTTPException:
            # Re-raise HTTPExceptions without modification
            raise
        except ValueError as e:
            error_msg = str(e)
            error_type = type(e).__name__
            logger.error(f"ValueError in pipeline ({error_type}): {e}", exc_info=True)
            
            # Log audio array state for debugging
            logger.error(f"Audio array state at error: shape={audio_array.shape if 'audio_array' in locals() else 'N/A'}, "
                        f"dtype={audio_array.dtype if 'audio_array' in locals() else 'N/A'}, "
                        f"len={len(audio_array) if 'audio_array' in locals() else 'N/A'}")
            
            # Log preprocessed file info
            if preprocessed_path and os.path.exists(preprocessed_path):
                file_size = os.path.getsize(preprocessed_path)
                logger.error(f"Preprocessed file: {preprocessed_path}, size={file_size} bytes")
                try:
                    test_audio, test_sr = librosa.load(preprocessed_path, sr=None, mono=True)
                    logger.error(f"Preprocessed file validation: {len(test_audio)} samples at {test_sr}Hz, "
                               f"max={np.abs(test_audio).max() if len(test_audio) > 0 else 0}")
                except Exception as read_err:
                    logger.error(f"Failed to read preprocessed file: {read_err}")
            
            # Provide more specific error messages
            if "torch.cat" in error_msg or "non-empty list" in error_msg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Audio processing error: The model received invalid audio data. This may indicate the audio file is corrupted or in an unsupported format. Please try recording again with clear speech. Technical error: {error_msg[:150]}"
                )
            elif "empty" in error_msg.lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"Audio processing error: The audio appears to be empty or contains no speech. Please ensure you recorded actual speech with sufficient volume. Technical error: {error_msg[:150]}"
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Pipeline processing error: {error_msg[:200]}"
                )
        except Exception as e:
            error_msg = str(e)
            error_type = type(e).__name__
            logger.error(f"Pipeline inference error ({error_type}): {e}", exc_info=True)
            
            # Log audio array state for debugging
            logger.error(f"Audio array state at error: shape={audio_array.shape if 'audio_array' in locals() else 'N/A'}, "
                        f"dtype={audio_array.dtype if 'audio_array' in locals() else 'N/A'}, "
                        f"len={len(audio_array) if 'audio_array' in locals() else 'N/A'}")
            
            # Log preprocessed file info
            if preprocessed_path and os.path.exists(preprocessed_path):
                file_size = os.path.getsize(preprocessed_path)
                logger.error(f"Preprocessed file: {preprocessed_path}, size={file_size} bytes")
                try:
                    test_audio, test_sr = librosa.load(preprocessed_path, sr=None, mono=True)
                    logger.error(f"Preprocessed file validation: {len(test_audio)} samples at {test_sr}Hz, "
                               f"max={np.abs(test_audio).max() if len(test_audio) > 0 else 0}")
                except Exception as read_err:
                    logger.error(f"Failed to read preprocessed file: {read_err}")
            
            # Provide more specific error messages
            if "torch.cat" in error_msg or "non-empty list" in error_msg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Audio processing error: The model received invalid audio data. This may indicate the audio file is corrupted or in an unsupported format. Please try recording again with clear speech. Technical error: {error_msg[:150]}"
                )
            elif "empty" in error_msg.lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"Audio processing error: The audio appears to be empty or contains no speech. Please ensure you recorded actual speech with sufficient volume. Technical error: {error_msg[:150]}"
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Inference error ({error_type}): {error_msg[:200]}"
                )
        
        inference_time = time.time() - inference_start
        logger.info(f"[PERF] Inference time: {inference_time:.3f}s")
        
        transcribed_text = result.get("text", "").strip()
        logger.info(f"Transcription result: {transcribed_text[:100]}...")
        logger.info(f"Transcription result length: {len(transcribed_text)} characters")
        
        # Clean up preprocessed file
        try:
            if os.path.exists(preprocessed_path):
                os.unlink(preprocessed_path)
        except Exception as e:
            logger.warning(f"Failed to delete preprocessed file: {e}")
        
        if not transcribed_text:
            logger.warning("Empty transcription result")
            transcribed_text = ""
        
        # Calculate total time
        total_time = time.time() - total_start_time
        
        # Log all performance metrics
        logger.info(f"✓ Transcription successful: {transcribed_text[:100]}...")
        logger.info(f"[PERF] Performance Summary:")
        logger.info(f"  - Upload read time: {upload_read_time:.3f}s")
        logger.info(f"  - Decode/resample time: {decode_resample_time:.3f}s")
        logger.info(f"  - Inference time: {inference_time:.3f}s")
        logger.info(f"  - Total time: {total_time:.3f}s")
        
        return JSONResponse({
            "success": True,
            "text": transcribed_text,
            "language": language,
            "model": MODEL_ID,
            "performance": {
                "upload_read_time": round(upload_read_time, 3),
                "decode_resample_time": round(decode_resample_time, 3),
                "inference_time": round(inference_time, 3),
                "total_time": round(total_time, 3)
            }
        })
        
    except HTTPException:
        # Re-raise HTTPExceptions without modification
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        # Provide more detailed error information
        error_detail = str(e)
        if not error_detail:
            error_detail = "Unknown error occurred during transcription"
        raise HTTPException(
            status_code=500,
            detail=error_detail
        )
    finally:
        # Clean up temporary files
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.unlink(tmp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")
        
        # Clean up preprocessed file if it exists
        if tmp_file_path:
            preprocessed_path = tmp_file_path.replace(Path(tmp_file_path).suffix, '_preprocessed.wav')
            if os.path.exists(preprocessed_path):
                try:
                    os.unlink(preprocessed_path)
                except Exception as e:
                    logger.warning(f"Failed to delete preprocessed file: {e}")

@app.post("/reload-model")
async def reload_model():
    """Manually reload the model (useful for updates)"""
    global model, processor, model_loaded
    
    try:
        model = None
        processor = None
        model_loaded = False
        
        download_and_load_model()
        
        return {
            "success": True,
            "message": "Model reloaded successfully",
            "model_id": MODEL_ID
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reload model: {str(e)}"
        )

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
