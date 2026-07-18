import { getDatabase } from './database';

// Minimal DB interface so methods accept type arguments (generics).
interface Database {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T = any>(sql: string, params: any[]): Promise<T[]>;
  getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]>;

  getFirstAsync<T = any>(sql: string, params: any[]): Promise<T | undefined>;
  getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | undefined>;

  runAsync(sql: string, params: any[]): Promise<{ lastInsertRowId?: number } & any>;
  runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId?: number } & any>;
}

// ── Safe executor (reuse from main database) ──────────────────────────────

async function safeExecute<T>(operation: (database: Database) => Promise<T>): Promise<T> {
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
      console.log('Organizer DB error, retrying...');
      const { resetDatabaseInstance } = require('./database');
      resetDatabaseInstance();
      await new Promise((r) => setTimeout(r, 200));
      const database = await getDatabase();
      return await operation(database);
    }
    throw error;
  }
}

// ==================== HOME SERVICES ====================

export async function getHomeServices(userId: number): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT s.*,
        (SELECT COUNT(*) FROM service_absences
         WHERE service_id = s.id
         AND strftime('%Y-%m', absent_date) = strftime('%Y-%m', 'now')
        ) as current_month_absences
       FROM home_services s
       WHERE s.user_id = ?
       ORDER BY s.name ASC`,
      [userId]
    )
  );
}

export async function createHomeService(
  userId: number,
  name: string,
  category: string,
  monthlyRate: number,
  perVisitRate: number,
  workingDays: string
): Promise<number> {
  return safeExecute(async (db) => {
    const result = await db.runAsync(
      `INSERT INTO home_services (user_id, name, category, monthly_rate, per_visit_rate, working_days)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, name, category, monthlyRate, perVisitRate, workingDays]
    );
    return result.lastInsertRowId;
  });
}

export async function updateHomeService(
  id: number,
  userId: number,
  name: string,
  category: string,
  monthlyRate: number,
  perVisitRate: number,
  workingDays: string,
  isActive?: boolean
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      `UPDATE home_services SET name = ?, category = ?, monthly_rate = ?,
       per_visit_rate = ?, working_days = ?, is_active = ?
       WHERE id = ? AND user_id = ?`,
      [name, category, monthlyRate, perVisitRate, workingDays,
       isActive !== undefined ? (isActive ? 1 : 0) : 1, id, userId]
    );
  });
}

export async function deleteHomeService(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM service_absences WHERE service_id = ? AND user_id = ?', [id, userId]);
    await db.runAsync('DELETE FROM home_services WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

// ── Service Absences ───────────────────────────────────────────────────────

export async function getServiceAbsences(
  userId: number,
  serviceId: number,
  month?: string // YYYY-MM format
): Promise<any[]> {
  return safeExecute(async (db) => {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    return db.getAllAsync(
      `SELECT * FROM service_absences
       WHERE user_id = ? AND service_id = ?
       AND strftime('%Y-%m', absent_date) = ?
       ORDER BY absent_date ASC`,
      [userId, serviceId, targetMonth]
    );
  });
}

export async function toggleServiceAbsence(
  userId: number,
  serviceId: number,
  date: string,
  reason?: string
): Promise<boolean> {
  return safeExecute(async (db) => {
    // Check if absence exists
    const existing = (await db.getFirstAsync(
      'SELECT id FROM service_absences WHERE service_id = ? AND absent_date = ?',
      [serviceId, date]
    )) as { id: number } | undefined;

    if (existing) {
      // Remove absence (mark as present)
      await db.runAsync('DELETE FROM service_absences WHERE id = ?', [existing.id]);
      return false; // not absent anymore
    } else {
      // Add absence
      await db.runAsync(
        'INSERT INTO service_absences (user_id, service_id, absent_date, reason) VALUES (?, ?, ?, ?)',
        [userId, serviceId, date, reason || null]
      );
      return true; // marked absent
    }
  });
}

export async function getServiceMonthlySummary(
  userId: number,
  serviceId: number,
  month?: string
): Promise<any> {
  return safeExecute(async (db) => {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [year, mon] = targetMonth.split('-').map(Number);

    // Get service details
    const service = await db.getFirstAsync<any>(
      'SELECT * FROM home_services WHERE id = ? AND user_id = ?',
      [serviceId, userId]
    );
    if (!service) return null;

    // Get absences for the month
    const absences = await db.getAllAsync<{ absent_date: string; reason: string }>(
      `SELECT absent_date, reason FROM service_absences
       WHERE user_id = ? AND service_id = ?
       AND strftime('%Y-%m', absent_date) = ?
       ORDER BY absent_date ASC`,
      [userId, serviceId, targetMonth]
    );

    // Calculate working days in month
    const workingDaysArr = service.working_days.split(',').map((d: string) => d.trim().toLowerCase());
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const daysInMonth = new Date(year, mon, 0).getDate();
    let totalWorkingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, mon - 1, day);
      const dayName = dayNames[date.getDay()];
      if (workingDaysArr.includes(dayName) || workingDaysArr.includes('all')) {
        totalWorkingDays++;
      }
    }

    const absentDays = absences.length;
    const presentDays = totalWorkingDays - absentDays;
    const perDayRate = service.per_visit_rate || (service.monthly_rate / totalWorkingDays);
    const deduction = absentDays * perDayRate;
    const payable = service.monthly_rate - deduction;

    return {
      service,
      month: targetMonth,
      totalWorkingDays,
      presentDays,
      absentDays,
      absences,
      perDayRate,
      deduction,
      monthlyRate: service.monthly_rate,
      payable: Math.max(0, payable),
    };
  });
}

