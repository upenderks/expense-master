import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let isOpening = false;
let openPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (openPromise) {
    return openPromise;
  }

  if (db) {
    try {
      await db.getFirstAsync('SELECT 1');
      return db;
    } catch {
      console.log('DB connection invalid, reopening...');
      db = null;
    }
  }

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

export function resetDatabaseInstance(): void {
  db = null;
  openPromise = null;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = OFF;');

  /*
  await database.execAsync(`
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS money_transactions;
    DROP TABLE IF EXISTS expense_categories;
    DROP TABLE IF EXISTS borrowers;
    DROP TABLE IF EXISTS users;
  `);
  */

  await database.execAsync('PRAGMA foreign_keys = ON;');

  // ── Core tables ────────────────────────────────────────────────────────────
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

  // Asset tracking tables must run AFTER core tables
  await initAssetTrackingTables(database);

  // Initialize organizer tables
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS home_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      monthly_rate REAL DEFAULT 0,
      per_visit_rate REAL DEFAULT 0,
      working_days TEXT DEFAULT 'mon,tue,wed,thu,fri,sat',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_absences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      absent_date TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES home_services(id) ON DELETE CASCADE,
      UNIQUE(service_id, absent_date)
    );

    CREATE TABLE IF NOT EXISTS refill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      default_price REAL DEFAULT 0,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refill_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      refill_date TEXT NOT NULL,
      amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES refill_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'custom',
      reminder_date TEXT NOT NULL,
      reminder_time TEXT DEFAULT '09:00',
      recurrence TEXT DEFAULT 'none',
      recurrence_day INTEGER,
      is_active INTEGER DEFAULT 1,
      is_done INTEGER DEFAULT 0,
      last_notified TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

      // Habits tables
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'custom',
      mode TEXT DEFAULT 'fixed',
      interval_hours REAL DEFAULT 2,
      start_time TEXT DEFAULT '08:00',
      end_time TEXT DEFAULT '20:00',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      reminder_time TEXT NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      habit_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      log_time TEXT NOT NULL,
      is_done INTEGER DEFAULT 0,
      done_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      UNIQUE(habit_id, log_date, log_time)
    );
  `);
}

// ==================== ASSET TRACKING TABLES ====================
// NOTE: asset_customer_settlements and asset_customer_settlement_jobs
// are created HERE (after asset_customers and time_logs exist)

async function initAssetTrackingTables(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      asset_type TEXT DEFAULT 'vehicle',
      hourly_rate REAL NOT NULL DEFAULT 0,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asset_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      asset_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes REAL DEFAULT 0,
      hourly_rate REAL NOT NULL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'completed',
      is_settled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES asset_customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asset_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      notes TEXT,
      is_settled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES asset_customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asset_customer_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      total_billed REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      job_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      settled_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES asset_customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asset_customer_settlement_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      settlement_id INTEGER NOT NULL,
      time_log_id INTEGER NOT NULL,
      FOREIGN KEY (settlement_id) REFERENCES asset_customer_settlements(id) ON DELETE CASCADE,
      FOREIGN KEY (time_log_id) REFERENCES time_logs(id) ON DELETE CASCADE
    );
  `);
}

// ==================== USERS ====================

export async function createUser(
  name: string,
  email: string,
  password: string
): Promise<number> {
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
    await db.runAsync(
      'INSERT INTO expense_categories (user_id, name, color) VALUES (?, ?, ?)',
      [userId, cat.name, cat.color]
    );
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

export async function createBorrower(
  userId: number, name: string, phone?: string,
  email?: string, address?: string, notes?: string
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO borrowers (user_id, name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, name, phone || null, email || null, address || null, notes || null]
  );
  return result.lastInsertRowId;
}

export async function updateBorrower(
  id: number, userId: number, name: string,
  phone?: string, email?: string, address?: string, notes?: string
): Promise<void> {
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

export async function createTransaction(
  userId: number, borrowerId: number, type: 'given' | 'received',
  amount: number, date: string, description?: string
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO money_transactions (user_id, borrower_id, type, amount, date, description) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, borrowerId, type, amount, date, description || null]
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(
  id: number, userId: number, borrowerId: number, type: 'given' | 'received',
  amount: number, date: string, description?: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE money_transactions SET borrower_id = ?, type = ?, amount = ?, date = ?, description = ? WHERE id = ? AND user_id = ?',
    [borrowerId, type, amount, date, description || null, id, userId]
  );
}

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
  return await db.getAllAsync(
    'SELECT * FROM expense_categories WHERE user_id = ? ORDER BY name',
    [userId]
  );
}

