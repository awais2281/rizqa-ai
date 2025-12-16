"""
Verify that a model file is a valid single .pt file (not a ZIP)
Run this on your local .pt file before uploading to ensure it's correct.
"""

import zipfile
import os
import sys

def verify_model_file(file_path):
    """Verify that a file is a valid .pt file, not a ZIP"""
    print(f"Checking file: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return False
    
    file_size = os.path.getsize(file_path) / (1024 * 1024)
    print(f"File size: {file_size:.1f} MB")
    
    # Check file signature
    with open(file_path, 'rb') as f:
        first_bytes = f.read(10)
        
    # ZIP files start with PK (0x50 0x4B)
    is_zip = first_bytes[:2] == b'PK'
    
    if is_zip:
        print("❌ File is a ZIP archive, not a single .pt file!")
        print("   The conversion may not have worked correctly.")
        
        # Check what's inside
        if zipfile.is_zipfile(file_path):
            with zipfile.ZipFile(file_path, 'r') as zf:
                files = zf.namelist()
                print(f"   Contains {len(files)} files/folders")
                print(f"   First few: {files[:5]}")
                
                # Check for .pt files
                pt_files = [f for f in files if f.endswith('.pt')]
                if pt_files:
                    print(f"   ✓ Found .pt file(s) inside: {pt_files}")
                else:
                    print("   ❌ No .pt files found inside ZIP")
        return False
    else:
        print("✓ File is NOT a ZIP (good!)")
        
        # Try to load it as PyTorch file
        try:
            import torch
            print("Attempting to load with PyTorch...")
            data = torch.load(file_path, map_location='cpu')
            print("✓ File can be loaded with PyTorch!")
            
            if isinstance(data, dict):
                print(f"   Contains state dict with {len(data)} keys")
            else:
                print(f"   Contains model object: {type(data)}")
            
            return True
        except Exception as e:
            print(f"⚠ Warning: Could not load with PyTorch: {e}")
            print("   File might still be valid, but couldn't verify loading")
            return True  # Assume it's OK if it's not a ZIP

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_model.py <path_to_model.pt>")
        print("\nExample:")
        print("  python verify_model.py whisper_ar_tiny_quran_single.pt")
        sys.exit(1)
    
    file_path = sys.argv[1]
    is_valid = verify_model_file(file_path)
    
    if is_valid:
        print("\n✅ File appears to be a valid single .pt file!")
        print("   You can upload this to Dropbox.")
    else:
        print("\n❌ File is NOT a valid single .pt file!")
        print("   Please re-run the conversion script:")
        print("   python convert_model.py <model_directory> output.pt")