// ==================== REFILL ITEMS ====================

export async function getRefillItems(userId: number): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT ri.*,
        (SELECT COUNT(*) FROM refill_logs WHERE item_id = ri.id) as total_refills,
        (SELECT COALESCE(SUM(amount), 0) FROM refill_logs WHERE item_id = ri.id) as total_spent,
        (SELECT refill_date FROM refill_logs WHERE item_id = ri.id ORDER BY refill_date DESC LIMIT 1) as last_refill_date
       FROM refill_items ri
       WHERE ri.user_id = ?
       ORDER BY ri.name ASC`,
      [userId]
    )
  );
}

export async function createRefillItem(
  userId: number,
  name: string,
  category: string,
  defaultPrice: number,
  notes?: string
): Promise<number> {
  return safeExecute(async (db) => {
    const result = await db.runAsync(
      'INSERT INTO refill_items (user_id, name, category, default_price, notes) VALUES (?, ?, ?, ?, ?)',
      [userId, name, category, defaultPrice, notes || null]
    );
    return result.lastInsertRowId;
  });
}

export async function updateRefillItem(
  id: number,
  userId: number,
  name: string,
  category: string,
  defaultPrice: number,
  notes?: string,
  isActive?: boolean
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      `UPDATE refill_items SET name = ?, category = ?, default_price = ?,
       notes = ?, is_active = ? WHERE id = ? AND user_id = ?`,
      [name, category, defaultPrice, notes || null,
       isActive !== undefined ? (isActive ? 1 : 0) : 1, id, userId]
    );
  });
}

export async function deleteRefillItem(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM refill_logs WHERE item_id = ? AND user_id = ?', [id, userId]);
    await db.runAsync('DELETE FROM refill_items WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

// ── Refill Logs ────────────────────────────────────────────────────────────

export async function getRefillLogs(
  userId: number,
  itemId?: number
): Promise<any[]> {
  return safeExecute(async (db) => {
    let query = `
      SELECT rl.*, ri.name as item_name, ri.category as item_category
      FROM refill_logs rl
      LEFT JOIN refill_items ri ON rl.item_id = ri.id
      WHERE rl.user_id = ?
    `;
    const params: any[] = [userId];
    if (itemId) {
      query += ' AND rl.item_id = ?';
      params.push(itemId);
    }
    query += ' ORDER BY rl.refill_date DESC';
    return db.getAllAsync(query, params);
  });
}

export async function createRefillLog(
  userId: number,
  itemId: number,
  refillDate: string,
  amount: number,
  notes?: string
): Promise<number> {
  return safeExecute(async (db) => {
    const result = await db.runAsync(
      'INSERT INTO refill_logs (user_id, item_id, refill_date, amount, notes) VALUES (?, ?, ?, ?, ?)',
      [userId, itemId, refillDate, amount, notes || null]
    );
    return result.lastInsertRowId;
  });
}

export async function deleteRefillLog(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM refill_logs WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

export async function getRefillItemStats(
  userId: number,
  itemId: number
): Promise<any> {
  return safeExecute(async (db) => {
    const item = await db.getFirstAsync<any>(
      'SELECT * FROM refill_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );

    const logs = await db.getAllAsync<{ refill_date: string; amount: number; notes: string }>(
      'SELECT * FROM refill_logs WHERE item_id = ? AND user_id = ? ORDER BY refill_date DESC',
      [itemId, userId]
    );

    const totalRefills = logs.length;
    const totalSpent = logs.reduce((s, l) => s + Number(l.amount || 0), 0);

    // Calculate average days between refills
    let avgDays = 0;
    if (logs.length >= 2) {
      let totalDiff = 0;
      for (let i = 0; i < logs.length - 1; i++) {
        const d1 = new Date(logs[i].refill_date).getTime();
        const d2 = new Date(logs[i + 1].refill_date).getTime();
        totalDiff += Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
      }
      avgDays = Math.round(totalDiff / (logs.length - 1));
    }

    return {
      item,
      logs,
      totalRefills,
      totalSpent,
      avgDaysBetweenRefills: avgDays,
      lastRefillDate: logs.length > 0 ? logs[0].refill_date : null,
    };
  });
}

// ==================== REMINDERS ====================

export async function getReminders(
  userId: number,
  filters?: {
    category?: string;
    showDone?: boolean;
    upcoming?: boolean;
  }
): Promise<any[]> {
  return safeExecute(async (db) => {
    let query = 'SELECT * FROM reminders WHERE user_id = ?';
    const params: any[] = [userId];

    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    if (!filters?.showDone) {
      query += ' AND is_done = 0';
    }
    if (filters?.upcoming) {
      query += ' AND reminder_date >= date("now")';
    }

    query += ' ORDER BY reminder_date ASC, reminder_time ASC';
    return db.getAllAsync(query, params);
  });
}

export async function createReminder(
  userId: number,
  title: string,
  description: string,
  category: string,
  reminderDate: string,
  reminderTime: string,
  recurrence: string,
  recurrenceDay?: number
): Promise<number> {
  return safeExecute(async (db) => {
    const result = await db.runAsync(
      `INSERT INTO reminders
       (user_id, title, description, category, reminder_date, reminder_time,
        recurrence, recurrence_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, description || null, category, reminderDate,
       reminderTime, recurrence, recurrenceDay || null]
    );
    return result.lastInsertRowId;
  });
}

