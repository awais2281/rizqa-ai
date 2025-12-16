"""
Whisper Transcription Server using Hugging Face Transformers
FastAPI server for transcribing Arabic audio using fine-tuned Whisper model
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
import urllib.request
import zipfile
import gdown

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Whisper Arabic Transcription API", version="2.0.0")

# CORS middleware - allow requests from your React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your app's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model and processor variables
model = None
processor = None
device = "cuda" if torch.cuda.is_available() else "cpu"

def download_model(model_url: str, model_path: str) -> str:
    """
    Download model from URL (Dropbox, Google Drive, etc.)
    Returns the path to the downloaded model file
    """
    logger.info(f"Downloading model from: {model_url}")
    
    # Handle Dropbox links
    if "dropbox.com" in model_url:
        if "&dl=0" in model_url:
            model_url = model_url.replace("&dl=0", "&dl=1")
        elif "?dl=0" in model_url:
            model_url = model_url.replace("?dl=0", "?dl=1")
        elif "?dl=" not in model_url and "&dl=" not in model_url:
            if "?" in model_url:
                model_url = model_url + "&dl=1"
            else:
                model_url = model_url + "?dl=1"
    
    # Download the file
    def show_progress(block_num, block_size, total_size):
        if total_size > 0:
            percent = min(100, (block_num * block_size * 100) // total_size)
            if percent % 10 == 0:
                logger.info(f"Download progress: {percent}%")
    
    try:
        req = urllib.request.Request(model_url)
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        urllib.request.urlretrieve(model_url, model_path, show_progress)
        
        file_size = os.path.getsize(model_path) / (1024 * 1024)
        logger.info(f"✓ Model downloaded successfully ({file_size:.1f} MB)")
        
        # Check if it's a ZIP file and extract if needed
        if zipfile.is_zipfile(model_path):
            logger.info("Detected ZIP archive. Extracting...")
            extract_dir = os.path.splitext(model_path)[0]
            os.makedirs(extract_dir, exist_ok=True)
            
            with zipfile.ZipFile(model_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            # Look for .pt file or model directory
            for root, dirs, files in os.walk(extract_dir):
                if any(f.endswith('.pt') for f in files):
                    model_path = os.path.join(root, [f for f in files if f.endswith('.pt')][0])
                    logger.info(f"Found .pt file: {model_path}")
                    break
                elif 'pytorch_model.bin' in files or 'model.safetensors' in files:
                    model_path = root
                    logger.info(f"Found model directory: {model_path}")
                    break
            
            # Remove ZIP file
            os.remove(model_path + '.zip' if model_path.endswith('.pt') else model_path)
        
        return model_path
        
    except Exception as e:
        logger.error(f"Failed to download model: {e}")
        raise

def load_model(model_path: str):
    """
    Load Whisper model using Hugging Face transformers
    """
    global model, processor
    
    try:
        from transformers import WhisperProcessor, WhisperForConditionalGeneration
        
        logger.info(f"Loading model from: {model_path}")
        logger.info(f"Using device: {device}")
        
        # Check if model_path is a directory (Hugging Face format) or a single file
        if os.path.isdir(model_path):
            # Load from Hugging Face directory format
            logger.info("Loading from Hugging Face directory format...")
            model = WhisperForConditionalGeneration.from_pretrained(
                model_path,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                device_map="auto" if device == "cuda" else None,
            )
            processor = WhisperProcessor.from_pretrained(model_path)
        elif model_path.endswith('.pt'):
            # Load from single .pt file
            logger.info("Loading from single .pt file...")
            # For single .pt files, we need to know the base model
            # Try to infer from filename or use tiny as default
            base_model = "openai/whisper-tiny"
            if "tiny" in model_path.lower():
                base_model = "openai/whisper-tiny"
            elif "base" in model_path.lower():
                base_model = "openai/whisper-base"
            elif "small" in model_path.lower():
                base_model = "openai/whisper-small"
            
            logger.info(f"Using base model: {base_model}")
            
            # Load base model first
            model = WhisperForConditionalGeneration.from_pretrained(
                base_model,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                device_map="auto" if device == "cuda" else None,
            )
            
            # Load fine-tuned weights
            state_dict = torch.load(model_path, map_location=device)
            model.load_state_dict(state_dict)
            
            processor = WhisperProcessor.from_pretrained(base_model)
        else:
            raise ValueError(f"Unknown model format: {model_path}")
        
        if device == "cpu":
            model = model.to(device)
        
        model.eval()
        logger.info("✓ Model loaded successfully")
        
    except ImportError:
        logger.error("transformers library not installed. Install with: pip install transformers")
        raise
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        raise

@app.on_event("startup")
async def startup_event():
    """Load model on server startup"""
    model_url = os.getenv("MODEL_DOWNLOAD_URL")
    model_file = os.getenv("WHISPER_MODEL", "whisper_ar_tiny_quran_single.pt")
    
    if not model_url:
        logger.warning("MODEL_DOWNLOAD_URL not set. Model will not be loaded.")
        return
    
    try:
        # Create models directory
        os.makedirs("models", exist_ok=True)
        model_path = f"models/{model_file}"
        
        # Download model if not exists
        if not os.path.exists(model_path):
            download_model(model_url, model_path)
        else:
            logger.info(f"Model already exists at: {model_path}")
        
        # Load the model
        load_model(model_path)
        
    except Exception as e:
        logger.error(f"Failed to load model on startup: {e}")
        logger.warning("Server will start but transcription will fail until model is loaded")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "model_loaded": model is not None,
        "device": device
    }

@app.get("/health")
async def health():
    """Health check with model status"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "processor_loaded": processor is not None,
        "device": device
    }

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = "ar"
):
    """
    Transcribe audio file to Arabic text
    
    Args:
        file: Audio file (WAV, MP3, M4A, etc.) - should be <10 seconds
        language: Language code (default: "ar" for Arabic)
    
    Returns:
        JSON with transcribed text
    """
    if model is None or processor is None:
        raise HTTPException(
            status_code=503,
            detail="Whisper model not loaded. Please check server logs."
        )
    
    # Validate file type
    allowed_extensions = {'.wav', '.mp3', '.m4a', '.ogg', '.flac', '.webm'}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save uploaded file to temporary location
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
        try:
            # Write file content
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
            
            logger.info(f"Transcribing audio file: {file.filename} ({len(content)} bytes)")
            logger.info(f"Language: {language}")
            
            # Load and process audio
            from transformers import pipeline
            
            # Create transcription pipeline
            pipe = pipeline(
                "automatic-speech-recognition",
                model=model,
                tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor,
                device=0 if device == "cuda" else -1,
            )
            
            # Transcribe
            result = pipe(tmp_file_path, return_timestamps=False, language=language)
            
            transcribed_text = result.get("text", "").strip()
            
            logger.info(f"Transcription successful: {transcribed_text[:50]}...")
            
            return JSONResponse({
                "success": True,
                "text": transcribed_text,
                "language": language
            })
            
        except Exception as e:
            logger.error(f"Transcription error: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Transcription failed: {str(e)}"
            )
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_file_path)
            except:
                pass

@app.post("/reload-model")
async def reload_model():
    """Reload the Whisper model"""
    global model, processor
    
    model_url = os.getenv("MODEL_DOWNLOAD_URL")
    model_file = os.getenv("WHISPER_MODEL", "whisper_ar_tiny_quran_single.pt")
    
    if not model_url:
        raise HTTPException(status_code=400, detail="MODEL_DOWNLOAD_URL not set")
    
    try:
        model_path = f"models/{model_file}"
        download_model(model_url, model_path)
        load_model(model_path)
        return {
            "success": True,
            "message": f"Model reloaded successfully: {model_path}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reload model: {str(e)}"
        )

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"Starting Whisper server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
