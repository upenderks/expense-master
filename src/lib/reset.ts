import * as SQLite from 'expo-sqlite';

export async function resetDatabase() {
  const db = await SQLite.openDatabaseAsync('tracker.db');
  await db.execAsync(`
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS money_transactions;
    DROP TABLE IF EXISTS expense_categories;
    DROP TABLE IF EXISTS borrowers;
    DROP TABLE IF EXISTS users;
  `);
  await db.closeAsync();
  console.log('✅ Database reset!');
}