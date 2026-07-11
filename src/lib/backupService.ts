import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';
import { getDatabase, resetDatabaseInstance } from './database';

const DB_NAME = 'expense_tracker.db';
const DB_PATH = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

export async function exportBackup(): Promise<boolean> {
  try {
    const db = await getDatabase();
    await db.execAsync('PRAGMA wal_checkpoint(FULL);');

    const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
    if (!fileInfo.exists) {
      Alert.alert(
        'Backup Failed',
        'Database file not found. Please add some data first and try again.'
      );
      return false;
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);

    const backupFileName = `expense-master-backup-${timestamp}.db`;
    const backupPath = `${FileSystem.cacheDirectory}${backupFileName}`;

    await FileSystem.copyAsync({
      from: DB_PATH,
      to: backupPath,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert(
        'Not Supported',
        'File sharing is not available on this device.'
      );
      return false;
    }

    await Sharing.shareAsync(backupPath, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Save Expense Master Backup',
      UTI: 'public.database',
    });

    return true;
  } catch (error) {
    console.error('Backup error:', error);
    Alert.alert('Backup Failed', String(error));
    return false;
  }
}

export async function importBackup(): Promise<boolean> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: '*/*',
    });

    if (result.canceled) return false;

    const pickedFile = result.assets[0];

    if (!pickedFile.name.toLowerCase().endsWith('.db')) {
      Alert.alert(
        'Invalid File',
        'Please select a valid backup file ending in .db'
      );
      return false;
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        '⚠️ Restore Backup',
        `This will REPLACE all your current data.\n\nFile: ${pickedFile.name}\n\nThis action cannot be undone. Are you sure?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Yes, Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                // Step 1: Get current DB and close it
                const db = await getDatabase();
                try {
                  await db.closeAsync();
                } catch (closeErr) {
                  console.warn('Close error (safe to ignore):', closeErr);
                }

                // Step 2: Reset singleton immediately
                resetDatabaseInstance();

                // Step 3: Small delay to ensure native side releases the file
                await new Promise((r) => setTimeout(r, 300));

                // Step 4: Remove old DB files
                const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
                const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(sqliteDir, {
                    intermediates: true,
                  });
                }

                await FileSystem.deleteAsync(DB_PATH, { idempotent: true });
                await FileSystem.deleteAsync(`${DB_PATH}-wal`, {
                  idempotent: true,
                });
                await FileSystem.deleteAsync(`${DB_PATH}-shm`, {
                  idempotent: true,
                });

                // Step 5: Copy backup file
                await FileSystem.copyAsync({
                  from: pickedFile.uri,
                  to: DB_PATH,
                });

                // Step 6: Reset singleton again to force fresh open
                resetDatabaseInstance();

                Alert.alert(
                  '✅ Restore Successful',
                  'Your data has been restored.\n\nPlease close and restart the app to see your restored data.',
                  [{ text: 'OK', onPress: () => resolve(true) }]
                );
              } catch (restoreError) {
                console.error('Restore error:', restoreError);
                Alert.alert('Restore Failed', String(restoreError));
                resolve(false);
              }
            },
          },
        ],
        { cancelable: false }
      );
    });
  } catch (error) {
    console.error('Import error:', error);
    Alert.alert('Import Failed', String(error));
    return false;
  }
}