"""
Drum Extractor Pro - Audio Mixing Module
========================================

This module handles audio manipulation and superposition using Pydub.
It allows the user to contextually preview the isolated drums within a new mix.

Performance Note:
    Pydub loads audio into RAM as raw PCM data. A 5-minute Wav file (CD quality) 
    is ~50MB. Processing multiple files is generally safe on modern machines 
    (8GB+ RAM), but we explicitly invoke garbage collection to be safe.
"""

import os
import gc
import tempfile
from pathlib import Path
from typing import Optional
from pydub import AudioSegment
from pydub.generators import Sine, Pulse

def generate_demo_backing(duration_sec: int = 30) -> str:
    """
    Synthesizes a simple electronic bassline to serve as a backing track.

    Why:
        Allows the user to test the "Mix" feature immediately without needing to 
        upload a separate backing track file.

    How:
        Uses Pydub's signal generators (Pulse/Sine) to create a rhythmic pattern.
        Pattern is looped to match the requested duration.
    
    Args:
        duration_sec (int): Length of the generated track.

    Returns:
        str: Path to the generated WAV file.
    """
    # 1. Define a simple 4-beat bar (120 BPM -> 500ms per beat)
    # Bass Note (C2 - ~65.4Hz)
    beat_len = 500
    note = Pulse(65.4).to_audio_segment(duration=200).fade_out(50)
    rest = AudioSegment.silent(duration=300)
    
    # Simple pattern: Boom - Rest - Boom - Rest
    bar = (note + rest) * 4
    
    # 2. Loop to duration
    total_len_ms = duration_sec * 1000
    loops = int(total_len_ms / len(bar)) + 1
    full_track = bar * loops
    full_track = full_track[:total_len_ms] # Trim excess
    
    # 3. Export
    temp_dir = Path(tempfile.gettempdir()) / "drum_extractor_pro"
    temp_dir.mkdir(parents=True, exist_ok=True)
    out_path = temp_dir / "demo_backing_bass.wav"
    
    # Lower volume to leave room for drums
    full_track = full_track - 6 
    full_track.export(str(out_path), format="wav")
    
    return str(out_path)

def create_mix(drums_path: str, backing_path: str) -> str:
    """
    Overlays the drum stem onto the backing track.

    Why:
        Contextual verification. Hearing drums in isolation is good, but hearing
        them 'sit' in a new mix proves the timing and phase are preserved.

    How:
        1. Loads both files.
        2. Loops the backing track if it's shorter than the drums (or vice versa, 
           usually we let the drums dictate the length).
        3. Overlays drums on top.
        4. Exports mix.

    Args:
        drums_path (str): Path to the separated drums wav.
        backing_path (str): Path to the backing track wav/mp3.

    Returns:
        str: Path to the mixed output file.
    """
    
    # Load separate segments
    # Pydub automatically handles format detection
    drums = AudioSegment.from_file(drums_path)
    backing = AudioSegment.from_file(backing_path)

    # Logic: Drums are the "Subject". usage scenario: Replacing drums on a song.
    # We will trim mixing to the length of the drums.
    
    # If backing is too short, loop it
    if len(backing) < len(drums):
        loops = int(len(drums) / len(backing)) + 1
        backing = backing * loops
    
    # Trim backing to match drums exactly
    backing = backing[:len(drums)]

    # Overlay
    # position=0 means start at beginning. 
    # Helper: Mixed = Backing (Background) + Drums (Foreground)
    mixed = backing.overlay(drums, position=0)

    # Export
    temp_dir = Path(tempfile.gettempdir()) / "drum_extractor_pro"
    temp_dir.mkdir(parents=True, exist_ok=True)
    out_path = temp_dir / "final_mix_preview.wav"
    
    mixed.export(str(out_path), format="wav")
    
    # Memory Cleanup
    del drums
    del backing
    del mixed
    gc.collect()
    
    return str(out_path)

if __name__ == "__main__":
    # Test gen
    print(f"Generated backing: {generate_demo_backing(5)}")
