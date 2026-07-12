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
  Image,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useAppSettings, FEATURE_KEYS } from '../../src/context/AppSettingsContext';
import {
  getExpenses,
  getExpenseCategories,
  createExpense,
  updateExpense,
  deleteExpense,
  createExpenseCategory,
  deleteExpenseCategory,
  updateExpenseCategory,
} from '../../src/lib/database';
import { takePhoto, pickPhoto, deletePhoto } from '../../src/lib/photoService';
import { generateExpenseReport } from '../../src/lib/reportService';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Select } from '../../src/components/Select';
import { PhotoPicker } from '../../src/components/PhotoPicker';
import { PhotoViewer } from '../../src/components/PhotoViewer';
import DatePicker from '../../src/components/DatePicker';
import DateRangeFilter from '../../src/components/DateRangeFilter';

type Tab = 'expenses' | 'categories';

const COLORS = [
  '#ef4444', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

function normalizeDate(date: string) {
  if (!date) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
    const [d, m, y] = date.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return date;
}

function isDateInRange(recordDate: string, startDate: string, endDate: string) {
  const record = normalizeDate(recordDate);
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (start && record < start) return false;
  if (end && record > end) return false;
  return true;
}

export default function Expenses() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { isEnabled } = useAppSettings();

  const pdfReportEnabled = isEnabled(FEATURE_KEYS.FEATURE_PDF_REPORT);
  const receiptPhotoEnabled = isEnabled(FEATURE_KEYS.FEATURE_RECEIPT_PHOTO);

  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [categoryModal, setCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [expenseForm, setExpenseForm] = useState({
    categoryId: '' as number | string,
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    photoUri: null as string | null,
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    color: COLORS[0],
  });
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<number | string>('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotoUri, setViewerPhotoUri] = useState('');

  const loadData = async () => {
    if (!user) return;
    try {
      const [expensesData, categoriesData] = await Promise.all([
        getExpenses(user.id),
        getExpenseCategories(user.id),
      ]);
      setExpenses(expensesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Load error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setFilterCategory('');
  };

  // ── Photo handlers ──────────────────────────────────────────────────────

  const handleTakePhoto = async () => {
    const uri = await takePhoto();
    if (uri) {
      if (expenseForm.photoUri) await deletePhoto(expenseForm.photoUri);
      setExpenseForm({ ...expenseForm, photoUri: uri });
    }
  };

  const handlePickPhoto = async () => {
    const uri = await pickPhoto();
    if (uri) {
      if (expenseForm.photoUri) await deletePhoto(expenseForm.photoUri);
      setExpenseForm({ ...expenseForm, photoUri: uri });
    }
  };

  const handleRemovePhoto = async () => {
    if (expenseForm.photoUri) await deletePhoto(expenseForm.photoUri);
    setExpenseForm({ ...expenseForm, photoUri: null });
  };

  const handleViewFormPhoto = () => {
    if (expenseForm.photoUri) {
      setViewerPhotoUri(expenseForm.photoUri);
      setViewerVisible(true);
    }
  };

  const handleViewExpensePhoto = (photoUri: string) => {
    setViewerPhotoUri(photoUri);
    setViewerVisible(true);
  };

  // ── Expense CRUD ────────────────────────────────────────────────────────

  const openExpenseModal = (expense?: any) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        categoryId: expense.category_id,
        amount: String(expense.amount),
        date: expense.date,
        description: expense.description || '',
        photoUri: expense.photo_uri || null,
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({
        categoryId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        photoUri: null,
      });
    }
    setExpenseModal(true);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.categoryId || !expenseForm.amount) {
      Alert.alert(t('error'), t('select_category_amount'));
      return;
    }
    if (!expenseForm.date) {
      Alert.alert(t('error'), t('enter_date'));
      return;
    }
    setSaving(true);
    try {
      if (editingExpense) {
        if (
          editingExpense.photo_uri &&
          editingExpense.photo_uri !== expenseForm.photoUri
        ) {
          await deletePhoto(editingExpense.photo_uri);
        }
        await updateExpense(
          editingExpense.id, user!.id,
          Number(expenseForm.categoryId), Number(expenseForm.amount),
          expenseForm.date, expenseForm.description,
          expenseForm.photoUri || undefined
        );
      } else {
        await createExpense(
          user!.id, Number(expenseForm.categoryId),
          Number(expenseForm.amount), expenseForm.date,
          expenseForm.description, expenseForm.photoUri || undefined
        );
      }
      setExpenseModal(false);
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = (id: number, photoUri?: string) => {
    Alert.alert(t('delete_expense'), t('are_you_sure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          if (photoUri) await deletePhoto(photoUri);
          await deleteExpense(id, user!.id);
          await loadData();
        },
      },
    ]);
  };

  // ── Category CRUD ──────────────────────────────────────────────────────

  const openCategoryModal = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        color: category.color || COLORS[0],
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', color: COLORS[0] });
    }
    setCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      Alert.alert(t('error'), t('name_required'));
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        await updateExpenseCategory(
          editingCategory.id, user!.id,
          categoryForm.name.trim(), categoryForm.color
        );
      } else {
        await createExpenseCategory(
          user!.id, categoryForm.name.trim(), categoryForm.color
        );
      }
      setCategoryModal(false);
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = (id: number, name: string) => {
    Alert.alert(
      t('delete_category'),
      `"${name}" - ${t('delete_category_confirm')}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteExpenseCategory(id, user!.id);
            await loadData();
          },
        },
      ]
    );
  };

  // ── Report ──────────────────────────────────────────────────────────────

  const handleGenerateReport = async () => {
    if (!user) return;
    setGeneratingReport(true);
    try {
      const categoryMap: Record<
        number,
        { id: number; name: string; color: string; total: number }
      > = {};
      filteredExpenses.forEach((e) => {
        if (!categoryMap[e.category_id]) {
          categoryMap[e.category_id] = {
            id: e.category_id, name: e.category_name,
            color: e.category_color || '#6b7280', total: 0,
          };
        }
        categoryMap[e.category_id].total += Number(e.amount || 0);
      });

      await generateExpenseReport({
        userName: user.name, startDate, endDate, totalExpenses,
        expenses: filteredExpenses.map((e) => ({
          id: e.id, date: e.date,
          category_name: e.category_name,
          category_color: e.category_color || '#6b7280',
          amount: Number(e.amount || 0),
          description: e.description,
        })),
        categories: Object.values(categoryMap),
      });
    } catch (error) {
      Alert.alert(t('report_failed'), String(error));
    } finally {
      setGeneratingReport(false);
    }
  };

  // ── Filter ─────────────────────────────────────────────────────────────

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const filteredExpenses = expenses.filter((expense) => {
    const matchesDate = isDateInRange(expense.date, startDate, endDate);
    const matchesCategory =
      !filterCategory || expense.category_id === Number(filterCategory);
    return matchesDate && matchesCategory;
  });

  const totalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0), 0
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Tabs */}
      <View style={[
        styles.tabs,
        { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
      ]}>
        {/* Expenses Tab */}
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'expenses' && [
              styles.activeTab,
              { backgroundColor: theme.colors.surface },
            ],
          ]}
          onPress={() => setActiveTab('expenses')}
        >
          <View style={styles.tabContent}>
            <Text style={styles.tabEmoji}>💸</Text>
            <Text style={[
              styles.tabLabel,
              { color: theme.colors.muted },
              activeTab === 'expenses' && {
                color: theme.colors.text,
                fontWeight: '600',
              },
            ]}>
              {t('expenses')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Categories Tab */}
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'categories' && [
              styles.activeTab,
              { backgroundColor: theme.colors.surface },
            ],
          ]}
          onPress={() => setActiveTab('categories')}
        >
          <View style={styles.tabContent}>
            <Text style={styles.tabEmoji}>🏷️</Text>
            <Text style={[
              styles.tabLabel,
              { color: theme.colors.muted },
              activeTab === 'categories' && {
                color: theme.colors.text,
                fontWeight: '600',
              },
            ]}>
              {t('categories')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {activeTab === 'expenses' ? (
          <>
            {/* Date filter */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                onClear={clearDateFilter}
              />
            </View>

            {/* Category filter */}
            <View style={{ paddingHorizontal: 16 }}>
              <Select
                label={t('filter_by_category')}
                value={filterCategory}
                onChange={setFilterCategory}
                options={[
                  { value: '', label: t('all_categories') },
                  ...categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                    color: c.color,
                  })),
                ]}
                placeholder={t('all_categories')}
              />
            </View>

            {/* Total + Report */}
            <Card style={[
              styles.totalCard,
              { backgroundColor: isDark ? theme.colors.dangerSoft : '#fef2f2' },
            ]}>
              <Text style={[styles.totalLabel, { color: theme.colors.muted }]}>
                {t('total')}{' '}
                {filterCategory || startDate || endDate ? `${t('filter')} ` : ''}
                {t('expenses')}
              </Text>
              <Text style={[styles.totalValue, { color: theme.colors.danger }]}>
                {formatCurrency(totalExpenses)}
              </Text>

              {/* PDF Report Button */}
              {pdfReportEnabled && (
                <TouchableOpacity
                  style={[
                    styles.reportButton,
                    { backgroundColor: theme.colors.primary },
                    generatingReport && { opacity: 0.6 },
                  ]}
                  onPress={handleGenerateReport}
                  disabled={generatingReport || filteredExpenses.length === 0}
                >
                  {generatingReport ? (
                    <View style={styles.reportButtonContent}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.reportButtonText}>
                        {t('generating_pdf')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.reportButtonContent}>
                      <Text style={styles.reportButtonIcon}>📄</Text>
                      <Text style={styles.reportButtonText}>
                        {t('generate_pdf_report')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </Card>

            {/* Expense list */}
            {filteredExpenses.length === 0 ? (
              <Card>
                <Text style={[styles.empty, { color: theme.colors.muted }]}>
                  {t('no_expenses_found')}
                </Text>
              </Card>
            ) : (
              filteredExpenses.map((e) => (
                <Card key={e.id} style={styles.itemCard}>
                  <View style={styles.expenseRow}>
                    {/* Thumbnail - only show if photos enabled */}
                    {receiptPhotoEnabled && e.photo_uri ? (
                      <TouchableOpacity
                        onPress={() => handleViewExpensePhoto(e.photo_uri)}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: e.photo_uri }}
                          style={styles.thumbnail}
                        />
                        <View style={[
                          styles.thumbnailBadge,
                          { backgroundColor: theme.colors.surface },
                        ]}>
                          <Text style={styles.thumbnailBadgeText}>📷</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={[
                        styles.colorDot,
                        { backgroundColor: e.category_color || e.color || '#6b7280' },
                      ]} />
                    )}

                    <View style={{ flex: 1, marginLeft: e.photo_uri ? 12 : 0 }}>
                      <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>
                        {e.category_name}
                      </Text>
                      <Text style={[styles.expenseDate, { color: theme.colors.muted }]}>
                        📅 {e.date}
                      </Text>
                      {e.description ? (
                        <Text style={[styles.expenseDesc, { color: theme.colors.muted }]}>
                          {e.description}
                        </Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.expenseAmount, { color: theme.colors.danger }]}>
                        -{formatCurrency(e.amount)}
                      </Text>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          onPress={() => openExpenseModal(e)}
                          style={[
                            styles.editBtn,
                            { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' },
                          ]}
                        >
                          <Text style={styles.editBtnText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteExpense(e.id, e.photo_uri)}
                        >
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            )}

            <Button
              title={`+ ${t('add_expense')}`}
              onPress={() => openExpenseModal()}
              style={styles.addBtn}
            />
          </>
        ) : (
          <>
            {/* Categories tab */}
            {categories.length === 0 ? (
              <Card>
                <Text style={[styles.empty, { color: theme.colors.muted }]}>
                  {t('no_categories_yet')}
                </Text>
              </Card>
            ) : (
              categories.map((c) => (
                <Card key={c.id} style={styles.itemCard}>
                  <View style={styles.categoryRow}>
                    <View style={[
                      styles.largeColorDot,
                      { backgroundColor: c.color || '#6b7280' },
                    ]} />
                    <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                      {c.name}
                    </Text>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        onPress={() => openCategoryModal(c)}
                        style={[
                          styles.editBtn,
                          { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' },
                        ]}
                      >
                        <Text style={styles.editBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteCategory(c.id, c.name)}
                      >
                        <Text style={styles.deleteBtn}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))
            )}
            <Button
              title={`+ ${t('add_category')}`}
              onPress={() => openCategoryModal()}
              style={styles.addBtn}
            />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Expense Modal ──────────────────────────────────────────────── */}
      <Modal visible={expenseModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView
            style={[
              styles.modalScrollContent,
              { backgroundColor: theme.colors.modalBg },
            ]}
            bounces={false}
          >
            <View style={styles.modalInner}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingExpense ? t('edit_expense') : t('add_expense')}
              </Text>

              <Select
                label={`${t('category')} *`}
                value={expenseForm.categoryId}
                onChange={(v) =>
                  setExpenseForm({ ...expenseForm, categoryId: v })
                }
                options={categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                  color: c.color,
                }))}
              />

              <Input
                label={t('amount')}
                value={expenseForm.amount}
                onChangeText={(v) =>
                  setExpenseForm({ ...expenseForm, amount: v })
                }
                placeholder="0"
                keyboardType="numeric"
              />

              <DatePicker
                label={t('date')}
                value={expenseForm.date}
                onChange={(d) =>
                  setExpenseForm({ ...expenseForm, date: d })
                }
              />

              <Input
                label={t('description')}
                value={expenseForm.description}
                onChangeText={(v) =>
                  setExpenseForm({ ...expenseForm, description: v })
                }
                placeholder={t('optional')}
              />

              {/* Receipt Photo Picker - only if enabled */}
              {receiptPhotoEnabled && (
                <PhotoPicker
                  label={t('receipt_photo')}
                  photoUri={expenseForm.photoUri}
                  onTakePhoto={handleTakePhoto}
                  onPickPhoto={handlePickPhoto}
                  onRemovePhoto={handleRemovePhoto}
                  onViewPhoto={handleViewFormPhoto}
                />
              )}

              <View style={styles.modalButtons}>
                <Button
                  title={t('cancel')}
                  variant="secondary"
                  onPress={() => setExpenseModal(false)}
                />
                <Button
                  title={t('save')}
                  onPress={handleSaveExpense}
                  loading={saving}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Category Modal ─────────────────────────────────────────────── */}
      <Modal visible={categoryModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[
            styles.modalContent,
            { backgroundColor: theme.colors.modalBg },
          ]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingCategory ? t('edit_category') : t('add_category')}
            </Text>

            <Input
              label={`${t('name')} *`}
              value={categoryForm.name}
              onChangeText={(v) =>
                setCategoryForm({ ...categoryForm, name: v })
              }
              placeholder={t('category_name')}
            />

            <Text style={[styles.colorLabel, { color: theme.colors.textSecondary }]}>
              {t('color')}
            </Text>
            <View style={styles.colorPicker}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    categoryForm.color === c && [
                      styles.colorOptionActive,
                      { borderColor: isDark ? '#fff' : '#111827' },
                    ],
                  ]}
                  onPress={() =>
                    setCategoryForm({ ...categoryForm, color: c })
                  }
                />
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Button
                title={t('cancel')}
                variant="secondary"
                onPress={() => setCategoryModal(false)}
              />
              <Button
                title={t('save')}
                onPress={handleSaveCategory}
                loading={saving}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Photo Viewer ───────────────────────────────────────────────── */}
      <PhotoViewer
        visible={viewerVisible}
        photoUri={viewerPhotoUri}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Tabs
  tabs: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabLabel: {
    fontSize: 14,
  },

  empty: { textAlign: 'center', padding: 20 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },

  // Total card
  totalCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  totalLabel: { fontSize: 12 },
  totalValue: { fontSize: 28, fontWeight: 'bold', marginTop: 4 },

  // Report button
  reportButton: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: 'stretch',
  },
  reportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportButtonIcon: { fontSize: 16 },
  reportButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Expense row
  expenseRow: { flexDirection: 'row', alignItems: 'flex-start' },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 10,
  },
  largeColorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },

  // Thumbnail
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  thumbnailBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnailBadgeText: { fontSize: 10 },

  expenseCategory: { fontSize: 15, fontWeight: '600' },
  expenseDate: { fontSize: 12, marginTop: 2 },
  expenseDesc: { fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  expenseAmount: { fontSize: 18, fontWeight: 'bold' },

  actionButtons: { flexDirection: 'row', gap: 4, marginTop: 4 },
  editBtn: { padding: 6, borderRadius: 6 },
  editBtnText: { fontSize: 14 },
  deleteBtn: { fontSize: 18, padding: 4 },
  addBtn: { marginHorizontal: 16, marginTop: 8 },

  // Category row
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  categoryName: { flex: 1, fontSize: 16, fontWeight: '500' },

  // Color picker
  colorLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  colorOption: { width: 40, height: 40, borderRadius: 20 },
  colorOptionActive: { borderWidth: 3 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalScrollContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  modalInner: { padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
});