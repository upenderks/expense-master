import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

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
  const { theme, isDark } = useTheme();
  const format = formatValue || ((v: number) => String(v));

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
          No data
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <View>
      {data.map((item, index) => {
        const width = Math.max(4, (Math.abs(item.value) / maxValue) * 100);

        return (
          <View key={index} style={styles.row}>
            {/* Label */}
            <Text
              style={[styles.label, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.label}
            </Text>

            {/* Bar Track */}
            <View
              style={[
                styles.barContainer,
                {
                  backgroundColor: isDark ? '#334155' : '#f3f4f6',
                },
              ]}
            >
              {/* Bar Fill */}
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

            {/* Value */}
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
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  label: {
    width: 70,
    fontSize: 12,
    fontWeight: '500',
  },
  barContainer: {
    flex: 1,
    height: 22,
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