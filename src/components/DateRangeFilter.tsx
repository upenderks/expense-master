import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../theme';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  onClear?: () => void;
  title?: string;
  autoSetDefaults?: boolean;
}

// Helper: get date string in YYYY-MM-DD format
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper: get date 30 days ago
function getDefault30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return getDateString(d);
}

// Helper: get today's date
function getToday(): string {
  return getDateString(new Date());
}

export default function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  onClear,
  title,
  autoSetDefaults = true,
}: DateRangeFilterProps) {
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  // Set default 30-day range if both are empty
  useEffect(() => {
    if (autoSetDefaults && !startDate && !endDate) {
      onChange(getDefault30DaysAgo(), getToday());
    }
  }, []);

  const formatDisplay = (date: string): string => {
    if (!date) return '-- / -- / ----';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(null);
    }

    if (!selectedDate) return;

    const formatted = getDateString(selectedDate);

    if (showPicker === 'start') {
      onChange(formatted, endDate);
    } else if (showPicker === 'end') {
      onChange(startDate, formatted);
    }
  };

  const handleDone = () => {
    setShowPicker(null);
  };

  const hasFilter = startDate || endDate;

  const getPickerDate = (): Date => {
    if (showPicker === 'start' && startDate) return new Date(startDate);
    if (showPicker === 'end' && endDate) return new Date(endDate);
    return new Date();
  };

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        {title && <Text style={styles.title}>{title}</Text>}
        {hasFilter && onClear && (
          <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
            <Text style={styles.clearText}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date buttons row */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={[
            styles.dateButton,
            startDate && styles.dateButtonActive,
          ]}
          onPress={() => setShowPicker('start')}
          activeOpacity={0.7}
        >
          <Text style={styles.dateLabel}>From</Text>
          <Text
            style={[
              styles.dateValue,
              startDate && styles.dateValueActive,
            ]}
          >
            {formatDisplay(startDate)}
          </Text>
        </TouchableOpacity>

        <Text style={styles.dateSeparator}>→</Text>

        <TouchableOpacity
          style={[
            styles.dateButton,
            endDate && styles.dateButtonActive,
          ]}
          onPress={() => setShowPicker('end')}
          activeOpacity={0.7}
        >
          <Text style={styles.dateLabel}>To</Text>
          <Text
            style={[
              styles.dateValue,
              endDate && styles.dateValueActive,
            ]}
          >
            {formatDisplay(endDate)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Android DatePicker */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={getPickerDate()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {/* iOS DatePicker Modal */}
      {showPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleDone}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {showPicker === 'start' ? 'From Date' : 'To Date'}
                </Text>
                <TouchableOpacity onPress={handleDone}>
                  <Text style={styles.modalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={getPickerDate()}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                style={{ height: 180 }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.danger,
  },

  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dateButtonActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.muted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  dateValueActive: {
    color: theme.colors.primaryDark,
  },
  dateSeparator: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '700',
  },

  // iOS Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modalDone: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});