import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'audio_extractor_history';
const MAX_HISTORY = 20;

export const saveTrack = async (track) => {
    try {
        const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
        let history = historyJson ? JSON.parse(historyJson) : [];

        // Check for duplicates (by task ID or name+key)
        const exists = history.find(h => h.id === track.id || (h.name === track.name && h.key === track.key));
        if (exists) {
            // Move to top? Or ignore? Let's move to top.
            history = history.filter(h => h !== exists);
        }

        const newItem = {
            ...track,
            timestamp: Date.now(),
        };

        history.unshift(newItem);

        if (history.length > MAX_HISTORY) {
            history.pop();
        }

        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        return true;
    } catch (e) {
        console.error("Failed to save history", e);
        return false;
    }
};

export const getHistory = async () => {
    try {
        const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
        return historyJson ? JSON.parse(historyJson) : [];
    } catch (e) {
        console.error("Failed to load history", e);
        return [];
    }
};

export const deleteTrack = async (id) => {
    try {
        const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
        if (!historyJson) return;

        let history = JSON.parse(historyJson);
        history = history.filter(h => h.id !== id);

        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        return history;
    } catch (e) {
        console.error("Failed to delete track", e);
    }
};

export const clearHistory = async () => {
    try {
        await AsyncStorage.removeItem(HISTORY_KEY);
    } catch (e) {
        console.error("Failed to clear history", e);
    }
};
