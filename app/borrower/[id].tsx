import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import {
  getBorrowers,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  updateBorrower,
  deleteBorrower,
} from '../../src/lib/database';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import DatePicker from '../../src/components/DatePicker';
import DateRangeFilter from '../../src/components/DateRangeFilter';
import { HorizontalBarChart } from '../../src/components/charts/HorizontalBarChart';

export default function BorrowerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const borrowerId = Number(id);

  const [borrower, setBorrower] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Date filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [transactionModal, setTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editBorrowerModal, setEditBorrowerModal] = useState(false);

  // Forms
  const [transactionForm, setTransactionForm] = useState({
    type: 'given' as 'given' | 'received',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [borrowerForm, setBorrowerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  // ── Load Data ───────────────────────────────────────────────────────

  const loadData = async () => {
    if (!user || !borrowerId) return;
    try {
      const allBorrowers = await getBorrowers(user.id);
      const found = allBorrowers.find((b: any) => b.id === borrowerId);
      setBorrower(found || null);

      const filters: any = { borrowerId };
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const txs = await getTransactions(user.id, filters);
      setTransactions(txs);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user, borrowerId, startDate, endDate])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  // ── Transaction handlers ────────────────────────────────────────────

  const openTransactionModal = (transaction?: any) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setTransactionForm({
        type: transaction.type,
        amount: String(transaction.amount),
        date: transaction.date,
        description: transaction.description || '',
      });
    } else {
      setEditingTransaction(null);
      setTransactionForm({
        type: 'given',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
    }
    setTransactionModal(true);
  };

  const handleSaveTransaction = async () => {
    if (!transactionForm.amount) {
      Alert.alert('Error', 'Please enter amount');
      return;
    }
    setSaving(true);
    try {
      if (editingTransaction) {
        await updateTransaction(
          editingTransaction.id,
          user!.id,
          borrowerId,
          transactionForm.type,
          parseFloat(transactionForm.amount),
          transactionForm.date,
          transactionForm.description
        );
      } else {
        await createTransaction(
          user!.id,
          borrowerId,
          transactionForm.type,
          parseFloat(transactionForm.amount),
          transactionForm.date,
          transactionForm.description
        );
      }
      setTransactionModal(false);
      await loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = (txId: number) => {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(txId, user!.id);
          await loadData();
        },
      },
    ]);
  };

  // ── Borrower handlers ──────────────────────────────────────────────

  const openEditBorrower = () => {
    if (!borrower) return;
    setBorrowerForm({
      name: borrower.name,
      phone: borrower.phone || '',
      email: borrower.email || '',
      address: borrower.address || '',
      notes: borrower.notes || '',
    });
    setEditBorrowerModal(true);
  };

  const handleSaveBorrower = async () => {
    if (!borrowerForm.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      await updateBorrower(
        borrowerId,
        user!.id,
        borrowerForm.name.trim(),
        borrowerForm.phone,
        borrowerForm.email,
        borrowerForm.address,
        borrowerForm.notes
      );
      setEditBorrowerModal(false);
      await loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBorrower = () => {
    Alert.alert(
      'Delete Borrower',
      `Delete ${borrower?.name}? This will also delete all their transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBorrower(borrowerId, user!.id);
            router.back();
          },
        },
      ]
    );
  };

  // ── Quick actions ──────────────────────────────────────────────────

  const handleCall = () => {
    if (borrower?.phone) {
      Linking.openURL(`tel:${borrower.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (borrower?.phone) {
      const phone = borrower.phone.replace(/[^0-9]/g, '');
      const message = `Hi ${borrower.name}`;
      Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`);
    }
  };

  const handleEmail = () => {
    if (borrower?.email) {
      Linking.openURL(`mailto:${borrower.email}`);
    }
  };

  // ── Formatting ─────────────────────────────────────────────────────

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const formatShort = (amount: number) => {
    if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
    if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
    return '₹' + amount.toFixed(0);
  };

  // ── Computed values ────────────────────────────────────────────────

  const totalGiven = transactions
    .filter((t) => t.type === 'given')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const totalReceived = transactions
    .filter((t) => t.type === 'received')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const outstanding = totalGiven - totalReceived;

  const chartData = [
    { label: 'Given', value: totalGiven, color: '#dc2626' },
    { label: 'Received', value: totalReceived, color: '#059669' },
  ];

  // ── Loading / Not found ────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!borrower) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Borrower not found</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openEditBorrower}>
          <Text style={styles.editHeaderBtn}>✏️ Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {borrower.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{borrower.name}</Text>
              {borrower.phone && (
                <Text style={styles.profileMeta}>📞 {borrower.phone}</Text>
              )}
              {borrower.email && (
                <Text style={styles.profileMeta}>✉️ {borrower.email}</Text>
              )}
              {borrower.address && (
                <Text style={styles.profileMeta}>📍 {borrower.address}</Text>
              )}
              {borrower.notes && (
                <Text style={styles.profileNotes}>📝 {borrower.notes}</Text>
              )}
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            {borrower.phone && (
              <TouchableOpacity style={styles.quickActionBtn} onPress={handleCall}>
                <Text style={styles.quickActionIcon}>📞</Text>
                <Text style={styles.quickActionText}>Call</Text>
              </TouchableOpacity>
            )}
            {borrower.phone && (
              <TouchableOpacity
                style={[styles.quickActionBtn, styles.whatsappBtn]}
                onPress={handleWhatsApp}
              >
                <Text style={styles.quickActionIcon}>💬</Text>
                <Text style={styles.quickActionText}>WhatsApp</Text>
              </TouchableOpacity>
            )}
            {borrower.email && (
              <TouchableOpacity style={styles.quickActionBtn} onPress={handleEmail}>
                <Text style={styles.quickActionIcon}>✉️</Text>
                <Text style={styles.quickActionText}>Email</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Balance Summary */}
        <View style={styles.summaryGrid}>
          <Card style={[styles.summaryCard, { backgroundColor: '#fef2f2' }]}>
            <Text style={styles.summaryEmoji}>💸</Text>
            <Text style={styles.summaryLabel}>Given</Text>
            <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
              {formatCurrency(totalGiven)}
            </Text>
          </Card>
          <Card style={[styles.summaryCard, { backgroundColor: '#ecfdf5' }]}>
            <Text style={styles.summaryEmoji}>💰</Text>
            <Text style={styles.summaryLabel}>Received</Text>
            <Text style={[styles.summaryValue, { color: '#059669' }]}>
              {formatCurrency(totalReceived)}
            </Text>
          </Card>
        </View>

        {/* Outstanding Badge */}
        <Card
          style={[
            styles.outstandingCard,
            {
              backgroundColor:
                outstanding > 0
                  ? '#fef2f2'
                  : outstanding < 0
                  ? '#ecfdf5'
                  : '#f9fafb',
            },
          ]}
        >
          <Text style={styles.outstandingLabel}>
            {outstanding > 0
              ? '⚠️ They Owe You'
              : outstanding < 0
              ? '⚠️ You Owe Them'
              : '✅ All Settled'}
          </Text>
          <Text
            style={[
              styles.outstandingValue,
              {
                color:
                  outstanding > 0
                    ? '#dc2626'
                    : outstanding < 0
                    ? '#059669'
                    : '#6b7280',
              },
            ]}
          >
            {formatCurrency(Math.abs(outstanding))}
          </Text>
          <Text style={styles.outstandingMeta}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </Text>
        </Card>

        {/* Chart */}
        {(totalGiven > 0 || totalReceived > 0) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Given vs Received</Text>
            <HorizontalBarChart data={chartData} formatValue={formatShort} />
          </Card>
        )}

        {/* Quick Add Buttons */}
        <View style={styles.quickAddRow}>
          <TouchableOpacity
            style={[styles.quickAddBtn, styles.quickAddGiven]}
            onPress={() => {
              setTransactionForm({
                type: 'given',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
              });
              setEditingTransaction(null);
              setTransactionModal(true);
            }}
          >
            <Text style={styles.quickAddIcon}>💸</Text>
            <Text style={styles.quickAddText}>Give Money</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAddBtn, styles.quickAddReceived]}
            onPress={() => {
              setTransactionForm({
                type: 'received',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
              });
              setEditingTransaction(null);
              setTransactionModal(true);
            }}
          >
            <Text style={styles.quickAddIcon}>💰</Text>
            <Text style={styles.quickAddText}>Receive Money</Text>
          </TouchableOpacity>
        </View>

        {/* Date Filter */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
            onClear={clearDateFilter}
            title="📅 Filter Transactions"
            autoSetDefaults={false}
          />
        </View>

        {/* Transactions List */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>
            📋 Transactions ({transactions.length})
          </Text>
          {transactions.length === 0 ? (
            <Text style={styles.empty}>
              No transactions{startDate || endDate ? ' in this date range' : ' yet'}
            </Text>
          ) : (
            transactions.map((t) => (
              <View key={t.id} style={styles.txRow}>
                <View
                  style={[
                    styles.txIcon,
                    {
                      backgroundColor:
                        t.type === 'given' ? '#fef2f2' : '#ecfdf5',
                    },
                  ]}
                >
                  <Text style={styles.txIconText}>
                    {t.type === 'given' ? '↗️' : '↙️'}
                  </Text>
                </View>

                <View style={styles.txInfo}>
                  <Text style={styles.txType}>
                    {t.type === 'given' ? 'Money Given' : 'Money Received'}
                  </Text>
                  <Text style={styles.txDate}>📅 {t.date}</Text>
                  {t.description && (
                    <Text style={styles.txDesc}>{t.description}</Text>
                  )}
                </View>

                <View style={styles.txRight}>
                  <Text
                    style={[
                      styles.txAmount,
                      t.type === 'given' ? styles.negative : styles.positive,
                    ]}
                  >
                    {t.type === 'given' ? '-' : '+'}
                    {formatCurrency(t.amount)}
                  </Text>
                  <View style={styles.txActions}>
                    <TouchableOpacity
                      onPress={() => openTransactionModal(t)}
                      style={styles.txEditBtn}
                    >
                      <Text style={styles.txEditBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteTransaction(t.id)}
                    >
                      <Text style={styles.txDeleteBtn}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Danger Zone */}
        <Card style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>⚠️ Danger Zone</Text>
          <Text style={styles.dangerDesc}>
            Deleting this borrower will remove all their transactions permanently.
          </Text>
          <Button
            title="🗑️ Delete Borrower"
            variant="danger"
            onPress={handleDeleteBorrower}
          />
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Transaction Modal ──────────────────────────────────────── */}
      <Modal visible={transactionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
            </Text>

            {/* Type Toggle */}
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  transactionForm.type === 'given' && styles.typeGivenActive,
                ]}
                onPress={() =>
                  setTransactionForm({ ...transactionForm, type: 'given' })
                }
              >
                <Text
                  style={[
                    styles.typeText,
                    transactionForm.type === 'given' && styles.typeTextActive,
                  ]}
                >
                  💸 Given
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  transactionForm.type === 'received' &&
                    styles.typeReceivedActive,
                ]}
                onPress={() =>
                  setTransactionForm({ ...transactionForm, type: 'received' })
                }
              >
                <Text
                  style={[
                    styles.typeText,
                    transactionForm.type === 'received' &&
                      styles.typeTextActive,
                  ]}
                >
                  💰 Received
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Amount *"
              value={transactionForm.amount}
              onChangeText={(t) =>
                setTransactionForm({ ...transactionForm, amount: t })
              }
              placeholder="0"
              keyboardType="numeric"
            />

            <DatePicker
              label="Date"
              value={transactionForm.date}
              onChange={(d) =>
                setTransactionForm({ ...transactionForm, date: d })
              }
            />

            <Input
              label="Description"
              value={transactionForm.description}
              onChangeText={(t) =>
                setTransactionForm({ ...transactionForm, description: t })
              }
              placeholder="Optional description"
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setTransactionModal(false)}
              />
              <Button
                title="Save"
                onPress={handleSaveTransaction}
                loading={saving}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Borrower Modal ────────────────────────────────────── */}
      <Modal visible={editBorrowerModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScrollContent} bounces={false}>
            <View style={styles.modalInner}>
              <Text style={styles.modalTitle}>Edit Borrower</Text>

              <Input
                label="Name *"
                value={borrowerForm.name}
                onChangeText={(t) =>
                  setBorrowerForm({ ...borrowerForm, name: t })
                }
                placeholder="Name"
              />
              <Input
                label="Phone"
                value={borrowerForm.phone}
                onChangeText={(t) =>
                  setBorrowerForm({ ...borrowerForm, phone: t })
                }
                placeholder="Phone"
                keyboardType="phone-pad"
              />
              <Input
                label="Email"
                value={borrowerForm.email}
                onChangeText={(t) =>
                  setBorrowerForm({ ...borrowerForm, email: t })
                }
                placeholder="Email"
              />
              <Input
                label="Address"
                value={borrowerForm.address}
                onChangeText={(t) =>
                  setBorrowerForm({ ...borrowerForm, address: t })
                }
                placeholder="Address"
              />
              <Input
                label="Notes"
                value={borrowerForm.notes}
                onChangeText={(t) =>
                  setBorrowerForm({ ...borrowerForm, notes: t })
                }
                placeholder="Notes"
              />

              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setEditBorrowerModal(false)}
                />
                <Button
                  title="Save"
                  onPress={handleSaveBorrower}
                  loading={saving}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: { fontSize: 16, color: '#6b7280' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { paddingVertical: 6 },
  backBtnText: { fontSize: 16, color: '#3b82f6', fontWeight: '600' },
  editHeaderBtn: { fontSize: 15, color: '#3b82f6', fontWeight: '600' },

  // Profile
  profileCard: { margin: 16, marginBottom: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 22, fontWeight: '700', color: '#111827' },
  profileMeta: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  profileNotes: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 3,
    fontStyle: 'italic',
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    borderRadius: 10,
  },
  whatsappBtn: { backgroundColor: '#ecfdf5' },
  quickActionIcon: { fontSize: 16 },
  quickActionText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  // Summary
  summaryGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  summaryEmoji: { fontSize: 22, marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: '#6b7280' },
  summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },

  // Outstanding
  outstandingCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 18,
  },
  outstandingLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  outstandingValue: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  outstandingMeta: { fontSize: 12, color: '#9ca3af', marginTop: 6 },

  // Section
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 14,
  },
  empty: { textAlign: 'center', color: '#9ca3af', paddingVertical: 20 },

  // Quick add
  quickAddRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  quickAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  quickAddGiven: { backgroundColor: '#dc2626' },
  quickAddReceived: { backgroundColor: '#059669' },
  quickAddIcon: { fontSize: 18 },
  quickAddText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Transaction rows
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txIconText: { fontSize: 16 },
  txInfo: { flex: 1, marginLeft: 10 },
  txType: { fontSize: 14, fontWeight: '500', color: '#111827' },
  txDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  txDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 3,
    fontStyle: 'italic',
  },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 16, fontWeight: '700' },
  txActions: { flexDirection: 'row', gap: 4, marginTop: 6 },
  txEditBtn: { padding: 4, backgroundColor: '#dbeafe', borderRadius: 6 },
  txEditBtnText: { fontSize: 12 },
  txDeleteBtn: { fontSize: 16, padding: 4 },

  positive: { color: '#059669' },
  negative: { color: '#dc2626' },

  // Danger zone
  dangerCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: '#dc2626', marginBottom: 6 },
  dangerDesc: { fontSize: 13, color: '#6b7280', marginBottom: 14 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalScrollContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  modalInner: {
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },

  // Type toggle
  typeToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  typeGivenActive: { backgroundColor: '#dc2626' },
  typeReceivedActive: { backgroundColor: '#059669' },
  typeText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  typeTextActive: { color: '#fff' },
});