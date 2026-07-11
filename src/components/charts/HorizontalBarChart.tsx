import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface HBarData {
  label: string;
  value: number;
  color: string;
}

interface HorizontalBarChartProps {
  data: HBarData[];
  formatValue?: (value: number) => string;
}

export function HorizontalBarChart({
  data,
  formatValue,
}: HorizontalBarChartProps) {
  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const format = formatValue || ((v: number) => String(v));

  return (
    <View>
      {data.map((item, index) => {
        const width = Math.max(
          4,
          (Math.abs(item.value) / maxValue) * 100
        );
        return (
          <View key={index} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${width}%`,
                    backgroundColor: item.color,
                  },
                ]}
              />
            </View>
            <Text style={[styles.value, { color: item.color }]}>
              {format(Math.abs(item.value))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  label: {
    width: 70,
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  barContainer: {
    flex: 1,
    height: 22,
    backgroundColor: '#f3f4f6',
    borderRadius: 11,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 11,
  },
  value: {
    width: 65,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
});