# Audio Extractor Pro

A professional-grade audio separation tool powered by **Demucs (Hybrid Transformer)**. Isolate Vocals, Drums, Bass, and Other instruments with high precision.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg) ![FastAPI](https://img.shields.io/badge/FastAPI-0.95+-green.svg) ![React Native](https://img.shields.io/badge/React_Native-0.71+-61DAFB.svg)

## 🔥 Features

- **Stem Separation**: High-quality isolation of Vocals, Drums, Bass, and Other tracks. (Powered by Meta's Demucs v4)
- **Key & BPM Detection**: Automatic musical analysis upon upload.
- **Desktop Application**: Standalone GUI wrapper for easy access.
- **Web Interface**: Modern, responsive UI with waveform visualization (Wavesurfer.js).
- **Mobile Support**: Companion React Native app for on-the-go processing.
- **Multitrack Player**: Solo/Mute controls, synchronized playback, and loop mode.

## 🚀 Quick Start (Desktop)

The easiest way to run the application is using the standalone desktop script.

1.  **Install Dependencies**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Launch the App**
    ```bash
    python desktop_app.py
    ```
    *This will start the backend server and open the application window.*

**(Troubleshooting)** If you encounter `ModuleNotFoundError`, try running with the virtual environment python directly:
```bash
.venv\Scripts\python.exe desktop_app.py
```

## 🌐 Web Interface (Advanced)

If you prefer using your own browser or are developing:

1.  Start the backend server:
    ```bash
    uvicorn main:app --reload
    ```
2.  Open the frontend:
    Access `http://localhost:8000/frontend/index.html` in your browser.

## 📱 Mobile App (React Native)

Refer to the `mobile_app/` directory for setup instructions.
Basically: `cd mobile_app` -> `npm install` -> `npx expo start`.

## 🛠️ Technology Stack

- **Core**: Python, PyTorch, Torchaudio
- **AI Model**: Demucs (Hybrid Transformer)
- **Backend API**: FastAPI, Uvicorn
- **Frontend**: HTML5, CSS3, Vanilla JS, Wavesurfer.js
- **Desktop Wrapper**: PyWebview
- **Mobile**: React Native, Expo

## ⚠️ Requirements

- **FFmpeg**: Must be installed and added to your system PATH.
- **Python 3.8+**
- **RAM**: At least 4GB recommended for inference.

## License

MIT License.
