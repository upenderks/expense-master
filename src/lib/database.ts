import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let isOpening = false;
let openPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // If already opening, wait for it to finish
  if (openPromise) {
    return openPromise;
  }

  // If db exists, validate it
  if (db) {
    try {
      await db.getFirstAsync('SELECT 1');
      return db;
    } catch {
      console.log('DB connection invalid, reopening...');
      db = null;
    }
  }

  // Open new connection with lock
  openPromise = (async () => {
    try {
      const database = await SQLite.openDatabaseAsync('expense_tracker.db');
      await initializeDatabase(database);
      db = database;
      return database;
    } finally {
      openPromise = null;
    }
  })();

  return openPromise;
}

// ── Safe executor - auto retries on connection loss ───────────────────────────

async function safeExecute<T>(
  operation: (database: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  try {
    const database = await getDatabase();
    return await operation(database);
  } catch (error: any) {
    const msg = String(error);
    if (
      msg.includes('NullPointerException') ||
      msg.includes('prepareAsync') ||
      msg.includes('finalizeAsync') ||
      msg.includes('closed') ||
      msg.includes('null')
    ) {
      console.log('DB error, resetting and retrying...');
      db = null;
      openPromise = null;
      await new Promise((r) => setTimeout(r, 200));
      const database = await getDatabase();
      return await operation(database);
    }
    throw error;
  }
}

// Call this after restore to reset the singleton
export function resetDatabaseInstance(): void {
  db = null;
  openPromise = null;
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
      is_admin INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
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
      settled_at TEXT,
      is_settled INTEGER DEFAULT 0,
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
      photo_uri TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      borrower_id INTEGER NOT NULL,
      total_given REAL NOT NULL DEFAULT 0,
      total_received REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      transaction_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      settled_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, setting_key)
    );

  `);
  await ensureDefaultAdmin(database);
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
  return await db.getFirstAsync('SELECT * FROM users WHERE email = ? ', [email]);
}

// ==================== BORROWERS ====================
export async function getBorrowers(userId: number): Promise<any[]> {
  const db = await getDatabase();
  return await db.getAllAsync(
    `
    SELECT b.*,
      COALESCE((
        SELECT SUM(CASE WHEN type = 'given' THEN amount ELSE -amount END)
        FROM money_transactions 
        WHERE borrower_id = b.id AND is_settled = 0
      ), 0) as balance,
      COALESCE((
        SELECT SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END)
        FROM money_transactions 
        WHERE borrower_id = b.id AND is_settled = 0
      ), 0) as unsettled_given,
      COALESCE((
        SELECT SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END)
        FROM money_transactions 
        WHERE borrower_id = b.id AND is_settled = 0
      ), 0) as unsettled_received,
      (SELECT COUNT(*) FROM settlements WHERE borrower_id = b.id) as settlement_count
    FROM borrowers b
    WHERE b.user_id = ?
    ORDER BY b.name
  `,
    [userId]
  );
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
export async function getTransactions(
  userId: number,
  filters?: {
    borrowerId?: number;
    startDate?: string;
    endDate?: string;
    includeSettled?: boolean;
  }
): Promise<any[]> {
  const db = await getDatabase();
  let query = `
    SELECT t.*, b.name as borrower_name
    FROM money_transactions t
    LEFT JOIN borrowers b ON t.borrower_id = b.id
    WHERE t.user_id = ?
  `;
  const params: any[] = [userId];

  // By default, only show unsettled transactions
  if (!filters?.includeSettled) {
    query += ' AND t.is_settled = 0';
  }

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
export async function getExpenses(
  userId: number,
  filters?: { categoryId?: number; startDate?: string; endDate?: string }
): Promise<any[]> {
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

export async function createExpense(userId: number, categoryId: number, amount: number, date: string, description?: string, photoUri?: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO expenses (user_id, category_id, amount, date, description, photo_uri) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, categoryId, amount, date, description || null, photoUri || null]
  );
  return result.lastInsertRowId;
}

// NEW: Update expense function
export async function updateExpense(id: number, userId: number, categoryId: number, amount: number, date: string, description?: string, photoUri?: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE expenses SET category_id = ?, amount = ?, date = ?, description = ?, photo_uri = ? WHERE id = ? AND user_id = ?',
    [categoryId, amount, date, description || null,  photoUri || null,  id, userId]
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

// ==================== SETTLEMENTS ====================

export async function settleBorrower(
    userId: number,
    borrowerId: number,
    notes?: string
  ): Promise<number> {
    const db = await getDatabase();

    // 1. Get all unsettled transactions for this borrower
    const unsettled = await db.getAllAsync<{
      id: number;
      type: string;
      amount: number;
    }>(
      `SELECT id, type, amount FROM money_transactions 
      WHERE user_id = ? AND borrower_id = ? AND is_settled = 0`,
      [userId, borrowerId]
    );

    if (unsettled.length === 0) {
      throw new Error('No unsettled transactions to settle');
    }

    // 2. Calculate totals
    const totalGiven = unsettled
      .filter((t) => t.type === 'given')
      .reduce((s, t) => s + t.amount, 0);

    const totalReceived = unsettled
      .filter((t) => t.type === 'received')
      .reduce((s, t) => s + t.amount, 0);

    const balance = totalGiven - totalReceived;
    const settledAt = new Date().toISOString();

    // 3. Create settlement record
    const result = await db.runAsync(
      `INSERT INTO settlements (user_id, borrower_id, total_given, total_received, balance, transaction_count, notes, settled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        borrowerId,
        totalGiven,
        totalReceived,
        balance,
        unsettled.length,
        notes || null,
        settledAt,
      ]
    );

    // 4. Mark all unsettled transactions as settled
    await db.runAsync(
      `UPDATE money_transactions 
      SET is_settled = 1, settled_at = ? 
      WHERE user_id = ? AND borrower_id = ? AND is_settled = 0`,
      [settledAt, userId, borrowerId]
    );

    return result.lastInsertRowId;
  }

  export async function getSettlements(
    userId: number,
    borrowerId?: number
  ): Promise<any[]> {
    const db = await getDatabase();
    let query = `
      SELECT s.*, b.name as borrower_name
      FROM settlements s
      LEFT JOIN borrowers b ON s.borrower_id = b.id
      WHERE s.user_id = ?
    `;
    const params: any[] = [userId];

    if (borrowerId) {
      query += ' AND s.borrower_id = ?';
      params.push(borrowerId);
    }

    query += ' ORDER BY s.settled_at DESC';
    return await db.getAllAsync(query, params);
  }

  export async function getSettlementTransactions(
    userId: number,
    borrowerId: number,
    settledAt: string
  ): Promise<any[]> {
    const db = await getDatabase();
    return await db.getAllAsync(
      `SELECT * FROM money_transactions 
      WHERE user_id = ? AND borrower_id = ? AND settled_at = ?
      ORDER BY date DESC`,
      [userId, borrowerId, settledAt]
    );
  }

  export async function deleteSettlement(
    settlementId: number,
    userId: number
  ): Promise<void> {
    const db = await getDatabase();

    // Get settlement details
    const settlement = await db.getFirstAsync<{
      borrower_id: number;
      settled_at: string;
    }>(
      'SELECT borrower_id, settled_at FROM settlements WHERE id = ? AND user_id = ?',
      [settlementId, userId]
    );

    if (!settlement) {
      throw new Error('Settlement not found');
    }

    // Unsettle the transactions
    await db.runAsync(
      `UPDATE money_transactions 
      SET is_settled = 0, settled_at = NULL 
      WHERE user_id = ? AND borrower_id = ? AND settled_at = ?`,
      [userId, settlement.borrower_id, settlement.settled_at]
    );

    // Delete settlement record
    await db.runAsync(
      'DELETE FROM settlements WHERE id = ? AND user_id = ?',
      [settlementId, userId]
    );
  }

