import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  barColor?: string;
  height?: number;
  formatValue?: (value: number) => string;
  title?: string;
}

export function BarChart({
  data,
  barColor = '#3b82f6',
  height = 180,
  formatValue,
  title,
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const format = formatValue || ((v: number) => String(v));

  return (
    <View>
      {title && <Text style={styles.title}>{title}</Text>}

      {/* Y-axis labels */}
      <View style={styles.chartContainer}>
        <View style={[styles.yAxis, { height }]}>
          <Text style={styles.yLabel}>{format(maxValue)}</Text>
          <Text style={styles.yLabel}>{format(maxValue / 2)}</Text>
          <Text style={styles.yLabel}>0</Text>
        </View>

        {/* Bars */}
        <View style={[styles.barsContainer, { height }]}>
          {/* Grid lines */}
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: '50%' }]} />
          <View style={[styles.gridLine, { bottom: 0 }]} />

          {data.map((item, index) => {
            const barHeight = Math.max(
              4,
              (item.value / maxValue) * (height - 20)
            );
            const color = item.color || barColor;

            return (
              <View key={index} style={styles.barWrapper}>
                {/* Value label */}
                <Text style={styles.barValue} numberOfLines={1}>
                  {item.value > 0 ? format(item.value) : ''}
                </Text>

                {/* Bar */}
                <View style={styles.barOuter}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: color,
                      },
                    ]}
                  />
                </View>

                {/* X-axis label */}
                <Text style={styles.barLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
  },
  yAxis: {
    width: 50,
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingRight: 6,
  },
  yLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'right',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 20,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barOuter: {
    width: '70%',
    maxWidth: 44,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minWidth: 16,
  },
  barValue: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  barLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },
});