export async function updateReminder(
  id: number,
  userId: number,
  title: string,
  description: string,
  category: string,
  reminderDate: string,
  reminderTime: string,
  recurrence: string,
  recurrenceDay?: number,
  isActive?: boolean
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      `UPDATE reminders SET title = ?, description = ?, category = ?,
       reminder_date = ?, reminder_time = ?, recurrence = ?,
       recurrence_day = ?, is_active = ?
       WHERE id = ? AND user_id = ?`,
      [title, description || null, category, reminderDate, reminderTime,
       recurrence, recurrenceDay || null,
       isActive !== undefined ? (isActive ? 1 : 0) : 1, id, userId]
    );
  });
}

export async function markReminderDone(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    const reminder = await db.getFirstAsync<{
      recurrence: string;
      reminder_date: string;
      recurrence_day: number;
    }>(
      'SELECT recurrence, reminder_date, recurrence_day FROM reminders WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!reminder) return;

    if (reminder.recurrence === 'none') {
      // One-time: mark as done
      await db.runAsync(
        'UPDATE reminders SET is_done = 1, last_notified = datetime("now") WHERE id = ?',
        [id]
      );
    } else {
      // Recurring: advance to next date
      const currentDate = new Date(reminder.reminder_date);
      let nextDate: Date;

      switch (reminder.recurrence) {
        case 'daily':
          nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'monthly':
          nextDate = new Date(currentDate);
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'yearly':
          nextDate = new Date(currentDate);
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        default:
          nextDate = currentDate;
      }

      const nextDateStr = nextDate.toISOString().split('T')[0];
      await db.runAsync(
        'UPDATE reminders SET reminder_date = ?, last_notified = datetime("now") WHERE id = ?',
        [nextDateStr, id]
      );
    }
  });
}

