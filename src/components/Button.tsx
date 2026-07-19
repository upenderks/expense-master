import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
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
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const variantStyles: Record<string, ViewStyle> = {
    primary: { backgroundColor: theme.colors.primary },
    secondary: {
      backgroundColor: theme.colors.primarySoft,
      shadowOpacity: 0.04,
      elevation: 1,
    },
    danger: { backgroundColor: theme.colors.danger },
    success: { backgroundColor: theme.colors.success },
  };

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={() => {
        lightHaptic();
        onPress();
      }}
      disabled={isDisabled}
      style={[
        styles.button,
        variantStyles[variant],
        { shadowColor: theme.colors.shadow },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? theme.colors.primary : '#fff'}
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === 'secondary' && { color: theme.colors.primaryDark },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  disabled: { opacity: 0.55 },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});