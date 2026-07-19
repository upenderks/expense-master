import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, onFocus, onBlur, ...props }: InputProps) {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[
          styles.label,
          { color: isFocused ? theme.colors.primary : theme.colors.textSecondary },
        ]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.muted}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.inputBg,
            borderColor: error
              ? theme.colors.danger
              : isFocused
              ? theme.colors.primary
              : theme.colors.inputBorder,
            color: theme.colors.text,
            borderWidth: isFocused ? 2 : 1.3,
          },
          isFocused && {
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 2,
          },
          style,
        ]}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {error ? (
        <Text style={[styles.error, { color: theme.colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    letterSpacing: 0.3,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  error: {
    fontSize: 12,
    marginTop: 5,
    fontWeight: '600',
  },
});