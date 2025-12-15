# Convert Hugging Face Model to Single .pt File

Your model is currently in Hugging Face format (a directory with `data.pkl` and many data files). We need to convert it to a single `.pt` file for use with `openai-whisper`.

## Step 1: Extract the Model Directory

First, extract the ZIP file you downloaded from Dropbox:

1. **Download the ZIP from Dropbox** (if you haven't already)
2. **Extract it** - you should get a `pytorch_model` folder
3. **Note the path** to the `pytorch_model` folder

## Step 2: Install Requirements

Make sure you have PyTorch installed:

```bash
pip install torch
```

## Step 3: Run the Conversion Script

I've created a conversion script for you. Run it like this:

```bash
cd server
python convert_model.py <path_to_pytorch_model_folder> whisper_tiny_ar_quran.pt
```

**Example:**
```bash
# If your pytorch_model folder is in the current directory:
python convert_model.py pytorch_model whisper_tiny_ar_quran.pt

# Or if it's in a different location:
python convert_model.py C:/path/to/pytorch_model whisper_tiny_ar_quran.pt
```

## Step 4: Upload the Converted File

After conversion, you'll have a `whisper_tiny_ar_quran.pt` file:

1. **Upload to Dropbox:**
   - Upload the new `.pt` file to Dropbox
   - Right-click → "Copy link"
   - Change `?dl=0` to `?dl=1` for direct download

2. **Update Railway:**
   - Go to Railway → Your service → "Variables"
   - Update `MODEL_DOWNLOAD_URL` with the new Dropbox link
   - Railway will redeploy automatically

## Alternative: Manual Conversion

If the script doesn't work, you can convert manually:

```python
import torch
import os

# Path to your pytorch_model directory
model_dir = "pytorch_model"
data_pkl_path = os.path.join(model_dir, "data.pkl")

# Load the state dict
state_dict = torch.load(data_pkl_path, map_location="cpu")

# Save as single .pt file
output_path = "whisper_tiny_ar_quran.pt"
torch.save(state_dict, output_path)

print(f"Model saved to {output_path}")
```

## Troubleshooting

### "data.pkl not found"
- Make sure you're pointing to the `pytorch_model` directory (not the parent folder)
- Check that `data.pkl` exists inside that directory

### "Module not found" errors
- Install PyTorch: `pip install torch`

### File is still too large
- The converted `.pt` file should be similar size to the original ZIP
- If it's much larger, there might be an issue with the conversion

## What the Script Does

1. Loads `data.pkl` from the Hugging Face model directory
2. Extracts the state dict (model weights)
3. Saves it as a single `.pt` file
4. This `.pt` file can be loaded by `openai-whisper`

## After Conversion

Once you have the `.pt` file:
1. Upload it to Dropbox
2. Update Railway's `MODEL_DOWNLOAD_URL`
3. The server will download and use your custom model!

Let me know if you need help with any step!

