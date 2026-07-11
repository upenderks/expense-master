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
