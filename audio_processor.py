"""
Drum Extractor Pro - Audio Processing Module
============================================

This module handles the core digital signal processing (DSP) logic for separating
audio sources. It interfaces with the Demucs deep learning model to perform
music source separation.

Architecture:
    - Model: Demucs (Hybrid Transformer - htdemucs)
    - Input: Audio file path (wav, mp3)
    - Output: Dictionary of separated audio file paths (wav)

Technical Constraints:
    - Must use `htdemucs` for SOTA separation quality.
    - Output must be PCM_16 WAV standard for high fidelity compatibility.
    - Export ALL stems (drums, bass, other, vocals).
"""

import torch
import torchaudio
import os
import tempfile
from pathlib import Path
from typing import Dict
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.audio import convert_audio

# Type alias for clarity
AudioTensor = torch.Tensor

def separate_audio(file_path: str) -> Dict[str, str]:
    """
    Separates the input audio file into 4 stems using the Demucs Hybrid Transformer model.

    Why:
        We need to isolate not just drums but all components to allow the user
        full access to the raw stems (Bass, Vocals, Other).

    How:
        1. **Model Loading**: Loads 'htdemucs'.
        2. **Preprocessing**: Resamples audio.
        3. **Inference**: Generates 4-source tensor.
        4. **Export Loop**: Iterates through all sources and saves them individually.
    
    Args:
        file_path (str): The absolute path to the input audio file.

    Returns:
        Dict[str, str]: A dictionary mapping source names to their file paths.
        Example: {'drums': '/tmp/drums_xyz.wav', 'bass': '/tmp/bass_xyz.wav', ...}

    Raises:
        RuntimeError: If the model fails to load or processing crashes.
        FileNotFoundError: If the input file does not exist.
    """
    
    # Validation
    input_path = Path(file_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {file_path}")

    # 1. Device selection
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    # 2. Load Model
    model = get_model(name="htdemucs")
    model.to(device)

    # 3. Load and Preprocess Audio
    wav, sr = torchaudio.load(str(input_path))
    ref = model.samplerate
    wav = convert_audio(wav, sr, ref, model.audio_channels)
    wav = wav.to(device)
    
    # 4. Apply Model (Inference)
    sources = apply_model(model, wav[None], shifts=1, split=True, overlap=0.25, progress=True)[0]
    # sources shape: (4, 2, Time)
    
    # 5. Save All Stems
    source_names = model.sources # ["drums", "bass", "other", "vocals"]
    stem_paths = {}
    
    temp_dir = Path(tempfile.gettempdir()) / "drum_extractor_pro"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    for name, source_tensor in zip(source_names, sources):
        # Move to CPU
        source_tensor = source_tensor.cpu()
        
        output_filename = f"{name}_{input_path.stem}.wav"
        output_path = temp_dir / output_filename
        
        torchaudio.save(
            str(output_path), 
            source_tensor, 
            sample_rate=ref, 
            encoding="PCM_S", 
            bits_per_sample=16
        )
        
        stem_paths[name] = str(output_path)

    return stem_paths

if __name__ == "__main__":
    print("Running Drum Extractor Pro - Core Logic Test")
