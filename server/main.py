"""
Whisper Transcription Server
FastAPI server for transcribing audio using PyTorch Whisper models
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import whisper
import torch
import os
import tempfile
import logging
from pathlib import Path
from typing import Optional
import uvicorn
import urllib.request
import shutil

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Whisper Transcription API", version="1.0.0")

# CORS middleware - allow requests from your React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your app's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
whisper_model = None
model_path = None

def load_model(model_file: str = "whisper_tiny_ar_quran.pt"):
    """Load the Whisper model"""
    global whisper_model, model_path
    
    # Try multiple possible locations
    possible_paths = [
        model_file,  # Current directory
        f"models/{model_file}",  # models/ subdirectory
        f"../models/{model_file}",  # Parent models/ directory
        f"assets/models/{model_file}",  # assets/models/ directory
    ]
    
    model_path = None
    for path in possible_paths:
        if os.path.exists(path):
            model_path = path
            break
    
    # If model not found locally, try downloading from URL
    if not model_path:
        download_url = os.getenv("MODEL_DOWNLOAD_URL")
        if download_url:
            logger.info(f"Model not found locally. Attempting to download from: {download_url}")
            # Create models directory if it doesn't exist
            os.makedirs("models", exist_ok=True)
            model_path = f"models/{model_file}"
            
            try:
                logger.info(f"Downloading model to {model_path}...")
                
                # Handle Google Drive links - convert to direct download
                if "drive.google.com" in download_url:
                    # Extract file ID from Google Drive URL
                    file_id = None
                    if "/file/d/" in download_url:
                        file_id = download_url.split("/file/d/")[1].split("/")[0]
                    elif "id=" in download_url:
                        file_id = download_url.split("id=")[1].split("&")[0]
                    
                    if file_id:
                        # Convert to direct download URL
                        download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
                        logger.info(f"Converted Google Drive link to direct download: {download_url}")
                
                # Download with progress and error handling
                def show_progress(block_num, block_size, total_size):
                    if total_size > 0:
                        percent = min(100, (block_num * block_size * 100) // total_size)
                        if percent % 10 == 0:  # Log every 10%
                            logger.info(f"Download progress: {percent}%")
                
                urllib.request.urlretrieve(download_url, model_path, show_progress)
                logger.info(f"✓ Model downloaded successfully to {model_path}")
            except Exception as e:
                logger.error(f"Failed to download model: {e}")
                raise FileNotFoundError(
                    f"Model file '{model_file}' not found locally and download failed. "
                    f"Searched in: {', '.join(possible_paths)}. "
                    f"Download URL: {download_url}"
                )
        else:
            raise FileNotFoundError(
                f"Model file '{model_file}' not found. Searched in: {', '.join(possible_paths)}. "
                f"Set MODEL_DOWNLOAD_URL environment variable to download from URL."
            )
    
    logger.info(f"Loading Whisper model from: {model_path}")
    
    try:
        # Load PyTorch model
        # If it's a custom fine-tuned model, use whisper.load_model with the path
        # If it's a standard Whisper model name, use that instead
        if model_file.endswith('.pt'):
            # Try loading as custom model first
            try:
                whisper_model = whisper.load_model(model_path)
            except Exception as e:
                logger.warning(f"Failed to load as custom model: {e}")
                # Fallback: try loading as standard Whisper model name
                # Extract model name from filename (e.g., "tiny" from "whisper_tiny_ar_quran.pt")
                model_name = "tiny"  # Default fallback
                if "tiny" in model_file.lower():
                    model_name = "tiny"
                elif "base" in model_file.lower():
                    model_name = "base"
                elif "small" in model_file.lower():
                    model_name = "small"
                elif "medium" in model_file.lower():
                    model_name = "medium"
                elif "large" in model_file.lower():
                    model_name = "large"
                
                logger.info(f"Loading standard Whisper model: {model_name}")
                whisper_model = whisper.load_model(model_name)
        else:
            # Standard Whisper model name
            whisper_model = whisper.load_model(model_file)
        
        logger.info("✓ Whisper model loaded successfully")
        return whisper_model
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        raise

@app.on_event("startup")
async def startup_event():
    """Load model on server startup"""
    model_file = os.getenv("WHISPER_MODEL", "whisper_tiny_ar_quran.pt")
    try:
        load_model(model_file)
    except Exception as e:
        logger.error(f"Failed to load model on startup: {e}")
        logger.warning("Server will start but transcription will fail until model is loaded")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "model_loaded": whisper_model is not None,
        "model_path": model_path
    }

@app.get("/health")
async def health():
    """Health check with model status"""
    return {
        "status": "healthy",
        "model_loaded": whisper_model is not None,
        "model_path": model_path,
        "device": "cuda" if torch.cuda.is_available() else "cpu"
    }

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = "ar",
    task: Optional[str] = "transcribe"
):
    """
    Transcribe audio file
    
    Args:
        file: Audio file (WAV, MP3, M4A, etc.)
        language: Language code (default: "ar" for Arabic)
        task: "transcribe" or "translate" (default: "transcribe")
    
    Returns:
        JSON with transcribed text
    """
    if whisper_model is None:
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
            logger.info(f"Language: {language}, Task: {task}")
            
            # Transcribe using Whisper
            result = whisper_model.transcribe(
                tmp_file_path,
                language=language if language != "auto" else None,
                task=task
            )
            
            # Extract text from result
            transcribed_text = result.get("text", "").strip()
            
            logger.info(f"Transcription successful: {transcribed_text[:50]}...")
            
            return JSONResponse({
                "success": True,
                "text": transcribed_text,
                "language": result.get("language", language),
                "segments": result.get("segments", [])
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
async def reload_model(model_file: Optional[str] = None):
    """Reload the Whisper model (useful for updating models without restarting server)"""
    global whisper_model, model_path
    
    try:
        model_to_load = model_file or os.getenv("WHISPER_MODEL", "whisper_tiny_ar_quran.pt")
        load_model(model_to_load)
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
    # Get configuration from environment variables
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"Starting Whisper server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)

