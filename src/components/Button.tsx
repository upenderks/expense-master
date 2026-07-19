import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { lightHaptic } from '../lib/haptics';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  icon,
  size = 'md',
}: ButtonProps) {
  const { theme, isDark } = useTheme();
  const isDisabled = disabled || loading;

  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.3,
    },
    secondary: {
      backgroundColor: theme.colors.primarySoft,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.05,
      elevation: 1,
    },
    danger: {
      backgroundColor: theme.colors.danger,
      shadowColor: theme.colors.danger,
      shadowOpacity: 0.3,
    },
    success: {
      backgroundColor: theme.colors.success,
      shadowColor: theme.colors.success,
      shadowOpacity: 0.3,
    },
  };

  const sizeStyles: Record<string, ViewStyle> = {
    sm: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 14 },
    md: { minHeight: 52, paddingVertical: 14, paddingHorizontal: 20 },
    lg: { minHeight: 58, paddingVertical: 16, paddingHorizontal: 24 },
  };

  const textSizes: Record<string, number> = {
    sm: 13,
    md: 15,
    lg: 17,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => {
        lightHaptic();
        onPress();
      }}
      disabled={isDisabled}
      style={[
        styles.button,
        sizeStyles[size],
        variantStyles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? theme.colors.primary : '#fff'}
        />
      ) : (
        <View style={styles.content}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text
            style={[
              styles.text,
              { fontSize: textSizes[size] },
              variant === 'secondary' && { color: theme.colors.primaryDark },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  disabled: { opacity: 0.5 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: { fontSize: 18 },
  text: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});