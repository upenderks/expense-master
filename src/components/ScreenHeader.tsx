import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  rightContent?: ReactNode;
  children?: ReactNode;
}

const STATUS_BAR_HEIGHT = Platform.OS === 'android'
  ? StatusBar.currentHeight || 24
  : 44;

export function ScreenHeader({
  title,
  subtitle,
  emoji,
  rightContent,
  children,
}: ScreenHeaderProps) {
  const { theme, isDark } = useTheme();

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isDark
          ? theme.colors.headerGradient1
          : theme.colors.primary,
        paddingTop: STATUS_BAR_HEIGHT + 8,
      },
    ]}>
      {/* Gradient overlay effect */}
      <View style={[
        styles.gradientOverlay,
        {
          backgroundColor: isDark
            ? theme.colors.headerGradient2
            : theme.colors.gradient2,
        },
      ]} />

      {/* Main content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleSection}>
            {emoji && (
              <Text style={styles.emoji}>{emoji}</Text>
            )}
            <View>
              <Text style={styles.title}>{title}</Text>
              {subtitle && (
                <Text style={styles.subtitle}>{subtitle}</Text>
              )}
            </View>
          </View>
          {rightContent && (
            <View style={styles.rightContent}>
              {rightContent}
            </View>
          )}
        </View>

        {/* Extra content (stats, quick actions etc.) */}
        {children && (
          <View style={styles.extraContent}>
            {children}
          </View>
        )}
      </View>

      {/* Bottom curve */}
      <View style={[
        styles.curve,
        { backgroundColor: theme.colors.background },
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '60%',
    height: '100%',
    opacity: 0.5,
    borderBottomLeftRadius: 100,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    zIndex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  emoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  extraContent: {
    marginTop: 16,
  },
  curve: {
    height: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -1,
  },
});