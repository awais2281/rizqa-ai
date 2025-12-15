"""
Convert Hugging Face format Whisper model to single .pt file
This script converts a model from Hugging Face directory format to a single .pt file
that can be used with openai-whisper library.
"""

import torch
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def convert_hf_to_pt(model_dir: str, output_path: str):
    """
    Convert Hugging Face format model directory to single .pt file
    
    Args:
        model_dir: Path to the pytorch_model directory
        output_path: Path where to save the .pt file
    """
    try:
        logger.info(f"Loading model from directory: {model_dir}")
        
        # Check if data.pkl exists
        data_pkl_path = os.path.join(model_dir, "data.pkl")
        if not os.path.exists(data_pkl_path):
            raise FileNotFoundError(f"data.pkl not found in {model_dir}")
        
        # Load the state dict from data.pkl
        logger.info("Loading state dict from data.pkl...")
        state_dict = torch.load(data_pkl_path, map_location="cpu")
        
        logger.info(f"State dict loaded. Keys: {len(state_dict.keys())}")
        logger.info(f"Sample keys: {list(state_dict.keys())[:5]}")
        
        # Check if it's already a model object or a state dict
        if isinstance(state_dict, dict):
            # It's a state dict - we need to reconstruct the model
            # For Whisper models, we'll save the state dict directly
            # The openai-whisper library can load state dicts
            logger.info("Saving state dict as .pt file...")
            torch.save(state_dict, output_path)
        else:
            # It's already a model object
            logger.info("Saving model object as .pt file...")
            torch.save(state_dict, output_path)
        
        file_size = os.path.getsize(output_path) / (1024 * 1024)
        logger.info(f"✓ Model converted successfully!")
        logger.info(f"✓ Output file: {output_path}")
        logger.info(f"✓ File size: {file_size:.1f} MB")
        
        return output_path
        
    except Exception as e:
        logger.error(f"Error converting model: {e}")
        raise

def main():
    """Main conversion function"""
    if len(sys.argv) < 2:
        print("Usage: python convert_model.py <model_directory> [output_file.pt]")
        print("\nExample:")
        print("  python convert_model.py pytorch_model whisper_tiny_ar_quran.pt")
        print("  python convert_model.py models/pytorch_model")
        sys.exit(1)
    
    model_dir = sys.argv[1]
    
    # Determine output path
    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        # Use the directory name + .pt
        dir_name = os.path.basename(os.path.normpath(model_dir))
        if dir_name == "pytorch_model":
            output_path = "whisper_tiny_ar_quran.pt"
        else:
            output_path = f"{dir_name}.pt"
    
    # Ensure output path has .pt extension
    if not output_path.endswith('.pt'):
        output_path += '.pt'
    
    # Check if model directory exists
    if not os.path.exists(model_dir):
        logger.error(f"Model directory not found: {model_dir}")
        sys.exit(1)
    
    # Check for data.pkl
    data_pkl = os.path.join(model_dir, "data.pkl")
    if not os.path.exists(data_pkl):
        logger.error(f"data.pkl not found in {model_dir}")
        logger.info("Looking for alternative model files...")
        # List files in directory
        files = os.listdir(model_dir)
        logger.info(f"Files found: {files[:10]}...")
        sys.exit(1)
    
    try:
        convert_hf_to_pt(model_dir, output_path)
        print(f"\n✅ Success! Model converted to: {output_path}")
        print(f"\nNext steps:")
        print(f"1. Upload {output_path} to Dropbox")
        print(f"2. Update MODEL_DOWNLOAD_URL in Railway with the new Dropbox link")
        print(f"3. The server will download and use your custom model!")
    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

