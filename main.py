from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import shutil
import os
from pathlib import Path
import audio_processor
import analysis # Refactored import
import urllib.parse

app = FastAPI(title="Audio Extractor API")

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuration ---
TEMP_INPUT_DIR = Path("temp_inputs")
# Switching to local directory for easier StaticFiles mounting
OUTPUT_DIR = Path("processed_tracks")
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB in bytes

# Ensure directories exist
TEMP_INPUT_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# --- In-Memory Progress Store ---
# Format: { task_id: { "progress": int(0-100), "status": str } }
PROGRESS_STORE = {}

# --- Mount Static Files ---
# Serve the output directory at /files results in:
# http://host:port/files/track_name/stem.wav
app.mount("/files", StaticFiles(directory=OUTPUT_DIR), name="files")
app.mount("/frontend", StaticFiles(directory="frontend", html=True), name="frontend")

@app.get("/progress/{task_id}")
async def get_progress(task_id: str):
    """Returns the progress of a specific task."""
    return PROGRESS_STORE.get(task_id, {"progress": 0, "status": "pending"})

@app.post("/cancel/{task_id}")
async def cancel_task(task_id: str):
    """Cancels a running task."""
    if task_id in PROGRESS_STORE:
        PROGRESS_STORE[task_id]["status"] = "cancelled"
        return {"message": "Cancellation requested"}
    return JSONResponse(status_code=404, content={"message": "Task not found"})

