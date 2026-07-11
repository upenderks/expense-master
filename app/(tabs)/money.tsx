import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, Alert, FlatList } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getBorrowers, getTransactions, createTransaction, updateTransaction, deleteTransaction, createBorrower, updateBorrower, deleteBorrower } from '../../src/lib/database';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Select } from '../../src/components/Select';
import  DatePicker  from '../../src/components/DatePicker';
import  DateRangeFilter  from '../../src/components/DateRangeFilter';

type Tab = 'borrowers' | 'transactions';

export default function Money() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('borrowers');
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Date filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [borrowerModal, setBorrowerModal] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<any>(null);
  const [transactionModal, setTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  // Form data
  const [borrowerForm, setBorrowerForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const [transactionForm, setTransactionForm] = useState({ 
    borrowerId: '' as number | string, 
    type: 'given' as 'given' | 'received', 
    amount: '', 
    date: new Date().toISOString().split('T')[0], 
    description: '' 
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const filters = (startDate || endDate) ? { startDate: startDate || undefined, endDate: endDate || undefined } : undefined;
      const [borrowersData, transactionsData] = await Promise.all([
        getBorrowers(user.id),
        getTransactions(user.id, filters),
      ]);
      setBorrowers(borrowersData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user, startDate, endDate]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const openBorrowerModal = (borrower?: any) => {
    if (borrower) {
      setEditingBorrower(borrower);
      setBorrowerForm({ name: borrower.name, phone: borrower.phone || '', email: borrower.email || '', address: borrower.address || '', notes: borrower.notes || '' });
    } else {
      setEditingBorrower(null);
      setBorrowerForm({ name: '', phone: '', email: '', address: '', notes: '' });
    }
    setBorrowerModal(true);
  };

  const handleSaveBorrower = async () => {
    if (!borrowerForm.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingBorrower) {
        await updateBorrower(editingBorrower.id, user!.id, borrowerForm.name, borrowerForm.phone, borrowerForm.email, borrowerForm.address, borrowerForm.notes);
      } else {
        await createBorrower(user!.id, borrowerForm.name, borrowerForm.phone, borrowerForm.email, borrowerForm.address, borrowerForm.notes);
      }
      setBorrowerModal(false);
      loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBorrower = (id: number, name: string) => {
    Alert.alert('Delete Borrower', `Delete ${name}? This will also delete all transactions.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteBorrower(id, user!.id);
        loadData();
      }},
    ]);
  };

  // NEW: Open transaction modal for edit or add
  const openTransactionModal = (transaction?: any) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setTransactionForm({
        borrowerId: transaction.borrower_id,
        type: transaction.type,
        amount: transaction.amount.toString(),
        date: transaction.date,
        description: transaction.description || '',
      });
    } else {
      setEditingTransaction(null);
      setTransactionForm({ borrowerId: '', type: 'given', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
    }
    setTransactionModal(true);
  };

  // NEW: Handle save for both add and edit
  const handleSaveTransaction = async () => {
    if (!transactionForm.borrowerId || !transactionForm.amount) {
      Alert.alert('Error', 'Please select borrower and enter amount');
      return;
    }
    setSaving(true);
    try {
      if (editingTransaction) {
        await updateTransaction(
          editingTransaction.id,
          user!.id,
          Number(transactionForm.borrowerId),
          transactionForm.type,
          parseFloat(transactionForm.amount),
          transactionForm.date,
          transactionForm.description
        );
      } else {
        await createTransaction(
          user!.id,
          Number(transactionForm.borrowerId),
          transactionForm.type,
          parseFloat(transactionForm.amount),
          transactionForm.date,
          transactionForm.description
        );
      }
      setTransactionModal(false);
      loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = (id: number) => {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteTransaction(id, user!.id);
        loadData();
      }},
    ]);
  };

  const formatCurrency = (amount: number) => '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // Use filtered totals based on date range
  const totalGiven = transactions.filter(t => t.type === 'given').reduce((s, t) => s + t.amount, 0);
  const totalReceived = transactions.filter(t => t.type === 'received').reduce((s, t) => s + t.amount, 0);

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'borrowers' && styles.activeTab]} onPress={() => setActiveTab('borrowers')}>
          <Text style={[styles.tabText, activeTab === 'borrowers' && styles.activeTabText]}>👥 Borrowers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'transactions' && styles.activeTab]} onPress={() => setActiveTab('transactions')}>
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.activeTabText]}>💱 Transactions</Text>
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {activeTab === 'borrowers' ? (
          <>
            {borrowers.length === 0 ? (
              <Card><Text style={styles.empty}>No borrowers yet. Tap + to add one.</Text></Card>
            ) : (
              borrowers.map((b) => (
                <Card key={b.id} style={styles.itemCard}>
                  <View style={styles.borrowerHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{b.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.borrowerName}>{b.name}</Text>
                      {b.phone && <Text style={styles.borrowerMeta}>📞 {b.phone}</Text>}
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity onPress={() => openBorrowerModal(b)} style={styles.editBtn}>
                        <Text style={styles.editBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteBorrower(b.id, b.name)}>
                        <Text style={styles.deleteBtn}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Balance:</Text>
                    <Text style={[styles.balanceAmount, b.balance > 0 ? styles.positive : b.balance < 0 ? styles.negative : styles.neutral]}>
                      {b.balance > 0 ? `Owes ${formatCurrency(b.balance)}` : b.balance < 0 ? `Owed ${formatCurrency(Math.abs(b.balance))}` : 'Settled'}
                    </Text>
                  </View>
                  <View style={styles.borrowerActions}>
                    <Button title="+ Money" onPress={() => { setTransactionForm({ ...transactionForm, borrowerId: b.id }); openTransactionModal(); }} style={styles.actionBtn} />
                  </View>
                </Card>
              ))
            )}
            <Button title="+ Add Borrower" onPress={() => openBorrowerModal()} style={styles.addBtn} />
          </>
        ) : (
          <>
            {/* NEW: Date Range Filter */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                onClear={clearDateFilter}
              />
            </View>

            <View style={styles.summaryRow}>
              <Card style={[styles.summaryCard, { backgroundColor: '#fef2f2' }]}>
                <Text style={styles.summaryLabel}>Given</Text>
                <Text style={[styles.summaryValue, { color: '#dc2626' }]}>{formatCurrency(totalGiven)}</Text>
              </Card>
              <Card style={[styles.summaryCard, { backgroundColor: '#ecfdf5' }]}>
                <Text style={styles.summaryLabel}>Received</Text>
                <Text style={[styles.summaryValue, { color: '#059669' }]}>{formatCurrency(totalReceived)}</Text>
              </Card>
            </View>
            {transactions.length === 0 ? (
              <Card><Text style={styles.empty}>No transactions {startDate || endDate ? 'in this date range' : 'yet'}</Text></Card>
            ) : (
              transactions.map((t) => (
                <Card key={t.id} style={styles.itemCard}>
                  <View style={styles.transactionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.transactionName}>{t.borrower_name}</Text>
                      <Text style={styles.transactionType}>{t.type === 'given' ? '💸 Money Given' : '💰 Money Received'}</Text>
                      <Text style={styles.transactionDate}>📅 {t.date}</Text>
                      {t.description && <Text style={styles.transactionDesc}>{t.description}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.transactionAmount, t.type === 'given' ? styles.negative : styles.positive]}>
                        {t.type === 'given' ? '-' : '+'}{formatCurrency(t.amount)}
                      </Text>
                      {/* NEW: Edit & Delete buttons */}
                      <View style={styles.actionButtons}>
                        <TouchableOpacity onPress={() => openTransactionModal(t)} style={styles.editBtn}>
                          <Text style={styles.editBtnText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteTransaction(t.id)}>
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            )}
            <Button title="+ Add Transaction" onPress={() => openTransactionModal()} style={styles.addBtn} />
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Borrower Modal */}
      <Modal visible={borrowerModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingBorrower ? 'Edit Borrower' : 'Add Borrower'}</Text>
            <Input label="Name *" value={borrowerForm.name} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, name: t })} placeholder="Name" />
            <Input label="Phone" value={borrowerForm.phone} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, phone: t })} placeholder="Phone" keyboardType="phone-pad" />
            <Input label="Email" value={borrowerForm.email} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, email: t })} placeholder="Email" />
            <Input label="Address" value={borrowerForm.address} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, address: t })} placeholder="Address" />
            <Input label="Notes" value={borrowerForm.notes} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, notes: t })} placeholder="Notes" />
            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="secondary" onPress={() => setBorrowerModal(false)} />
              <Button title="Save" onPress={handleSaveBorrower} loading={saving} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Modal - Updated with DatePicker */}
      <Modal visible={transactionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</Text>
            <Select label="Borrower" value={transactionForm.borrowerId} onChange={(v) => setTransactionForm({ ...transactionForm, borrowerId: v })} options={borrowers.map(b => ({ value: b.id, label: b.name }))} />
            <View style={styles.typeToggle}>
              <TouchableOpacity style={[styles.typeButton, transactionForm.type === 'given' && styles.typeActive]} onPress={() => setTransactionForm({ ...transactionForm, type: 'given' })}>
                <Text style={[styles.typeText, transactionForm.type === 'given' && styles.typeTextActive]}>💸 Given</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeButton, transactionForm.type === 'received' && styles.typeActive]} onPress={() => setTransactionForm({ ...transactionForm, type: 'received' })}>
                <Text style={[styles.typeText, transactionForm.type === 'received' && styles.typeTextActive]}>💰 Received</Text>
              </TouchableOpacity>
            </View>
            <Input label="Amount" value={transactionForm.amount} onChangeText={(t) => setTransactionForm({ ...transactionForm, amount: t })} placeholder="0" keyboardType="numeric" />
            {/* NEW: Date Picker for transaction date */}
            <DatePicker
              label="Date"
              value={transactionForm.date}
              onChange={(d) => setTransactionForm({ ...transactionForm, date: d })}
            />
            <Input label="Description" value={transactionForm.description} onChangeText={(t) => setTransactionForm({ ...transactionForm, description: t })} placeholder="Optional description" />
            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="secondary" onPress={() => setTransactionModal(false)} />
              <Button title="Save" onPress={handleSaveTransaction} loading={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  tabs: { flexDirection: 'row', backgroundColor: '#e5e7eb', margin: 16, borderRadius: 8, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  activeTab: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, color: '#6b7280' },
  activeTabText: { color: '#111827', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9ca3af', padding: 20 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },
  borrowerHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  borrowerName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  borrowerMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: 4 },
  editBtn: { padding: 6, backgroundColor: '#dbeafe', borderRadius: 6 },
  editBtnText: { fontSize: 14 },
  deleteBtn: { fontSize: 18, padding: 4 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  balanceLabel: { fontSize: 14, color: '#6b7280' },
  balanceAmount: { fontSize: 14, fontWeight: '600' },
  positive: { color: '#059669' },
  negative: { color: '#dc2626' },
  neutral: { color: '#6b7280' },
  borrowerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1 },
  addBtn: { marginHorizontal: 16, marginTop: 8 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, alignItems: 'center', padding: 12 },
  summaryLabel: { fontSize: 12, color: '#6b7280' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  transactionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  transactionName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  transactionType: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  transactionDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  transactionDesc: { fontSize: 13, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },
  transactionAmount: { fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  typeToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#e5e7eb' },
  typeActive: { backgroundColor: '#3b82f6' },
  typeText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  typeTextActive: { color: '#fff' },
});
