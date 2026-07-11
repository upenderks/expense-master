# Money Tracker App UI Polish Patch
# Copy this file into your Expo app root and run:
# powershell -ExecutionPolicy Bypass -File .\apply-ui-polish.ps1

Write-Host "Applying UI polish..." -ForegroundColor Cyan

if (!(Test-Path "src\components")) {
  Write-Host "ERROR: src\components folder not found. Run this script from your Expo app root." -ForegroundColor Red
  exit 1
}

@'
export const theme = {
  colors: {
    background: '#f3f6fb',
    surface: '#ffffff',
    surfaceSoft: '#f8fafc',
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    primarySoft: '#dbeafe',
    success: '#059669',
    successSoft: '#d1fae5',
    danger: '#dc2626',
    dangerSoft: '#fee2e2',
    warning: '#d97706',
    warningSoft: '#ffedd5',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    inputBorder: '#cbd5e1',
    shadow: '#0f172a'
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24
  }
};
'@ | Out-File -FilePath "src\theme.ts" -Encoding UTF8

@'
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'success' && styles.success,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? theme.colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.text, variant === 'secondary' && styles.secondaryText]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.primarySoft, shadowOpacity: 0.04, elevation: 1 },
  danger: { backgroundColor: theme.colors.danger },
  success: { backgroundColor: theme.colors.success },
  disabled: { opacity: 0.55 },
  text: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  secondaryText: { color: theme.colors.primaryDark },
});
'@ | Out-File -FilePath "src\components\Button.tsx" -Encoding UTF8

@'
import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
});
'@ | Out-File -FilePath "src\components\Card.tsx" -Encoding UTF8

@'
import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { theme } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#94a3b8"
        style={[styles.input, error && styles.inputError, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: theme.spacing.lg },
  label: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 7 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.3,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: theme.colors.text,
  },
  inputError: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, fontSize: 12, marginTop: 5, fontWeight: '600' },
});
'@ | Out-File -FilePath "src\components\Input.tsx" -Encoding UTF8

@'
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface Option { value: number | string; label: string; color?: string }
interface SelectProps {
  label?: string;
  value: number | string;
  options: Option[];
  onChange: (value: number | string) => void;
  placeholder?: string;
}

export function Select({ label, value, options, onChange, placeholder = 'Select...' }: SelectProps) {
  const [visible, setVisible] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity activeOpacity={0.75} style={styles.selector} onPress={() => setVisible(true)}>
        <View style={styles.selectedRow}>
          {selectedOption?.color ? <View style={[styles.dot, { backgroundColor: selectedOption.color }]} /> : null}
          <Text style={[styles.selectorText, !selectedOption && styles.placeholder]}>{selectedOption?.label || placeholder}</Text>
        </View>
        <Text style={styles.arrow}>⌄</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{label || 'Select'}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.option, item.value === value && styles.selectedOption]} onPress={() => { onChange(item.value); setVisible(false); }}>
                  {item.color ? <View style={[styles.dot, { backgroundColor: item.color }]} /> : null}
                  <Text style={[styles.optionText, item.value === value && styles.selectedOptionText]}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: theme.spacing.lg },
  label: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 7 },
  selector: { backgroundColor: '#fff', borderWidth: 1.3, borderColor: theme.colors.inputBorder, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectedRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectorText: { fontSize: 15, color: theme.colors.text, fontWeight: '600' },
  placeholder: { color: '#94a3b8', fontWeight: '500' },
  arrow: { fontSize: 18, color: theme.colors.muted, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 22 },
  modal: { backgroundColor: '#fff', borderRadius: theme.radius.lg, maxHeight: '70%', overflow: 'hidden' },
  modalTitle: { fontSize: 18, fontWeight: '900', padding: 18, color: theme.colors.text, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  option: { padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  selectedOption: { backgroundColor: theme.colors.primarySoft },
  optionText: { fontSize: 16, color: theme.colors.text, fontWeight: '600' },
  selectedOptionText: { color: theme.colors.primaryDark, fontWeight: '900' },
  dot: { width: 13, height: 13, borderRadius: 7, marginRight: 10 },
});
'@ | Out-File -FilePath "src\components\Select.tsx" -Encoding UTF8

@'
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const [yyyy, mm, dd] = value.split('-').map(Number);
  return new Date(yyyy, mm - 1, dd);
}

export default function DatePicker({ label, value, onChange, placeholder = 'YYYY-MM-DD' }: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) onChange(formatDate(selectedDate));
  };
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#94a3b8" autoCapitalize="none" />
        <TouchableOpacity activeOpacity={0.8} style={styles.calendarButton} onPress={() => setShowPicker(true)}><Text style={styles.calendarButtonText}>📅</Text></TouchableOpacity>
      </View>
      <Text style={styles.helper}>Format: YYYY-MM-DD</Text>
      {showPicker ? <DateTimePicker value={parseDate(value)} mode="date" display="default" onChange={handleDateChange} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: theme.spacing.lg },
  label: { fontSize: 13, color: '#334155', fontWeight: '800', marginBottom: 7 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#fff', borderWidth: 1.3, borderColor: theme.colors.inputBorder, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.colors.text },
  calendarButton: { width: 50, height: 50, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 3 },
  calendarButtonText: { fontSize: 20, color: '#fff' },
  helper: { marginTop: 5, fontSize: 11, color: '#94a3b8' },
});
'@ | Out-File -FilePath "src\components\DatePicker.tsx" -Encoding UTF8

@'
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DatePicker from './DatePicker';
import { theme } from '../theme';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  onClear?: () => void;
  title?: string;
}

export default function DateRangeFilter({ startDate, endDate, onChange, onClear, title = 'Date Filter' }: DateRangeFilterProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <DatePicker label="From Date" value={startDate} onChange={(value) => onChange(value, endDate)} />
      <DatePicker label="To Date" value={endDate} onChange={(value) => onChange(startDate, value)} />
      <Text style={styles.helper}>Example: 2026-07-01 to 2026-07-31</Text>
      {onClear ? <TouchableOpacity activeOpacity={0.8} style={styles.clearButton} onPress={onClear}><Text style={styles.clearButtonText}>Clear Filter</Text></TouchableOpacity> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 },
  title: { fontSize: 17, fontWeight: '900', color: theme.colors.text, marginBottom: 12 },
  helper: { marginTop: -4, fontSize: 11, color: '#94a3b8' },
  clearButton: { marginTop: 12, backgroundColor: '#e2e8f0', borderRadius: theme.radius.md, paddingVertical: 11, alignItems: 'center' },
  clearButtonText: { color: '#334155', fontWeight: '900' },
});
'@ | Out-File -FilePath "src\components\DateRangeFilter.tsx" -Encoding UTF8

Write-Host "UI polish applied successfully." -ForegroundColor Green
Write-Host "Run: npx expo start --clear" -ForegroundColor Cyan