@app.post("/separate")
async def separate_audio_endpoint(
    request: Request, 
    file: UploadFile = File(...), 
    task_id: str = None
):
    """
    Accepts an audio file, separates it, and returns download URLs.
    Now includes Key Analysis and Progress Tracking.
    Running in thread pool to prevent blocking.
    """
    import asyncio
    loop = asyncio.get_event_loop()

    # 0. File Size Check
    if not task_id:
        task_id = "default" # Fallback if frontend doesn't send one

    # Validate file size if content-length header is present
    content_length = request.headers.get('content-length')
    if content_length and int(content_length) > MAX_FILE_SIZE:
         raise HTTPException(status_code=413, detail="File too large. Max size is 200MB.")

    input_path = None # Scope for cleanup

    try:
        # Initialize progress
        PROGRESS_STORE[task_id] = {"progress": 0, "status": "uploading"}

        # 1. Save uploaded file
        # Sanitize filename: decode URL-encoded chars and replace spaces
        import time
        original_name = urllib.parse.unquote(file.filename)
        base_name, ext = os.path.splitext(original_name)
        safe_base = "".join([c if c.isalnum() or c in "._-" else "_" for c in base_name])
        
        # Append timestamp to ensure uniqueness
        timestamp = int(time.time())
        safe_filename = f"{safe_base}_{timestamp}{ext}"
        
        input_path = TEMP_INPUT_DIR / safe_filename
        
        # Check actual read size just in case
        file_size = 0
        with open(input_path, "wb") as buffer:
            while True:
                # Check for cancellation during upload
                if PROGRESS_STORE.get(task_id, {}).get("status") == "cancelled":
                     raise audio_processor.CancellationException("Cancelled during upload")

                chunk = await file.read(1024 * 1024) # Read 1MB chunks
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    input_path.unlink(missing_ok=True) # Delete partial file
                    raise HTTPException(status_code=413, detail="File too large. Max size is 200MB.")
                buffer.write(chunk)
        
        # Check cancellation before switching to analyzing
        if PROGRESS_STORE.get(task_id, {}).get("status") == "cancelled":
             raise audio_processor.CancellationException("Cancelled after upload")

        PROGRESS_STORE[task_id]["status"] = "analyzing"

        # 2. Analyze Audio (Key) - Run in Thread
        # analysis.analyze_track returns (bpm, key)
        try:
             # run_in_executor(None, ...) uses the default thread pool
             _, detected_key = await loop.run_in_executor(None, analysis.analyze_track, str(input_path))
        except Exception as e:
             print(f"Analysis failed: {e}")
             detected_key = "Unknown"

        # Check cancellation before switching to separating
        if PROGRESS_STORE.get(task_id, {}).get("status") == "cancelled":
             raise audio_processor.CancellationException("Cancelled after analysis")

        # 3. Process Audio (Separation) - Run in Thread
        PROGRESS_STORE[task_id]["status"] = "separating"
        
        def update_progress(p):
            # Callback to update progress store
            # Check if cancelled before updating progress (don't revive a cancelled task)
            if task_id in PROGRESS_STORE and PROGRESS_STORE[task_id].get("status") != "cancelled":
                PROGRESS_STORE[task_id]["progress"] = int(p)

        def check_cancelled():
            # Check if task is marked as cancelled
            status = PROGRESS_STORE.get(task_id, {}).get("status")
            return status == "cancelled"

        stems_dict = await loop.run_in_executor(
            None, 
            lambda: audio_processor.separate_audio(
                str(input_path), 
                str(OUTPUT_DIR),
                progress_callback=update_progress,
                cancel_check=check_cancelled,
                detected_key=detected_key,
                timestamp=timestamp
            )
        )
        
        # 4. Construct Response
        track_name = os.path.splitext(safe_filename)[0]
        base_url = str(request.base_url).rstrip("/")
        
        response_stems = {}
        for stem_name, abs_path in stems_dict.items():
            filename = os.path.basename(abs_path)
            
            # Playback URL (Static Files - for Wavesurfer)
            playback_url = f"{base_url}/files/{track_name}/{filename}"
            
            # Download URL (Force Download - for Buttons)
            download_url = f"{base_url}/download?track={track_name}&file={filename}"
            
            # Check for file existence before returning (sanity check)
            # if not os.path.exists(abs_path): ...

            response_stems[stem_name] = {
                "playback": playback_url,
                "download": download_url
            }

        # Cleanup progress
        if task_id in PROGRESS_STORE:
            del PROGRESS_STORE[task_id]

        # Cleanup input file (Success case)
        if input_path and input_path.exists():
            try:
                input_path.unlink()
            except Exception as e:
                print(f"Warning: Failed to delete input file {input_path}: {e}")

        return JSONResponse(content={
            "status": "success", 
            "key": detected_key,
            "stems": response_stems
        })
    
    except audio_processor.CancellationException:
        print(f"Task {task_id} cancelled. Cleaning up...")
        if task_id in PROGRESS_STORE:
            del PROGRESS_STORE[task_id]
        
        # Delete input file
        if input_path and input_path.exists():
            try:
                input_path.unlink()
                print(f"Deleted input file: {input_path}")
            except Exception as e:
                print(f"Error deleting input file: {e}")

        # Delete output directory (if created)
        # Convert input filename to output folder name logic
        if input_path:
             track_name = os.path.splitext(input_path.name)[0]
             output_subdir = OUTPUT_DIR / track_name
             if output_subdir.exists():
                 try:
                     shutil.rmtree(output_subdir)
                     print(f"Deleted output dir: {output_subdir}")
                 except Exception as e:
                     print(f"Error deleting output dir: {e}")
        
        return JSONResponse(status_code=499, content={"message": "Task cancelled"})

    except HTTPException as he:
        if task_id in PROGRESS_STORE:
            del PROGRESS_STORE[task_id]
        raise he
    except Exception as e:
        if task_id in PROGRESS_STORE:
            del PROGRESS_STORE[task_id]
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download")
async def download_file(track: str, file: str):
    """
    Force download of a file.
    Usage: /download?track=song_name&file=drums.wav
    """
    # Security: basic traversal prevention
    if ".." in track or ".." in file:
        raise HTTPException(status_code=400, detail="Invalid path")
        
    file_path = OUTPUT_DIR / track / file
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(
        path=file_path, 
        filename=file,
        media_type="audio/wav",
        headers={"Content-Disposition": f"attachment; filename={file}"}
    )

@app.delete("/delete/{filename}")
async def delete_audio_endpoint(filename: str):
    """
    Deletes the folder containing separated stems for a specific file.
    """
    # Security: basic traversal prevention
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    target_dir = OUTPUT_DIR / filename
    
    # Try stripping extension if direct match fails (since we create folders without ext)
    if not target_dir.exists():
        stem = os.path.splitext(filename)[0]
        target_dir = OUTPUT_DIR / stem

    if not target_dir.exists():
        # Debug print
        print(f"Delete failed: {target_dir} does not exist")
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        import shutil
        shutil.rmtree(target_dir) # Delete the directory and all contents
        return {"message": f"Successfully deleted {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")



if __name__ == "__main__":
    import uvicorn
    # Exact command requested by user
    print("Run with: uvicorn main:app --reload")
    uvicorn.run(app, host="0.0.0.0", port=8000)