export async function createExpenseCategory(
  userId: number, name: string, color?: string
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO expense_categories (user_id, name, color) VALUES (?, ?, ?)',
    [userId, name, color || '#3b82f6']
  );
  return result.lastInsertRowId;
}

export async function updateExpenseCategory(
  id: number, userId: number, name: string, color?: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE expense_categories SET name = ?, color = ? WHERE id = ? AND user_id = ?',
    [name, color || '#3b82f6', id, userId]
  );
}

export async function deleteExpenseCategory(id: number, userId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM expense_categories WHERE id = ? AND user_id = ?',
    [id, userId]
  );
}

// ==================== EXPENSES ====================

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

export async function createExpense(
  userId: number, categoryId: number, amount: number,
  date: string, description?: string, photoUri?: string
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO expenses (user_id, category_id, amount, date, description, photo_uri) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, categoryId, amount, date, description || null, photoUri || null]
  );
  return result.lastInsertRowId;
}

export async function updateExpense(
  id: number, userId: number, categoryId: number, amount: number,
  date: string, description?: string, photoUri?: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE expenses SET category_id = ?, amount = ?, date = ?, description = ?, photo_uri = ? WHERE id = ? AND user_id = ?',
    [categoryId, amount, date, description || null, photoUri || null, id, userId]
  );
}

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

// ==================== MONEY SETTLEMENTS ====================

export async function settleBorrower(
  userId: number, borrowerId: number, notes?: string
): Promise<number> {
  const db = await getDatabase();
  const unsettled = await db.getAllAsync<{ id: number; type: string; amount: number }>(
    `SELECT id, type, amount FROM money_transactions
     WHERE user_id = ? AND borrower_id = ? AND is_settled = 0`,
    [userId, borrowerId]
  );
  if (unsettled.length === 0) throw new Error('No unsettled transactions to settle');

  const totalGiven = unsettled.filter((t) => t.type === 'given').reduce((s, t) => s + t.amount, 0);
  const totalReceived = unsettled.filter((t) => t.type === 'received').reduce((s, t) => s + t.amount, 0);
  const balance = totalGiven - totalReceived;
  const settledAt = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO settlements (user_id, borrower_id, total_given, total_received, balance, transaction_count, notes, settled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, borrowerId, totalGiven, totalReceived, balance, unsettled.length, notes || null, settledAt]
  );
  await db.runAsync(
    `UPDATE money_transactions SET is_settled = 1, settled_at = ?
     WHERE user_id = ? AND borrower_id = ? AND is_settled = 0`,
    [settledAt, userId, borrowerId]
  );
  return result.lastInsertRowId;
}

export async function getSettlements(
  userId: number, borrowerId?: number
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
  userId: number, borrowerId: number, settledAt: string
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
  settlementId: number, userId: number
): Promise<void> {
  const db = await getDatabase();
  const settlement = await db.getFirstAsync<{ borrower_id: number; settled_at: string }>(
    'SELECT borrower_id, settled_at FROM settlements WHERE id = ? AND user_id = ?',
    [settlementId, userId]
  );
  if (!settlement) throw new Error('Settlement not found');

  await db.runAsync(
    `UPDATE money_transactions SET is_settled = 0, settled_at = NULL
     WHERE user_id = ? AND borrower_id = ? AND settled_at = ?`,
    [userId, settlement.borrower_id, settlement.settled_at]
  );
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
  if (filters?.startDate) { dateFilter += ' AND date >= ?'; params.push(filters.startDate); }
  if (filters?.endDate) { dateFilter += ' AND date <= ?'; params.push(filters.endDate); }

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
    `SELECT b.id, b.name, b.phone,
      COALESCE(SUM(CASE WHEN t.type = 'given' THEN t.amount ELSE -t.amount END), 0) as balance
     FROM borrowers b
     LEFT JOIN money_transactions t ON b.id = t.borrower_id AND t.is_settled = 0
     WHERE b.user_id = ?
     GROUP BY b.id, b.name, b.phone
     ORDER BY balance DESC`,
    [userId]
  );
  const recentTransactions = await db.getAllAsync(
    `SELECT t.*, b.name as borrower_name
     FROM money_transactions t
     LEFT JOIN borrowers b ON t.borrower_id = b.id
     WHERE t.user_id = ? AND t.is_settled = 0
     ORDER BY t.date DESC, t.id DESC LIMIT 5`,
    [userId]
  );

  const totalGivenAmount = totalGiven?.total || 0;
  const totalReceivedAmount = totalReceived?.total || 0;
  return {
    totalGiven: totalGivenAmount,
    totalReceived: totalReceivedAmount,
    outstanding: totalGivenAmount - totalReceivedAmount,
    borrowerCount: borrowerCount?.count || 0,
    borrowerBalances,
    recentTransactions,
  };
}

