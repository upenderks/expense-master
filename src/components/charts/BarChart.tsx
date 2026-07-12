import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

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

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Fixed chart area height (excludes x-axis label area)
  const chartAreaHeight = height;
  // Space reserved at bottom for x-axis labels
  const xLabelHeight = 24;
  // Space reserved at top for bar value labels
  const topPadding = 20;
  // Actual drawable bar area
  const barAreaHeight = chartAreaHeight - xLabelHeight - topPadding;

  return (
    <View>
      {/* Title */}
      {title && (
        <Text style={[styles.title, { color: theme.colors.muted }]}>
          {title}
        </Text>
      )}

      <View style={styles.chartContainer}>
        {/* Y Axis Labels */}
        <View style={[styles.yAxis, { height: chartAreaHeight }]}>
          {/* Top label - aligns with top of bar area */}
          <View style={{ height: topPadding, justifyContent: 'flex-end' }}>
            <Text style={[styles.yLabel, { color: theme.colors.muted }]}>
              {format(maxValue)}
            </Text>
          </View>

          {/* Middle label - aligns with middle grid line */}
          <View style={{ flex: 1, justifyContent: 'center', paddingBottom: xLabelHeight / 2 }}>
            <Text style={[styles.yLabel, { color: theme.colors.muted }]}>
              {format(maxValue / 2)}
            </Text>
          </View>

          {/* Bottom label - aligns with bottom of bar area */}
          <View style={{ height: xLabelHeight, justifyContent: 'flex-start' }}>
            <Text style={[styles.yLabel, { color: theme.colors.muted }]}>
              0
            </Text>
          </View>
        </View>

        {/* Bars Area */}
        <View style={[styles.barsArea, { height: chartAreaHeight }]}>
          {/* Grid lines container - only covers bar drawing area */}
          <View style={[styles.gridContainer, { height: barAreaHeight, marginTop: topPadding }]}>
            {/* Top grid line */}
            <View
              style={[
                styles.gridLine,
                { top: 0, backgroundColor: isDark ? '#334155' : '#f3f4f6' },
              ]}
            />
            {/* Middle grid line */}
            <View
              style={[
                styles.gridLine,
                { top: '50%', backgroundColor: isDark ? '#334155' : '#f3f4f6' },
              ]}
            />
            {/* Bottom grid line */}
            <View
              style={[
                styles.gridLine,
                { bottom: 0, backgroundColor: isDark ? '#334155' : '#f3f4f6' },
              ]}
            />
          </View>

          {/* Bars Row */}
          <View
            style={[
              styles.barsRow,
              {
                height: barAreaHeight,
                marginTop: topPadding,
                marginBottom: xLabelHeight,
              },
            ]}
          >
            {data.map((item, index) => {
              const barHeight = Math.max(
                2,
                (item.value / maxValue) * barAreaHeight
              );
              const color = item.color || barColor;

              return (
                <View key={index} style={styles.barWrapper}>
                  {/* Value label above bar */}
                  <View style={styles.barValueContainer}>
                    <Text
                      style={[styles.barValue, { color: theme.colors.muted }]}
                      numberOfLines={1}
                    >
                      {item.value > 0 ? format(item.value) : ''}
                    </Text>
                  </View>

                  {/* Bar fill */}
                  <View style={styles.barOuter}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor: color,
                          opacity:
                            isDark && color === '#e5e7eb' ? 0.3 : 1,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {/* X Axis Labels Row */}
          <View style={[styles.xLabelsRow, { height: xLabelHeight }]}>
            {data.map((item, index) => (
              <View key={index} style={styles.xLabelWrapper}>
                <Text
                  style={[styles.barLabel, { color: theme.colors.muted }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
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
    fontSize: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },

  // Main layout
  chartContainer: {
    flexDirection: 'row',
  },

  // Y Axis
  yAxis: {
    width: 48,
    paddingRight: 6,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  yLabel: {
    fontSize: 10,
    textAlign: 'right',
  },

  // Bars area (right side)
  barsArea: {
    flex: 1,
    flexDirection: 'column',
  },

  // Grid lines container
  gridContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },

  // Bars row
  barsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barValueContainer: {
    position: 'absolute',
    top: -18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  barValue: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  barOuter: {
    width: '65%',
    maxWidth: 40,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    minWidth: 14,
  },

  // X axis labels
  xLabelsRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  xLabelWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
});