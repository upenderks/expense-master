import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  glowing?: boolean;
}

export function Card({ children, style, elevated, glowing }: CardProps) {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated
            ? theme.colors.surfaceElevated
            : theme.colors.surface,
          borderColor: theme.colors.cardBorder,
          shadowColor: theme.colors.shadow,
        },
        glowing && {
          borderColor: theme.colors.primaryLight,
          borderWidth: 1.5,
          shadowColor: theme.colors.primary,
          shadowOpacity: isDark ? 0.3 : 0.15,
          shadowRadius: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
});