export async function getExpenseDashboardData(
  userId: number,
  period: 'day' | 'week' | 'month' = 'month',
  filters?: { startDate?: string; endDate?: string }
): Promise<any> {
  const db = await getDatabase();
  let startDate: string;
  if (filters?.startDate) {
    startDate = filters.startDate;
  } else {
    const now = new Date();
    if (period === 'day') {
      startDate = now.toISOString().split('T')[0];
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
  }

  const totalExpenses = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= ?',
    [userId, startDate]
  );
  const categoryTotals = await db.getAllAsync(
    `SELECT c.id, c.name, c.color, COALESCE(SUM(e.amount), 0) as total
     FROM expense_categories c
     LEFT JOIN expenses e ON c.id = e.category_id AND e.date >= ?
     WHERE c.user_id = ?
     GROUP BY c.id, c.name, c.color
     ORDER BY total DESC`,
    [startDate, userId]
  );
  const recentExpenses = await db.getAllAsync(
    `SELECT e.*, c.name as category_name, c.color as category_color
     FROM expenses e
     LEFT JOIN expense_categories c ON e.category_id = c.id
     WHERE e.user_id = ?
     ORDER BY e.date DESC, e.id DESC LIMIT 5`,
    [userId]
  );

  return {
    period,
    startDate,
    totalExpenses: totalExpenses?.total || 0,
    categoryTotals,
    recentExpenses,
  };
}

// ==================== ADMIN ====================

async function ensureDefaultAdmin(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const admin = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM users WHERE is_admin = 1'
    );
    if (!admin) {
      const defaultPassword = hashPasswordSimple('admin123');
      await database.runAsync(
        'INSERT OR IGNORE INTO users (name, email, password, is_admin) VALUES (?, ?, ?, 1)',
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
      'SELECT value FROM app_settings WHERE key = ?', [key]
    );
    return result?.value || null;
  });
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      [key, value]
    );
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

export async function getUserSetting(userId: number, key: string): Promise<string | null> {
  return safeExecute(async (db) => {
    const result = await db.getFirstAsync<{ setting_value: string }>(
      'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, key]
    );
    return result?.setting_value || null;
  });
}

