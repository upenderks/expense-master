import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getBorrowers, getTransactions, getExpenses, getExpenseCategories } from '../../src/lib/database';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Select } from '../../src/components/Select';

type View = 'consolidated' | 'borrower-detail';

export default function More() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('consolidated');
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [borrowerTransactions, setBorrowerTransactions] = useState<any[]>([]);
  const [filterModal, setFilterModal] = useState(false);
  const [expensePeriod, setExpensePeriod] = useState('all');

  const loadData = async () => {
    if (!user) return;
    try {
      const [borrowersData, transactionsData, expensesData, categoriesData] = await Promise.all([
        getBorrowers(user.id),
        getTransactions(user.id),
        getExpenses(user.id),
        getExpenseCategories(user.id),
      ]);
      setBorrowers(borrowersData);
      setAllTransactions(transactionsData);
      setAllExpenses(expensesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Load error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user]));

  const handleBorrowerSelect = (borrower: any) => {
    setSelectedBorrower(borrower);
    const txs = allTransactions.filter(t => t.borrower_id === borrower.id);
    setBorrowerTransactions(txs);
    setView('borrower-detail');
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/login');
      }},
    ]);
  };

  const formatCurrency = (amount: number) => '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // Filter expenses by period
  const now = new Date();
  const filteredExpenses = allExpenses.filter(e => {
    if (expensePeriod === 'all') return true;
    const expDate = new Date(e.date);
    if (expensePeriod === 'day') return expDate.toDateString() === now.toDateString();
    if (expensePeriod === 'week') return (now.getTime() - expDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
    if (expensePeriod === 'month') return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    return true;
  });

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalGiven = allTransactions.filter(t => t.type === 'given').reduce((s, t) => s + t.amount, 0);
  const totalReceived = allTransactions.filter(t => t.type === 'received').reduce((s, t) => s + t.amount, 0);
  const outstanding = totalGiven - totalReceived;

  if (view === 'borrower-detail' && selectedBorrower) {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity onPress={() => setView('consolidated')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.largeAvatar}>
              <Text style={styles.largeAvatarText}>{selectedBorrower.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerName}>{selectedBorrower.name}</Text>
              {selectedBorrower.phone && <Text style={styles.headerMeta}>📞 {selectedBorrower.phone}</Text>}
              {selectedBorrower.email && <Text style={styles.headerMeta}>✉️ {selectedBorrower.email}</Text>}
            </View>
          </View>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={[styles.balanceValue, selectedBorrower.balance > 0 ? styles.positive : selectedBorrower.balance < 0 ? styles.negative : styles.neutral]}>
              {selectedBorrower.balance > 0 ? `Owes You: ${formatCurrency(selectedBorrower.balance)}` : selectedBorrower.balance < 0 ? `You Owe: ${formatCurrency(Math.abs(selectedBorrower.balance))}` : 'Settled'}
            </Text>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Total Given</Text>
              <Text style={[styles.summaryItemValue, { color: '#dc2626' }]}>{formatCurrency(borrowerTransactions.filter(t => t.type === 'given').reduce((s, t) => s + t.amount, 0))}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Total Received</Text>
              <Text style={[styles.summaryItemValue, { color: '#059669' }]}>{formatCurrency(borrowerTransactions.filter(t => t.type === 'received').reduce((s, t) => s + t.amount, 0))}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Transactions</Text>
              <Text style={styles.summaryItemValue}>{borrowerTransactions.length}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📝 All Transactions</Text>
          {borrowerTransactions.length === 0 ? (
            <Text style={styles.empty}>No transactions yet</Text>
          ) : (
            borrowerTransactions.map((t) => (
              <View key={t.id} style={styles.txItem}>
                <View>
                  <Text style={styles.txType}>{t.type === 'given' ? '💸 Given' : '💰 Received'}</Text>
                  <Text style={styles.txDate}>{t.date}</Text>
                  {t.description && <Text style={styles.txDesc}>{t.description}</Text>}
                </View>
                <Text style={[styles.txAmount, t.type === 'given' ? styles.negative : styles.positive]}>
                  {t.type === 'given' ? '-' : '+'}{formatCurrency(t.amount)}
                </Text>
              </View>
            ))
          )}
        </Card>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.userCard}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.consolidatedCard}>
        <Text style={styles.consolidatedTitle}>📊 Consolidated View</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statItemLabel}>💸 Total Given</Text>
            <Text style={[styles.statItemValue, { color: '#dc2626' }]}>{formatCurrency(totalGiven)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statItemLabel}>💰 Total Received</Text>
            <Text style={[styles.statItemValue, { color: '#059669' }]}>{formatCurrency(totalReceived)}</Text>
          </View>
        </View>
        
        <View style={styles.outstandingRow}>
          <Text style={styles.outstandingLabel}>Outstanding Amount</Text>
          <Text style={[styles.outstandingValue, outstanding > 0 ? styles.positive : outstanding < 0 ? styles.negative : styles.neutral]}>
            {formatCurrency(Math.abs(outstanding))} {outstanding > 0 ? '(to receive)' : outstanding < 0 ? '(to pay)' : ''}
          </Text>
        </View>
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💰 Borrowers</Text>
          <Text style={styles.count}>{borrowers.length} total</Text>
        </View>
        {borrowers.length === 0 ? (
          <Text style={styles.empty}>No borrowers yet</Text>
        ) : (
          borrowers.map((b) => (
            <TouchableOpacity key={b.id} style={styles.borrowerItem} onPress={() => handleBorrowerSelect(b)}>
              <View style={styles.smallAvatar}>
                <Text style={styles.smallAvatarText}>{b.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.borrowerName}>{b.name}</Text>
                <Text style={styles.borrowerMeta}>Tap to view details</Text>
              </View>
              <Text style={[styles.borrowerBalance, b.balance > 0 ? styles.positive : b.balance < 0 ? styles.negative : styles.neutral]}>
                {formatCurrency(Math.abs(b.balance))}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💸 Expenses</Text>
          <TouchableOpacity onPress={() => setFilterModal(true)}>
            <Text style={styles.filterButton}>📅 {expensePeriod === 'all' ? 'All Time' : expensePeriod.charAt(0).toUpperCase() + expensePeriod.slice(1)} ▼</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatCurrency(totalExpenses)}</Text>
        </View>

        {filteredExpenses.length === 0 ? (
          <Text style={styles.empty}>No expenses in this period</Text>
        ) : (
          filteredExpenses.slice(0, 10).map((e) => (
            <View key={e.id} style={styles.expenseItem}>
              <View style={[styles.colorDot, { backgroundColor: e.category_color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expenseCategory}>{e.category_name}</Text>
                <Text style={styles.expenseDate}>{e.date}</Text>
              </View>
              <Text style={styles.expenseAmount}>-{formatCurrency(e.amount)}</Text>
            </View>
          ))
        )}
        {filteredExpenses.length > 10 && (
          <Text style={styles.moreText}>+ {filteredExpenses.length - 10} more</Text>
        )}
      </Card>

      <Card style={styles.logoutCard}>
        <Button title="Logout" variant="danger" onPress={handleLogout} />
      </Card>
      <View style={{ height: 40 }} />

      {/* Period Filter Modal */}
      <Modal visible={filterModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setFilterModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Period</Text>
            {[
              { value: 'all', label: '📅 All Time' },
              { value: 'day', label: '📅 Today' },
              { value: 'week', label: '📅 This Week' },
              { value: 'month', label: '📅 This Month' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.filterOption, expensePeriod === opt.value && styles.filterOptionActive]}
                onPress={() => { setExpensePeriod(opt.value); setFilterModal(false); }}
              >
                <Text style={[styles.filterOptionText, expensePeriod === opt.value && styles.filterOptionTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 16 },
  userCard: { marginBottom: 16 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  userName: { fontSize: 18, fontWeight: '600', color: '#111827', marginLeft: 12 },
  userEmail: { fontSize: 14, color: '#6b7280', marginLeft: 12 },
  consolidatedCard: { marginBottom: 16, backgroundColor: '#eff6ff' },
  consolidatedTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statItem: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 8, alignItems: 'center' },
  statItemLabel: { fontSize: 12, color: '#6b7280' },
  statItemValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  outstandingRow: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#dbeafe' },
  outstandingLabel: { fontSize: 12, color: '#6b7280' },
  outstandingValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  positive: { color: '#059669' },
  negative: { color: '#dc2626' },
  neutral: { color: '#6b7280' },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  count: { fontSize: 12, color: '#6b7280' },
  filterButton: { fontSize: 13, color: '#3b82f6', fontWeight: '500' },
  empty: { textAlign: 'center', color: '#9ca3af', padding: 20 },
  borrowerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  smallAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  smallAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  borrowerName: { fontSize: 15, fontWeight: '500', color: '#111827' },
  borrowerMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  borrowerBalance: { fontSize: 14, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', marginBottom: 12 },
  totalLabel: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  totalAmount: { fontSize: 20, fontWeight: 'bold', color: '#dc2626' },
  expenseItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  expenseCategory: { fontSize: 14, fontWeight: '500', color: '#111827' },
  expenseDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  expenseAmount: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  moreText: { textAlign: 'center', color: '#6b7280', fontSize: 13, marginTop: 8 },
  logoutCard: { marginTop: 8 },
  backButton: { padding: 8, marginBottom: 8 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '500' },
  headerCard: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  largeAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  largeAvatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerName: { fontSize: 20, fontWeight: '600', color: '#111827' },
  headerMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  balanceCard: { marginTop: 16, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8, alignItems: 'center' },
  balanceLabel: { fontSize: 12, color: '#6b7280' },
  balanceValue: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemLabel: { fontSize: 11, color: '#6b7280' },
  summaryItemValue: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  txType: { fontSize: 14, fontWeight: '500', color: '#111827' },
  txDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  txDesc: { fontSize: 12, color: '#6b7280', marginTop: 2, fontStyle: 'italic' },
  txAmount: { fontSize: 15, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  filterOption: { padding: 14, borderRadius: 8, marginVertical: 2 },
  filterOptionActive: { backgroundColor: '#eff6ff' },
  filterOptionText: { fontSize: 16, color: '#374151' },
  filterOptionTextActive: { color: '#3b82f6', fontWeight: '500' },
});
