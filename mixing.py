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
from typing import Optional, Dict, List
from pydub import AudioSegment
from pydub.generators import Sine, Pulse
import librosa
import soundfile as sf
import numpy as np

def optimize_bpm_target(source_bpm: float, target_bpm: float) -> float:
    """
    Finds the optimal 'effective' target BPM by checking octave (x2, x0.5) relationships.
    Returns the adjusted target BPM that is closest to source_bpm to minimize stretching artifacts.
    
    Example:
        Source=170, Target=90 -> Returns 180 (90*2)
        Source=75, Target=140 -> Returns 150 (75*2 is wrong ex. Target is fixed. Source is flexible? 
        Wait. We are matching Source TO Target.
        If Target is 90. Source is 170.
        We can play Source at 180 (Speed up +6%). 180 is 2x Target.
        If we play at 90, we slow down -47%.
        So we want to find a Target Multiplier (Target * 2^n) that is closest to Source.
    """
    if target_bpm <= 0 or source_bpm <= 0:
        return target_bpm

    # Check multipliers: 0.5, 1.0, 2.0 (Handle Half-time and Double-time)
    multipliers = [0.5, 1.0, 2.0]
    best_target = target_bpm
    min_diff_ratio = float('inf') 

    for m in multipliers:
        candidate = target_bpm * m
        # Calculate stretch ratio (candidate / source)
        # We want this ratio to be as close to 1.0 as possible
        ratio = candidate / source_bpm
        diff = abs(ratio - 1.0)

        if diff < min_diff_ratio:
            min_diff_ratio = diff
            best_target = candidate

    return best_target

def time_stretch_audio(file_path: str, target_bpm: float, source_bpm: float) -> str:
    """
    Stretches audio to match target BPM without changing pitch.
    Automatically handles octave processing (Smart Sync).
    """
    if target_bpm <= 0 or source_bpm <= 0:
        return file_path
        
    # Smart Sync: Find best effective target
    effective_target_bpm = optimize_bpm_target(source_bpm, target_bpm)
        
    rate = effective_target_bpm / source_bpm
    if abs(rate - 1.0) < 0.01:
        return file_path
        
    # Load with Librosa
    y, sr = librosa.load(file_path, sr=None)
    
    # Time Stretch
    # rate > 1.0 means faster (shorter duration)
    y_stretched = librosa.effects.time_stretch(y, rate=rate)
    
    # Save
    temp_dir = Path(tempfile.gettempdir()) / "drum_extractor_pro"
    temp_dir.mkdir(parents=True, exist_ok=True)
    out_name = f"stretched_{int(effective_target_bpm)}_{os.path.basename(file_path)}"
    out_path = temp_dir / out_name
    
    # Write
    sf.write(str(out_path), y_stretched, sr)
    
    return str(out_path)

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

def create_multitrack_mix(stems_paths: Dict[str, str], current_playing_stems: List[str], sample_path: Optional[str] = None) -> Optional[str]:
    """
    Mixes selected stems and an optional custom sample into a single audio file.
    
    Args:
        stems_paths: Dictionary mapping component names (drums, bass, etc) to file paths
        current_playing_stems: List of component names to include in the mix
        sample_path: Optional path to a drum library sample to layer
        
    Returns:
        Path to the mixed audio file or None if no inputs
    """
    
    if not current_playing_stems and not sample_path:
        return None
        
    mixed: Optional[AudioSegment] = None
    files_loaded = []
    
    # 1. Load and Mix Stems
    for name in current_playing_stems:
        path = stems_paths.get(name)
        if path and os.path.exists(path):
            seg = AudioSegment.from_file(path)
            files_loaded.append(seg)
            if mixed is None:
                mixed = seg
            else:
                mixed = mixed.overlay(seg)
                
    # If no stems were valid/selected, start with silent base if sample exists, or return None
    if mixed is None and sample_path:
        # We need a duration. If only sample is selected, how long? 
        # Let's say we don't support sample-only without reference, OR we just play sample once/loop 4 bars?
        # Better: If mix exists, we overlay sample on it. 
        # If mix doesn't exist (only sample selected), we just return sample (looped? or raw?).
        # Let's assume user always selects at least one stem usually. 
        # If NOT, we just return the sample.
        pass
        
    # 2. Layer Sample (Drum Kit)
    if sample_path and os.path.exists(sample_path):
        sample = AudioSegment.from_file(sample_path)
        
        if mixed is None:
             # Only sample selected. Return it directly (or loop it?)
             # Let's just return it directly for now, or loop 4 times if really short.
             if len(sample) < 10000: # Less than 10s
                 mixed = sample * 4
             else:
                 mixed = sample
        else:
            # Overlay sample. 
            # If sample is a loop (short), loop it to match mix duration.
            # If sample is a one-shot, just play at start? Or is it a full backing?
            # User said "Drum Kit Library". Usually means loops or hits. 
            # If hits, playing once at start is weird.
            # Assuming LOOPS for now based on "Traklib" reference (beat store).
            
            # Loop sample to fill mix
            if len(sample) < len(mixed):
                loops = int(len(mixed) / len(sample)) + 1
                sample = sample * loops
                sample = sample[:len(mixed)]
            
            mixed = mixed.overlay(sample)

    if mixed is None:
        return None

    # Export
    temp_dir = Path(tempfile.gettempdir()) / "drum_extractor_pro"
    temp_dir.mkdir(parents=True, exist_ok=True)
    out_path = temp_dir / "multitrack_mix.wav"
    
    mixed.export(str(out_path), format="wav")
    
    # cleanup
    for f in files_loaded: 
        del f
    del mixed
    gc.collect()
    
    return str(out_path)

if __name__ == "__main__":
    # Test gen
    print(f"Generated backing: {generate_demo_backing(5)}")
