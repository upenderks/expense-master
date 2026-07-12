import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { ThemeMode } from '../../src/theme';
import {
  getBorrowers,
  getTransactions,
  getExpenses,
  getExpenseCategories,
} from '../../src/lib/database';
import { exportBackup, importBackup } from '../../src/lib/backupService';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAppSettings, FEATURE_KEYS } from '../../src/context/AppSettingsContext';

type ViewType = 'consolidated' | 'borrower-detail';

export default function More() {
  const { user, logout } = useAuth();
  const { theme, themeMode, setThemeMode, isDark } = useTheme();

  const [view, setView] = useState<ViewType>('consolidated');
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [borrowerTransactions, setBorrowerTransactions] = useState<any[]>([]);
  const [filterModal, setFilterModal] = useState(false);
  const [expensePeriod, setExpensePeriod] = useState('all');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { isEnabled } = useAppSettings();
  const moneyEnabled = isEnabled(FEATURE_KEYS.MODULE_MONEY);
  const expenseEnabled = isEnabled(FEATURE_KEYS.MODULE_EXPENSE);
  const backupEnabled = isEnabled(FEATURE_KEYS.FEATURE_BACKUP_RESTORE);
  const darkModeEnabled = isEnabled(FEATURE_KEYS.FEATURE_DARK_MODE);

  const loadData = async () => {
    if (!user) return;
    try {
      const [borrowersData, transactionsData, expensesData] =
        await Promise.all([
          getBorrowers(user.id),
          getTransactions(user.id),
          getExpenses(user.id),
          getExpenseCategories(user.id),
        ]);
      setBorrowers(borrowersData);
      setAllTransactions(transactionsData);
      setAllExpenses(expensesData);
    } catch (error) {
      console.error('Load error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user]));

  const handleBorrowerSelect = (borrower: any) => {
    setSelectedBorrower(borrower);
    const txs = allTransactions.filter((t) => t.borrower_id === borrower.id);
    setBorrowerTransactions(txs);
    setView('borrower-detail');
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try { await exportBackup(); }
    finally { setIsBackingUp(false); }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try { await importBackup(); }
    finally { setIsRestoring(false); }
  };

  const formatCurrency = (amount: number) =>
    '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const now = new Date();
  const filteredExpenses = allExpenses.filter((e) => {
    if (expensePeriod === 'all') return true;
    const expDate = new Date(e.date);
    if (expensePeriod === 'day') return expDate.toDateString() === now.toDateString();
    if (expensePeriod === 'week') return now.getTime() - expDate.getTime() <= 7 * 24 * 60 * 60 * 1000;
    if (expensePeriod === 'month') return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    return true;
  });

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalGiven = allTransactions.filter((t) => t.type === 'given').reduce((s, t) => s + t.amount, 0);
  const totalReceived = allTransactions.filter((t) => t.type === 'received').reduce((s, t) => s + t.amount, 0);
  const outstanding = totalGiven - totalReceived;

  // ── Borrower detail view ───────────────────────────────────────────────────
  if (view === 'borrower-detail' && selectedBorrower) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <TouchableOpacity
          onPress={() => setView('consolidated')}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: theme.colors.primary }]}>
            ← Back
          </Text>
        </TouchableOpacity>

        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={[styles.largeAvatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.largeAvatarText}>
                {selectedBorrower.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.headerName, { color: theme.colors.text }]}>
                {selectedBorrower.name}
              </Text>
              {selectedBorrower.phone && (
                <Text style={[styles.headerMeta, { color: theme.colors.muted }]}>
                  📞 {selectedBorrower.phone}
                </Text>
              )}
              {selectedBorrower.email && (
                <Text style={[styles.headerMeta, { color: theme.colors.muted }]}>
                  ✉️ {selectedBorrower.email}
                </Text>
              )}
            </View>
          </View>
          <View style={[styles.balanceCard, { backgroundColor: isDark ? '#0f172a' : '#f9fafb' }]}>
            <Text style={[styles.balanceLabel, { color: theme.colors.muted }]}>
              Current Balance
            </Text>
            <Text style={[
              styles.balanceValue,
              selectedBorrower.balance > 0 ? styles.positive
                : selectedBorrower.balance < 0 ? styles.negative
                : { color: theme.colors.muted },
            ]}>
              {selectedBorrower.balance > 0
                ? `Owes You: ${formatCurrency(selectedBorrower.balance)}`
                : selectedBorrower.balance < 0
                ? `You Owe: ${formatCurrency(Math.abs(selectedBorrower.balance))}`
                : 'Settled'}
            </Text>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            📊 Summary
          </Text>
          <View style={styles.summaryRow}>
            {[
              { label: 'Total Given', value: borrowerTransactions.filter(t => t.type === 'given').reduce((s, t) => s + t.amount, 0), color: '#dc2626' },
              { label: 'Total Received', value: borrowerTransactions.filter(t => t.type === 'received').reduce((s, t) => s + t.amount, 0), color: '#059669' },
              { label: 'Transactions', value: borrowerTransactions.length, color: theme.colors.text, isCurrency: false },
            ].map((item, i) => (
              <View key={i} style={styles.summaryItem}>
                <Text style={[styles.summaryItemLabel, { color: theme.colors.muted }]}>
                  {item.label}
                </Text>
                <Text style={[styles.summaryItemValue, { color: item.color }]}>
                  {item.isCurrency === false ? item.value : formatCurrency(item.value as number)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            📝 All Transactions
          </Text>
          {borrowerTransactions.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.muted }]}>
              No transactions yet
            </Text>
          ) : (
            borrowerTransactions.map((t) => (
              <View
                key={t.id}
                style={[styles.txItem, { borderBottomColor: theme.colors.border }]}
              >
                <View>
                  <Text style={[styles.txType, { color: theme.colors.text }]}>
                    {t.type === 'given' ? '💸 Given' : '💰 Received'}
                  </Text>
                  <Text style={[styles.txDate, { color: theme.colors.muted }]}>
                    {t.date}
                  </Text>
                  {t.description && (
                    <Text style={[styles.txDesc, { color: theme.colors.muted }]}>
                      {t.description}
                    </Text>
                  )}
                </View>
                <Text style={[
                  styles.txAmount,
                  t.type === 'given' ? styles.negative : styles.positive,
                ]}>
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

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* User Card */}
      <Card style={styles.userCard}>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarText}>
              {user?.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {user?.name}
            </Text>
            <Text style={[styles.userEmail, { color: theme.colors.muted }]}>
              {user?.email}
            </Text>
          </View>
        </View>
      </Card>

      {/* Consolidated Summary */}
      {moneyEnabled && (
      <Card style={[
        styles.consolidatedCard,
        { backgroundColor: isDark ? theme.colors.primarySoft : '#eff6ff' },
      ]}>
        <Text style={[styles.consolidatedTitle, { color: theme.colors.text }]}>
          📊 Consolidated View
        </Text>
        <View style={styles.statsRow}>
          <View style={[
            styles.statItem,
            { backgroundColor: isDark ? '#0f172a' : '#fff' },
          ]}>
            <Text style={[styles.statItemLabel, { color: theme.colors.muted }]}>
              💸 Total Given
            </Text>
            <Text style={[styles.statItemValue, { color: '#dc2626' }]}>
              {formatCurrency(totalGiven)}
            </Text>
          </View>
          <View style={[
            styles.statItem,
            { backgroundColor: isDark ? '#0f172a' : '#fff' },
          ]}>
            <Text style={[styles.statItemLabel, { color: theme.colors.muted }]}>
              💰 Total Received
            </Text>
            <Text style={[styles.statItemValue, { color: '#059669' }]}>
              {formatCurrency(totalReceived)}
            </Text>
          </View>
        </View>
        <View style={[
          styles.outstandingRow,
          { borderTopColor: isDark ? '#1e3a5f' : '#dbeafe' },
        ]}>
          <Text style={[styles.outstandingLabel, { color: theme.colors.muted }]}>
            Outstanding Amount
          </Text>
          <Text style={[
            styles.outstandingValue,
            outstanding > 0 ? styles.positive
              : outstanding < 0 ? styles.negative
              : { color: theme.colors.muted },
          ]}>
            {formatCurrency(Math.abs(outstanding))}{' '}
            {outstanding > 0 ? '(to receive)' : outstanding < 0 ? '(to pay)' : ''}
          </Text>
        </View>
      </Card>
      )}

      {/* Borrowers */}
      {moneyEnabled && (
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            💰 Borrowers
          </Text>
          <Text style={[styles.count, { color: theme.colors.muted }]}>
            {borrowers.length} total
          </Text>
        </View>
        {borrowers.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.muted }]}>
            No borrowers yet
          </Text>
        ) : (
          borrowers.map((b) => (
            <TouchableOpacity
              key={b.id}
              style={[
                styles.borrowerItem,
                { borderBottomColor: theme.colors.border },
              ]}
              onPress={() => handleBorrowerSelect(b)}
            >
              <View style={[styles.smallAvatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.smallAvatarText}>
                  {b.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.borrowerName, { color: theme.colors.text }]}>
                  {b.name}
                </Text>
                <Text style={[styles.borrowerMeta, { color: theme.colors.muted }]}>
                  Tap to view details
                </Text>
              </View>
              <Text style={[
                styles.borrowerBalance,
                b.balance > 0 ? styles.positive
                  : b.balance < 0 ? styles.negative
                  : { color: theme.colors.muted },
              ]}>
                {formatCurrency(Math.abs(b.balance))}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </Card>
       )}

      {/* Expenses */}
      {expenseEnabled && (
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            💸 Expenses
          </Text>
          <TouchableOpacity onPress={() => setFilterModal(true)}>
            <Text style={[styles.filterButton, { color: theme.colors.primary }]}>
              📅 {expensePeriod === 'all' ? 'All Time' : expensePeriod.charAt(0).toUpperCase() + expensePeriod.slice(1)} ▼
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.totalRow, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.totalLabel, { color: theme.colors.muted }]}>
            Total
          </Text>
          <Text style={[styles.totalAmount, { color: theme.colors.danger }]}>
            {formatCurrency(totalExpenses)}
          </Text>
        </View>
        {filteredExpenses.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.muted }]}>
            No expenses in this period
          </Text>
        ) : (
          filteredExpenses.slice(0, 10).map((e) => (
            <View
              key={e.id}
              style={[styles.expenseItem, { borderBottomColor: theme.colors.border }]}
            >
              <View style={[styles.colorDot, { backgroundColor: e.category_color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>
                  {e.category_name}
                </Text>
                <Text style={[styles.expenseDate, { color: theme.colors.muted }]}>
                  {e.date}
                </Text>
              </View>
              <Text style={[styles.expenseAmount, { color: theme.colors.danger }]}>
                -{formatCurrency(e.amount)}
              </Text>
            </View>
          ))
        )}
        {filteredExpenses.length > 10 && (
          <Text style={[styles.moreText, { color: theme.colors.muted }]}>
            + {filteredExpenses.length - 10} more
          </Text>
        )}
      </Card>
      )}

      {/* Appearance / Theme Card */}
      {darkModeEnabled && (
      <Card style={[
        styles.themeCard,
        {
          backgroundColor: isDark ? theme.colors.surface : '#f8fafc',
          borderColor: theme.colors.border,
        },
      ]}>
        <Text style={[styles.themeTitle, { color: theme.colors.text }]}>
          🎨 Appearance
        </Text>
        <Text style={[styles.themeSubtitle, { color: theme.colors.muted }]}>
          Choose your preferred theme
        </Text>
        <View style={styles.themeRow}>
          {([
            { mode: 'light' as ThemeMode, icon: '☀️', label: 'Light' },
            { mode: 'dark' as ThemeMode, icon: '🌙', label: 'Dark' },
            { mode: 'system' as ThemeMode, icon: '📱', label: 'System' },
          ]).map((item) => (
            <TouchableOpacity
              key={item.mode}
              style={[
                styles.themeOption,
                {
                  backgroundColor:
                    themeMode === item.mode
                      ? theme.colors.primary
                      : isDark
                      ? '#334155'
                      : '#e5e7eb',
                  borderColor:
                    themeMode === item.mode
                      ? theme.colors.primary
                      : theme.colors.border,
                },
              ]}
              onPress={() => setThemeMode(item.mode)}
            >
              <Text style={styles.themeOptionIcon}>{item.icon}</Text>
              <Text style={[
                styles.themeOptionLabel,
                {
                  color: themeMode === item.mode ? '#fff' : theme.colors.text,
                },
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>
      )}

      {/* Backup & Restore Card */}
      {backupEnabled && (
      <Card style={[
        styles.backupCard,
        {
          backgroundColor: isDark ? '#064e3b' : '#f0fdf4',
          borderColor: isDark ? '#065f46' : '#bbf7d0',
        },
      ]}>
        <Text style={[styles.backupTitle, { color: theme.colors.text }]}>
          🗄️ Data Backup & Restore
        </Text>
        <Text style={[styles.backupSubtitle, { color: theme.colors.muted }]}>
          Keep your data safe by creating regular backups
        </Text>

        <TouchableOpacity
          style={[styles.backupButton, { backgroundColor: theme.colors.primary }, isBackingUp && styles.buttonDisabled]}
          onPress={handleBackup}
          disabled={isBackingUp || isRestoring}
        >
          {isBackingUp ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.backupButtonText}>Creating Backup...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>📤</Text>
              <Text style={styles.backupButtonText}>Export Backup</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.restoreButton,
            {
              backgroundColor: isDark ? '#1e293b' : '#fff',
              borderColor: theme.colors.primary,
            },
            isRestoring && styles.buttonDisabled,
          ]}
          onPress={handleRestore}
          disabled={isBackingUp || isRestoring}
        >
          {isRestoring ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.restoreButtonText, { color: theme.colors.primary }]}>
                Restoring...
              </Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>📥</Text>
              <Text style={[styles.restoreButtonText, { color: theme.colors.primary }]}>
                Restore from Backup
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={[
          styles.infoBox,
          {
            backgroundColor: isDark ? '#451a03' : '#fffbeb',
            borderColor: isDark ? '#92400e' : '#fde68a',
          },
        ]}>
          <Text style={[styles.infoText, { color: isDark ? '#fcd34d' : '#92400e' }]}>
            💡 Backup saves your data as a .db file. You can store it in Google Drive, iCloud, or send via WhatsApp / Email.
          </Text>
        </View>
      </Card>
       )}

      {/* Logout */}
      <Card style={styles.logoutCard}>
        <Button title="Logout" variant="danger" onPress={handleLogout} />
      </Card>

      <View style={{ height: 40 }} />

      {/* Period Filter Modal */}
      <Modal visible={filterModal} transparent animationType="fade">
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setFilterModal(false)}
        >
          <View style={[
            styles.modalContent,
            {
              backgroundColor: theme.colors.modalBg,
              borderColor: theme.colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Filter by Period
            </Text>
            {[
              { value: 'all', label: '📅 All Time' },
              { value: 'day', label: '📅 Today' },
              { value: 'week', label: '📅 This Week' },
              { value: 'month', label: '📅 This Month' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.filterOption,
                  expensePeriod === opt.value && {
                    backgroundColor: isDark ? theme.colors.primarySoft : '#eff6ff',
                  },
                ]}
                onPress={() => { setExpensePeriod(opt.value); setFilterModal(false); }}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: theme.colors.text },
                  expensePeriod === opt.value && {
                    color: theme.colors.primary,
                    fontWeight: '600',
                  },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },

  // User card
  userCard: { marginBottom: 16 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  userName: { fontSize: 18, fontWeight: '600', marginLeft: 12 },
  userEmail: { fontSize: 14, marginLeft: 12 },

  // Consolidated
  consolidatedCard: { marginBottom: 16 },
  consolidatedTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statItem: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  statItemLabel: { fontSize: 12 },
  statItemValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  outstandingRow: { paddingTop: 12, borderTopWidth: 1 },
  outstandingLabel: { fontSize: 12 },
  outstandingValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },

  // Common
  positive: { color: '#059669' },
  negative: { color: '#dc2626' },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  count: { fontSize: 12 },
  filterButton: { fontSize: 13, fontWeight: '500' },
  empty: { textAlign: 'center', padding: 20 },

  // Borrowers
  borrowerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  smallAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  smallAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  borrowerName: { fontSize: 15, fontWeight: '500' },
  borrowerMeta: { fontSize: 12, marginTop: 2 },
  borrowerBalance: { fontSize: 14, fontWeight: '600' },

  // Expenses
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, marginBottom: 12 },
  totalLabel: { fontSize: 14, fontWeight: '500' },
  totalAmount: { fontSize: 20, fontWeight: 'bold' },
  expenseItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  expenseCategory: { fontSize: 14, fontWeight: '500' },
  expenseDate: { fontSize: 12, marginTop: 2 },
  expenseAmount: { fontSize: 14, fontWeight: '600' },
  moreText: { textAlign: 'center', fontSize: 13, marginTop: 8 },

  // Theme card
  themeCard: { marginBottom: 16, borderWidth: 1 },
  themeTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  themeSubtitle: { fontSize: 13, marginBottom: 16 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  themeOptionIcon: { fontSize: 20, marginBottom: 4 },
  themeOptionLabel: { fontSize: 12, fontWeight: '600' },

  // Backup card
  backupCard: { marginBottom: 16, borderWidth: 1 },
  backupTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  backupSubtitle: { fontSize: 13, marginBottom: 16 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonIcon: { fontSize: 18 },
  backupButton: { paddingVertical: 14, borderRadius: 10, marginBottom: 10 },
  buttonDisabled: { opacity: 0.6 },
  backupButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  restoreButton: { paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, marginBottom: 12 },
  restoreButtonText: { fontSize: 15, fontWeight: '600' },
  infoBox: { borderRadius: 8, padding: 10, borderWidth: 1 },
  infoText: { fontSize: 12, lineHeight: 18 },

  // Logout
  logoutCard: { marginTop: 8 },

  // Borrower detail
  backButton: { padding: 8, marginBottom: 8 },
  backText: { fontSize: 16, fontWeight: '500' },
  headerCard: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  largeAvatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  largeAvatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerName: { fontSize: 20, fontWeight: '600' },
  headerMeta: { fontSize: 13, marginTop: 2 },
  balanceCard: { marginTop: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  balanceLabel: { fontSize: 12 },
  balanceValue: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemLabel: { fontSize: 11 },
  summaryItemValue: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1 },
  txType: { fontSize: 14, fontWeight: '500' },
  txDate: { fontSize: 12, marginTop: 2 },
  txDesc: { fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  txAmount: { fontSize: 15, fontWeight: 'bold' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  filterOption: { padding: 14, borderRadius: 8, marginVertical: 2 },
  filterOptionText: { fontSize: 16 },
});