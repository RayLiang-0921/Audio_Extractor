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
from typing import Optional
from pathlib import Path

# Local Modules
import audio_processor
import analysis
import mixing

# --- Page Config ---
st.set_page_config(
    page_title="Drum Extractor Pro",
    page_icon="🥁",
    layout="wide",
    initial_sidebar_state="expanded"
)

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
    st.markdown("### High-Fidelity Percussion Isolation System")

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
                progress_bar.progress(20)
                
                # Returns Dict[str, str] now
                stems = audio_processor.separate_audio(st.session_state.local_path)
                
                # Store all stems in session state (we only keep 'stems' dict now instead of just drums path)
                st.session_state.stems = stems
                st.session_state.processed_drums = stems['drums'] # Keep compatibility
                
                progress_bar.progress(70)

                # Step B: Analysis
                status_text.text("Analyzing Audio Metrics (Librosa)...")
                
                # Analyze Drums stem for BPM? Or Original?
                # User preference usually lies with Drum BPM.
                bpm, key = analysis.analyze_track(st.session_state.stems['drums']) 
                # Key is better from original usually, but let's stick to what we had or do original.
                # Let's do Original for Key to be safe.
                _, key = analysis.analyze_track(st.session_state.local_path) # Just to get key
                
                st.session_state.analysis_results = {"bpm": bpm, "key": key}
                progress_bar.progress(100)
                status_text.text("Processing Complete!")
                
            except Exception as e:
                st.error(f"Error during processing: {e}")
                st.stop()

        # 2. Results Dashboard
        if st.session_state.processed_drums:
            st.divider()
            
            # Metrics Row
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Detected BPM", f"{st.session_state.analysis_results['bpm']:.1f}")
            with col2:
                st.metric("Detected Key", st.session_state.analysis_results['key'])
            with col3:
                st.metric("Model", "HTDemucs (v4)")

            # Players
            st.subheader("🎧 Audio Stems")
            c1, c2 = st.columns(2)
            with c1:
                st.markdown("**Original Track**")
                st.audio(st.session_state.local_path)
            with c2:
                st.markdown("**Isolated Drums**")
                st.audio(st.session_state.processed_drums)
            
            # 3. Mixing Studio
            st.divider()
            st.subheader("🎛️ Mixing Studio")
            st.markdown("Preview your isolated drums against a backing track.")

            backing_option = st.selectbox(
                "Select Backing Track",
                ["None", "Demo Bass Loop (Generated)", "Custom Upload (Coming Soon)"]
            )

            if backing_option == "Demo Bass Loop (Generated)":
                if st.button("Generate Mix"):
                    with st.spinner("Mixing Audio..."):
                        # Generate backing if needed
                        backing_path = mixing.generate_demo_backing()
                        
                        # Mix
                        mix_path = mixing.create_mix(
                            st.session_state.processed_drums,
                            backing_path
                        )
                        st.session_state.current_mix = mix_path
            
            if st.session_state.current_mix:
                st.audio(st.session_state.current_mix, format="audio/wav")
                st.success("Mix generated successfully.")

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