// ==================== DASHBOARD DATA ====================

export async function getMoneyDashboardData(
  userId: number,
  filters?: { startDate?: string; endDate?: string }
): Promise<any> {
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

  const totalGiven = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM money_transactions WHERE user_id = ? AND type = 'given' AND is_settled = 0${dateFilter}`,
    params
  );

  const totalReceived = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM money_transactions WHERE user_id = ? AND type = 'received' AND is_settled = 0${dateFilter}`,
    params
  );

  const borrowerCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM borrowers WHERE user_id = ?',
    [userId]
  );

  const borrowerBalances = await db.getAllAsync(
    `
    SELECT b.id, b.name, b.phone,
      COALESCE(SUM(CASE WHEN t.type = 'given' THEN t.amount ELSE -t.amount END), 0) as balance
    FROM borrowers b
    LEFT JOIN money_transactions t ON b.id = t.borrower_id AND t.is_settled = 0
    WHERE b.user_id = ?
    GROUP BY b.id, b.name, b.phone
    ORDER BY balance DESC
  `,
    [userId]
  );

  const totalGivenAmount = totalGiven?.total || 0;
  const totalReceivedAmount = totalReceived?.total || 0;
  const outstanding = totalGivenAmount - totalReceivedAmount;

  const recentTransactions = await db.getAllAsync(
    `
    SELECT t.*, b.name as borrower_name
    FROM money_transactions t
    LEFT JOIN borrowers b ON t.borrower_id = b.id
    WHERE t.user_id = ? AND t.is_settled = 0
    ORDER BY t.date DESC, t.id DESC
    LIMIT 5
  `,
    [userId]
  );

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

// ==================== ADMIN ====================

