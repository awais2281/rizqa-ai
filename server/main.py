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
import urllib.parse
import shutil
import zipfile
import tarfile
import gzip
import re
import http.cookiejar
# gdown is imported above (after logger initialization)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check for gdown availability (after logger is initialized)
try:
    import gdown
    GDOWN_AVAILABLE = True
    logger.info("✓ gdown library is available for Google Drive downloads")
except ImportError:
    GDOWN_AVAILABLE = False
    logger.warning("⚠ gdown library not available - will use urllib for downloads")

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
                
                # Handle Dropbox links - ensure direct download
                if "dropbox.com" in download_url:
                    # Dropbox: change ?dl=0 or &dl=0 to ?dl=1 or &dl=1 for direct download
                    if "&dl=0" in download_url:
                        download_url = download_url.replace("&dl=0", "&dl=1")
                        logger.info(f"Converted Dropbox link to direct download (changed &dl=0 to &dl=1)")
                    elif "?dl=0" in download_url:
                        download_url = download_url.replace("?dl=0", "?dl=1")
                        logger.info(f"Converted Dropbox link to direct download (changed ?dl=0 to ?dl=1)")
                    elif "?dl=" not in download_url and "&dl=" not in download_url:
                        # Only add if not already present
                        if "?" in download_url:
                            download_url = download_url + "&dl=1"
                        else:
                            download_url = download_url + "?dl=1"
                        logger.info(f"Added direct download parameter to Dropbox link")
                    # If dl=1 already exists, don't modify
                    elif "dl=1" in download_url:
                        logger.info(f"Dropbox link already has direct download enabled")
                
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
                last_percent = -1
                def show_progress(block_num, block_size, total_size):
                    nonlocal last_percent
                    if total_size > 0:
                        percent = min(100, (block_num * block_size * 100) // total_size)
                        # Log every 5% or at key milestones
                        if percent != last_percent and (percent % 5 == 0 or percent in [1, 10, 25, 50, 75, 90, 95, 99, 100]):
                            logger.info(f"Download progress: {percent}% ({block_num * block_size / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB)")
                            last_percent = percent
                
                # Use gdown for Google Drive downloads (handles large files better)
                if "drive.google.com" in download_url and GDOWN_AVAILABLE:
                    logger.info("Using gdown for Google Drive download (better for large files)")
                    try:
                        # Extract file ID from URL
                        file_id = None
                        if "/file/d/" in download_url:
                            file_id = download_url.split("/file/d/")[1].split("/")[0]
                        elif "id=" in download_url:
                            file_id = download_url.split("id=")[1].split("&")[0]
                        
                        if file_id:
                            # Use gdown to download - specify output path explicitly
                            gdrive_url = f"https://drive.google.com/uc?id={file_id}"
                            logger.info(f"Downloading with gdown from file ID: {file_id} to {model_path}")
                            
                            # Ensure output directory exists
                            os.makedirs(os.path.dirname(model_path), exist_ok=True)
                            
                            # Download with gdown - use output parameter
                            result = gdown.download(gdrive_url, output=model_path, quiet=False, fuzzy=True)
                            
                            # Check if file was actually downloaded
                            if os.path.exists(model_path) and os.path.getsize(model_path) > 0:
                                file_size = os.path.getsize(model_path)
                                logger.info(f"✓ Download completed with gdown ({file_size / (1024*1024):.1f} MB)")
                            else:
                                raise FileNotFoundError(f"gdown reported success but file not found at {model_path}")
                        else:
                            raise ValueError("Could not extract file ID from Google Drive URL")
                    except Exception as e:
                        logger.error(f"gdown failed: {e}")
                        logger.info("Falling back to urllib method...")
                        # Fall back to urllib method
                        req = urllib.request.Request(download_url)
                        req.add_header('User-Agent', 'Mozilla/5.0')
                        urllib.request.urlretrieve(download_url, model_path, show_progress)
                else:
                    # Use standard urllib for non-Google Drive or if gdown not available
                    req = urllib.request.Request(download_url)
                    req.add_header('User-Agent', 'Mozilla/5.0')
                    urllib.request.urlretrieve(download_url, model_path, show_progress)
                
                # Check if we got an HTML page instead of the actual file (Google Drive large file warning)
                with open(model_path, 'rb') as f:
                    first_bytes = f.read(100)
                    if first_bytes.startswith(b'<') or b'<html' in first_bytes.lower():
                        logger.warning("Downloaded file appears to be HTML. Google Drive may require confirmation for large files.")
                        logger.info("Attempting alternative download method...")
                        
                        # Try with confirm parameter for large files
                        if "drive.google.com" in download_url and "confirm=" not in download_url:
                            # Add confirm parameter to bypass virus scan warning
                            download_url_with_confirm = download_url + "&confirm=t"
                            logger.info(f"Retrying with confirm parameter: {download_url_with_confirm}")
                            urllib.request.urlretrieve(download_url_with_confirm, model_path, show_progress)
                            
                            # Check again
                            with open(model_path, 'rb') as f2:
                                first_bytes = f2.read(100)
                                if first_bytes.startswith(b'<') or b'<html' in first_bytes.lower():
                                    raise ValueError("Failed to download model file - Google Drive returned HTML instead of file. File may be too large or access restricted.")
                
                # Verify file size (should be > 1MB for a model file)
                file_size = os.path.getsize(model_path)
                if file_size < 1024 * 1024:  # Less than 1MB
                    raise ValueError(f"Downloaded file is too small ({file_size} bytes). Expected model file to be much larger.")
                
                logger.info(f"✓ File downloaded successfully ({file_size / (1024*1024):.1f} MB)")
                
                # Check if downloaded file is a compressed archive and extract it
                extracted_model_path = model_path
                
                # First, check if the file is actually a .pt file (not an archive)
                # by checking the file signature/magic bytes
                with open(model_path, 'rb') as f:
                    first_bytes = f.read(4)
                    # PyTorch .pt files typically start with specific bytes
                    # ZIP files start with PK (0x50 0x4B)
                    is_zip = first_bytes[:2] == b'PK'
                    
                if is_zip and zipfile.is_zipfile(model_path):
                    logger.info("Detected ZIP archive. Extracting...")
                    with zipfile.ZipFile(model_path, 'r') as zip_ref:
                        # List all files in archive for debugging
                        all_files = zip_ref.namelist()
                        logger.info(f"Files in archive: {all_files}")
                        
                        # Look for .pt file in the archive (case-insensitive)
                        pt_files = [f for f in all_files if f.lower().endswith('.pt')]
                        
                        if pt_files:
                            # Extract the first .pt file found
                            extracted_file = pt_files[0]
                            zip_ref.extract(extracted_file, os.path.dirname(model_path))
                            extracted_model_path = os.path.join(os.path.dirname(model_path), extracted_file)
                            logger.info(f"✓ Extracted {extracted_file} from ZIP archive")
                            # Remove the zip file to save space
                            os.remove(model_path)
                        else:
                            # Maybe the file is named differently - list what's actually there
                            logger.error(f"ZIP archive does not contain a .pt file. Files found: {all_files}")
                            raise ValueError(f"ZIP archive does not contain a .pt model file. Found files: {all_files}")
                elif not is_zip:
                    # File is not a ZIP, assume it's the .pt file itself
                    logger.info("File appears to be a .pt model file (not an archive)")
                    extracted_model_path = model_path
                elif model_path.endswith('.tar.gz') or model_path.endswith('.tgz'):
                    logger.info("Detected TAR.GZ archive. Extracting...")
                    with tarfile.open(model_path, 'r:gz') as tar_ref:
                        # Look for .pt file in the archive
                        pt_files = [f for f in tar_ref.getnames() if f.endswith('.pt')]
                        if pt_files:
                            tar_ref.extract(pt_files[0], os.path.dirname(model_path))
                            extracted_model_path = os.path.join(os.path.dirname(model_path), pt_files[0])
                            logger.info(f"✓ Extracted {pt_files[0]} from TAR.GZ archive")
                            os.remove(model_path)
                        else:
                            raise ValueError("TAR.GZ archive does not contain a .pt model file")
                elif model_path.endswith('.tar'):
                    logger.info("Detected TAR archive. Extracting...")
                    with tarfile.open(model_path, 'r') as tar_ref:
                        pt_files = [f for f in tar_ref.getnames() if f.endswith('.pt')]
                        if pt_files:
                            tar_ref.extract(pt_files[0], os.path.dirname(model_path))
                            extracted_model_path = os.path.join(os.path.dirname(model_path), pt_files[0])
                            logger.info(f"✓ Extracted {pt_files[0]} from TAR archive")
                            os.remove(model_path)
                        else:
                            raise ValueError("TAR archive does not contain a .pt model file")
                elif model_path.endswith('.gz') and not model_path.endswith('.tar.gz'):
                    logger.info("Detected GZIP archive. Extracting...")
                    with gzip.open(model_path, 'rb') as gz_ref:
                        # Assume the extracted file should be .pt
                        extracted_model_path = model_path[:-3]  # Remove .gz extension
                        with open(extracted_model_path, 'wb') as out_file:
                            out_file.write(gz_ref.read())
                        logger.info(f"✓ Extracted from GZIP archive")
                        os.remove(model_path)
                
                # Update model_path to point to extracted file if archive was extracted
                if extracted_model_path != model_path:
                    model_path = extracted_model_path
                    logger.info(f"Using extracted model file: {model_path}")
                
                logger.info(f"✓ Model file ready at {model_path} ({os.path.getsize(model_path) / (1024*1024):.1f} MB)")
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

