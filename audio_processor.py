
import torch
import torchaudio
from demucs.apply import apply_model
from demucs.pretrained import get_model
import os
import soundfile as sf
import demucs.apply
# Import tqdm explicitly to be used as the base class
import tqdm as std_tqdm

class ProgressTqdm:
    """
    Hook to capture tqdm progress updates from Demucs.
    """
    def __init__(self, callback, *args, **kwargs):
        self.callback = callback
        # Use the standard tqdm class directly
        self.tqdm_obj = std_tqdm.tqdm(*args, **kwargs)
        self.total = self.tqdm_obj.total

    def __iter__(self):
        """
        Make the class iterable by delegating to the underlying tqdm object.
        Required because __getattr__ does not delegate magic methods like __iter__.
        """
        # Iterate over the internal tqdm object
        for item in self.tqdm_obj:
            yield item
            # After yield, the internal tqdm has updated (usually). 
            # We trigger our callback here.
            if self.callback and self.total:
                percentage = (self.tqdm_obj.n / self.total) * 100
                self.callback(percentage)

    def __getattr__(self, name):
        return getattr(self.tqdm_obj, name)

class CancellationException(Exception):
    pass

def separate_audio(file_path, output_dir, model_name="htdemucs_ft", device="cpu", progress_callback=None, cancel_check=None, detected_key="Unknown", timestamp=0):
    print(f"--- Starting Separation for {file_path} ---")

    # 1. LOAD MODEL
    model = get_model(model_name)
    model.to(device)
    
    # 2. MANUAL LOAD (The Fix: Force SoundFile backend)
    # We load the file into a Tensor manually to stop Demucs from using TorchCodec
    print("Loading audio with SoundFile backend...") 
    # Direct SoundFile load to bypass Torchaudio backend issues
    try:
        data, sr = sf.read(file_path)
        # SoundFile returns (Time, Channels) or just (Time,)
        # Demucs expects (Channels, Time)
        
        if len(data.shape) == 1:
            # Mono: Add channel dim -> (1, Time)
            wav = torch.from_numpy(data).float().unsqueeze(0)
        else:
             # Multi-channel: Transpose -> (Channels, Time)
            wav = torch.from_numpy(data).float().t()
            
    except Exception as e:
        print(f"Error loading audio with SoundFile: {e}")
        raise e

    # 3. PREPARE TENSOR (Demucs needs [1, Channels, Time])
    wav = wav.unsqueeze(0).to(device)

    # 4. INFERENCE (Apply model directly to Tensor)
    print("Running inference...") 
    ref = wav.mean(0) 
    wav = (wav - ref.mean()) / ref.std() 
    
    # --- Progress Hook ---
    # Captures both `import tqdm` (module) and `from tqdm import tqdm` (class) usage
    original_tqdm_val = getattr(demucs.apply, "tqdm", None)

    # 1. Custom TQDM that sends updates to our callback
    class CustomTqdm(std_tqdm.tqdm):
        def __init__(self, *args, progress_callback=None, cancel_check=None, **kwargs):
            # Force disable=False to ensure it runs even if no TTY is detected
            kwargs['disable'] = False 
            self.progress_callback = progress_callback
            self.cancel_check = cancel_check
            super().__init__(*args, **kwargs)

        def update(self, n=1):
            # Check cancellation BEFORE update
            if self.cancel_check and self.cancel_check():
                raise CancellationException("Task cancelled by user")

            super().update(n)
            # Debug print
            # print(f"DEBUG: n={self.n}, total={self.total}") 
            if self.progress_callback:
                if self.total:
                     percentage = (self.n / self.total) * 100
                     self.progress_callback(percentage)
                else:
                     # Fallback if total is unknown?
                     pass
        
    # 2. Universal Shim to handle "import tqdm" vs "from tqdm import tqdm"
    class UniversalTqdmShim:
        def __init__(self, callback, cancel_check):
            self.callback = callback
            self.cancel_check = cancel_check

        def __call__(self, *args, **kwargs):
            # Case: from tqdm import tqdm -> calls tqdm(...)
            return CustomTqdm(*args, progress_callback=self.callback, cancel_check=self.cancel_check, **kwargs)

        def tqdm(self, *args, **kwargs):
            # Case: import tqdm -> calls tqdm.tqdm(...)
            return CustomTqdm(*args, progress_callback=self.callback, cancel_check=self.cancel_check, **kwargs)
            
    try:
        if progress_callback or cancel_check:
            print("Installing TQDM Shim...")
            # Replaces the 'tqdm' attribute in demucs.apply with our Shim
            demucs.apply.tqdm = UniversalTqdmShim(progress_callback, cancel_check)

        print("Calling apply_model...")
        sources = apply_model(model, wav, shifts=1, split=True, overlap=0.25, progress=True) 
        print("apply_model finished.")
        
    finally:
        # Restore original logic
        if original_tqdm_val is not None:
             demucs.apply.tqdm = original_tqdm_val

    sources = sources * ref.std() + ref.mean() 
    sources = sources.squeeze(0) # Remove batch dim

    # 5. SAVE OUTPUTS
    filename = os.path.splitext(os.path.basename(file_path))[0] 
    save_dir = os.path.join(output_dir, filename) 
    os.makedirs(save_dir, exist_ok=True)

    generated_files = {} 
    source_names = model.sources

    for name, source in zip(source_names, sources): 
        # Double check cancellation before write (optional but good)
        if cancel_check and cancel_check():
            raise CancellationException("Task cancelled by user")

        save_path = os.path.join(save_dir, f"{name}.wav") 
        # Save using soundfile (safe) 
        source_cpu = source.cpu().numpy().transpose(1, 0) 
        sf.write(save_path, source_cpu, sr) 
        generated_files[name] = save_path
    
    # Save Metadata
    import json
    metadata = {
        "filename": filename,
        "key": detected_key,
        "timestamp": timestamp, # Available from outer scope? Yes
        "stems": list(generated_files.keys())
    }
    with open(os.path.join(save_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f)

    return generated_files


