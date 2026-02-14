import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, Animated, Easing, Modal, Dimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { separateAudio, fetchProgress, cancelTask } from '../services/api';
import { saveTrack } from '../services/storage'; // History
import { useLanguage } from '../contexts/LanguageContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Reusable ScaleButton Component (Non-Bouncy)
const ScaleButton = ({ onPress, style, children, disabled }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.timing(scale, {
            toValue: 0.95,
            duration: 100,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
        }).start();
    };

    const onPressOut = () => {
        Animated.timing(scale, {
            toValue: 1,
            duration: 100,
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
            style={{ width: '100%', alignItems: 'center' }}
        >
            <Animated.View style={[style, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
};

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export default function HomeScreen({ navigation }) {
    const { t, setLanguage, language } = useLanguage(); // i18n
    const insets = useSafeAreaInsets(); // Get safe area insets
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("Initializing");
    const [startTime, setStartTime] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const currentTaskId = useRef(null);
    const abortController = useRef(null);

    // Language Modal
    const [langModalVisible, setLangModalVisible] = useState(false);

    const languages = [
        { code: 'en', label: 'English' },
        { code: 'zh_tw', label: '繁體中文' },
        { code: 'zh_cn', label: '简体中文' },
        { code: 'ja', label: '日本語' },
        { code: 'ko', label: '한국어' },
        { code: 'es', label: 'Español' },
        { code: 'fr', label: 'Français' },
        { code: 'de', label: 'Deutsch' },
        { code: 'ru', label: 'Русский' }
    ];

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['audio/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];

            if (file.size > MAX_FILE_SIZE) {
                Alert.alert(t('file_too_large'), t('file_too_large_msg'));
                return;
            }

            uploadFile(file);
        } catch (err) {
            console.error(err);
            Alert.alert(t('error'), t('pick_failed'));
        }
    };
    // ... (rest of function) ...
    // Then later in the render loop (jumping to render part)
    {/* Language Picker Modal */ }
    <Modal
        animationType="fade"
        transparent={true}
        visible={langModalVisible}
        onRequestClose={() => setLangModalVisible(false)}
    >
        <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setLangModalVisible(false)}
        >
            <View style={styles.langModalContent}>
                <Text style={styles.langTitle}>Select Language</Text>
                {languages.map((lang, index) => (
                    <TouchableOpacity
                        key={lang.code}
                        style={[
                            styles.langOption,
                            language === lang.code && styles.langOptionSelected,
                            index === languages.length - 1 && { borderBottomWidth: 0 }
                        ]}
                        onPress={() => {
                            setLanguage(lang.code);
                            setLangModalVisible(false);
                        }}
                    >
                        <Text style={[
                            styles.langText,
                            language === lang.code && styles.langTextSelected
                        ]}>
                            {lang.label}
                        </Text>
                        {language === lang.code && <Ionicons name="checkmark" size={20} color="#FFC107" />}
                    </TouchableOpacity>
                ))}
            </View>
        </TouchableOpacity>
    </Modal>

    const uploadFile = async (file) => {
        setLoading(true);
        setProgress(0);
        setStatus("Uploading");
        setStartTime(Date.now());
        setTimeRemaining(null);

        const taskId = generateUUID();
        currentTaskId.current = taskId;
        abortController.current = new AbortController();

        let pollInterval;

        try {
            pollInterval = setInterval(async () => {
                const data = await fetchProgress(taskId);
                if (data) {
                    if (data.status === 'cancelled') {
                        clearInterval(pollInterval);
                        setLoading(false);
                        Alert.alert(t('cancelled_alrt_title'), t('cancelled_alrt_msg'));
                        return;
                    }

                    setProgress(data.progress);
                    // Map backend status to translation key if possible, else direct
                    // Assuming backend returns lowercase status like "analyzing"
                    setStatus(data.status);

                    if (data.progress > 0 && data.progress < 100) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const totalEstimated = (elapsed / data.progress) * 100;
                        const remaining = totalEstimated - elapsed;
                        setTimeRemaining(remaining > 0 ? remaining : 0);
                    }
                }
            }, 1000);

            const data = await separateAudio(
                file.uri,
                file.name,
                file.mimeType,
                taskId,
                abortController.current.signal
            );

            if (data) {
                await saveTrack({
                    id: taskId,
                    name: file.name,
                    key: data.key,
                    stems: data.stems
                });

                navigation.navigate('Player', {
                    stems: data.stems,
                    key: data.key,
                    trackName: file.name
                });
            }

        } catch (error) {
            if (error.name === 'AbortError' || error.message === 'Aborted') {
                console.log('Upload aborted client-side');
            } else if (error.status === 499 || error.message === 'Task cancelled' || error.message.includes('499')) {
                console.log('Cancellation confirmed via API error');
            } else {
                Alert.alert(t('upload_failed'), error.message || 'Could not process audio.');
            }
        } finally {
            if (pollInterval) clearInterval(pollInterval);
            setLoading(false);
            currentTaskId.current = null;
            abortController.current = null;
        }
    };

    const formatTime = (seconds) => {
        if (!seconds) return t('calculating');
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return t('remaining', { time: `${m}m ${s}s` });
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#FFC107" />
                <Text style={styles.loadingText}>
                    {t(status.toLowerCase()) || status.toUpperCase()}...
                </Text>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${progress}%` }]} />
                </View>

                <Text style={styles.percentText}>{progress}%</Text>
                {progress > 0 && progress < 100 && (
                    <Text style={styles.subText}>{formatTime(timeRemaining)}</Text>
                )}

                <TouchableOpacity
                    onPress={async () => {
                        if (abortController.current) {
                            abortController.current.abort();
                        }
                        if (currentTaskId.current) {
                            setStatus("Cancelling");
                            await cancelTask(currentTaskId.current);
                        } else {
                            setLoading(false);
                            setProgress(0);
                        }
                    }}
                    style={{ marginTop: 30, padding: 10 }}
                >
                    <Text style={{ color: '#666', fontSize: 16 }}>{t('cancel')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Language Switcher - Top Right Absolute */}
            {/* Language Switcher - Top Right Absolute */}
            <TouchableOpacity
                onPress={() => setLangModalVisible(true)}
                style={{
                    position: 'absolute',
                    top: insets.top + (Dimensions.get('window').height * 0.02), // 2% of screen height buffer + safe area
                    right: 20,
                    zIndex: 10,
                    padding: 10,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: 25
                }}
            >
                <Ionicons name="globe-outline" size={36} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.content}>
                <View style={[styles.titleContainer, { justifyContent: 'center', width: '100%', marginBottom: 30 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="musical-notes" size={32} color="#FFC107" style={{ marginRight: 10 }} />
                        <Text style={styles.title}>{t('app_title')}</Text>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.instruction}>{t('instruction')}</Text>

                    <ScaleButton style={styles.button} onPress={pickDocument}>
                        <Text style={styles.buttonText}>{t('select_file')}</Text>
                    </ScaleButton>

                    <TouchableOpacity
                        onPress={() => navigation.navigate('History')}
                        style={{ marginTop: 20, padding: 10, flexDirection: 'row', alignItems: 'center' }}
                    >
                        <Ionicons name="time-outline" size={20} color="#666" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#666', fontSize: 16 }}>{t('view_history')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Language Picker Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={langModalVisible}
                onRequestClose={() => setLangModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setLangModalVisible(false)}
                >
                    <View style={styles.langModalContent}>
                        <Text style={styles.langTitle}>{t('select_language')}</Text>
                        {languages.map((lang, index) => (
                            <TouchableOpacity
                                key={lang.code}
                                style={[
                                    styles.langOption,
                                    language === lang.code && styles.langOptionSelected,
                                    index === languages.length - 1 && { borderBottomWidth: 0 }
                                ]}
                                onPress={() => {
                                    setLanguage(lang.code);
                                    setLangModalVisible(false);
                                }}
                            >
                                <Text style={[
                                    styles.langText,
                                    language === lang.code && styles.langTextSelected
                                ]}>
                                    {lang.label}
                                </Text>
                                {language === lang.code && <Ionicons name="checkmark" size={20} color="#FFC107" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        width: '90%',
        alignItems: 'center',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 20,
        color: '#888',
        marginBottom: 40,
    },
    loadingText: {
        color: '#FFC107',
        marginTop: 20,
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center', // Fix alignment
    },
    subText: {
        color: '#666',
        marginTop: 10,
    },
    percentText: {
        color: '#FFF',
        fontSize: 14,
        marginTop: 15, // Increased spacing
        fontWeight: 'bold',
    },
    progressContainer: {
        width: '80%',
        height: 6,
        backgroundColor: '#333',
        borderRadius: 3,
        marginTop: 15,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#FFC107',
    },
    card: {
        width: '100%',
        padding: 30,
        backgroundColor: '#111',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
    },
    instruction: {
        color: '#CCC',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    button: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#FFC107',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 50,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFC107',
        fontSize: 16,
        fontWeight: 'bold',
    },
    // Same modal styles reusing basic structure or custom
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    langModalContent: {
        width: '80%',
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    langTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    langOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    langOptionSelected: {
        backgroundColor: '#222',
        borderRadius: 8,
    },
    langText: {
        color: '#BBB',
        fontSize: 16,
    },
    langTextSelected: {
        color: '#FFC107',
        fontWeight: 'bold',
    }
});
