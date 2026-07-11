import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  data,
  size = 200,
  strokeWidth = 28,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <View style={[styles.emptyContainer, { width: size, height: size }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulatedOffset = 0;

  return (
    <View style={styles.container}>
      {/* Chart */}
      <View style={{ width: size, height: size, position: 'relative' }}>
        {/* Background circle */}
        <View
          style={[
            styles.backgroundCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
            },
          ]}
        />

        {/* Segments using border trick */}
        {filtered.map((segment, index) => {
          const percentage = segment.value / total;
          const segmentAngle = percentage * 360;
          const rotation = accumulatedOffset;
          accumulatedOffset += segmentAngle;

          return (
            <View
              key={index}
              style={[
                styles.segmentContainer,
                {
                  width: size,
                  height: size,
                  transform: [{ rotate: `${rotation}deg` }],
                },
              ]}
            >
              <View
                style={[
                  styles.segment,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: 'transparent',
                    borderTopColor: segment.color,
                    borderRightColor:
                      segmentAngle > 90 ? segment.color : 'transparent',
                    borderBottomColor:
                      segmentAngle > 180 ? segment.color : 'transparent',
                    borderLeftColor:
                      segmentAngle > 270 ? segment.color : 'transparent',
                  },
                ]}
              />
            </View>
          );
        })}

        {/* Center text */}
        <View style={[styles.centerContent, { width: size, height: size }]}>
          {centerLabel && (
            <Text style={styles.centerLabel}>{centerLabel}</Text>
          )}
          {centerValue && (
            <Text
              style={styles.centerValue}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {centerValue}
            </Text>
          )}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {filtered.map((segment, index) => {
          const pct = ((segment.value / total) * 100).toFixed(1);
          return (
            <View key={index} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: segment.color }]}
              />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {segment.label}
              </Text>
              <Text style={styles.legendPct}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  backgroundCircle: {
    position: 'absolute',
    borderColor: '#f3f4f6',
  },
  segmentContainer: {
    position: 'absolute',
  },
  segment: {
    position: 'absolute',
  },
  centerContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  centerLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  centerValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: '#374151',
    maxWidth: 80,
  },
  legendPct: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
  },
});