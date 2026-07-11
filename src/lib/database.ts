import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('expense_tracker.db');
    await initializeDatabase(db);
  }
  return db;
}

// Call this after restore to reset the singleton
export function resetDatabaseInstance(): void {
  db = null;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  // Step 1: Disable FK checks temporarily for drops
  await database.execAsync('PRAGMA foreign_keys = OFF;');

  // Step 2: Drop in correct child-first order (only for dev/reset)
  // ⚠️ IMPORTANT: Comment these DROP lines out in production
  // or your data will be wiped every time app restarts

  /*
  await database.execAsync(`
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS money_transactions;
    DROP TABLE IF EXISTS expense_categories;
    DROP TABLE IF EXISTS borrowers;
    DROP TABLE IF EXISTS users;
  `);
    */

  // Step 3: Enable FK checks
  await database.execAsync('PRAGMA foreign_keys = ON;');

  // Step 4: Create tables if not exist
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS borrowers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS money_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      borrower_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('given', 'received')),
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE
    );
  `);
}

// ==================== USERS ====================
export async function createUser(name: string, email: string, password: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, password]
  );
  const userId = result.lastInsertRowId;
  
  const defaultCategories = [
    { name: 'Food', color: '#ef4444' },
    { name: 'Transport', color: '#f59e0b' },
    { name: 'Shopping', color: '#8b5cf6' },
    { name: 'Bills', color: '#10b981' },
    { name: 'Entertainment', color: '#3b82f6' },
    { name: 'Others', color: '#6b7280' },
  ];
  for (const cat of defaultCategories) {
    await db.runAsync('INSERT INTO expense_categories (user_id, name, color) VALUES (?, ?, ?)', [userId, cat.name, cat.color]);
  }
  
  return userId;
}

export async function getUserByEmail(email: string): Promise<any> {
  const db = await getDatabase();
  return await db.getFirstAsync('SELECT * FROM users WHERE email = ?', [email]);
}

// ==================== BORROWERS ====================
export async function getBorrowers(userId: number): Promise<any[]> {
  const db = await getDatabase();
  return await db.getAllAsync(`
    SELECT b.*,
      COALESCE((SELECT SUM(CASE WHEN type = 'given' THEN amount ELSE -amount END) FROM money_transactions WHERE borrower_id = b.id), 0) as balance
    FROM borrowers b
    WHERE b.user_id = ?
    ORDER BY b.name
  `, [userId]);
}

export async function createBorrower(userId: number, name: string, phone?: string, email?: string, address?: string, notes?: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO borrowers (user_id, name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, name, phone || null, email || null, address || null, notes || null]
  );
  return result.lastInsertRowId;
}

export async function updateBorrower(id: number, userId: number, name: string, phone?: string, email?: string, address?: string, notes?: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE borrowers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ? AND user_id = ?',
    [name, phone || null, email || null, address || null, notes || null, id, userId]
  );
}

export async function deleteBorrower(id: number, userId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM borrowers WHERE id = ? AND user_id = ?', [id, userId]);
}

// ==================== MONEY TRANSACTIONS ====================
// NEW: Updated to support date filtering
export async function getTransactions(userId: number, filters?: { borrowerId?: number; startDate?: string; endDate?: string }): Promise<any[]> {
  const db = await getDatabase();
  let query = `
    SELECT t.*, b.name as borrower_name
    FROM money_transactions t
    LEFT JOIN borrowers b ON t.borrower_id = b.id
    WHERE t.user_id = ?
  `;
  const params: any[] = [userId];
  
  if (filters?.borrowerId) {
    query += ' AND t.borrower_id = ?';
    params.push(filters.borrowerId);
  }
  if (filters?.startDate) {
    query += ' AND t.date >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    query += ' AND t.date <= ?';
    params.push(filters.endDate);
  }
  
  query += ' ORDER BY t.date DESC, t.id DESC';
  return await db.getAllAsync(query, params);
}

export async function createTransaction(userId: number, borrowerId: number, type: 'given' | 'received', amount: number, date: string, description?: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO money_transactions (user_id, borrower_id, type, amount, date, description) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, borrowerId, type, amount, date, description || null]
  );
  return result.lastInsertRowId;
}

// NEW: Update transaction function
export async function updateTransaction(id: number, userId: number, borrowerId: number, type: 'given' | 'received', amount: number, date: string, description?: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE money_transactions SET borrower_id = ?, type = ?, amount = ?, date = ?, description = ? WHERE id = ? AND user_id = ?',
    [borrowerId, type, amount, date, description || null, id, userId]
  );
}

// NEW: Get single transaction by ID
export async function getTransactionById(id: number, userId: number): Promise<any> {
  const db = await getDatabase();
  return await db.getFirstAsync(
    'SELECT * FROM money_transactions WHERE id = ? AND user_id = ?',
    [id, userId]
  );
}

export async function deleteTransaction(id: number, userId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM money_transactions WHERE id = ? AND user_id = ?', [id, userId]);
}

// ==================== EXPENSE CATEGORIES ====================
export async function getExpenseCategories(userId: number): Promise<any[]> {
  const db = await getDatabase();
  return await db.getAllAsync('SELECT * FROM expense_categories WHERE user_id = ? ORDER BY name', [userId]);
}

export async function createExpenseCategory(userId: number, name: string, color?: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO expense_categories (user_id, name, color) VALUES (?, ?, ?)',
    [userId, name, color || '#3b82f6']
  );
  return result.lastInsertRowId;
}

export async function updateExpenseCategory(id: number, userId: number, name: string, color?: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE expense_categories SET name = ?, color = ? WHERE id = ? AND user_id = ?',
    [name, color || '#3b82f6', id, userId]
  );
}

export async function deleteExpenseCategory(id: number, userId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expense_categories WHERE id = ? AND user_id = ?', [id, userId]);
}

// ==================== EXPENSES ====================
// NEW: Updated to support date filtering
export async function getExpenses(userId: number, filters?: { categoryId?: number; startDate?: string; endDate?: string }): Promise<any[]> {
  const db = await getDatabase();
  let query = `
    SELECT e.*, c.name as category_name, c.color as category_color
    FROM expenses e
    LEFT JOIN expense_categories c ON e.category_id = c.id
    WHERE e.user_id = ?
  `;
  const params: any[] = [userId];
  
  if (filters?.categoryId) {
    query += ' AND e.category_id = ?';
    params.push(filters.categoryId);
  }
  if (filters?.startDate) {
    query += ' AND e.date >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    query += ' AND e.date <= ?';
    params.push(filters.endDate);
  }
  
  query += ' ORDER BY e.date DESC, e.id DESC';
  return await db.getAllAsync(query, params);
}

export async function createExpense(userId: number, categoryId: number, amount: number, date: string, description?: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO expenses (user_id, category_id, amount, date, description) VALUES (?, ?, ?, ?, ?)',
    [userId, categoryId, amount, date, description || null]
  );
  return result.lastInsertRowId;
}

// NEW: Update expense function
export async function updateExpense(id: number, userId: number, categoryId: number, amount: number, date: string, description?: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE expenses SET category_id = ?, amount = ?, date = ?, description = ? WHERE id = ? AND user_id = ?',
    [categoryId, amount, date, description || null, id, userId]
  );
}

// NEW: Get single expense by ID
export async function getExpenseById(id: number, userId: number): Promise<any> {
  const db = await getDatabase();
  return await db.getFirstAsync(
    'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
    [id, userId]
  );
}

export async function deleteExpense(id: number, userId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, userId]);
}

// ==================== DASHBOARD DATA ====================

export async function getMoneyDashboardData(userId: number, filters?: { startDate?: string; endDate?: string }): Promise<any> {
  const db = await getDatabase();
  
  let dateFilter = '';
  const params: any[] = [userId];
  if (filters?.startDate) {
    dateFilter += ' AND date >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    dateFilter += ' AND date <= ?';
    params.push(filters.endDate);
  }
  
  const totalGiven = await db.getFirstAsync<{total: number}>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM money_transactions WHERE user_id = ? AND type = 'given'${dateFilter}`, params
  );
  
  const totalReceived = await db.getFirstAsync<{total: number}>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM money_transactions WHERE user_id = ? AND type = 'received'${dateFilter}`, params
  );
  
  const borrowerCount = await db.getFirstAsync<{count: number}>(
    'SELECT COUNT(*) as count FROM borrowers WHERE user_id = ?', [userId]
  );
  
  const borrowerBalances = await db.getAllAsync(`
    SELECT b.id, b.name, b.phone,
      COALESCE(SUM(CASE WHEN t.type = 'given' THEN t.amount ELSE -t.amount END), 0) as balance
    FROM borrowers b
    LEFT JOIN money_transactions t ON b.id = t.borrower_id
    WHERE b.user_id = ?
    GROUP BY b.id, b.name, b.phone
    ORDER BY balance DESC
  `, [userId]);
  
  const totalGivenAmount = totalGiven?.total || 0;
  const totalReceivedAmount = totalReceived?.total || 0;
  const outstanding = totalGivenAmount - totalReceivedAmount;
  
  const recentTransactions = await db.getAllAsync(`
    SELECT t.*, b.name as borrower_name
    FROM money_transactions t
    LEFT JOIN borrowers b ON t.borrower_id = b.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC, t.id DESC
    LIMIT 5
  `, [userId]);
  
  return {
    totalGiven: totalGivenAmount,
    totalReceived: totalReceivedAmount,
    outstanding,
    borrowerCount: borrowerCount?.count || 0,
    borrowerBalances,
    recentTransactions,
  };
}

export async function getExpenseDashboardData(userId: number, period: 'day' | 'week' | 'month' = 'month', filters?: { startDate?: string; endDate?: string }): Promise<any> {
  const db = await getDatabase();
  
  let startDate: string;
  
  if (filters?.startDate) {
    // Custom date range
    startDate = filters.startDate;
  } else {
    const now = new Date();
    if (period === 'day') {
      startDate = now.toISOString().split('T')[0];
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = weekAgo.toISOString().split('T')[0];
    } else {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = monthAgo.toISOString().split('T')[0];
    }
  }
  
  const totalExpenses = await db.getFirstAsync<{total: number}>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= ?',
    [userId, startDate]
  );
  
  const categoryTotals = await db.getAllAsync(`
    SELECT c.id, c.name, c.color, COALESCE(SUM(e.amount), 0) as total
    FROM expense_categories c
    LEFT JOIN expenses e ON c.id = e.category_id AND e.date >= ?
    WHERE c.user_id = ?
    GROUP BY c.id, c.name, c.color
    ORDER BY total DESC
  `, [startDate, userId]);
  
  const recentExpenses = await db.getAllAsync(`
    SELECT e.*, c.name as category_name, c.color as category_color
    FROM expenses e
    LEFT JOIN expense_categories c ON e.category_id = c.id
    WHERE e.user_id = ?
    ORDER BY e.date DESC, e.id DESC
    LIMIT 5
  `, [userId]);
  
  return {
    period,
    startDate,
    totalExpenses: totalExpenses?.total || 0,
    categoryTotals,
    recentExpenses,
  };
}