export async function deleteReminder(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM reminders WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

export async function getTodaysReminders(userId: number): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT * FROM reminders
       WHERE user_id = ? AND is_done = 0 AND is_active = 1
       AND reminder_date <= date('now')
       ORDER BY reminder_time ASC`,
      [userId]
    )
  );
}

export async function getUpcomingReminders(
  userId: number,
  days: number = 7
): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT * FROM reminders
       WHERE user_id = ? AND is_done = 0 AND is_active = 1
       AND reminder_date BETWEEN date('now') AND date('now', '+' || ? || ' days')
       ORDER BY reminder_date ASC, reminder_time ASC`,
      [userId, days]
    )
  );
}

// ── Organizer Dashboard ────────────────────────────────────────────────────

export async function getOrganizerDashboard(userId: number): Promise<any> {
  return safeExecute(async (db) => {
    const activeServices = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM home_services WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthAbsences = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM service_absences
       WHERE user_id = ? AND strftime('%Y-%m', absent_date) = ?`,
      [userId, currentMonth]
    );

    const activeRefillItems = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM refill_items WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    const todaysReminders = await db.getAllAsync(
      `SELECT * FROM reminders
       WHERE user_id = ? AND is_done = 0 AND is_active = 1
       AND reminder_date <= date('now')
       ORDER BY reminder_time ASC`,
      [userId]
    );

    const upcomingReminders = await db.getAllAsync(
      `SELECT * FROM reminders
       WHERE user_id = ? AND is_done = 0 AND is_active = 1
       AND reminder_date > date('now')
       AND reminder_date <= date('now', '+7 days')
       ORDER BY reminder_date ASC, reminder_time ASC`,
      [userId]
    );

    // Services with this month's absences
    const servicesWithAbsences = await db.getAllAsync(
      `SELECT s.id, s.name, s.category, s.monthly_rate,
        (SELECT COUNT(*) FROM service_absences
         WHERE service_id = s.id
         AND strftime('%Y-%m', absent_date) = ?
        ) as absences_this_month
       FROM home_services s
       WHERE s.user_id = ? AND s.is_active = 1
       ORDER BY absences_this_month DESC`,
      [currentMonth, userId]
    );

    // Recent refills
    const recentRefills = await db.getAllAsync(
      `SELECT rl.*, ri.name as item_name, ri.category as item_category
       FROM refill_logs rl
       LEFT JOIN refill_items ri ON rl.item_id = ri.id
       WHERE rl.user_id = ?
       ORDER BY rl.refill_date DESC LIMIT 5`,
      [userId]
    );

    return {
      activeServices: activeServices?.count || 0,
      monthAbsences: monthAbsences?.count || 0,
      activeRefillItems: activeRefillItems?.count || 0,
      todaysReminders,
      upcomingReminders,
      servicesWithAbsences,
      recentRefills,
    };
  });
}


// ==================== DAILY HABITS ====================

export async function getHabits(userId: number): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT h.*,
        (SELECT COUNT(*) FROM habit_logs
         WHERE habit_id = h.id AND log_date = date('now') AND is_done = 1
        ) as today_done,
        (SELECT COUNT(*) FROM habit_times WHERE habit_id = h.id) as total_times
       FROM habits h
       WHERE h.user_id = ? AND h.is_active = 1
       ORDER BY h.name ASC`,
      [userId]
    )
  );
}