export async function setUserSetting(userId: number, key: string, value: string): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO user_settings (user_id, setting_key, setting_value, updated_at) VALUES (?, ?, ?, datetime('now'))`,
      [userId, key, value]
    );
  });
}

export async function getAllUserSettings(userId: number): Promise<Record<string, string>> {
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
      'SELECT id, name, email, is_admin, is_active, created_at FROM users ORDER BY is_admin DESC, name ASC'
    )
  );
}

export async function updateUserStatus(userId: number, isActive: boolean): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, userId]);
  });
}

export async function resetUserPassword(userId: number, newPassword: string): Promise<void> {
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

export async function adminLogin(email: string, password: string): Promise<any> {
  return safeExecute(async (db) => {
    const user = await db.getFirstAsync<any>(
      'SELECT * FROM users WHERE email = ? AND is_admin = 1', [email]
    );
    if (!user) throw new Error('Admin account not found');
    if (user.password !== hashPasswordSimple(password)) throw new Error('Invalid admin password');
    return { id: user.id, name: user.name, email: user.email, is_admin: true };
  });
}

export async function changeAdminPassword(
  adminId: number, currentPassword: string, newPassword: string
): Promise<void> {
  return safeExecute(async (db) => {
    const admin = await db.getFirstAsync<{ password: string }>(
      'SELECT password FROM users WHERE id = ? AND is_admin = 1', [adminId]
    );
    if (!admin) throw new Error('Admin not found');
    if (admin.password !== hashPasswordSimple(currentPassword)) throw new Error('Current password is incorrect');
    await db.runAsync('UPDATE users SET password = ? WHERE id = ?', [hashPasswordSimple(newPassword), adminId]);
  });
}

export async function getUserStats(userId: number): Promise<any> {
  return safeExecute(async (db) => {
    const expenses = await db.getFirstAsync<{ count: number; total: number }>(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?',
      [userId]
    );
    const borrowers = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM borrowers WHERE user_id = ?', [userId]
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

// ==================== ASSET TRACKING ====================

export async function getAssets(userId: number): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT a.*,
        COALESCE((SELECT SUM(duration_minutes) FROM time_logs WHERE asset_id = a.id AND user_id = ?), 0) as total_minutes,
        COALESCE((SELECT SUM(total_amount) FROM time_logs WHERE asset_id = a.id AND user_id = ?), 0) as total_earned
       FROM assets a
       WHERE a.user_id = ?
       ORDER BY a.name ASC`,
      [userId, userId, userId]
    )
  );
}

export async function createAsset(
  userId: number, name: string, assetType: string,
  hourlyRate: number, description?: string
): Promise<number> {
  return safeExecute(async (db) => {
    const result = await db.runAsync(
      'INSERT INTO assets (user_id, name, asset_type, hourly_rate, description) VALUES (?, ?, ?, ?, ?)',
      [userId, name, assetType, hourlyRate, description || null]
    );
    return result.lastInsertRowId;
  });
}

export async function updateAsset(
  id: number, userId: number, name: string, assetType: string,
  hourlyRate: number, description?: string, isActive?: boolean
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      `UPDATE assets SET name = ?, asset_type = ?, hourly_rate = ?,
       description = ?, is_active = ? WHERE id = ? AND user_id = ?`,
      [name, assetType, hourlyRate, description || null,
       isActive !== undefined ? (isActive ? 1 : 0) : 1, id, userId]
    );
    return undefined;
  });
}

export async function deleteAsset(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM assets WHERE id = ? AND user_id = ?', [id, userId]);
    return undefined;
  });
}

// ── Asset Customers ────────────────────────────────────────────────────────

