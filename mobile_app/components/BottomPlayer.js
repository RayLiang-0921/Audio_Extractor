import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useAudio } from '../contexts/AudioContext';

export default function BottomPlayer() {
    const { currentTrack, isPlaying, togglePlay, isLoading, position, duration, seek } = useAudio();
    const [sliderValue, setSliderValue] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);

    // Sync slider with actual position when not seeking
    useEffect(() => {
        if (!isSeeking && duration > 0) {
            setSliderValue(position / duration);
        }
    }, [position, duration, isSeeking]);

    if (!currentTrack) return null;

    const handleSlidingComplete = async (value) => {
        const seekPosition = value * duration;
        await seek(seekPosition);
        setIsSeeking(false);
    };

    return (
        <View style={styles.container}>
            <View style={styles.controlsRow}>
                {/* Left: Track Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.trackName} numberOfLines={1}>
                        {currentTrack.name}
                    </Text>
                    <Text style={styles.stemName}>
                        {currentTrack.stem?.toUpperCase() || 'AUDIO'}
                    </Text>
                </View>

                {/* Right: Slider & Play Button Stacked */}
                <View style={styles.playerControls}>
                    <Slider
                        style={styles.miniSlider}
                        minimumValue={0}
                        maximumValue={1}
                        value={sliderValue}
                        onValueChange={(val) => {
                            setIsSeeking(true);
                            setSliderValue(val);
                        }}
                        onSlidingComplete={handleSlidingComplete}
                        minimumTrackTintColor="#FF3333"
                        maximumTrackTintColor="#555"
                        thumbTintColor="#FF3333"
                        thumbImage={undefined} // Optional: Custom thumb if needed
                    />

                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={togglePlay}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <Ionicons
                                name={isPlaying ? "pause" : "play"}
                                size={28}
                                color="white"
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100, // Adjusted height for stacked layout
        backgroundColor: '#121212',
        borderTopWidth: 1,
        borderTopColor: '#333',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 10,
        zIndex: 1000,
        justifyContent: 'center',
        paddingBottom: 10
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        justifyContent: 'space-between',
        flex: 1,
    },
    infoContainer: {
        flex: 1,
        marginRight: 20,
        justifyContent: 'center'
    },
    trackName: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    stemName: {
        color: '#888',
        fontSize: 12,
        marginTop: 2,
    },
    playerControls: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5
    },
    miniSlider: {
        width: 100,
        height: 20,
        marginBottom: 5
    },
    playButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FF3333',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