export async function createHabit(
  userId: number,
  name: string,
  category: string,
  mode: string,
  intervalHours: number,
  startTime: string,
  endTime: string,
  times: string[]
): Promise<number> {
  return safeExecute(async (db) => {
    const result = await db.runAsync(
      `INSERT INTO habits (user_id, name, category, mode, interval_hours, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, category, mode, intervalHours, startTime, endTime]
    );
    const habitId = result.lastInsertRowId;

    // Insert times
    if (mode === 'fixed' && times.length > 0) {
      for (const time of times) {
        await db.runAsync(
          'INSERT INTO habit_times (habit_id, reminder_time) VALUES (?, ?)',
          [habitId, time]
        );
      }
    } else if (mode === 'interval' && intervalHours > 0) {
      // Generate times based on interval
      const [startH] = startTime.split(':').map(Number);
      const [endH] = endTime.split(':').map(Number);
      for (let h = startH; h <= endH; h += intervalHours) {
        const timeStr = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
        await db.runAsync(
          'INSERT INTO habit_times (habit_id, reminder_time) VALUES (?, ?)',
          [habitId, timeStr]
        );
      }
    }

    return habitId;
  });
}

export async function updateHabit(
  id: number,
  userId: number,
  name: string,
  category: string,
  mode: string,
  intervalHours: number,
  startTime: string,
  endTime: string,
  times: string[],
  isActive?: boolean
): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync(
      `UPDATE habits SET name = ?, category = ?, mode = ?,
       interval_hours = ?, start_time = ?, end_time = ?,
       is_active = ? WHERE id = ? AND user_id = ?`,
      [name, category, mode, intervalHours, startTime, endTime,
       isActive !== undefined ? (isActive ? 1 : 0) : 1, id, userId]
    );

    // Replace times
    await db.runAsync('DELETE FROM habit_times WHERE habit_id = ?', [id]);

    if (mode === 'fixed' && times.length > 0) {
      for (const time of times) {
        await db.runAsync(
          'INSERT INTO habit_times (habit_id, reminder_time) VALUES (?, ?)',
          [id, time]
        );
      }
    } else if (mode === 'interval' && intervalHours > 0) {
      const [startH] = startTime.split(':').map(Number);
      const [endH] = endTime.split(':').map(Number);
      for (let h = startH; h <= endH; h += intervalHours) {
        const timeStr = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
        await db.runAsync(
          'INSERT INTO habit_times (habit_id, reminder_time) VALUES (?, ?)',
          [id, timeStr]
        );
      }
    }
  });
}

export async function deleteHabit(id: number, userId: number): Promise<void> {
  return safeExecute(async (db) => {
    await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ?', [id]);
    await db.runAsync('DELETE FROM habit_times WHERE habit_id = ?', [id]);
    await db.runAsync('DELETE FROM habits WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

export async function getHabitTimes(habitId: number): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      'SELECT * FROM habit_times WHERE habit_id = ? ORDER BY reminder_time ASC',
      [habitId]
    )
  );
}

// ── Habit Logs ─────────────────────────────────────────────────────────────

export async function getHabitLogsForDate(
  userId: number,
  date: string
): Promise<any[]> {
  return safeExecute((db) =>
    db.getAllAsync(
      `SELECT hl.*, h.name as habit_name, h.category as habit_category
       FROM habit_logs hl
       LEFT JOIN habits h ON hl.habit_id = h.id
       WHERE hl.user_id = ? AND hl.log_date = ?
       ORDER BY hl.log_time ASC`,
      [userId, date]
    )
  );
}

export async function toggleHabitLog(
  userId: number,
  habitId: number,
  date: string,
  time: string
): Promise<boolean> {
  return safeExecute(async (db) => {
    const existing = await db.getFirstAsync<{ id: number; is_done: number }>(
      `SELECT id, is_done FROM habit_logs
       WHERE habit_id = ? AND log_date = ? AND log_time = ?`,
      [habitId, date, time]
    );

    if (existing) {
      if (existing.is_done) {
        // Mark as undone
        await db.runAsync(
          'UPDATE habit_logs SET is_done = 0, done_at = NULL WHERE id = ?',
          [existing.id]
        );
        return false;
      } else {
        // Mark as done
        await db.runAsync(
          'UPDATE habit_logs SET is_done = 1, done_at = datetime("now") WHERE id = ?',
          [existing.id]
        );
        return true;
      }
    } else {
      // Create new log and mark done
      await db.runAsync(
        `INSERT INTO habit_logs (user_id, habit_id, log_date, log_time, is_done, done_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'))`,
        [userId, habitId, date, time]
      );
      return true;
    }
  });
}

export async function ensureHabitLogsForDate(
  userId: number,
  date: string
): Promise<void> {
  return safeExecute(async (db) => {
    // Get all active habits
    const habits = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM habits WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    for (const habit of habits) {
      const times = await db.getAllAsync<{ reminder_time: string }>(
        'SELECT reminder_time FROM habit_times WHERE habit_id = ?',
        [habit.id]
      );

      for (const timeEntry of times) {
        const existing = await db.getFirstAsync(
          `SELECT id FROM habit_logs
           WHERE habit_id = ? AND log_date = ? AND log_time = ?`,
          [habit.id, date, timeEntry.reminder_time]
        );

        if (!existing) {
          await db.runAsync(
            `INSERT INTO habit_logs (user_id, habit_id, log_date, log_time, is_done)
             VALUES (?, ?, ?, ?, 0)`,
            [userId, habit.id, date, timeEntry.reminder_time]
          );
        }
      }
    }
  });
}