export async function getAssetCustomers(userId: number): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT c.*,
        COALESCE((SELECT SUM(total_amount) FROM time_logs
          WHERE customer_id = c.id AND user_id = ? AND is_settled = 0 AND status = 'completed'), 0) as total_billed,
        COALESCE((SELECT SUM(amount) FROM asset_payments
          WHERE customer_id = c.id AND user_id = ? AND is_settled = 0), 0) as total_paid
       FROM asset_customers c
       WHERE c.user_id = ?
       ORDER BY c.name ASC`,
      [userId, userId, userId]
    )
  );
}

export async function createAssetCustomer(
  userId: number, name: string, phone?: string,
  address?: string, notes?: string
): Promise<number> {
  return safeExecute(async (db) => {
    const result = await db.runAsync(
      'INSERT INTO asset_customers (user_id, name, phone, address, notes) VALUES (?, ?, ?, ?, ?)',
      [userId, name, phone || null, address || null, notes || null]
    );
    return result.lastInsertRowId;
  });
}

export async function updateAssetCustomer(
  id: number, userId: number, name: string,
  phone?: string, address?: string, notes?: string
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      'UPDATE asset_customers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ? AND user_id = ?',
      [name, phone || null, address || null, notes || null, id, userId]
    );
  });
}

export async function deleteAssetCustomer(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM asset_customers WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

// ── Time Logs ──────────────────────────────────────────────────────────────

export async function getTimeLogs(
  userId: number,
  filters?: {
    customerId?: number;
    assetId?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<any[]> {
  return safeExecute(async (db) => {
    let query = `
      SELECT tl.*,
        a.name as asset_name, a.asset_type,
        c.name as customer_name, c.phone as customer_phone
      FROM time_logs tl
      LEFT JOIN assets a ON tl.asset_id = a.id
      LEFT JOIN asset_customers c ON tl.customer_id = c.id
      WHERE tl.user_id = ?
    `;
    const params: any[] = [userId];

    if (filters?.customerId) { query += ' AND tl.customer_id = ?'; params.push(filters.customerId); }
    if (filters?.assetId) { query += ' AND tl.asset_id = ?'; params.push(filters.assetId); }
    if (filters?.startDate) { query += ' AND DATE(tl.start_time) >= ?'; params.push(filters.startDate); }
    if (filters?.endDate) { query += ' AND DATE(tl.start_time) <= ?'; params.push(filters.endDate); }

    query += ' ORDER BY tl.start_time DESC';
    return db.getAllAsync(query, params);
  });
}

export async function createTimeLog(
  userId: number, assetId: number, customerId: number,
  startTime: string, endTime: string, durationMinutes: number,
  hourlyRate: number, totalAmount: number, notes?: string
): Promise<number> {
  return safeExecute(async (db) => {
    const status = endTime ? 'completed' : 'running';
    const result = await db.runAsync(
      `INSERT INTO time_logs
       (user_id, asset_id, customer_id, start_time, end_time,
        duration_minutes, hourly_rate, total_amount, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, assetId, customerId, startTime,
       endTime || null, durationMinutes, hourlyRate,
       totalAmount, notes || null, status]
    );
    return result.lastInsertRowId;
  });
}

export async function updateTimeLog(
  id: number, userId: number, assetId: number, customerId: number,
  startTime: string, endTime: string, durationMinutes: number,
  hourlyRate: number, totalAmount: number, notes?: string
): Promise<void> {
  return safeExecute(async (db) => {
    const status = endTime ? 'completed' : 'running';
    await db.runAsync(
      `UPDATE time_logs SET asset_id = ?, customer_id = ?, start_time = ?,
       end_time = ?, duration_minutes = ?, hourly_rate = ?,
       total_amount = ?, notes = ?, status = ? WHERE id = ? AND user_id = ?`,
      [assetId, customerId, startTime, endTime || null,
       durationMinutes, hourlyRate, totalAmount, notes || null,
       status, id, userId]
    );
  });
}

