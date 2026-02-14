import React, { createContext, useState, useContext, useEffect } from 'react';
import { Audio } from 'expo-av';

const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState(null); // { name: 'Track Name', stem: 'Drums' }
    const [isLoading, setIsLoading] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);

    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    const onPlaybackStatusUpdate = (status) => {
        if (status.isLoaded) {
            setDuration(status.durationMillis);
            setPosition(status.positionMillis);
            setIsPlaying(status.isPlaying);

            if (status.didJustFinish && !status.isLooping) {
                setIsPlaying(false);
            }
        }
    };

    const playStem = async (uri, trackName, stemName) => {
        try {
            setIsLoading(true);

            // Unload previous sound if exists
            if (sound) {
                await sound.unloadAsync();
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true, isLooping: true },
                onPlaybackStatusUpdate
            );

            setSound(newSound);
            setCurrentTrack({ name: trackName, stem: stemName });
            setIsPlaying(true);
            setIsLoading(false);

        } catch (error) {
            console.error("Error playing stem:", error);
            setIsLoading(false);
        }
    };

    const togglePlay = async () => {
        if (!sound) return;

        if (isPlaying) {
            await sound.pauseAsync();
        } else {
            await sound.playAsync();
        }
    };

    const seek = async (positionMillis) => {
        if (sound) {
            await sound.setPositionAsync(positionMillis);
        }
    };

    return (
        <AudioContext.Provider value={{
            sound,
            isPlaying,
            currentTrack,
            playStem,
            togglePlay,
            isLoading,
            duration,
            position,
            seek
        }}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudio = () => useContext(AudioContext);