// ── Habit Stats ────────────────────────────────────────────────────────────

export async function getHabitStats(
  userId: number,
  habitId: number
): Promise<any> {
  return safeExecute(async (db) => {
    const habit = await db.getFirstAsync<any>(
      'SELECT * FROM habits WHERE id = ? AND user_id = ?',
      [habitId, userId]
    );

    const times = await db.getAllAsync<{ reminder_time: string }>(
      'SELECT reminder_time FROM habit_times WHERE habit_id = ? ORDER BY reminder_time ASC',
      [habitId]
    );

    const today = new Date().toISOString().split('T')[0];

    // Today's progress
    const todayLogs = await db.getAllAsync<{ log_time: string; is_done: number }>(
      'SELECT log_time, is_done FROM habit_logs WHERE habit_id = ? AND log_date = ?',
      [habitId, today]
    );

    const todayDone = todayLogs.filter((l) => l.is_done === 1).length;
    const todayTotal = times.length;

    // Streak calculation
    let streak = 0;
    let checkDate = new Date();
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const dayLogs = await db.getAllAsync<{ is_done: number }>(
        'SELECT is_done FROM habit_logs WHERE habit_id = ? AND log_date = ?',
        [habitId, dateStr]
      );

      if (dayLogs.length === 0 && dateStr !== today) break;

      const allDone = dayLogs.length > 0 && dayLogs.every((l) => l.is_done === 1);
      if (allDone && dayLogs.length >= todayTotal) {
        streak++;
      } else if (dateStr !== today) {
        break;
      }

      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Last 30 days history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const history = await db.getAllAsync<{
      log_date: string;
      done_count: number;
      total_count: number;
    }>(
      `SELECT log_date,
        SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) as done_count,
        COUNT(*) as total_count
       FROM habit_logs
       WHERE habit_id = ? AND log_date >= ?
       GROUP BY log_date
       ORDER BY log_date DESC`,
      [habitId, thirtyDaysAgoStr]
    );

    return {
      habit,
      times,
      todayDone,
      todayTotal,
      todayPercent: todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0,
      streak,
      history,
    };
  });
}

export async function getTodaysHabitsSummary(userId: number): Promise<any> {
  return safeExecute(async (db) => {
    const today = new Date().toISOString().split('T')[0];

    const habits = await db.getAllAsync<any>(
      `SELECT h.*,
        (SELECT COUNT(*) FROM habit_times WHERE habit_id = h.id) as total_times,
        (SELECT COUNT(*) FROM habit_logs
         WHERE habit_id = h.id AND log_date = ? AND is_done = 1
        ) as done_count
       FROM habits h
       WHERE h.user_id = ? AND h.is_active = 1
       ORDER BY h.name ASC`,
      [today, userId]
    );

    const totalHabits = habits.length;
    const completedHabits = habits.filter(
      (h: any) => h.done_count >= h.total_times && h.total_times > 0
    ).length;

    // Next upcoming habit time
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let nextHabit: any = null;
    for (const habit of habits) {
      const undoneTimes = await db.getAllAsync<{ reminder_time: string }>(
        `SELECT ht.reminder_time FROM habit_times ht
         WHERE ht.habit_id = ?
         AND ht.reminder_time >= ?
         AND NOT EXISTS (
           SELECT 1 FROM habit_logs hl
           WHERE hl.habit_id = ht.habit_id
           AND hl.log_date = ?
           AND hl.log_time = ht.reminder_time
           AND hl.is_done = 1
         )
         ORDER BY ht.reminder_time ASC
         LIMIT 1`,
        [habit.id, currentTime, today]
      );

      if (undoneTimes.length > 0) {
        nextHabit = {
          ...habit,
          nextTime: undoneTimes[0].reminder_time,
        };
        break;
      }
    }

    return {
      habits,
      totalHabits,
      completedHabits,
      nextHabit,
    };
  });
}


