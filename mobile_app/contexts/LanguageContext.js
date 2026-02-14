import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../services/translations';

const LanguageContext = createContext();

const LANGUAGE_KEY = 'audio_extractor_language';

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('en'); // Default to English
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLanguage();
    }, []);

    const loadLanguage = async () => {
        try {
            const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
            if (savedLanguage && translations[savedLanguage]) {
                setLanguage(savedLanguage);
            }
        } catch (e) {
            console.error("Failed to load language", e);
        } finally {
            setLoading(false);
        }
    };

    const changeLanguage = async (lang) => {
        if (!translations[lang]) return;
        setLanguage(lang);
        try {
            await AsyncStorage.setItem(LANGUAGE_KEY, lang);
        } catch (e) {
            console.error("Failed to save language", e);
        }
    };

    const t = (key, params = {}) => {
        const text = translations[language][key] || translations['en'][key] || key;

        // Simple parameter replacement {name}
        return text.replace(/{(\w+)}/g, (_, k) => {
            return params[k] !== undefined ? params[k] : `{${k}}`;
        });
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t, loading }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
