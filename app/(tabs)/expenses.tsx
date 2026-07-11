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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
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
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Select } from '../../src/components/Select';
import DatePicker from '../../src/components/DatePicker';
import DateRangeFilter from '../../src/components/DateRangeFilter';
import { generateExpenseReport } from '../../src/lib/reportService';
import { ActivityIndicator } from 'react-native';

type Tab = 'expenses' | 'categories';

const COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
];

function normalizeDate(date: string) {
  if (!date) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  // DD/MM/YYYY or D/M/YYYY
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

  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Date filter
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
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    color: COLORS[0],
  });

  const [saving, setSaving] = useState(false);

  const [filterCategory, setFilterCategory] = useState<number | string>('');

  const [generatingReport, setGeneratingReport] = useState(false);

  /**
   * IMPORTANT:
   * We always load all expenses from SQLite.
   * Filtering is done locally in this screen.
   * This avoids database filter issues and works reliably offline.
   */
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  // Add inside Expenses() component after loadData function
const handleGenerateReport = async () => {
  if (!user) return;

  setGeneratingReport(true);
  try {
    // Build category totals from filtered expenses
    const categoryMap: Record<number, {
      id: number;
      name: string;
      color: string;
      total: number;
    }> = {};

    filteredExpenses.forEach((e) => {
      if (!categoryMap[e.category_id]) {
        categoryMap[e.category_id] = {
          id: e.category_id,
          name: e.category_name,
          color: e.category_color || '#6b7280',
          total: 0,
        };
      }
      categoryMap[e.category_id].total += Number(e.amount || 0);
    });

    await generateExpenseReport({
      userName: user.name,
      startDate,
      endDate,
      totalExpenses,
      expenses: filteredExpenses.map((e) => ({
        id: e.id,
        date: e.date,
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

  const openExpenseModal = (expense?: any) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        categoryId: expense.category_id,
        amount: String(expense.amount),
        date: expense.date,
        description: expense.description || '',
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({
        categoryId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
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
        await updateExpense(
          editingExpense.id,
          user!.id,
          Number(expenseForm.categoryId),
          Number(expenseForm.amount),
          expenseForm.date,
          expenseForm.description
        );
      } else {
        await createExpense(
          user!.id,
          Number(expenseForm.categoryId),
          Number(expenseForm.amount),
          expenseForm.date,
          expenseForm.description
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

  const handleDeleteExpense = (id: number) => {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(id, user!.id);
          await loadData();
        },
      },
    ]);
  };

  const openCategoryModal = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        color: category.color || COLORS[0],
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        color: COLORS[0],
      });
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
        await updateExpenseCategory(
          editingCategory.id,
          user!.id,
          categoryForm.name.trim(),
          categoryForm.color
        );
      } else {
        await createExpenseCategory(
          user!.id,
          categoryForm.name.trim(),
          categoryForm.color
        );
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

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  /**
   * LOCAL FILTERING:
   * Date filter + category filter.
   */
  const filteredExpenses = expenses.filter((expense) => {
    console.log('Filter values:', {
                startDate,
                endDate,
                expenseDate: expense.date,
              });
    const matchesDate = isDateInRange(expense.date, startDate, endDate);

    const matchesCategory =
      !filterCategory || expense.category_id === Number(filterCategory);

    return matchesDate && matchesCategory;
  });

  const totalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'expenses' && styles.activeTab]}
          onPress={() => setActiveTab('expenses')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'expenses' && styles.activeTabText,
            ]}
          >
            💸 Expenses
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'categories' && styles.activeTab]}
          onPress={() => setActiveTab('categories')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'categories' && styles.activeTabText,
            ]}
          >
            🏷️ Categories
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'expenses' ? (
          <>
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => {
                  setStartDate(s);
                  setEndDate(e);
                }}
                onClear={clearDateFilter}
              />
            </View>

            <View style={{ paddingHorizontal: 16 }}>
              <Select
                label="Filter by Category"
                value={filterCategory}
                onChange={setFilterCategory}
                options={[
                  { value: '', label: 'All Categories' },
                  ...categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                    color: c.color,
                  })),
                ]}
                placeholder="All Categories"
              />
            </View>

            <Card style={styles.totalCard}>
              <Text style={styles.totalLabel}>
                Total{' '}
                {filterCategory || startDate || endDate ? 'Filtered' : ''}{' '}
                Expenses
              </Text>
              <Text style={styles.totalValue}>
                {formatCurrency(totalExpenses)}
              </Text>

              {/* Report Button */}
              <TouchableOpacity
                style={[
                  styles.reportButton,
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
                    <Text style={styles.reportButtonText}>
                      Generate PDF Report
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </Card>

            {filteredExpenses.length === 0 ? (
              <Card>
                <Text style={styles.empty}>
                  No expenses found. Tap + to add one.
                </Text>
              </Card>
            ) : (
              filteredExpenses.map((e) => (
                <Card key={e.id} style={styles.itemCard}>
                  <View style={styles.expenseRow}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: e.category_color || e.color || '#6b7280' },
                      ]}
                    />

                    <View style={{ flex: 1 }}>
                      <Text style={styles.expenseCategory}>
                        {e.category_name}
                      </Text>
                      <Text style={styles.expenseDate}>📅 {e.date}</Text>
                      {e.description ? (
                        <Text style={styles.expenseDesc}>{e.description}</Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.expenseAmount}>
                        -{formatCurrency(e.amount)}
                      </Text>

                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          onPress={() => openExpenseModal(e)}
                          style={styles.editBtn}
                        >
                          <Text style={styles.editBtnText}>✏️</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleDeleteExpense(e.id)}
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
              title="+ Add Expense"
              onPress={() => openExpenseModal()}
              style={styles.addBtn}
            />
          </>
        ) : (
          <>
            {categories.length === 0 ? (
              <Card>
                <Text style={styles.empty}>No categories yet</Text>
              </Card>
            ) : (
              categories.map((c) => (
                <Card key={c.id} style={styles.itemCard}>
                  <View style={styles.categoryRow}>
                    <View
                      style={[
                        styles.largeColorDot,
                        { backgroundColor: c.color || '#6b7280' },
                      ]}
                    />

                    <Text style={styles.categoryName}>{c.name}</Text>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        onPress={() => openCategoryModal(c)}
                        style={styles.editBtn}
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
              title="+ Add Category"
              onPress={() => openCategoryModal()}
              style={styles.addBtn}
            />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Expense Modal */}
      <Modal visible={expenseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingExpense ? 'Edit Expense' : 'Add Expense'}
            </Text>

            <Select
              label="Category *"
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
              label="Amount"
              value={expenseForm.amount}
              onChangeText={(t) =>
                setExpenseForm({ ...expenseForm, amount: t })
              }
              placeholder="0"
              keyboardType="numeric"
            />

            <DatePicker
              label="Date"
              value={expenseForm.date}
              onChange={(d) =>
                setExpenseForm({ ...expenseForm, date: d })
              }
            />

            <Input
              label="Description"
              value={expenseForm.description}
              onChangeText={(t) =>
                setExpenseForm({ ...expenseForm, description: t })
              }
              placeholder="Optional"
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setExpenseModal(false)}
              />
              <Button
                title="Save"
                onPress={handleSaveExpense}
                loading={saving}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal visible={categoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </Text>

            <Input
              label="Name *"
              value={categoryForm.name}
              onChangeText={(t) =>
                setCategoryForm({ ...categoryForm, name: t })
              }
              placeholder="e.g., Food"
            />

            <Text style={styles.colorLabel}>Color</Text>

            <View style={styles.colorPicker}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    categoryForm.color === c && styles.colorOptionActive,
                  ]}
                  onPress={() =>
                    setCategoryForm({ ...categoryForm, color: c })
                  }
                />
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setCategoryModal(false)}
              />
              <Button
                title="Save"
                onPress={handleSaveCategory}
                loading={saving}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
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
  activeTab: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, color: '#6b7280' },
  activeTabText: { color: '#111827', fontWeight: '600' },

  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: 20,
  },

  itemCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },

  totalCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    backgroundColor: '#fef2f2',
  },

  totalLabel: {
    fontSize: 12,
    color: '#6b7280',
  },

  totalValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#dc2626',
    marginTop: 4,
  },

  expenseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

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

  expenseCategory: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },

  expenseDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  expenseDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },

  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },

  editBtn: {
    padding: 6,
    backgroundColor: '#dbeafe',
    borderRadius: 6,
  },

  editBtnText: {
    fontSize: 14,
  },

  deleteBtn: {
    fontSize: 18,
    padding: 4,
  },

  addBtn: {
    marginHorizontal: 16,
    marginTop: 8,
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  categoryName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },

  colorLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },

  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },

  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  colorOptionActive: {
    borderWidth: 3,
    borderColor: '#111827',
  },

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

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },

  reportButton: {
  marginTop: 14,
  backgroundColor: '#3b82f6',
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

  reportButtonIcon: {
    fontSize: 16,
  },
  
  reportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

});