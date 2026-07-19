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
import { useLanguage } from '../../src/context/LanguageContext';
import { useAppSettings, FEATURE_KEYS } from '../../src/context/AppSettingsContext';
import { ThemeMode } from '../../src/theme';
import { Language } from '../../src/i18n/translations';
import {
  getBorrowers,
  getTransactions,
  getExpenses,
  getExpenseCategories,
} from '../../src/lib/database';
import { exportBackup, importBackup } from '../../src/lib/backupService';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { StatPill } from '../../src/components/StatPill';

type ViewType = 'consolidated' | 'borrower-detail';

export default function More() {
  const { user, logout } = useAuth();
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { isEnabled } = useAppSettings();

  const moneyEnabled = isEnabled(FEATURE_KEYS.MODULE_MONEY);
  const expenseEnabled = isEnabled(FEATURE_KEYS.MODULE_EXPENSE);
  const backupEnabled = isEnabled(FEATURE_KEYS.FEATURE_BACKUP_RESTORE);
  const darkModeEnabled = isEnabled(FEATURE_KEYS.FEATURE_DARK_MODE);

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
    const txs = allTransactions.filter((tx) => tx.borrower_id === borrower.id);
    setBorrowerTransactions(txs);
    setView('borrower-detail');
  };

  const handleLogout = () => {
    Alert.alert(t('logout'), t('logout_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'),
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

  const formatShort = (amount: number) => {
    if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
    if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
    return '₹' + amount.toFixed(0);
  };

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
  const totalGiven = allTransactions.filter((tx) => tx.type === 'given').reduce((s, tx) => s + tx.amount, 0);
  const totalReceived = allTransactions.filter((tx) => tx.type === 'received').reduce((s, tx) => s + tx.amount, 0);
  const outstanding = totalGiven - totalReceived;

  // ── Borrower detail view ───────────────────────────────────────────────────
  if (view === 'borrower-detail' && selectedBorrower) {
    return (
      <View style={[{ flex: 1 }, { backgroundColor: theme.colors.background }]}>
        <ScreenHeader
          emoji="👤"
          title={selectedBorrower.name}
          subtitle={t('borrowers')}
        >
          <View style={styles.headerStats}>
            <StatPill
              emoji="💸"
              label={t('given')}
              value={formatShort(borrowerTransactions.filter(tx => tx.type === 'given').reduce((s, tx) => s + tx.amount, 0))}
            />
            <StatPill
              emoji="💰"
              label={t('received')}
              value={formatShort(borrowerTransactions.filter(tx => tx.type === 'received').reduce((s, tx) => s + tx.amount, 0))}
            />
          </View>
        </ScreenHeader>

        <ScrollView style={styles.scrollContent}>
          <TouchableOpacity
            onPress={() => setView('consolidated')}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: theme.colors.primary }]}>
              ← {t('back')}
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

            <View style={[
              styles.balanceCard,
              { backgroundColor: isDark ? '#0f172a' : '#f9fafb' },
            ]}>
              <Text style={[styles.balanceLabel, { color: theme.colors.muted }]}>
                {t('balance')}
              </Text>
              <Text style={[
                styles.balanceValue,
                selectedBorrower.balance > 0 ? styles.positive
                  : selectedBorrower.balance < 0 ? styles.negative
                  : { color: theme.colors.muted },
              ]}>
                {selectedBorrower.balance > 0
                  ? `${t('they_owe_you')}: ${formatCurrency(selectedBorrower.balance)}`
                  : selectedBorrower.balance < 0
                  ? `${t('you_owe_them')}: ${formatCurrency(Math.abs(selectedBorrower.balance))}`
                  : t('settled')}
              </Text>
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              📊 {t('consolidated_view')}
            </Text>
            <View style={styles.summaryRow}>
              {[
                {
                  label: t('total_given'),
                  value: borrowerTransactions.filter((tx) => tx.type === 'given').reduce((s, tx) => s + tx.amount, 0),
                  color: '#dc2626', isCurrency: true,
                },
                {
                  label: t('total_received'),
                  value: borrowerTransactions.filter((tx) => tx.type === 'received').reduce((s, tx) => s + tx.amount, 0),
                  color: '#059669', isCurrency: true,
                },
                {
                  label: t('transactions'),
                  value: borrowerTransactions.length,
                  color: theme.colors.text, isCurrency: false,
                },
              ].map((item, i) => (
                <View key={i} style={styles.summaryItem}>
                  <Text style={[styles.summaryItemLabel, { color: theme.colors.muted }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.summaryItemValue, { color: item.color }]}>
                    {item.isCurrency ? formatCurrency(item.value as number) : item.value}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              📝 {t('recent_transactions')}
            </Text>
            {borrowerTransactions.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.muted }]}>
                {t('no_transactions_yet')}
              </Text>
            ) : (
              borrowerTransactions.map((tx) => (
                <View
                  key={tx.id}
                  style={[styles.txItem, { borderBottomColor: theme.colors.border }]}
                >
                  <View>
                    <View style={styles.txTypeRow}>
                      <Text style={styles.txTypeEmoji}>
                        {tx.type === 'given' ? '💸' : '💰'}
                      </Text>
                      <Text style={[styles.txType, { color: theme.colors.text }]}>
                        {tx.type === 'given' ? t('given') : t('received')}
                      </Text>
                    </View>
                    <Text style={[styles.txDate, { color: theme.colors.muted }]}>
                      {tx.date}
                    </Text>
                    {tx.description && (
                      <Text style={[styles.txDesc, { color: theme.colors.muted }]}>
                        {tx.description}
                      </Text>
                    )}
                  </View>
                  <Text style={[
                    styles.txAmount,
                    tx.type === 'given' ? styles.negative : styles.positive,
                  ]}>
                    {tx.type === 'given' ? '-' : '+'}{formatCurrency(tx.amount)}
                  </Text>
                </View>
              ))
            )}
          </Card>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <View style={[{ flex: 1 }, { backgroundColor: theme.colors.background }]}>

      {/* ── Screen Header ─────────────────────────────────────────── */}
      <ScreenHeader
        emoji="⚙️"
        title={t('tab_more')}
        subtitle={user?.email || ''}
      >
        <View style={styles.headerStats}>
          <StatPill
            emoji="👤"
            label={t('name')}
            value={user?.name || ''}
          />
          {moneyEnabled && (
            <StatPill
              emoji="📊"
              label={t('outstanding')}
              value={formatShort(Math.abs(outstanding))}
            />
          )}
          {expenseEnabled && (
            <StatPill
              emoji="💸"
              label={t('expenses')}
              value={String(allExpenses.length)}
            />
          )}
        </View>
      </ScreenHeader>

      <ScrollView style={styles.scrollContent}>

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
              📊 {t('consolidated_view')}
            </Text>
            <View style={styles.statsRow}>
              <View style={[styles.statItem, { backgroundColor: isDark ? '#0f172a' : '#fff' }]}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabelEmoji}>💸</Text>
                  <Text style={[styles.statItemLabel, { color: theme.colors.muted }]}>
                    {t('total_given')}
                  </Text>
                </View>
                <Text style={[styles.statItemValue, { color: '#dc2626' }]}>
                  {formatCurrency(totalGiven)}
                </Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: isDark ? '#0f172a' : '#fff' }]}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabelEmoji}>💰</Text>
                  <Text style={[styles.statItemLabel, { color: theme.colors.muted }]}>
                    {t('total_received')}
                  </Text>
                </View>
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
                {t('outstanding_amount')}
              </Text>
              <Text style={[
                styles.outstandingValue,
                outstanding > 0 ? styles.positive
                  : outstanding < 0 ? styles.negative
                  : { color: theme.colors.muted },
              ]}>
                {formatCurrency(Math.abs(outstanding))}{' '}
                {outstanding > 0 ? t('to_receive_label')
                  : outstanding < 0 ? t('to_pay_label') : ''}
              </Text>
            </View>
          </Card>
        )}

        {/* Borrowers */}
        {moneyEnabled && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitleEmoji}>💰</Text>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  {t('borrowers')}
                </Text>
              </View>
              <Text style={[styles.count, { color: theme.colors.muted }]}>
                {borrowers.length} {t('total')}
              </Text>
            </View>
            {borrowers.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.muted }]}>
                {t('no_borrowers_yet')}
              </Text>
            ) : (
              borrowers.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.borrowerItem, { borderBottomColor: theme.colors.border }]}
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
                      {t('tap_view_details')}
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
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitleEmoji}>💸</Text>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  {t('expenses')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFilterModal(true)}>
                <Text style={[styles.filterButton, { color: theme.colors.primary }]}>
                  📅 {expensePeriod === 'all' ? t('all_time')
                    : expensePeriod === 'day' ? t('today')
                    : expensePeriod === 'week' ? t('this_week')
                    : t('this_month')} ▼
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.totalRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.totalLabel, { color: theme.colors.muted }]}>
                {t('total')}
              </Text>
              <Text style={[styles.totalAmount, { color: theme.colors.danger }]}>
                {formatCurrency(totalExpenses)}
              </Text>
            </View>

            {filteredExpenses.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.muted }]}>
                {t('no_expenses_period')}
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
                + {filteredExpenses.length - 10} {t('more_items')}
              </Text>
            )}
          </Card>
        )}

        {/* Appearance Card */}
        {darkModeEnabled && (
          <Card style={[
            styles.themeCard,
            { backgroundColor: isDark ? theme.colors.surface : '#f8fafc', borderColor: theme.colors.border },
          ]}>
            <Text style={[styles.themeTitle, { color: theme.colors.text }]}>
              🎨 {t('appearance')}
            </Text>
            <Text style={[styles.themeSubtitle, { color: theme.colors.muted }]}>
              {t('choose_theme')}
            </Text>
            <View style={styles.themeRow}>
              {([
                { mode: 'light' as ThemeMode, icon: '☀️', label: t('light') },
                { mode: 'dark' as ThemeMode, icon: '🌙', label: t('dark') },
                { mode: 'system' as ThemeMode, icon: '📱', label: t('system') },
              ]).map((item) => (
                <TouchableOpacity
                  key={item.mode}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: themeMode === item.mode
                        ? theme.colors.primary
                        : isDark ? '#334155' : '#e5e7eb',
                      borderColor: themeMode === item.mode
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                  onPress={() => setThemeMode(item.mode)}
                >
                  <Text style={styles.themeOptionIcon}>{item.icon}</Text>
                  <Text style={[
                    styles.themeOptionLabel,
                    { color: themeMode === item.mode ? '#fff' : theme.colors.text },
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* Language Card */}
        <Card style={[
          styles.themeCard,
          { backgroundColor: isDark ? theme.colors.surface : '#f8fafc', borderColor: theme.colors.border },
        ]}>
          <Text style={[styles.themeTitle, { color: theme.colors.text }]}>
            🌐 {t('language')}
          </Text>
          <Text style={[styles.themeSubtitle, { color: theme.colors.muted }]}>
            {t('choose_language')}
          </Text>
          <View style={styles.themeRow}>
            {([
              { lang: 'en' as Language, icon: '🇬🇧', label: t('english') },
              { lang: 'hi' as Language, icon: '🇮🇳', label: t('hindi') },
            ]).map((item) => (
              <TouchableOpacity
                key={item.lang}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: language === item.lang
                      ? theme.colors.primary
                      : isDark ? '#334155' : '#e5e7eb',
                    borderColor: language === item.lang
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
                onPress={() => setLanguage(item.lang, user?.id)}
              >
                <Text style={styles.themeOptionIcon}>{item.icon}</Text>
                <Text style={[
                  styles.themeOptionLabel,
                  { color: language === item.lang ? '#fff' : theme.colors.text },
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Backup Card */}
        {backupEnabled && (
          <Card style={[
            styles.backupCard,
            {
              backgroundColor: isDark ? '#064e3b' : '#f0fdf4',
              borderColor: isDark ? '#065f46' : '#bbf7d0',
            },
          ]}>
            <Text style={[styles.backupTitle, { color: theme.colors.text }]}>
              🗄️ {t('data_backup_restore')}
            </Text>
            <Text style={[styles.backupSubtitle, { color: theme.colors.muted }]}>
              {t('backup_subtitle')}
            </Text>

            <TouchableOpacity
              style={[
                styles.backupButton,
                { backgroundColor: theme.colors.primary },
                isBackingUp && styles.buttonDisabled,
              ]}
              onPress={handleBackup}
              disabled={isBackingUp || isRestoring}
            >
              {isBackingUp ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.backupButtonText}>{t('creating_backup')}</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>📤</Text>
                  <Text style={styles.backupButtonText}>{t('export_backup')}</Text>
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
                    {t('restoring')}
                  </Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>📥</Text>
                  <Text style={[styles.restoreButtonText, { color: theme.colors.primary }]}>
                    {t('restore_from_backup')}
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
                💡 {t('backup_info')}
              </Text>
            </View>
          </Card>
        )}

        {/* About Card */}
        <Card style={[
          styles.aboutCard,
          { backgroundColor: isDark ? theme.colors.surface : '#f8fafc', borderColor: theme.colors.border },
        ]}>
          <View style={styles.aboutHeader}>
            <Text style={styles.aboutLogo}>📓</Text>
            <View>
              <Text style={[styles.aboutAppName, { color: theme.colors.text }]}>DigiDiary</Text>
              <Text style={[styles.aboutVersion, { color: theme.colors.muted }]}>Version 1.0.0</Text>
            </View>
          </View>
          <Text style={[styles.aboutTagline, { color: theme.colors.muted }]}>
            {t('app_tagline')}
          </Text>

          <View style={[styles.aboutDivider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.aboutFeatures}>
            {[
              { emoji: '💰', label: t('tab_money') },
              { emoji: '💸', label: t('tab_expenses') },
              { emoji: '⏱️', label: t('tab_tracker') },
              { emoji: '📒', label: t('tab_organizer') },
              { emoji: '🌙', label: t('appearance') },
              { emoji: '🌐', label: t('language') },
            ].map((item, i) => (
              <View key={i} style={styles.aboutFeatureItem}>
                <Text style={styles.aboutFeatureEmoji}>{item.emoji}</Text>
                <Text style={[styles.aboutFeatureLabel, { color: theme.colors.text }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.aboutDivider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.aboutFooter, { color: theme.colors.muted }]}>
            Made with ❤️ in India
          </Text>
          <Text style={[styles.aboutCopyright, { color: theme.colors.muted }]}>
            © 2026 DigiDiary. All rights reserved.
          </Text>
        </Card>

        {/* Logout */}
        <Card style={styles.logoutCard}>
          <Button title={t('logout')} variant="danger" onPress={handleLogout} />
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
                {t('filter_by_period')}
              </Text>
              {[
                { value: 'all', label: `📅 ${t('all_time')}` },
                { value: 'day', label: `📅 ${t('today')}` },
                { value: 'week', label: `📅 ${t('this_week')}` },
                { value: 'month', label: `📅 ${t('this_month')}` },
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
                    expensePeriod === opt.value && { color: theme.colors.primary, fontWeight: '600' },
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header stats
  headerStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scrollContent: { flex: 1, padding: 16 },

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
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  statLabelEmoji: { fontSize: 12 },
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
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionTitleEmoji: { fontSize: 16 },
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

  // Transaction item
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1 },
  txTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txTypeEmoji: { fontSize: 14 },
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

  // About
  aboutCard: { marginBottom: 16, borderWidth: 1, alignItems: 'center' },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  aboutLogo: { fontSize: 42 },
  aboutAppName: { fontSize: 22, fontWeight: '800' },
  aboutVersion: { fontSize: 13, marginTop: 2 },
  aboutTagline: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  aboutDivider: { height: 1, alignSelf: 'stretch', marginVertical: 14 },
  aboutFeatures: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  aboutFeatureItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.03)' },
  aboutFeatureEmoji: { fontSize: 14 },
  aboutFeatureLabel: { fontSize: 12, fontWeight: '500' },
  aboutFooter: { fontSize: 13, marginTop: 4 },
  aboutCopyright: { fontSize: 11, marginTop: 4 },
});