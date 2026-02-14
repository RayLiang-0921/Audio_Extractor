import os
import wave
import struct
from pathlib import Path

OUTPUT_DIR = Path("processed_tracks")

def check_files():
    if not OUTPUT_DIR.exists():
        print(f"Directory {OUTPUT_DIR} does not exist.")
        return

    print(f"Scanning {OUTPUT_DIR.resolve()} for silent files using standard 'wave' module...\n")
    
    found_issues = False
    
    for track_dir in OUTPUT_DIR.iterdir():
        if track_dir.is_dir():
            print(f"Checking Track: {track_dir.name}")
            for file in track_dir.glob("*.wav"):
                try:
                    with wave.open(str(file), 'rb') as wf:
                        n_frames = wf.getnframes()
                        content = wf.readframes(n_frames)
                        
                        # Check if all bytes are zero (Silence)
                        # We can simply check if max byte > 0 (for unsigned 8-bit) or check typical values
                        # But for 16-bit PCM (standard), silence is 0x0000.
                        # Simple check: are there ANY non-zero bytes?
                        
                        is_silent = all(b == 0 for b in content)
                        
                        # A better check for 'virtual' silence might be needed, but this catches absolute zero.
                        # Calculating Max Amplitude roughly
                        max_val = 0
                        if len(content) > 0:
                            # Sample a few bytes to avoid memory kill on huge loops?
                            # No, let's just check raw bytes count of 0 vs non-0
                            pass

                        status = "OK"
                        if is_silent:
                            status = "SILENT (All Zero Bytes)"
                            found_issues = True
                        
                        # Rough Check for 'Empty' file (header only)
                        if len(content) == 0:
                             status = "EMPTY (No Data)"
                             found_issues = True

                        print(f"  - {file.name}: {status} (Frames: {n_frames}, Bytes: {len(content)})")
                except Exception as e:
                    print(f"  - {file.name}: ERROR READING ({e})")
                    found_issues = True
            print("-" * 20)

    if not found_issues:
        print("\nAll files contain non-zero data (Hardware Silence Check Passed).")
    else:
        print("\nWARNING: Silent files found!")

if __name__ == "__main__":
    check_files()
    
    for track_dir in OUTPUT_DIR.iterdir():
        if track_dir.is_dir():
            print(f"Checking Track: {track_dir.name}")
            for file in track_dir.glob("*.wav"):
                try:
                    data, samplerate = sf.read(file)
                    # Check Max Amplitude
                    max_amp = np.max(np.abs(data))
                    rms = np.sqrt(np.mean(data**2))
                    
                    status = "OK"
                    if max_amp == 0:
                        status = "SILENT (Absolute Zero)"
                        found_issues = True
                    elif max_amp < 0.001:
                        status = "VIRTUALLY SILENT (Very Low Amp)"
                        
                    print(f"  - {file.name}: {status} (Max: {max_amp:.4f}, RMS: {rms:.4f})")
                except Exception as e:
                    print(f"  - {file.name}: ERROR READING ({e})")
                    found_issues = True
            print("-" * 20)

    if not found_issues:
        print("\nAll files appear to have audio content.")
    else:
        print("\nWARNING: Silent or problematic files found!")

if __name__ == "__main__":
    check_files()
