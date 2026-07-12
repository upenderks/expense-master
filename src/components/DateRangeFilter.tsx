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
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  onClear?: () => void;
  title?: string;
  autoSetDefaults?: boolean;
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDefault30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return getDateString(d);
}

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
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

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

  const handleDone = () => setShowPicker(null);

  const hasFilter = startDate || endDate;

  const getPickerDate = (): Date => {
    if (showPicker === 'start' && startDate) return new Date(startDate);
    if (showPicker === 'end' && endDate) return new Date(endDate);
    return new Date();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        {title && (
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {title}
          </Text>
        )}
        {hasFilter && onClear && (
          <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
            <Text style={[styles.clearText, { color: theme.colors.danger }]}>
              ✕ {t('clear_filter')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date Buttons Row */}
      <View style={styles.dateRow}>
        {/* From Button */}
        <TouchableOpacity
          style={[
            styles.dateButton,
            {
              backgroundColor: startDate
                ? isDark
                  ? theme.colors.primarySoft
                  : theme.colors.primarySoft
                : isDark
                ? '#1e293b'
                : '#f8fafc',
              borderColor: startDate
                ? theme.colors.primary
                : theme.colors.inputBorder,
            },
          ]}
          onPress={() => setShowPicker('start')}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateLabel, { color: theme.colors.muted }]}>
            {t('from')}
          </Text>
          <Text style={[
            styles.dateValue,
            { color: startDate ? theme.colors.primary : theme.colors.muted },
          ]}>
            {formatDisplay(startDate)}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.dateSeparator, { color: theme.colors.muted }]}>
          →
        </Text>

        {/* To Button */}
        <TouchableOpacity
          style={[
            styles.dateButton,
            {
              backgroundColor: endDate
                ? isDark
                  ? theme.colors.primarySoft
                  : theme.colors.primarySoft
                : isDark
                ? '#1e293b'
                : '#f8fafc',
              borderColor: endDate
                ? theme.colors.primary
                : theme.colors.inputBorder,
            },
          ]}
          onPress={() => setShowPicker('end')}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateLabel, { color: theme.colors.muted }]}>
            {t('to')}
          </Text>
          <Text style={[
            styles.dateValue,
            { color: endDate ? theme.colors.primary : theme.colors.muted },
          ]}>
            {formatDisplay(endDate)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Android Picker */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={getPickerDate()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {/* iOS Picker Modal */}
      {showPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <TouchableOpacity
            style={[
              styles.modalOverlay,
              { backgroundColor: theme.colors.overlay },
            ]}
            activeOpacity={1}
            onPress={handleDone}
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: theme.colors.modalBg,
                  borderColor: theme.colors.border,
                  borderWidth: isDark ? 1 : 0,
                },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {showPicker === 'start' ? t('from_date') : t('to_date')}
                </Text>
                <TouchableOpacity
                  onPress={handleDone}
                  style={[
                    styles.doneButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text style={styles.doneButtonText}>{t('done')}</Text>
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
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
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
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateSeparator: {
    fontSize: 14,
    fontWeight: '700',
  },

  // iOS Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});