export async function deleteTimeLog(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM time_logs WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

// ── Asset Payments ─────────────────────────────────────────────────────────

export async function getAssetPayments(
  userId: number, customerId?: number
): Promise<any[]> {
  return safeExecute(async (db) => {
    let query = `
      SELECT p.*, c.name as customer_name
      FROM asset_payments p
      LEFT JOIN asset_customers c ON p.customer_id = c.id
      WHERE p.user_id = ?
    `;
    const params: any[] = [userId];
    if (customerId) { query += ' AND p.customer_id = ?'; params.push(customerId); }
    query += ' ORDER BY p.payment_date DESC';
    return db.getAllAsync(query, params);
  });
}

export async function createAssetPayment(
  userId: number, customerId: number, amount: number,
  paymentDate: string, notes?: string
): Promise<number> {
  return safeExecute(async (db) => {
    const result = await db.runAsync(
      'INSERT INTO asset_payments (user_id, customer_id, amount, payment_date, notes) VALUES (?, ?, ?, ?, ?)',
      [userId, customerId, amount, paymentDate, notes || null]
    );
    return result.lastInsertRowId;
  });
}

export async function deleteAssetPayment(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM asset_payments WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

// ── Customer Report ────────────────────────────────────────────────────────

export async function getCustomerReportData(
  userId: number, customerId: number,
  filters?: { startDate?: string; endDate?: string }
): Promise<any> {
  return safeExecute(async (db) => {
    const customer = await db.getFirstAsync<any>(
      'SELECT * FROM asset_customers WHERE id = ? AND user_id = ?',
      [customerId, userId]
    );

    let dateFilter = '';
    const params: any[] = [userId, customerId];
    if (filters?.startDate) { dateFilter += ' AND DATE(start_time) >= ?'; params.push(filters.startDate); }
    if (filters?.endDate) { dateFilter += ' AND DATE(start_time) <= ?'; params.push(filters.endDate); }

    // Only unsettled jobs
    const jobs = await db.getAllAsync(
      `SELECT tl.*, a.name as asset_name, a.asset_type
       FROM time_logs tl
       LEFT JOIN assets a ON tl.asset_id = a.id
       WHERE tl.user_id = ? AND tl.customer_id = ?
       AND tl.is_settled = 0${dateFilter}
       ORDER BY tl.start_time DESC`,
      params
    );

    const totals = await db.getFirstAsync<{
      total_jobs: number; total_minutes: number; total_amount: number;
    }>(
      `SELECT COUNT(*) as total_jobs,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(SUM(total_amount), 0) as total_amount
       FROM time_logs
       WHERE user_id = ? AND customer_id = ?
       AND is_settled = 0${dateFilter}`,
      params
    );

    // Only unsettled payments
    const payments = await db.getAllAsync(
      `SELECT * FROM asset_payments
       WHERE user_id = ? AND customer_id = ? AND is_settled = 0
       ORDER BY payment_date DESC`,
      [userId, customerId]
    );

    const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

    // Settlement history
    const settlements = await db.getAllAsync(
      `SELECT * FROM asset_customer_settlements
       WHERE user_id = ? AND customer_id = ?
       ORDER BY settled_at DESC`,
      [userId, customerId]
    );

    return {
      customer,
      jobs,
      payments,
      settlements,
      totalJobs: totals?.total_jobs || 0,
      totalMinutes: totals?.total_minutes || 0,
      totalHours: (totals?.total_minutes || 0) / 60,
      totalAmount: totals?.total_amount || 0,
      totalPaid,
      outstanding: (totals?.total_amount || 0) - totalPaid,
    };
  });
}

// ── Asset Dashboard ────────────────────────────────────────────────────────

export async function getAssetDashboardData(userId: number): Promise<any> {
  return safeExecute(async (db) => {
    const totalAssets = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM assets WHERE user_id = ? AND is_active = 1', [userId]
    );
    const totalCustomers = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM asset_customers WHERE user_id = ?', [userId]
    );
    const totalRevenue = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM time_logs
       WHERE user_id = ? AND is_settled = 0 AND status = 'completed'`,
      [userId]
    );
    const totalPaid = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM asset_payments
       WHERE user_id = ? AND is_settled = 0`,
      [userId]
    );
    const recentLogs = await db.getAllAsync(
      `SELECT tl.*, a.name as asset_name, a.asset_type, c.name as customer_name
       FROM time_logs tl
       LEFT JOIN assets a ON tl.asset_id = a.id
       LEFT JOIN asset_customers c ON tl.customer_id = c.id
       WHERE tl.user_id = ? AND tl.is_settled = 0
       ORDER BY tl.start_time DESC LIMIT 5`,
      [userId]
    );
  
    const topCustomers = await db.getAllAsync(
    `SELECT c.id, c.name,
      COALESCE((
        SELECT SUM(total_amount)
        FROM time_logs
        WHERE customer_id = c.id
          AND user_id = ?
          AND is_settled = 0
          AND status = 'completed'
      ), 0) as total_billed,
      COALESCE((
        SELECT SUM(amount)
        FROM asset_payments
        WHERE customer_id = c.id
          AND user_id = ?
          AND is_settled = 0
      ), 0) as total_paid
    FROM asset_customers c
    WHERE c.user_id = ?
      AND (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM time_logs
        WHERE customer_id = c.id
          AND user_id = ?
          AND is_settled = 0
          AND status = 'completed'
      ) > 0
    ORDER BY total_billed DESC
    LIMIT 5`,
    [userId, userId, userId, userId]
  );

    const totalRevAmount = totalRevenue?.total || 0;
    const totalPaidAmount = totalPaid?.total || 0;
    return {
      totalAssets: totalAssets?.count || 0,
      totalCustomers: totalCustomers?.count || 0,
      totalRevenue: totalRevAmount,
      totalPaid: totalPaidAmount,
      outstanding: totalRevAmount - totalPaidAmount,
      recentLogs,
      topCustomers,
    };
  });
}