async function ensureDefaultAdmin(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  try {
    const admin = await database.getFirstAsync<{ id: number }>(
      `SELECT id FROM users WHERE is_admin = 1`
    );
    if (!admin) {
      // Create default admin
      // Default password: admin123 (hashed same way as user passwords)
      const defaultPassword = hashPasswordSimple('admin123');
      await database.runAsync(
        `INSERT OR IGNORE INTO users (name, email, password, is_admin) VALUES (?, ?, ?, 1)`,
        ['Admin', 'admin@app.local', defaultPassword]
      );
      console.log('✅ Default admin created (admin@app.local / admin123)');
    }
  } catch (e) {
    console.error('Admin creation error:', e);
  }
}

function hashPasswordSimple(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash_${Math.abs(hash)}_${password.length}`;
}

// ==================== APP SETTINGS ====================

export async function getAppSetting(key: string): Promise<string | null> {
  return safeExecute(async (db) => {
    const result = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key]
    );
    return result?.value || null;
  });
}

export async function setAppSetting(
  key: string,
  value: string
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      [key, value]
    );
    // ensure the returned promise resolves to void rather than SQLiteRunResult
    return undefined;
  });
}

export async function getAllAppSettings(): Promise<Record<string, string>> {
  return safeExecute(async (db) => {
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM app_settings'
    );
    const settings: Record<string, string> = {};
    rows.forEach((r) => { settings[r.key] = r.value; });
    return settings;
  });
}

// ==================== USER SETTINGS ====================

export async function getUserSetting(
  userId: number,
  key: string
): Promise<string | null> {
  return safeExecute(async (db) => {
    const result = await db.getFirstAsync<{ setting_value: string }>(
      'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, key]
    );
    return result?.setting_value || null;
  });
}

export async function setUserSetting(
  userId: number,
  key: string,
  value: string
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO user_settings (user_id, setting_key, setting_value, updated_at) VALUES (?, ?, ?, datetime('now'))`,
      [userId, key, value]
    );
  });
}

export async function getAllUserSettings(
  userId: number
): Promise<Record<string, string>> {
  return safeExecute(async (db) => {
    const rows = await db.getAllAsync<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?',
      [userId]
    );
    const settings: Record<string, string> = {};
    rows.forEach((r) => { settings[r.setting_key] = r.setting_value; });
    return settings;
  });
}

export async function deleteAllUserSettings(userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM user_settings WHERE user_id = ?', [userId]);
    return undefined;
  });
}

// ==================== ADMIN USER MANAGEMENT ====================

export async function getAllUsers(): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT id, name, email, is_admin, is_active, created_at FROM users ORDER BY is_admin DESC, name ASC`
    )
  );
}

export async function updateUserStatus(
  userId: number,
  isActive: boolean
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [isActive ? 1 : 0, userId]
    );
  });
}

export async function resetUserPassword(
  userId: number,
  newPassword: string
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashPasswordSimple(newPassword), userId]
    );
  });
}

export async function deleteUser(userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM user_settings WHERE user_id = ?', [userId]);
    await db.runAsync('DELETE FROM users WHERE id = ? AND is_admin = 0', [userId]);
  });
}

export async function adminLogin(
  email: string,
  password: string
): Promise<any> {
  return safeExecute(async (db) => {
    const user = await db.getFirstAsync<any>(
      'SELECT * FROM users WHERE email = ? AND is_admin = 1',
      [email]
    );
    if (!user) throw new Error('Admin account not found');
    const hashed = hashPasswordSimple(password);
    if (user.password !== hashed) throw new Error('Invalid admin password');
    return { id: user.id, name: user.name, email: user.email, is_admin: true };
  });
}

export async function changeAdminPassword(
  adminId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  return safeExecute(async (db) => {
    const admin = await db.getFirstAsync<{ password: string }>(
      'SELECT password FROM users WHERE id = ? AND is_admin = 1',
      [adminId]
    );
    if (!admin) throw new Error('Admin not found');
    if (admin.password !== hashPasswordSimple(currentPassword)) {
      throw new Error('Current password is incorrect');
    }
    await db.runAsync(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashPasswordSimple(newPassword), adminId]
    );
  });
}

export async function getUserStats(userId: number): Promise<any> {
  return safeExecute(async (db) => {
    const expenses = await db.getFirstAsync<{ count: number; total: number }>(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?',
      [userId]
    );
    const borrowers = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM borrowers WHERE user_id = ?',
      [userId]
    );
    const transactions = await db.getFirstAsync<{ count: number; given: number; received: number }>(
      `SELECT COUNT(*) as count,
        COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) as given,
        COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) as received
       FROM money_transactions WHERE user_id = ? AND is_settled = 0`,
      [userId]
    );
    return {
      expenseCount: expenses?.count || 0,
      totalExpenses: expenses?.total || 0,
      borrowerCount: borrowers?.count || 0,
      transactionCount: transactions?.count || 0,
      totalGiven: transactions?.given || 0,
      totalReceived: transactions?.received || 0,
    };
  });
}
