import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface EmptyStateProps {
  emoji: string;
  title: string;
  subtitle?: string;
  actionHint?: string;
  onAction?: () => void;
}

export function EmptyState({
  emoji,
  title,
  subtitle,
  actionHint,
  onAction,
}: EmptyStateProps) {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[
        styles.emojiCircle,
        { backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
      ]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {subtitle}
        </Text>
      )}
      {actionHint && (
        onAction ? (
          <TouchableOpacity
            onPress={onAction}
            activeOpacity={0.7}
            style={[
              styles.hintBadge,
              styles.hintBadgeTappable,
              { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' },
            ]}
          >
            <Text style={[styles.hintText, { color: theme.colors.primary }]}>
              {actionHint}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[
            styles.hintBadge,
            { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' },
          ]}>
            <Text style={[styles.hintText, { color: theme.colors.primary }]}>
              {actionHint}
            </Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emojiCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  hintBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintBadgeTappable: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '600',
  },
});