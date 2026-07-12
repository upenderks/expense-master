import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(value: string): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date();
  }
  const [yyyy, mm, dd] = value.split('-').map(Number);
  return new Date(yyyy, mm - 1, dd);
}

export default function DatePicker({
  label,
  value,
  onChange,
  placeholder,
}: DatePickerProps) {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const [showPicker, setShowPicker] = useState(false);

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      onChange(formatDate(selectedDate));
    }
  };

  const handleDone = () => {
    setShowPicker(false);
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      {label ? (
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}

      {/* Input Row */}
      <View style={styles.row}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.inputBg,
              borderColor: theme.colors.inputBorder,
              color: theme.colors.text,
            },
          ]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || t('format_date')}
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="none"
        />

        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.calendarButton,
            {
              backgroundColor: theme.colors.primary,
              shadowColor: theme.colors.shadow,
            },
          ]}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="calendar-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Format helper */}
      <Text style={[styles.helper, { color: theme.colors.muted }]}>
        {t('format_date')}
      </Text>

      {/* Android - direct picker */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {/* iOS - picker inside modal */}
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
              {/* Modal Header */}
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {label || t('date')}
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

              {/* iOS Date Picker */}
              <DateTimePicker
                value={parseDate(value)}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                style={[
                  styles.iosPicker,
                  isDark && styles.iosPickerDark,
                ]}
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
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1.3,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  calendarButton: {
    width: 56,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  helper: {
    marginTop: 5,
    fontSize: 11,
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
    fontSize: 17,
    fontWeight: '700',
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
  iosPicker: {
    height: 200,
  },
  iosPickerDark: {
    backgroundColor: 'transparent',
  },
});