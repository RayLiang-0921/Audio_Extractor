"""
Drum Extractor Pro - Main Application Entry Point
=================================================

This module serves as the frontend interface for the Drum Extractor Pro application.
It integrates the processing, analysis, and mixing modules into a cohesive
Streamlit dashboard.

Architecture:
    - Presentation Layer: Streamlit
    - Processing Layer: audio_processor (Demucs), analysis (Librosa), mixing (Pydub)
    - State Management: st.session_state for caching heavy results

Usage:
    $ streamlit run app.py
"""

import streamlit as st
import os
import shutil
import torchaudio
from typing import Optional
from pathlib import Path

# Set audio backend to soundfile for Windows compatibility
# Set audio backend to soundfile for Windows compatibility
if hasattr(torchaudio, "set_audio_backend"):
    torchaudio.set_audio_backend("soundfile")
else:
    # Fallback/Debug
    print("Warning: torchaudio.set_audio_backend not available. Relying on default.")

# Local Modules
# Local Modules
import audio_processor
import analysis
import mixing
import base64
import streamlit.components.v1 as components
import uuid

# --- Page Config ---
# --- Page Config ---
st.set_page_config(
    page_title="Audio Extractor",
    page_icon="🥁",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Custom CSS Injection (Tracklib Theme) ---
st.markdown("""
    <style>
        /* Global Reset & Pitch Black Background */
        .stApp {
            background-color: #000000;
        }
        
        /* Main Container & Typography */
        h1, h2, h3, h4, h5, h6, p, div, span, label {
            color: #FFFFFF;
            font-family: 'Inter', sans-serif;
        }
        
        h1 {
            text-align: center;
            font-weight: 800;
            margin-bottom: 30px;
            color: #FFFFFF;
        }

        /* Sidebar Styling */
        [data-testid="stSidebar"] {
            background-color: #050505;
            border-right: 1px solid #222;
        }
        
        /* Buttons: Rounded, Neon Red Border */
        .stButton > button {
            background-color: transparent !important;
            border: 2px solid #FF3333 !important;
            border-radius: 50px !important;
            color: #FF3333 !important;
            font-weight: 600 !important;
            transition: all 0.3s ease !important;
        }

        .stButton > button:hover {
            transform: scale(1.05);
            box-shadow: 0 0 15px rgba(255, 51, 51, 0.6);
            color: #FFFFFF !important;
            background-color: #FF3333 !important;
        }
        
        /* Download Buttons */
        .stDownloadButton > button {
            background-color: transparent !important;
            border: 2px solid #FF3333 !important;
            border-radius: 50px !important;
            color: #FF3333 !important;
            font-weight: 600 !important;
            transition: all 0.3s ease !important;
        }
        
        .stDownloadButton > button:hover {
             transform: scale(1.05);
             box-shadow: 0 0 15px rgba(255, 51, 51, 0.6);
             color: #FFFFFF !important;
             background-color: #FF3333 !important;
        }

        /* Hide Streamlit Defaults */
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        header {visibility: hidden;}
        
        /* Waveform/Matplotlib tweaks (if any) */
        /* Currently streamlit parses plots as images usually, but if custom html: */
        
    </style>
""", unsafe_allow_html=True)

# --- Session State Management ---
# Why: Streamlit re-runs the whole script on every interaction. We use session_state
# to persist the heavy processing results (Separation & Analysis) so we don't
# compute them again just because the user toggled a checkbox.
if 'processed_drums' not in st.session_state:
    st.session_state.processed_drums = None
if 'analysis_results' not in st.session_state:
    st.session_state.analysis_results = None
if 'current_mix' not in st.session_state:
    st.session_state.current_mix = None
if 'input_filename' not in st.session_state:
    st.session_state.input_filename = ""

def save_uploaded_file(uploaded_file) -> str:
    """Helper to save uploaded file to disk for processing."""
    temp_dir = Path("temp_inputs")
    if temp_dir.exists():
        shutil.rmtree(temp_dir) # Clean previous run
    temp_dir.mkdir(exist_ok=True)
    
    file_path = temp_dir / uploaded_file.name
    with open(file_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    return str(file_path)

def setup_sidebar():
    st.sidebar.header("🥁 Control Panel")
    st.sidebar.info("""
    **Workflow:**
    1. Upload a Track
    2. Wait for Separation (GPU/CPU)
    3. Analyze & Mix
    """)

def main():
    st.title("🥁 Drum Extractor Pro")
    st.markdown("<h3 style='text-align: center; color: #888;'>High-Fidelity Percussion Isolation System</h3>", unsafe_allow_html=True)

    setup_sidebar()

    # File Uploader
    uploaded_file = st.file_uploader("Upload Audio (WAV/MP3)", type=["wav", "mp3"])

    if uploaded_file is not None:
        # Check if it's a new file
        if uploaded_file.name != st.session_state.input_filename:
            # Reset state for new file
            st.session_state.input_filename = uploaded_file.name
            st.session_state.processed_drums = None
            st.session_state.analysis_results = None
            st.session_state.current_mix = None
            
            # Save file immediately
            with st.spinner("Caching input file..."):
                st.session_state.local_path = save_uploaded_file(uploaded_file)

        # 1. Processing Trigger
        # We process automatically if not done yet
        if st.session_state.processed_drums is None:
            st.divider()
            st.write("⚙️ **Processing Track...**")
            
            progress_bar = st.progress(0)
            status_text = st.empty()

            try:
                # Step A: Separation
                status_text.text("Separating Stems (Demucs htdemucs)... This may take a minute.")
                progress_bar.progress(50)
                
                # Returns Dict[str, str] now
                import tempfile
                output_dir = os.path.join(tempfile.gettempdir(), "drum_extractor_pro")
                stems = audio_processor.separate_audio(st.session_state.local_path, output_dir=output_dir)
                
                # Store all stems in session state (we only keep 'stems' dict now instead of just drums path)
                st.session_state.stems = stems
                st.session_state.processed_drums = stems['drums'] # Keep compatibility
                
                progress_bar.progress(70)

                # Step B: Analysis (Key Only)
                status_text.text("Analyzing Musical Key...")
                
                # We analyze the original track for better key detection
                _, key = analysis.analyze_track(st.session_state.local_path)
                
                st.session_state.analysis_results = {"key": key}
                progress_bar.progress(100)
                status_text.text("Processing Complete!")
                
            except Exception as e:
                st.error(f"Error during processing: {e}")
                st.stop()

        # 2. Results Dashboard
        if st.session_state.processed_drums:
            st.divider()
            
            # Metrics Row (Simplified)
            col1, col2 = st.columns(2)
            with col1:
                 st.metric("Detected Key", st.session_state.analysis_results['key'])
            with col2:
                 st.metric("Model", "HTDemucs (v4)")

            # 3. Mixing Studio (Old Grid Removed)
            # User requested removal of the 2x2 grid.
            st.divider()    
            
            # 3. Multitrack Studio (Advanced Player)
            st.divider()
            st.subheader("🎛️ Multitrack Studio")
            st.markdown("Select stems to create your custom mix.")
            
            # Simplified Selection
            st.markdown("### Mix Stems")
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                use_drums = st.checkbox("🥁 Drums", value=True)
            with col2:
                use_bass = st.checkbox("🎸 Bass", value=True)
            with col3:
                use_vocals = st.checkbox("🎤 Vocals", value=True)
            with col4:
                use_other = st.checkbox("🎹 Other", value=True)

            if st.button("Load Player", type="primary"):
                with st.spinner("Preparing Audio..."):
                    # 1. Prepare Base Mix
                    active_stems = []
                    if use_drums: active_stems.append('drums')
                    if use_bass: active_stems.append('bass')
                    if use_vocals: active_stems.append('vocals')
                    if use_other: active_stems.append('other')
                    
                    # Create Base Track (Backing)
                    base_path = mixing.create_multitrack_mix(
                        stems_paths=st.session_state.stems,
                        current_playing_stems=active_stems,
                        sample_path=None # No drums in base
                    )
                    
                    if base_path:
                        # Helper for Base64 (Inject here or global? Inline is easy)
                        def get_b64(path):
                            with open(path, "rb") as f:
                                data = f.read()
                            return base64.b64encode(data).decode()

                        base_b64 = get_b64(base_path)

                        # Fix: Inline Player Styles
                        # Removed fixed positioning and z-index hacks
                        unique_id = str(uuid.uuid4())
                        
                        # Updated Player to Match Tracklib Theme (Black/Red)
                        player_html = f"""
                        <div id="inline-player" style="background: #000000; border: 1px solid #FF3333; color: white; padding: 20px; border-radius: 10px; display: flex; gap: 15px; align-items: center; box-shadow: 0 0 15px rgba(255, 51, 51, 0.2); font-family: 'Inter', sans-serif;">
                            <button onclick="skip(-5)" style="background:none; border:none; color: #FF3333; cursor: pointer; font-size: 20px; transition: 0.2s;">⏪ -5s</button>
                            <button id="playBtn_{unique_id}" onclick="togglePlay()" style="background: #FF3333; border: none; border-radius: 50%; width: 50px; height: 50px; color: white; font-size: 24px; cursor: pointer; box-shadow: 0 0 10px rgba(255, 51, 51, 0.5);">▶</button>
                            <button onclick="skip(5)" style="background:none; border:none; color: #FF3333; cursor: pointer; font-size: 20px; transition: 0.2s;">+5s ⏩</button>
                            <span id="timeDisplay_{unique_id}" style="margin-left: 20px; font-family: monospace; font-size: 16px; color: #FFF;">0:00</span>
                            
                            <!-- Hidden Audio Elements -->
                            <audio id="audioBase_{unique_id}" src="data:audio/wav;base64,{base_b64}"></audio>
                            
                            <script>
                                var base = document.getElementById("audioBase_{unique_id}");
                                var btn = document.getElementById("playBtn_{unique_id}");
                                var display = document.getElementById("timeDisplay_{unique_id}");
                                var isPlaying = false;

                                function togglePlay() {{
                                    if (isPlaying) {{
                                        base.pause();
                                        btn.innerHTML = "▶";
                                        isPlaying = false;
                                    }} else {{
                                        base.play();
                                        btn.innerHTML = "⏸";
                                        isPlaying = true;
                                    }}
                                }}

                                function skip(seconds) {{
                                    base.currentTime += seconds;
                                }}
                                
                                base.onended = function() {{
                                    isPlaying = false;
                                    btn.innerHTML = "▶";
                                    base.currentTime = 0;
                                }};
                                
                                base.ontimeupdate = function() {{
                                    var min = Math.floor(base.currentTime / 60);
                                    var sec = Math.floor(base.currentTime % 60);
                                    if (sec < 10) sec = "0" + sec;
                                    display.innerText = min + ":" + sec;
                                }};
                                
                            </script>
                        </div>
                        """
                        # Persist to session state
                        st.session_state['active_player_html'] = player_html
                    else:
                        st.warning("No stems selected.")

            # Render Persistent Player
            if 'active_player_html' in st.session_state:
                # Use components.html to avoid Markdown rendering issues
                components.html(st.session_state['active_player_html'], height=120)

            # 4. Downloads Section
            st.divider()
            st.subheader("⬇️ Download Stems")
            st.markdown("Download high-fidelity separate tracks (WAV 16-bit).")
            
            d_col1, d_col2, d_col3, d_col4 = st.columns(4)
            
            # Helper to create buttons
            def create_dl_btn(col, label, key_name):
                path = st.session_state.stems.get(key_name)
                if path and os.path.exists(path):
                    with open(path, "rb") as f:
                        col.download_button(
                            label=label,
                            data=f,
                            file_name=f"{key_name}_stem.wav",
                            mime="audio/wav"
                        )
            
            create_dl_btn(d_col1, "⬇ Drums", "drums")
            create_dl_btn(d_col2, "⬇ Bass", "bass")
            create_dl_btn(d_col3, "⬇ Vocals", "vocals")
            create_dl_btn(d_col4, "⬇ Other", "other")


    else:
        st.info("👋 Upload a file to begin.")

if __name__ == "__main__":
    main()
