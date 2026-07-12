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
  const [categoryForm, setCategoryForm] = useState({ name: '', color: COLORS[0] });
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
      Alert.alert('Error', 'Please select category and enter amount');
      return;
    }
    if (!expenseForm.date) {
      Alert.alert('Error', 'Please enter date');
      return;
    }
    setSaving(true);
    try {
      if (editingExpense) {
        if (editingExpense.photo_uri && editingExpense.photo_uri !== expenseForm.photoUri) {
          await deletePhoto(editingExpense.photo_uri);
        }
        await updateExpense(
          editingExpense.id, user!.id,
          Number(expenseForm.categoryId), Number(expenseForm.amount),
          expenseForm.date, expenseForm.description, expenseForm.photoUri || undefined
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
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = (id: number, photoUri?: string) => {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
      setCategoryForm({ name: category.name, color: category.color || COLORS[0] });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', color: COLORS[0] });
    }
    setCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        await updateExpenseCategory(editingCategory.id, user!.id, categoryForm.name.trim(), categoryForm.color);
      } else {
        await createExpenseCategory(user!.id, categoryForm.name.trim(), categoryForm.color);
      }
      setCategoryModal(false);
      await loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = (id: number, name: string) => {
    Alert.alert(
      'Delete Category',
      `Delete "${name}"? All expenses in this category will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
      const categoryMap: Record<number, { id: number; name: string; color: string; total: number }> = {};
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
        userName: user.name,
        startDate, endDate, totalExpenses,
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
      Alert.alert('Report Failed', String(error));
    } finally {
      setGeneratingReport(false);
    }
  };

  // ── Filter ─────────────────────────────────────────────────────────────

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const filteredExpenses = expenses.filter((expense) => {
    const matchesDate = isDateInRange(expense.date, startDate, endDate);
    const matchesCategory = !filterCategory || expense.category_id === Number(filterCategory);
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
        {(['expenses', 'categories'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && [
                styles.activeTab,
                { backgroundColor: theme.colors.surface },
              ],
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: theme.colors.muted },
              activeTab === tab && { color: theme.colors.text, fontWeight: '600' },
            ]}>
              {tab === 'expenses' ? '💸 Expenses' : '🏷️ Categories'}
            </Text>
          </TouchableOpacity>
        ))}
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
                label="Filter by Category"
                value={filterCategory}
                onChange={setFilterCategory}
                options={[
                  { value: '', label: 'All Categories' },
                  ...categories.map((c) => ({ value: c.id, label: c.name, color: c.color })),
                ]}
                placeholder="All Categories"
              />
            </View>

            {/* Total + Report */}
            <Card style={[
              styles.totalCard,
              { backgroundColor: isDark ? theme.colors.dangerSoft : '#fef2f2' },
            ]}>
              <Text style={[styles.totalLabel, { color: theme.colors.muted }]}>
                Total {filterCategory || startDate || endDate ? 'Filtered' : ''} Expenses
              </Text>
              <Text style={[styles.totalValue, { color: theme.colors.danger }]}>
                {formatCurrency(totalExpenses)}
              </Text>
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
                    <Text style={styles.reportButtonText}>Generating PDF...</Text>
                  </View>
                ) : (
                  <View style={styles.reportButtonContent}>
                    <Text style={styles.reportButtonIcon}>📄</Text>
                    <Text style={styles.reportButtonText}>Generate PDF Report</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Card>

            {/* Expense list */}
            {filteredExpenses.length === 0 ? (
              <Card>
                <Text style={[styles.empty, { color: theme.colors.muted }]}>
                  No expenses found. Tap + to add one.
                </Text>
              </Card>
            ) : (
              filteredExpenses.map((e) => (
                <Card key={e.id} style={styles.itemCard}>
                  <View style={styles.expenseRow}>
                    {/* Thumbnail or dot */}
                    {e.photo_uri ? (
                      <TouchableOpacity
                        onPress={() => handleViewExpensePhoto(e.photo_uri)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: e.photo_uri }} style={styles.thumbnail} />
                        <View style={[
                          styles.thumbnailBadge,
                          { backgroundColor: theme.colors.surface },
                        ]}>
                          <Text style={styles.thumbnailBadgeText}>📷</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={[
                          styles.colorDot,
                          { backgroundColor: e.category_color || e.color || '#6b7280' },
                        ]}
                      />
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
                        <TouchableOpacity onPress={() => handleDeleteExpense(e.id, e.photo_uri)}>
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            )}

            <Button
              title="+ Add Expense"
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
                  No categories yet
                </Text>
              </Card>
            ) : (
              categories.map((c) => (
                <Card key={c.id} style={styles.itemCard}>
                  <View style={styles.categoryRow}>
                    <View style={[styles.largeColorDot, { backgroundColor: c.color || '#6b7280' }]} />
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
                      <TouchableOpacity onPress={() => handleDeleteCategory(c.id, c.name)}>
                        <Text style={styles.deleteBtn}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))
            )}
            <Button
              title="+ Add Category"
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
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </Text>

              <Select
                label="Category *"
                value={expenseForm.categoryId}
                onChange={(v) => setExpenseForm({ ...expenseForm, categoryId: v })}
                options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
              />

              <Input
                label="Amount"
                value={expenseForm.amount}
                onChangeText={(t) => setExpenseForm({ ...expenseForm, amount: t })}
                placeholder="0"
                keyboardType="numeric"
              />

              <DatePicker
                label="Date"
                value={expenseForm.date}
                onChange={(d) => setExpenseForm({ ...expenseForm, date: d })}
              />

              <Input
                label="Description"
                value={expenseForm.description}
                onChangeText={(t) => setExpenseForm({ ...expenseForm, description: t })}
                placeholder="Optional"
              />

              <PhotoPicker
                label="Receipt Photo"
                photoUri={expenseForm.photoUri}
                onTakePhoto={handleTakePhoto}
                onPickPhoto={handlePickPhoto}
                onRemovePhoto={handleRemovePhoto}
                onViewPhoto={handleViewFormPhoto}
              />

              <View style={styles.modalButtons}>
                <Button title="Cancel" variant="secondary" onPress={() => setExpenseModal(false)} />
                <Button title="Save" onPress={handleSaveExpense} loading={saving} />
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
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </Text>

            <Input
              label="Name *"
              value={categoryForm.name}
              onChangeText={(t) => setCategoryForm({ ...categoryForm, name: t })}
              placeholder="e.g., Food"
            />

            <Text style={[styles.colorLabel, { color: theme.colors.textSecondary }]}>
              Color
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
                  onPress={() => setCategoryForm({ ...categoryForm, color: c })}
                />
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="secondary" onPress={() => setCategoryModal(false)} />
              <Button title="Save" onPress={handleSaveCategory} loading={saving} />
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
  tabs: { flexDirection: 'row', margin: 16, borderRadius: 8, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  activeTab: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  tabText: { fontSize: 14 },

  empty: { textAlign: 'center', padding: 20 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },

  // Total card
  totalCard: { marginHorizontal: 16, marginBottom: 12, alignItems: 'center' },
  totalLabel: { fontSize: 12 },
  totalValue: { fontSize: 28, fontWeight: 'bold', marginTop: 4 },

  // Report button
  reportButton: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignSelf: 'stretch' },
  reportButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reportButtonIcon: { fontSize: 16 },
  reportButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Expense row
  expenseRow: { flexDirection: 'row', alignItems: 'flex-start' },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, marginRight: 10 },
  largeColorDot: { width: 24, height: 24, borderRadius: 12, marginRight: 12 },

  // Thumbnail
  thumbnail: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#e2e8f0' },
  thumbnailBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
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
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  colorOption: { width: 40, height: 40, borderRadius: 20 },
  colorOptionActive: { borderWidth: 3 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalScrollContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalInner: { padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
});