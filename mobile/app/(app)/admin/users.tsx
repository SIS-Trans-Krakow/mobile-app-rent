import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Alert, ActivityIndicator, Modal, Switch,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { useAuthStore } from '../../../stores/auth';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';

interface UserItem {
  id: number;
  username: string;
  full_name: string;
  role: string;
  active: number;
}

export default function UsersScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [])
  );

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Load users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUsername.trim() || !newPassword.trim() || !newFullName.trim()) {
      Alert.alert(t('common.error'), t('common.required'));
      return;
    }
    setCreating(true);
    try {
      await api.post('/users', {
        username: newUsername.trim(),
        password: newPassword,
        full_name: newFullName.trim(),
        role: newRole,
      });
      Alert.alert(t('common.success'), t('admin.userCreated'));
      setModalVisible(false);
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('user');
      loadUsers();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || 'Error');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (u: UserItem) => {
    try {
      await api.patch(`/users/${u.id}`, { active: !u.active });
      loadUsers();
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  };

  const deleteUser = async (targetUser: UserItem) => {
    Alert.alert(
      t('common.delete'),
      `${t('admin.deleteUserConfirm')} ${targetUser.full_name}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${targetUser.id}`);
              Alert.alert(t('common.success'), t('admin.userDeleted'));
              loadUsers();
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.response?.data?.error || 'Error');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.userName}>{item.full_name}</Text>
              <Text style={styles.userDetail}>@{item.username} · {item.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}</Text>
            </View>
            <View style={styles.cardActions}>
              <Text style={[styles.statusText, { color: item.active ? Colors.success : Colors.danger }]}>
                {item.active ? t('admin.active') : t('admin.inactive')}
              </Text>
              <View style={styles.actionsRow}>
                <Switch
                  value={!!item.active}
                  onValueChange={() => toggleActive(item)}
                  trackColor={{ true: Colors.success }}
                />
                {user?.id !== item.id && (
                  <TouchableOpacity
                    style={styles.deleteIconBtn}
                    onPress={() => deleteUser(item)}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="person-add" size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('admin.createUser')}</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.label}>{t('auth.username')} *</Text>
            <TextInput style={styles.input} value={newUsername} onChangeText={setNewUsername}
              autoCapitalize="none" placeholder={t('auth.username')} placeholderTextColor={Colors.gray400} />

            <Text style={styles.label}>{t('auth.password')} *</Text>
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword}
              secureTextEntry placeholder={t('auth.password')} placeholderTextColor={Colors.gray400} />

            <Text style={styles.label}>{t('admin.fullName')} *</Text>
            <TextInput style={styles.input} value={newFullName} onChangeText={setNewFullName}
              placeholder={t('admin.fullName')} placeholderTextColor={Colors.gray400} />

            <Text style={styles.label}>{t('admin.role')}</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleChip, newRole === 'user' && styles.roleChipActive]}
                onPress={() => setNewRole('user')}
              >
                <Text style={[styles.roleChipText, newRole === 'user' && styles.roleChipTextActive]}>
                  {t('admin.roleUser')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleChip, newRole === 'admin' && styles.roleChipActive]}
                onPress={() => setNewRole('admin')}
              >
                <Text style={[styles.roleChipText, newRole === 'admin' && styles.roleChipTextActive]}>
                  {t('admin.roleAdmin')}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.createBtn} onPress={createUser} disabled={creating}>
              {creating ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.createBtnText}>{t('admin.createUser')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardContent: { flex: 1 },
  userName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  userDetail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cardActions: { alignItems: 'center' },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: { fontSize: FontSize.xs, fontWeight: '600', marginBottom: 4 },
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: Spacing.xl,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  modalBody: { padding: Spacing.lg },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleChipText: { fontSize: FontSize.sm, color: Colors.text },
  roleChipTextActive: { color: Colors.white, fontWeight: '600' },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  createBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '600' },
});
