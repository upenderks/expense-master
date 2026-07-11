import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getMoneyDashboardData, getExpenseDashboardData } from '../../src/lib/database';
import { Card } from '../../src/components/Card';

type Module = 'money' | 'expense';
type Period = 'day' | 'week' | 'month';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>('money');
  const [expensePeriod, setExpensePeriod] = useState<Period>('month');
  const [moneyData, setMoneyData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    try {
      const [money, expense] = await Promise.all([
        getMoneyDashboardData(user.id),
        getExpenseDashboardData(user.id, expensePeriod),
      ]);
      setMoneyData(money);
      setExpenseData(expense);
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user, expensePeriod]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Hello, {user?.name}! 👋</Text>

      {/* Module Toggle */}
      <View style={styles.moduleToggle}>
        <TouchableOpacity
          style={[styles.moduleButton, activeModule === 'money' && styles.activeModule]}
          onPress={() => setActiveModule('money')}
        >
          <Text style={styles.moduleEmoji}>💰</Text>
          <Text style={[styles.moduleText, activeModule === 'money' && styles.activeModuleText]}>Money</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.moduleButton, activeModule === 'expense' && styles.activeModule]}
          onPress={() => setActiveModule('expense')}
        >
          <Text style={styles.moduleEmoji}>💸</Text>
          <Text style={[styles.moduleText, activeModule === 'expense' && styles.activeModuleText]}>Expense</Text>
        </TouchableOpacity>
      </View>

      {/* Money Module Dashboard */}
      {activeModule === 'money' && moneyData && (
        <>
          <View style={styles.statsGrid}>
            <Card style={[styles.statCard, styles.greenCard]}>
              <Text style={styles.statLabel}>Total Given</Text>
              <Text style={styles.statValue}>{formatCurrency(moneyData.totalGiven)}</Text>
            </Card>
            <Card style={[styles.statCard, styles.blueCard]}>
              <Text style={styles.statLabel}>Total Received</Text>
              <Text style={styles.statValue}>{formatCurrency(moneyData.totalReceived)}</Text>
            </Card>
            <Card style={[styles.statCard, styles.orangeCard]}>
              <Text style={styles.statLabel}>Outstanding</Text>
              <Text style={styles.statValue}>{formatCurrency(moneyData.outstanding)}</Text>
            </Card>
            <Card style={[styles.statCard, styles.purpleCard]}>
              <Text style={styles.statLabel}>Borrowers</Text>
              <Text style={styles.statValue}>{moneyData.borrowerCount}</Text>
            </Card>
          </View>

          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Borrower Balances</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/money')}>
                <Text style={styles.viewAll}>View All →</Text>
              </TouchableOpacity>
            </View>
            {moneyData.borrowerBalances.length === 0 ? (
              <Text style={styles.emptyText}>No borrowers yet</Text>
            ) : (
              moneyData.borrowerBalances.slice(0, 5).map((b: any) => (
                <View key={b.id} style={styles.borrowerRow}>
                  <View style={styles.borrowerInfo}>
                    <Text style={styles.borrowerName}>{b.name}</Text>
                    {b.phone && <Text style={styles.borrowerMeta}>📞 {b.phone}</Text>}
                  </View>
                  <Text style={[styles.balance, b.balance > 0 ? styles.positive : b.balance < 0 ? styles.negative : styles.neutral]}>
                    {b.balance > 0 ? 'Owes: ' : b.balance < 0 ? 'Owed: ' : ''}{formatCurrency(Math.abs(b.balance))}
                  </Text>
                </View>
              ))
            )}
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {moneyData.recentTransactions.length === 0 ? (
              <Text style={styles.emptyText}>No transactions yet</Text>
            ) : (
              moneyData.recentTransactions.map((t: any) => (
                <View key={t.id} style={styles.transactionRow}>
                  <View>
                    <Text style={styles.transactionName}>{t.borrower_name}</Text>
                    <Text style={styles.transactionDate}>{t.date}</Text>
                  </View>
                  <Text style={[styles.transactionAmount, t.type === 'given' ? styles.negative : styles.positive]}>
                    {t.type === 'given' ? '-' : '+'}{formatCurrency(t.amount)}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}

      {/* Expense Module Dashboard */}
      {activeModule === 'expense' && expenseData && (
        <>
          {/* Period Selector */}
          <View style={styles.periodToggle}>
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodButton, expensePeriod === p && styles.activePeriod]}
                onPress={() => setExpensePeriod(p)}
              >
                <Text style={[styles.periodText, expensePeriod === p && styles.activePeriodText]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Card style={[styles.statCard, styles.redCard, { marginBottom: 16 }]}>
            <Text style={styles.statLabel}>Total Expenses ({expensePeriod})</Text>
            <Text style={[styles.statValue, { fontSize: 28 }]}>{formatCurrency(expenseData.totalExpenses)}</Text>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>By Category</Text>
            {expenseData.categoryTotals.filter((c: any) => c.total > 0).length === 0 ? (
              <Text style={styles.emptyText}>No expenses in this period</Text>
            ) : (
              expenseData.categoryTotals.filter((c: any) => c.total > 0).map((cat: any) => {
                const maxTotal = Math.max(...expenseData.categoryTotals.map((c: any) => c.total));
                const percentage = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
                return (
                  <View key={cat.id} style={styles.categoryRow}>
                    <View style={styles.categoryHeader}>
                      <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                      <Text style={styles.categoryName}>{cat.name}</Text>
                      <Text style={styles.categoryAmount}>{formatCurrency(cat.total)}</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: cat.color }]} />
                    </View>
                  </View>
                );
              })
            )}
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            {expenseData.recentExpenses.length === 0 ? (
              <Text style={styles.emptyText}>No expenses yet</Text>
            ) : (
              expenseData.recentExpenses.map((e: any) => (
                <View key={e.id} style={styles.expenseRow}>
                  <View style={[styles.categoryDotSmall, { backgroundColor: e.category_color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expenseCategory}>{e.category_name}</Text>
                    <Text style={styles.expenseDate}>{e.date}</Text>
                  </View>
                  <Text style={styles.expenseAmount}>-{formatCurrency(e.amount)}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  moduleToggle: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 12, padding: 4, marginBottom: 20 },
  moduleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  activeModule: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  moduleEmoji: { fontSize: 20 },
  moduleText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  activeModuleText: { color: '#111827', fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { width: '47%', padding: 16 },
  greenCard: { backgroundColor: '#ecfdf5' },
  blueCard: { backgroundColor: '#eff6ff' },
  orangeCard: { backgroundColor: '#fff7ed' },
  purpleCard: { backgroundColor: '#f3e8ff' },
  redCard: { backgroundColor: '#fef2f2' },
  statLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  viewAll: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
  emptyText: { textAlign: 'center', color: '#9ca3af', paddingVertical: 20 },
  borrowerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  borrowerInfo: { flex: 1 },
  borrowerName: { fontSize: 15, fontWeight: '500', color: '#111827' },
  borrowerMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  balance: { fontSize: 14, fontWeight: '600' },
  positive: { color: '#059669' },
  negative: { color: '#dc2626' },
  neutral: { color: '#6b7280' },
  transactionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  transactionName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  transactionDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  transactionAmount: { fontSize: 15, fontWeight: '600' },
  periodToggle: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 4, marginBottom: 16 },
  periodButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  activePeriod: { backgroundColor: '#fff' },
  periodText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  activePeriodText: { color: '#3b82f6', fontWeight: '600' },
  categoryRow: { marginBottom: 12 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  categoryDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  categoryDotSmall: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  categoryName: { flex: 1, fontSize: 14, color: '#111827' },
  categoryAmount: { fontSize: 14, fontWeight: '600', color: '#111827' },
  progressBar: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  expenseCategory: { fontSize: 14, fontWeight: '500', color: '#111827' },
  expenseDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: '600', color: '#dc2626' },
});
