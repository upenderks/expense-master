import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
}

function formatDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(value: string) {
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
  placeholder = 'YYYY-MM-DD',
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (selectedDate) {
      onChange(formatDate(selectedDate));
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
        />

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.calendarButton}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="calendar-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.helper}>Format: YYYY-MM-DD</Text>

      {showPicker ? (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 13,
    color: '#334155',
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
    backgroundColor: '#fff',
    borderWidth: 1.3,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: theme.colors.text,
  },
  calendarButton: {
    width: 56,
    height: 50,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  helper: {
    marginTop: 5,
    fontSize: 11,
    color: '#94a3b8',
  },
});