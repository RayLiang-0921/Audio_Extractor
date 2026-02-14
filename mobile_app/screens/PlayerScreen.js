import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Switch, ScrollView, ActivityIndicator, Platform, Alert, Animated, Easing } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';

import { Slider } from '@miblanchard/react-native-slider';

// Reusable ScaleButton Component (Non-Bouncy)
const ScaleButton = ({ onPress, style, children, disabled, contentStyle }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.timing(scale, {
            toValue: 0.9,
            duration: 100,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
        }).start();
    };

    const onPressOut = () => {
        Animated.timing(scale, {
            toValue: 1,
            duration: 150, // Slightly slower out for feel
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
        }).start();
    };

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={disabled}
            style={style}
        >
            <Animated.View style={[contentStyle, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function PlayerScreen({ route, navigation }) {
    const { t } = useLanguage();
    // const { playStem } = useAudio(); // Removed
    const { stems, key, trackName } = route.params;
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(null); // Track which stem is downloading
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);

    // Track State: { soundObj, isMuted, volume }
    const tracksRef = useRef({});
    const [trackStates, setTrackStates] = useState({
        drums: { muted: false, volume: 1.0 },
        bass: { muted: false, volume: 1.0 },
        vocals: { muted: false, volume: 1.0 },
        other: { muted: false, volume: 1.0 },
    });

    // Thumb Animation
    const thumbScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(thumbScale, {
            toValue: isSeeking ? 1.8 : 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [isSeeking]);

    useEffect(() => {
        setupAudio();
        return () => {
            unloadAll();
        };
    }, []);

    const setupAudio = async () => {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
            });

            const stemKeys = Object.keys(stems);
            let firstTrackLoaded = false;

            const loadStem = async (name, url) => {
                // Only modify onPlaybackStatusUpdate for the first track to drive range slider
                const onPlaybackStatusUpdate = (!firstTrackLoaded && stems[name]?.playback) ? (status) => {
                    if (status.isLoaded) {
                        setDuration(status.durationMillis);
                        setPosition(status.positionMillis);
                        if (status.didJustFinish && !status.isLooping) {
                            setIsPlaying(false);
                        }
                    }
                } : null;

                if (onPlaybackStatusUpdate) firstTrackLoaded = true;

                const { sound } = await Audio.Sound.createAsync(
                    { uri: url, progressUpdateIntervalMillis: 32 },
                    { shouldPlay: false, isLooping: true },
                    onPlaybackStatusUpdate
                );
                tracksRef.current[name] = sound;
            };

            const promises = stemKeys.map(key => {
                if (stems[key]?.playback) {
                    return loadStem(key, stems[key].playback);
                }
            });

            await Promise.all(promises);
            setLoading(false);

        } catch (error) {
            console.error("Error loading audio", error);
        }
    };

    const unloadAll = async () => {
        Object.values(tracksRef.current).forEach(async (sound) => {
            try { await sound.unloadAsync(); } catch (e) { }
        });
    };

    const seek = async (value) => {
        if (!duration) return;
        const seekPosition = value * duration;

        // Seek all tracks
        const promises = Object.values(tracksRef.current).map(sound =>
            sound.setPositionAsync(seekPosition)
        );
        await Promise.all(promises);
        setIsSeeking(false);
    };

    const togglePlayback = async () => {
        const sounds = Object.values(tracksRef.current);
        if (isPlaying) {
            await Promise.all(sounds.map(s => s.pauseAsync()));
        } else {
            await Promise.all(sounds.map(s => s.playAsync()));
        }
        setIsPlaying(!isPlaying);
    };

    const toggleMute = async (stemName) => {
        const sound = tracksRef.current[stemName];
        if (sound) {
            const isMuted = !trackStates[stemName].muted;
            await sound.setIsMutedAsync(isMuted);
            setTrackStates(prev => ({
                ...prev,
                [stemName]: { ...prev[stemName], muted: isMuted }
            }));
        }
    };

    const downloadStem = async (stemName) => {
        const url = stems[stemName]?.download;
        if (!url) return;

        if (Platform.OS === 'web') {
            const tempLink = document.createElement('a');
            tempLink.href = url;
            tempLink.setAttribute('download', `${trackName}_${stemName}.wav`);
            tempLink.click();
            return;
        }

        try {
            setDownloading(stemName);
            const fileUri = FileSystem.documentDirectory + `${trackName}_${stemName}.wav`;

            const { uri } = await FileSystem.downloadAsync(url, fileUri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert(t('success'), t('download_saved'));
            }
        } catch (e) {
            console.error(e);
            Alert.alert(t('error'), t('download_failed'));
        } finally {
            setDownloading(null);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#FFC107" />
                <Text style={styles.text}>{t('loading_stems')}</Text>
            </View>
        );
    }

    const formatTime = (millis) => {
        if (!millis) return '00:00';
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const renderThumb = () => (
        <Animated.View style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: '#FFC107',
            transform: [{ scale: thumbScale }],
        }} />
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.trackTitle}>{trackName}</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>Key: {key}</Text>
                </View>
            </View>

            <View style={styles.mixerContainer}>
                {Object.keys(stems).map((stem) => (
                    <View key={stem} style={styles.trackRow}>
                        <View>
                            <Text style={styles.trackLabel}>{stem.toUpperCase()}</Text>
                            <ScaleButton onPress={() => downloadStem(stem)} disabled={downloading === stem} style={{ marginTop: 5 }}>
                                {downloading === stem ? (
                                    <ActivityIndicator size="small" color="#FFC107" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="download-outline" size={16} color="#888" />
                                        <Text style={styles.downloadText}> {t('save_wav')}</Text>
                                    </View>
                                )}
                            </ScaleButton>
                        </View>

                        <View style={styles.controls}>
                            <Text style={[styles.status, trackStates[stem].muted && styles.mutedText]}>
                                {trackStates[stem].muted ? t('muted') : t('on')}
                            </Text>
                            <Switch
                                trackColor={{ false: "#333", true: "#FFC107" }}
                                thumbColor={trackStates[stem].muted ? "#f4f3f4" : "#000"}
                                onValueChange={() => toggleMute(stem)}
                                value={!trackStates[stem].muted}
                            />
                        </View>
                    </View>
                ))}
            </View>

            <View style={styles.footer}>
                <View style={styles.sliderContainer}>
                    <Slider
                        value={(isSeeking ? undefined : (duration ? position / duration : 0))}
                        minimumValue={0}
                        maximumValue={1}
                        containerStyle={{ width: '100%', height: 40 }}
                        trackStyle={{ height: 4, borderRadius: 2 }}
                        minimumTrackTintColor="#FFC107"
                        maximumTrackTintColor="#555"
                        thumbTouchSize={{ width: 40, height: 40 }}
                        renderThumbComponent={renderThumb}
                        onSlidingStart={() => setIsSeeking(true)}
                        onSlidingComplete={(vals) => {
                            // setIsSeeking will be handled in seek or after
                            seek(vals[0]);
                        }}
                    />
                </View>

                <View style={styles.footerControls}>
                    <ScaleButton style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        <Ionicons name="arrow-back" size={28} color="#FFC107" />
                    </ScaleButton>

                    <ScaleButton style={styles.playButton} onPress={togglePlayback} contentStyle={{
                        width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="black" />
                    </ScaleButton>

                    <View style={{ width: 50, alignItems: 'center' }}>
                        <Text style={{ color: '#FFC107', fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                            {formatTime(position)}
                        </Text>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    trackTitle: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    badge: {
        backgroundColor: '#FFC107',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        color: 'black',
        fontWeight: 'bold',
    },
    mixerContainer: {
        flex: 1,
    },
    trackRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#111',
        marginBottom: 15,
        padding: 20,
        borderRadius: 15,
        borderLeftWidth: 4,
        borderLeftColor: '#FFC107',
    },
    trackLabel: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    downloadText: {
        color: '#888',
        fontSize: 12,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    status: {
        color: '#FFC107',
        fontWeight: 'bold',
        fontSize: 12,
    },
    mutedText: {
        color: '#555',
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: '#222',
        paddingTop: 10,
        paddingBottom: 20,
        backgroundColor: '#000',
        width: '100%',
    },
    sliderContainer: {
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    footerControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    playButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#FFC107',
        justifyContent: 'center',
        alignItems: 'center',
        // No shadow/elevation as requested
    },
    backButton: {
        padding: 10,
    },
    backText: {
        color: '#666',
    },
    text: { color: 'white', marginTop: 10 }
});