// ── Asset Customer Settlements ─────────────────────────────────────────────

export async function settleAssetCustomer(
  userId: number, customerId: number, notes?: string
): Promise<number> {
  return safeExecute(async (db) => {
    const unsettledJobs = await db.getAllAsync<{ id: number; total_amount: number }>(
      `SELECT id, total_amount FROM time_logs
       WHERE user_id = ? AND customer_id = ? AND status = 'completed' AND is_settled = 0`,
      [userId, customerId]
    );
    if (unsettledJobs.length === 0) throw new Error('No unsettled completed jobs to settle');

    const unsettledPayments = await db.getAllAsync<{ id: number; amount: number }>(
      `SELECT id, amount FROM asset_payments
       WHERE user_id = ? AND customer_id = ? AND is_settled = 0`,
      [userId, customerId]
    );

    const totalBilled = unsettledJobs.reduce((s, j) => s + j.total_amount, 0);
    const totalPaid = unsettledPayments.reduce((s, p) => s + p.amount, 0);
    const balance = totalBilled - totalPaid;
    const settledAt = new Date().toISOString();

    const settlementResult = await db.runAsync(
      `INSERT INTO asset_customer_settlements
       (user_id, customer_id, total_billed, total_paid, balance, job_count, notes, settled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, customerId, totalBilled, totalPaid, balance, unsettledJobs.length, notes || null, settledAt]
    );
    const settlementId = settlementResult.lastInsertRowId;

    for (const job of unsettledJobs) {
      await db.runAsync(
        'INSERT INTO asset_customer_settlement_jobs (settlement_id, time_log_id) VALUES (?, ?)',
        [settlementId, job.id]
      );
    }

    await db.runAsync(
      `UPDATE time_logs SET is_settled = 1
       WHERE user_id = ? AND customer_id = ? AND status = 'completed' AND is_settled = 0`,
      [userId, customerId]
    );
    await db.runAsync(
      `UPDATE asset_payments SET is_settled = 1
       WHERE user_id = ? AND customer_id = ? AND is_settled = 0`,
      [userId, customerId]
    );

    return settlementId;
  });
}

export async function getAssetCustomerSettlements(
  userId: number, customerId: number
): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT * FROM asset_customer_settlements
       WHERE user_id = ? AND customer_id = ?
       ORDER BY settled_at DESC`,
      [userId, customerId]
    )
  );
}

export async function getAssetSettlementJobs(settlementId: number): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT tl.*, a.name as asset_name, a.asset_type
       FROM asset_customer_settlement_jobs sj
       LEFT JOIN time_logs tl ON sj.time_log_id = tl.id
       LEFT JOIN assets a ON tl.asset_id = a.id
       WHERE sj.settlement_id = ?
       ORDER BY tl.start_time DESC`,
      [settlementId]
    )
  );
}

export async function undoAssetCustomerSettlement(
  settlementId: number, userId: number
): Promise<void> {
  return safeExecute(async (db) => {
    const jobs = await db.getAllAsync<{ time_log_id: number }>(
      'SELECT time_log_id FROM asset_customer_settlement_jobs WHERE settlement_id = ?',
      [settlementId]
    );
    const jobIds = jobs.map((j) => j.time_log_id);

    if (jobIds.length > 0) {
      await db.runAsync(
        `UPDATE time_logs SET is_settled = 0 WHERE id IN (${jobIds.join(',')})`,
        []
      );
    }

    const settlement = await db.getFirstAsync<{ customer_id: number; settled_at: string }>(
      'SELECT customer_id, settled_at FROM asset_customer_settlements WHERE id = ? AND user_id = ?',
      [settlementId, userId]
    );

    if (settlement) {
      await db.runAsync(
        `UPDATE asset_payments SET is_settled = 0
         WHERE user_id = ? AND customer_id = ? AND is_settled = 1`,
        [userId, settlement.customer_id]
      );
    }

    await db.runAsync(
      'DELETE FROM asset_customer_settlement_jobs WHERE settlement_id = ?',
      [settlementId]
    );
    await db.runAsync(
      'DELETE FROM asset_customer_settlements WHERE id = ? AND user_id = ?',
      [settlementId, userId]
    );
  });
}