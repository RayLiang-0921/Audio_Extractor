import os
import sys
import threading
import uvicorn
import webview
from main import app

# 1. Determine if running as script or frozen exe
if getattr(sys, 'frozen', False):
    # Running as compiled exe
    base_dir = sys._MEIPASS
else:
    # Running as script
    base_dir = os.path.dirname(os.path.abspath(__file__))

# 2. Configure paths for frozen app
# We need to tell the app where to find resources when frozen
# Note: You might need to adjust 'main.py' to use base_dir for templates/static files if not using relative paths correctly.
# In this app, we serve static files from 'frontend' and 'processed_tracks'.
# We will ensure these are bundled correctly in the spec file.

def start_server():
    # Run Uvicorn server in a separate thread
    # Use a fixed port or find an open one
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

if __name__ == '__main__':
    # Start the server thread
    t = threading.Thread(target=start_server, daemon=True)
    t.start()

    # Start the webview (GUI)
    # This must run in the main thread
    webview.create_window(
        "Audio Extractor", 
        "http://127.0.0.1:8000/frontend/index.html",
        width=1200,
        height=800,
        resizable=True
    )
    webview.start()
