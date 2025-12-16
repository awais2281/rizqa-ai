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
    description="Production inference server for tarteel-ai/whisper-tiny-ar-quran",
    version="1.0.0"
)

# CORS middleware - allow requests from React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your app domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model and processor
model = None
processor = None
device = "cuda" if torch.cuda.is_available() else "cpu"
model_loaded = False

# Model configuration
MODEL_ID = "tarteel-ai/whisper-tiny-ar-quran"
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "./models_cache")

def download_and_load_model():
    """
    Download model from Hugging Face and load into memory
    Model is cached on disk after first download
    """
    global model, processor, model_loaded
    
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
        
        model.eval()
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
    language: Optional[str] = "ar"
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
    
    # Save uploaded file to temporary location
    tmp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            content = await file.read()
            
            # Check file size (warn if > 10 seconds worth of audio)
            file_size_mb = len(content) / (1024 * 1024)
            if file_size_mb > 1.0:  # Rough estimate for 10s audio
                logger.warning(f"Large audio file detected: {file_size_mb:.2f} MB")
            
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        logger.info(f"Transcribing audio: {file.filename} ({len(content)} bytes)")
        
        # Create transcription pipeline
        from transformers import pipeline
        
        pipe = pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            device=0 if device == "cuda" else -1,
            return_timestamps=False,
        )
        
        # Transcribe with Arabic language
        logger.info(f"Running transcription (language: {language})...")
        result = pipe(tmp_file_path, language=language)
        
        transcribed_text = result.get("text", "").strip()
        
        if not transcribed_text:
            logger.warning("Empty transcription result")
            transcribed_text = ""
        
        logger.info(f"✓ Transcription successful: {transcribed_text[:100]}...")
        
        return JSONResponse({
            "success": True,
            "text": transcribed_text,
            "language": language,
            "model": MODEL_ID
        })
        
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.unlink(tmp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")

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
