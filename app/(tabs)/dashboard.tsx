import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import {
  getMoneyDashboardData,
  getExpenseDashboardData,
  getExpenses,
} from '../../src/lib/database';
import { Card } from '../../src/components/Card';
import { DonutChart } from '../../src/components/charts/DonutChart';
import { BarChart } from '../../src/components/charts/BarChart';
import { HorizontalBarChart } from '../../src/components/charts/HorizontalBarChart';
import DateRangeFilter from '../../src/components/DateRangeFilter';

type Module = 'money' | 'expense';
type Period = 'day' | 'week' | 'month' | 'custom';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>('expense');
  const [expensePeriod, setExpensePeriod] = useState<Period>('month');
  const [moneyData, setMoneyData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Custom date range
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      let expenseFilters: { startDate?: string; endDate?: string } | undefined;

      if (expensePeriod === 'custom' && (customStartDate || customEndDate)) {
        expenseFilters = {
          startDate: customStartDate || undefined,
          endDate: customEndDate || undefined,
        };
      }

      const periodForQuery =
        expensePeriod === 'custom' ? 'month' : expensePeriod;

      const [money, expense, allExp] = await Promise.all([
        getMoneyDashboardData(user.id),
        getExpenseDashboardData(user.id, periodForQuery, expenseFilters),
        getExpenses(user.id),
      ]);

      setMoneyData(money);
      setAllExpenses(allExp);

      // If custom period, filter expenses manually
      if (expensePeriod === 'custom' && (customStartDate || customEndDate)) {
        const filtered = allExp.filter((e: any) => {
          if (customStartDate && e.date < customStartDate) return false;
          if (customEndDate && e.date > customEndDate) return false;
          return true;
        });

        const totalExpenses = filtered.reduce(
          (s: number, e: any) => s + Number(e.amount || 0),
          0
        );

        // Build category totals
        const catMap: Record<
          number,
          { id: number; name: string; color: string; total: number }
        > = {};
        filtered.forEach((e: any) => {
          if (!catMap[e.category_id]) {
            catMap[e.category_id] = {
              id: e.category_id,
              name: e.category_name,
              color: e.category_color || '#6b7280',
              total: 0,
            };
          }
          catMap[e.category_id].total += Number(e.amount || 0);
        });

        setExpenseData({
          period: 'custom',
          startDate: customStartDate,
          totalExpenses,
          categoryTotals: Object.values(catMap).sort(
            (a, b) => b.total - a.total
          ),
          recentExpenses: filtered.slice(0, 5),
          allFilteredExpenses: filtered,
        });
      } else {
        // Add allFilteredExpenses for bar chart
        const now = new Date();
        let startDate: string;
        if (expensePeriod === 'day') {
          startDate = now.toISOString().split('T')[0];
        } else if (expensePeriod === 'week') {
          const weekAgo = new Date(
            now.getTime() - 7 * 24 * 60 * 60 * 1000
          );
          startDate = weekAgo.toISOString().split('T')[0];
        } else {
          const monthAgo = new Date(
            now.getTime() - 30 * 24 * 60 * 60 * 1000
          );
          startDate = monthAgo.toISOString().split('T')[0];
        }
        const filtered = allExp.filter(
          (e: any) => e.date >= startDate
        );

        setExpenseData({
          ...expense,
          allFilteredExpenses: filtered,
        });
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user, expensePeriod, customStartDate, customEndDate])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Handle quick period selection
  const handlePeriodChange = (period: Period) => {
    if (period !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
      setShowDateFilter(false);
    } else {
      setShowDateFilter(true);
    }
    setExpensePeriod(period);
  };

  // Handle custom date changes
  const handleDateFilterChange = (start: string, end: string) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setExpensePeriod('custom');
  };

  const handleClearDateFilter = () => {
    setCustomStartDate('');
    setCustomEndDate('');
    setExpensePeriod('month');
    setShowDateFilter(false);
  };

  const formatCurrency = (amount: number) =>
    '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const formatShort = (amount: number) => {
    if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
    if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
    return '₹' + amount.toFixed(0);
  };

  // Period display label
  const getPeriodLabel = (): string => {
    if (expensePeriod === 'custom') {
      if (customStartDate && customEndDate) {
        return `${customStartDate} to ${customEndDate}`;
      }
      if (customStartDate) return `From ${customStartDate}`;
      if (customEndDate) return `Until ${customEndDate}`;
      return 'Custom';
    }
    return expensePeriod;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // ── Prepare chart data ──────────────────────────────────────────────

  const expenseDonutData =
    expenseData?.categoryTotals
      ?.filter((c: any) => c.total > 0)
      ?.map((c: any) => ({
        label: c.name,
        value: c.total,
        color: c.color,
      })) || [];

  // Bar chart - group expenses by day/week/month based on period
  const expenseBarData = (() => {
    const expenses = expenseData?.allFilteredExpenses || [];
    if (expenses.length === 0) return [];

    if (expensePeriod === 'day') {
      // Show hourly breakdown (morning/afternoon/evening/night)
      const slots = [
        { label: 'Today', value: expenseData?.totalExpenses || 0, color: '#ef4444' },
      ];
      return slots;
    }

    if (expensePeriod === 'week') {
      // Show last 7 days
      const dayMap: Record<string, number> = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dayMap[key] = 0;
      }
      expenses.forEach((e: any) => {
        if (dayMap[e.date] !== undefined) {
          dayMap[e.date] += Number(e.amount || 0);
        }
      });
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return Object.entries(dayMap).map(([date, total]) => ({
        label: days[new Date(date).getDay()],
        value: total,
        color: total > 0 ? '#ef4444' : '#e5e7eb',
      }));
    }

    if (expensePeriod === 'month') {
      // Show last 4 weeks
      const weekMap: Record<string, number> = {};
      const today = new Date();
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const label = `W${4 - i}`;
        weekMap[label] = 0;

        expenses.forEach((e: any) => {
          const expDate = new Date(e.date);
          if (expDate >= weekStart && expDate <= weekEnd) {
            weekMap[label] += Number(e.amount || 0);
          }
        });
      }
      return Object.entries(weekMap).map(([label, total]) => ({
        label,
        value: total,
        color: total > 0 ? '#ef4444' : '#e5e7eb',
      }));
    }

    if (expensePeriod === 'custom') {
      // Group by month if range > 60 days, by week if > 14 days, by day otherwise
      if (expenses.length === 0) return [];

      const dates = expenses.map((e: any) => new Date(e.date));
      const minDate = new Date(
        Math.min(...dates.map((d: Date) => d.getTime()))
      );
      const maxDate = new Date(
        Math.max(...dates.map((d: Date) => d.getTime()))
      );
      const diffDays = Math.ceil(
        (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays > 60) {
        // Group by month
        const monthMap: Record<string, number> = {};
        expenses.forEach((e: any) => {
          const d = new Date(e.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthMap[key] = (monthMap[key] || 0) + Number(e.amount || 0);
        });
        const monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
        ];
        return Object.entries(monthMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-8)
          .map(([key, total]) => {
            const [, mo] = key.split('-');
            return {
              label: monthNames[parseInt(mo) - 1],
              value: total,
              color: total > 0 ? '#ef4444' : '#e5e7eb',
            };
          });
      }

      if (diffDays > 14) {
        // Group by week
        const weekMap: Record<string, number> = {};
        let weekNum = 1;
        const weekStart = new Date(minDate);
        while (weekStart <= maxDate) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const label = `W${weekNum}`;
          weekMap[label] = 0;
          expenses.forEach((e: any) => {
            const expDate = new Date(e.date);
            if (expDate >= weekStart && expDate <= weekEnd) {
              weekMap[label] += Number(e.amount || 0);
            }
          });
          weekStart.setDate(weekStart.getDate() + 7);
          weekNum++;
        }
        return Object.entries(weekMap)
          .slice(-8)
          .map(([label, total]) => ({
            label,
            value: total,
            color: total > 0 ? '#ef4444' : '#e5e7eb',
          }));
      }

      // Group by day
      const dayMap: Record<string, number> = {};
      expenses.forEach((e: any) => {
        dayMap[e.date] = (dayMap[e.date] || 0) + Number(e.amount || 0);
      });
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-10)
        .map(([date, total]) => ({
          label: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}`,
          value: total,
          color: total > 0 ? '#ef4444' : '#e5e7eb',
        }));
    }

    return [];
  })();

  // Money chart data
  const moneyComparisonData = moneyData
    ? [
        { label: 'Given', value: moneyData.totalGiven, color: '#dc2626' },
        { label: 'Received', value: moneyData.totalReceived, color: '#059669' },
      ]
    : [];

  const borrowerChartData =
    moneyData?.borrowerBalances
      ?.filter((b: any) => b.balance !== 0)
      ?.slice(0, 6)
      ?.map((b: any) => ({
        label: b.name.length > 8 ? b.name.slice(0, 8) + '..' : b.name,
        value: b.balance,
        color: b.balance > 0 ? '#059669' : '#dc2626',
      })) || [];

  // Bar chart title based on period
  const getBarChartTitle = (): string => {
    switch (expensePeriod) {
      case 'day':
        return "Today's Spending";
      case 'week':
        return 'Last 7 Days';
      case 'month':
        return 'Weekly Breakdown';
      case 'custom':
        return 'Spending Trend';
      default:
        return '';
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.greeting}>Hello, {user?.name}! 👋</Text>

      {/* Module Toggle */}
      <View style={styles.moduleToggle}>
        <TouchableOpacity
          style={[
            styles.moduleButton,
            activeModule === 'expense' && styles.activeModule,
          ]}
          onPress={() => setActiveModule('expense')}
        >
          <Text style={styles.moduleEmoji}>💸</Text>
          <Text
            style={[
              styles.moduleText,
              activeModule === 'expense' && styles.activeModuleText,
            ]}
          >
            Expense
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.moduleButton,
            activeModule === 'money' && styles.activeModule,
          ]}
          onPress={() => setActiveModule('money')}
        >
          <Text style={styles.moduleEmoji}>💰</Text>
          <Text
            style={[
              styles.moduleText,
              activeModule === 'money' && styles.activeModuleText,
            ]}
          >
            Money
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── EXPENSE DASHBOARD ─────────────────────────────────────── */}
      {activeModule === 'expense' && expenseData && (
        <>
          {/* Period Selector - Day/Week/Month/Custom */}
          <View style={styles.periodToggle}>
            {(['day', 'week', 'month', 'custom'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.periodButton,
                  expensePeriod === p && styles.activePeriod,
                ]}
                onPress={() => handlePeriodChange(p)}
              >
                <Text
                  style={[
                    styles.periodText,
                    expensePeriod === p && styles.activePeriodText,
                  ]}
                >
                  {p === 'custom' ? '📅' : ''}{' '}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Date Range Filter */}
          {(expensePeriod === 'custom' || showDateFilter) && (
            <View style={{ marginBottom: 12 }}>
              <DateRangeFilter
                startDate={customStartDate}
                endDate={customEndDate}
                onChange={handleDateFilterChange}
                onClear={handleClearDateFilter}
                title="📅 Custom Date Range"
              />
            </View>
          )}

          {/* Total Card */}
          <Card style={[styles.totalCard, styles.redCard]}>
            <Text style={styles.totalLabel}>
              Total Expenses ({getPeriodLabel()})
            </Text>
            <Text style={styles.totalValue}>
              {formatCurrency(expenseData.totalExpenses)}
            </Text>
            <View style={styles.totalMeta}>
              <View style={styles.totalMetaItem}>
                <Text style={styles.totalMetaLabel}>Categories</Text>
                <Text style={styles.totalMetaValue}>
                  {
                    expenseData.categoryTotals.filter(
                      (c: any) => c.total > 0
                    ).length
                  }
                </Text>
              </View>
              <View style={styles.totalMetaDivider} />
              <View style={styles.totalMetaItem}>
                <Text style={styles.totalMetaLabel}>Transactions</Text>
                <Text style={styles.totalMetaValue}>
                  {expenseData.allFilteredExpenses?.length ||
                    expenseData.recentExpenses?.length ||
                    0}
                </Text>
              </View>
            </View>
          </Card>

          {/* Donut Chart */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🥧 Category Breakdown</Text>
            <DonutChart
              data={expenseDonutData}
              size={190}
              strokeWidth={30}
              centerLabel="Total"
              centerValue={formatShort(expenseData.totalExpenses)}
            />
          </Card>

          {/* Bar Chart */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>
              📊 {getBarChartTitle()}
            </Text>
            <BarChart
              data={expenseBarData}
              barColor="#ef4444"
              height={160}
              formatValue={formatShort}
            />
          </Card>

          {/* Category Progress */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🏷️ By Category</Text>
            {expenseData.categoryTotals.filter((c: any) => c.total > 0)
              .length === 0 ? (
              <Text style={styles.emptyText}>
                No expenses in this period
              </Text>
            ) : (
              expenseData.categoryTotals
                .filter((c: any) => c.total > 0)
                .sort((a: any, b: any) => b.total - a.total)
                .map((cat: any) => {
                  const pct =
                    expenseData.totalExpenses > 0
                      ? (cat.total / expenseData.totalExpenses) * 100
                      : 0;
                  return (
                    <View key={cat.id} style={styles.categoryRow}>
                      <View style={styles.categoryHeader}>
                        <View
                          style={[
                            styles.categoryDot,
                            { backgroundColor: cat.color },
                          ]}
                        />
                        <Text style={styles.categoryName}>{cat.name}</Text>
                        <Text style={styles.categoryPct}>
                          {pct.toFixed(1)}%
                        </Text>
                        <Text style={styles.categoryAmount}>
                          {formatCurrency(cat.total)}
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: cat.color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })
            )}
          </Card>

          {/* Recent Expenses */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📋 Recent Expenses</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/expenses')}
              >
                <Text style={styles.viewAll}>View All →</Text>
              </TouchableOpacity>
            </View>
            {expenseData.recentExpenses.length === 0 ? (
              <Text style={styles.emptyText}>No expenses yet</Text>
            ) : (
              expenseData.recentExpenses
                .slice(0, 5)
                .map((e: any) => (
                  <View key={e.id} style={styles.expenseRow}>
                    <View
                      style={[
                        styles.categoryDotSmall,
                        { backgroundColor: e.category_color },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expenseCategory}>
                        {e.category_name}
                      </Text>
                      <Text style={styles.expenseDate}>{e.date}</Text>
                    </View>
                    <Text style={styles.expenseAmount}>
                      -{formatCurrency(e.amount)}
                    </Text>
                  </View>
                ))
            )}
          </Card>
        </>
      )}

      {/* ─── MONEY DASHBOARD ───────────────────────────────────────── */}
      {activeModule === 'money' && moneyData && (
        <>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <Card style={[styles.statCard, styles.greenCardBg]}>
              <Text style={styles.statEmoji}>💸</Text>
              <Text style={styles.statLabel}>Total Given</Text>
              <Text style={[styles.statValue, { color: '#dc2626' }]}>
                {formatCurrency(moneyData.totalGiven)}
              </Text>
            </Card>
            <Card style={[styles.statCard, styles.blueCardBg]}>
              <Text style={styles.statEmoji}>💰</Text>
              <Text style={styles.statLabel}>Total Received</Text>
              <Text style={[styles.statValue, { color: '#059669' }]}>
                {formatCurrency(moneyData.totalReceived)}
              </Text>
            </Card>
            <Card style={[styles.statCard, styles.orangeCardBg]}>
              <Text style={styles.statEmoji}>📊</Text>
              <Text style={styles.statLabel}>Outstanding</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      moneyData.outstanding > 0
                        ? '#dc2626'
                        : moneyData.outstanding < 0
                        ? '#059669'
                        : '#6b7280',
                  },
                ]}
              >
                {formatCurrency(Math.abs(moneyData.outstanding))}
              </Text>
            </Card>
            <Card style={[styles.statCard, styles.purpleCardBg]}>
              <Text style={styles.statEmoji}>👥</Text>
              <Text style={styles.statLabel}>Borrowers</Text>
              <Text style={styles.statValue}>
                {moneyData.borrowerCount}
              </Text>
            </Card>
          </View>

          {/* Given vs Received */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Given vs Received</Text>
            <HorizontalBarChart
              data={moneyComparisonData}
              formatValue={formatShort}
            />
            <View style={styles.comparisonSummary}>
              <View
                style={[
                  styles.comparisonBadge,
                  {
                    backgroundColor:
                      moneyData.outstanding > 0
                        ? '#fef2f2'
                        : moneyData.outstanding < 0
                        ? '#ecfdf5'
                        : '#f9fafb',
                  },
                ]}
              >
                <Text style={styles.comparisonBadgeLabel}>
                  {moneyData.outstanding > 0
                    ? 'To Receive'
                    : moneyData.outstanding < 0
                    ? 'To Pay'
                    : 'Settled'}
                </Text>
                <Text
                  style={[
                    styles.comparisonBadgeValue,
                    {
                      color:
                        moneyData.outstanding > 0
                          ? '#dc2626'
                          : moneyData.outstanding < 0
                          ? '#059669'
                          : '#6b7280',
                    },
                  ]}
                >
                  {formatCurrency(Math.abs(moneyData.outstanding))}
                </Text>
              </View>
            </View>
          </Card>

          {/* Borrower Balances Chart */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>👥 Borrower Balances</Text>
            {borrowerChartData.length === 0 ? (
              <Text style={styles.emptyText}>No outstanding balances</Text>
            ) : (
              <HorizontalBarChart
                data={borrowerChartData}
                formatValue={formatShort}
              />
            )}
          </Card>

          {/* Borrower List */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📋 Borrower Details</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/money')}
              >
                <Text style={styles.viewAll}>View All →</Text>
              </TouchableOpacity>
            </View>
            {moneyData.borrowerBalances.length === 0 ? (
              <Text style={styles.emptyText}>No borrowers yet</Text>
            ) : (
              moneyData.borrowerBalances.slice(0, 5).map((b: any) => (
                <View key={b.id} style={styles.borrowerRow}>
                  <View style={styles.borrowerAvatar}>
                    <Text style={styles.borrowerAvatarText}>
                      {b.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.borrowerInfo}>
                    <Text style={styles.borrowerName}>{b.name}</Text>
                    {b.phone && (
                      <Text style={styles.borrowerMeta}>
                        📞 {b.phone}
                      </Text>
                    )}
                  </View>
                  <View style={styles.borrowerBalanceContainer}>
                    <Text
                      style={[
                        styles.borrowerBalance,
                        b.balance > 0
                          ? styles.positive
                          : b.balance < 0
                          ? styles.negative
                          : styles.neutral,
                      ]}
                    >
                      {formatCurrency(Math.abs(b.balance))}
                    </Text>
                    <Text
                      style={[
                        styles.borrowerBalanceLabel,
                        b.balance > 0
                          ? styles.positive
                          : b.balance < 0
                          ? styles.negative
                          : styles.neutral,
                      ]}
                    >
                      {b.balance > 0
                        ? 'Owes you'
                        : b.balance < 0
                        ? 'You owe'
                        : 'Settled'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>

          {/* Recent Transactions */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                🔄 Recent Transactions
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/money')}
              >
                <Text style={styles.viewAll}>View All →</Text>
              </TouchableOpacity>
            </View>
            {moneyData.recentTransactions.length === 0 ? (
              <Text style={styles.emptyText}>No transactions yet</Text>
            ) : (
              moneyData.recentTransactions.map((t: any) => (
                <View key={t.id} style={styles.transactionRow}>
                  <View
                    style={[
                      styles.transactionIcon,
                      {
                        backgroundColor:
                          t.type === 'given' ? '#fef2f2' : '#ecfdf5',
                      },
                    ]}
                  >
                    <Text style={styles.transactionIconText}>
                      {t.type === 'given' ? '↗️' : '↙️'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.transactionName}>
                      {t.borrower_name}
                    </Text>
                    <Text style={styles.transactionDate}>{t.date}</Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      t.type === 'given'
                        ? styles.negative
                        : styles.positive,
                    ]}
                  >
                    {t.type === 'given' ? '-' : '+'}
                    {formatCurrency(t.amount)}
                  </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },

  // Module toggle
  moduleToggle: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  moduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  activeModule: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  moduleEmoji: { fontSize: 20 },
  moduleText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  activeModuleText: { color: '#111827', fontWeight: '600' },

  // Period toggle
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activePeriod: { backgroundColor: '#fff' },
  periodText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  activePeriodText: { color: '#3b82f6', fontWeight: '600' },

  // Total card
  totalCard: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 20,
  },
  redCard: { backgroundColor: '#fef2f2' },
  totalLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  totalValue: { fontSize: 32, fontWeight: '800', color: '#dc2626' },
  totalMeta: {
    flexDirection: 'row',
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  totalMetaItem: { alignItems: 'center', paddingHorizontal: 16 },
  totalMetaLabel: { fontSize: 11, color: '#6b7280' },
  totalMetaValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  totalMetaDivider: { width: 1, backgroundColor: '#e5e7eb' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: { width: '47%', padding: 16, alignItems: 'center' },
  statEmoji: { fontSize: 24, marginBottom: 6 },
  greenCardBg: { backgroundColor: '#ecfdf5' },
  blueCardBg: { backgroundColor: '#eff6ff' },
  orangeCardBg: { backgroundColor: '#fff7ed' },
  purpleCardBg: { backgroundColor: '#f3e8ff' },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#111827' },

  // Section
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  viewAll: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    paddingVertical: 20,
  },

  // Comparison
  comparisonSummary: { alignItems: 'center', marginTop: 14 },
  comparisonBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  comparisonBadgeLabel: { fontSize: 11, color: '#6b7280' },
  comparisonBadgeValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },

  // Category rows
  categoryRow: { marginBottom: 14 },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  categoryName: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  categoryPct: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginRight: 8,
  },
  categoryAmount: { fontSize: 13, fontWeight: '700', color: '#111827' },
  progressBar: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  // Borrower rows
  borrowerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  borrowerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  borrowerAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  borrowerInfo: { flex: 1, marginLeft: 12 },
  borrowerName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  borrowerMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  borrowerBalanceContainer: { alignItems: 'flex-end' },
  borrowerBalance: { fontSize: 14, fontWeight: '700' },
  borrowerBalanceLabel: { fontSize: 10, marginTop: 2 },

  positive: { color: '#059669' },
  negative: { color: '#dc2626' },
  neutral: { color: '#6b7280' },

  // Transaction rows
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionIconText: { fontSize: 16 },
  transactionName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  transactionDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  transactionAmount: { fontSize: 15, fontWeight: '700' },

  // Expense rows
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  expenseCategory: { fontSize: 14, fontWeight: '500', color: '#111827' },
  expenseDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: '600', color: '#dc2626' },
});