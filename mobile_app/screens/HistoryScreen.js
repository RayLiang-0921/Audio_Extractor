import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getHistory, deleteTrack } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';

export default function HistoryScreen({ navigation }) {
    const { t } = useLanguage();
    const [history, setHistory] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    // Custom Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState(null);

    const loadData = useCallback(async () => {
        const data = await getHistory();
        setHistory(data);
    }, []);

    // Load on focus
    React.useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadData();
        });
        return unsubscribe;
    }, [navigation, loadData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const confirmDelete = (item) => {
        setSelectedTrack(item);
        setModalVisible(true);
    };

    const performDelete = async () => {
        if (selectedTrack) {
            await deleteTrack(selectedTrack.id);
            loadData(); // Refresh
        }
        setModalVisible(false);
        setSelectedTrack(null);
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('Player', {
                stems: item.stems,
                key: item.key,
                trackName: item.name
            })}
            onLongPress={() => confirmDelete(item)}
        >
            <View style={styles.itemInfo}>
                <Ionicons name="musical-note" size={24} color="#FFC107" style={{ marginRight: 15 }} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemDate}>
                        {new Date(item.timestamp).toLocaleString()} • Key: {item.key || '?'}
                    </Text>
                </View>
            </View>
            <TouchableOpacity
                onPress={() => confirmDelete(item)}
                style={{
                    padding: 15,
                    marginLeft: 5,
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                <Ionicons name="trash" size={24} color="#FF4444" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('history_title')}</Text>
                <View style={{ width: 44 }} />
            </View>

            {history.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>{t('no_history')}</Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.id || item.timestamp.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFC107" />
                    }
                />
            )}

            {/* Custom Delete Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconContainer}>
                            <Ionicons name="trash-bin-outline" size={40} color="#FF4444" />
                        </View>
                        <Text style={styles.modalTitle}>{t('delete_track')}</Text>
                        <Text style={styles.modalMessage}>
                            {t('delete_confirm', { name: selectedTrack?.name })}
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.btnText}>{t('cancel')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, styles.deleteBtn]}
                                onPress={performDelete}
                            >
                                <Text style={[styles.btnText, { color: '#FFF' }]}>{t('delete')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    title: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    listContent: {
        padding: 20,
    },
    item: {
        backgroundColor: '#111',
        borderRadius: 12,
        marginBottom: 15,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderWidth: 1,
        borderColor: '#222',
    },
    itemInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    itemDate: {
        color: '#888',
        fontSize: 12,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    modalIconContainer: {
        marginBottom: 20,
        padding: 15,
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        borderRadius: 50,
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    modalMessage: {
        color: '#CCC',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    modalActions: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        gap: 15,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: '#333',
    },
    deleteBtn: {
        backgroundColor: '#FF4444',
    },
    btnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
