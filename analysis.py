"""
Drum Extractor Pro - Audio Analysis Module
==========================================

This module provides high-level descriptors of the audio content, specifically
BPM (Beats Per Minute) and Musical Key.

Optimization Strategy:
    Full track analysis with Librosa can be slow (O(n) on audio length).
    We optimize this by only analyzing the "center" segment of the track (e.g., 60 seconds).
    Why? The middle of a song usually contains the most stable tempo and harmonic content,
    avoiding intro/outro variations.

DSP Concepts:
    - Onset Strength Envelope: Used for BPM. Measures sudden increases in energy.
    - Constant-Q Transform (CQT): Used for Key. Logarithmic frequency spacing matches musical scales.
    - Chroma Features: Projects spectrum onto 12 semitones (C, C#, etc.).
"""

import librosa
import numpy as np
import os
from typing import Tuple, Optional

def analyze_track(file_path: str, duration: int = 60) -> Tuple[float, str]:
    """
    Analyzes an audio file to determine its global BPM and Key.

    Optimization:
        Loads only a specific duration from the center of the track to reduce I/O and CPU load.

    Args:
        file_path (str): Absolute path to the audio file.
        duration (int): Duration in seconds to analyze (center window). Defaults to 60.

    Returns:
        Tuple[float, str]: (BPM, Key String)
            - BPM: Global tempo estimate.
            - Key: e.g., "C Major", "F# Minor".

    Raises:
        FileNotFoundError: If file_path is invalid.
    """
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # 1. Efficient Loading (Center Window)
    # Why: Analyzing a 5-minute song takes ~5x longer than 1 minute.
    # We first get the duration to calculate the offset.
    total_duration = librosa.get_duration(path=file_path)
    
    start_offset = max(0.0, (total_duration - duration) / 2)
    
    # Load audio
    # y: audio time series, sr: sampling rate
    y, sr = librosa.load(file_path, sr=None, offset=start_offset, duration=duration)

    # --- BPM Detection ---
    # How it works (Librosa beat_track):
    # 1. Onset Strength Envelope: It computes a spectral flux (difference between consecutive STFT frames).
    #    This essentially highlights "transients" or "hits" in the audio.
    # 2. Periodicity Analysis: Autocorrelation is applied to this envelope to find repetitive patterns.
    # 3. Tempo Estimation: The peak of the autocorrelation gives the primary tempo period.
    # 4. Beat Tracking: Dynamic programming aligns beat moments to the onsets consistent with the tempo.
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    
    # beat_track returns a scalar or array depending on librosa version/options.
    # Ensure we return a single float.
    if isinstance(tempo, np.ndarray):
        bpm = float(tempo[0]) if len(tempo) > 0 else 0.0
    else:
        bpm = float(tempo)
    
    # --- Key Detection ---
    # How it works (Chroma CQT + Krumhansl-Schmuckler):
    # 1. Chroma CQT: We compute a Constant-Q Transform spectrogram. unlike FFT (linear),
    #    CQT has logarithmic frequency bins corresponding to musical notes.
    #    We then wrap this into a "Chroma" vector of size 12 (C, C#, D... B), representing
    #    the energy of each pitch class regardless of octave.
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    
    # 2. Global Chroma: Average the chroma over time to get the "tonal profile" of the clip.
    chroma_vals = np.mean(chroma, axis=1) # Shape: (12,)
    
    # 3. Krumhansl-Schmuckler Profiles: Standard templates for Major and Minor keys.
    #    We correlate our observed chroma profile with these 24 templates (12 Major + 12 Minor).
    #    The highest correlation indicates the most likely key.
    
    # Pitch class names
    pitch_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    # Standard profiles (Krumhansl-Schmuckler) - empirical values for tonal stability
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    
    # Normalize our chroma
    chroma_vals = (chroma_vals - np.mean(chroma_vals)) / (np.std(chroma_vals) + 1e-6)
    major_profile = (major_profile - np.mean(major_profile)) / np.std(major_profile)
    minor_profile = (minor_profile - np.mean(minor_profile)) / np.std(minor_profile)
    
    max_corr = -1.0
    best_key = "Unknown"
    
    # Check all 12 transpositions
    for i in range(12):
        # Major Correlation
        # Roll the chroma to match the root 'i'
        corr_major = np.corrcoef(np.roll(chroma_vals, -i), major_profile)[0, 1]
        
        # Minor Correlation
        corr_minor = np.corrcoef(np.roll(chroma_vals, -i), minor_profile)[0, 1]
        
        if corr_major > max_corr:
            max_corr = corr_major
            best_key = f"{pitch_names[i]} Major"
            
        if corr_minor > max_corr:
            max_corr = corr_minor
            best_key = f"{pitch_names[i]} Minor"
            
    return bpm, best_key

if __name__ == "__main__":
    print("Use this module by importing analyze_track")
