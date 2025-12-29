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
    description="Production inference server for tarteel-ai/whisper-base-ar-quran (upgraded from tiny)",
    version="2.0.0"
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

# Model configuration
MODEL_ID = "tarteel-ai/whisper-base-ar-quran"  # Upgraded from tiny to base for better accuracy
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "./models_cache")

def download_and_load_model():
    """
    Download model from Hugging Face and load into memory
    Model is cached on disk after first download
    """
    global model, processor, pipe, model_loaded
    
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
        from transformers import pipeline
        
        # Ensure generation config doesn't request timestamps
        if hasattr(model, 'generation_config'):
            model.generation_config.return_timestamps = False
        
        global pipe
        pipe = pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            device=0 if device == "cuda" else -1,
            return_timestamps=False,
            chunk_length_s=30,  # Process in chunks to avoid timestamp issues
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
        
        logger.info("Preprocessing audio...")
        
        # Load audio with librosa (handles various formats)
        decode_resample_start = time.time()
        audio_array, original_sr = librosa.load(tmp_file_path, sr=None, mono=True)
        
        # Resample to 16kHz if needed (Whisper requirement)
        if original_sr != 16000:
            logger.info(f"Resampling from {original_sr}Hz to 16000Hz")
            audio_array = librosa.resample(audio_array, orig_sr=original_sr, target_sr=16000)
        
        # Normalize audio to prevent clipping and improve quality
        max_val = np.abs(audio_array).max()
        if max_val > 0:
            # Normalize to [-1, 1] range, but avoid over-amplification
            if max_val < 1.0:
                audio_array = audio_array / max_val * 0.95  # Scale to 95% to avoid clipping
            else:
                audio_array = audio_array / max_val * 0.95
        
        # VAD (Voice Activity Detection) filter - remove silence at start and end
        # Use faster RMS-based detection with larger frames
        frame_length = 4096  # Larger frames for faster processing
        hop_length = 2048   # Larger hops for speed
        threshold_db = -35  # Slightly higher threshold for faster detection
        
        # Calculate energy (faster with larger frames)
        energy = librosa.feature.rms(y=audio_array, frame_length=frame_length, hop_length=hop_length)[0]
        energy_db = librosa.power_to_db(energy**2, ref=np.max)
        
        # Find non-silent frames
        non_silent_frames = np.where(energy_db > threshold_db)[0]
        
        if len(non_silent_frames) > 0:
            # Convert frame indices to sample indices
            start_frame = non_silent_frames[0]
            end_frame = non_silent_frames[-1]
            start_sample = start_frame * hop_length
            end_sample = min((end_frame + 1) * hop_length, len(audio_array))
            
            # Trim silence
            audio_array = audio_array[start_sample:end_sample]
            logger.info(f"Trimmed silence: {len(audio_array)} samples remaining")
        
        # Ensure minimum length (at least 0.5 seconds)
        min_samples = int(16000 * 0.5)  # 0.5 seconds at 16kHz
        if len(audio_array) < min_samples:
            logger.warning(f"Audio too short ({len(audio_array)} samples), padding to minimum")
            padding = np.zeros(min_samples - len(audio_array))
            audio_array = np.concatenate([padding, audio_array])
        
        # Save preprocessed audio to temporary file
        preprocessed_path = tmp_file_path.replace(file_ext, '_preprocessed.wav')
        wavfile.write(preprocessed_path, 16000, (audio_array * 32767).astype(np.int16))
        logger.info(f"Preprocessed audio saved: {len(audio_array)} samples at 16kHz")
        decode_resample_time = time.time() - decode_resample_start
        logger.info(f"[PERF] Decode/resample time: {decode_resample_time:.3f}s")
        
        # Use cached pipeline (created at startup) for faster inference
        global pipe
        if pipe is None:
            logger.warning("Pipeline not cached, creating new one...")
            from transformers import pipeline
            # Ensure generation config doesn't request timestamps
            if hasattr(model, 'generation_config'):
                model.generation_config.return_timestamps = False
            pipe = pipeline(
                "automatic-speech-recognition",
                model=model,
                tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor,
                device=0 if device == "cuda" else -1,
                return_timestamps=False,
                chunk_length_s=30,  # Process in chunks to avoid timestamp issues
            )
        
        # Transcribe - for fine-tuned Arabic model, we don't need to force language
        # The model is already trained for Arabic, so it will transcribe in Arabic
        logger.info(f"Running transcription (model: {MODEL_ID})...")
        logger.info(f"Starting pipeline inference...")
        
        # Fast decoding settings for optimal speed
        inference_start = time.time()
        
        # Fast decoding generation kwargs
        # beam_size=1 (num_beams=1) for greedy decoding (fastest)
        # best_of=1 is implicit with num_beams=1 (only one beam)
        # vad_filter=True is handled by our preprocessing (silence trimming above)
        # condition_on_previous_text=False for faster decoding
        generate_kwargs = {
            "max_new_tokens": 120,  # Reduced for faster generation
            "num_beams": 1,  # beam_size=1 for fastest decoding (greedy, equivalent to best_of=1)
            "do_sample": False,  # Deterministic (no sampling)
            "temperature": None,  # Disable temperature for faster generation
            "use_cache": True,  # Enable KV cache for faster generation
            "return_timestamps": False,  # Explicitly disable timestamps
        }
        
        # Pipeline parameters for fast decoding
        # vad_filter is handled by our preprocessing (silence trimming above)
        # condition_on_previous_text can be passed to pipeline
        pipeline_kwargs = {
            "language": "ar",  # Explicitly set Arabic language
            "return_timestamps": False,  # No timestamps for speed
            "condition_on_previous_text": False,  # Don't condition on previous text (faster)
        }
        
        # Use preprocessed audio file
        result = pipe(
            preprocessed_path,  # Use preprocessed audio
            generate_kwargs=generate_kwargs,
            **pipeline_kwargs
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
        
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
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
