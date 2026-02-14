import axios from 'axios';
import { Platform } from 'react-native';

// Use LAN IP for better compatibility with physical devices
// Use LAN IP detected by Metro (check npx expo start output if this changes)
const BASE_URL = 'http://192.168.31.113:8000';

const api = axios.create({
    baseURL: BASE_URL,
});

export const separateAudio = async (fileUri, fileName, mimeType, taskId, abortSignal) => {
    const formData = new FormData();

    if (Platform.OS === 'web') {
        const req = await fetch(fileUri);
        const blob = await req.blob();
        formData.append('file', blob, fileName);
    } else {
        formData.append('file', {
            uri: fileUri,
            name: fileName,
            type: mimeType || 'audio/wav',
        });
    }

    try {
        const url = taskId ? `${BASE_URL}/separate?task_id=${taskId}` : `${BASE_URL}/separate`;
        console.log("Uploading with fetch to:", url);

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json',
                // Explicitly letting the browser/engine set Content-Type + Boundary
            },
            signal: abortSignal,
        });

        const result = await response.json();

        if (!response.ok) {
            if (response.status === 499) {
                const err = new Error("Task cancelled");
                err.status = 499;
                throw err;
            }

            console.error('Server Error Detail:', JSON.stringify(result));
            throw new Error(result.detail || result.message || 'Server returned an error');
        }

        return result;
    } catch (error) {
        // Suppress logging for cancellation errors
        if (error.name === 'AbortError' || error.status === 499 || error.message === 'Task cancelled') {
            // Squelch
        } else {
            console.error('Upload Failed:', error);
        }
        throw error;
    }
};

export const fetchProgress = async (taskId) => {
    try {
        const response = await fetch(`${BASE_URL}/progress/${taskId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Progress Fetch Failed:', error);
        return null;
    }
};

export const cancelTask = async (taskId) => {
    try {
        const response = await fetch(`${BASE_URL}/cancel/${taskId}`, {
            method: 'POST',
        });
        return response.ok;
    } catch (error) {
        console.error('Cancel Task Failed:', error);
        return false;
    }
};

export default api;
