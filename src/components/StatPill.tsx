import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatPillProps {
  emoji: string;
  label: string;
  value: string;
}

export function StatPill({ emoji, label, value }: StatPillProps) {
  return (
    <View style={styles.pill}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emoji: { fontSize: 18 },
  value: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
  },
});