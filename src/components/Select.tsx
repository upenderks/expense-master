import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { selectionHaptic } from '../lib/haptics';

interface Option {
  value: number | string;
  label: string;
  color?: string;
}

interface SelectProps {
  label?: string;
  value: number | string;
  options: Option[];
  onChange: (value: number | string) => void;
  placeholder?: string;
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
}: SelectProps) {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayPlaceholder = placeholder || t('select');

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.75}
        style={[
          styles.selector,
          {
            backgroundColor: theme.colors.inputBg,
            borderColor: theme.colors.inputBorder,
          },
        ]}
        onPress={() => setVisible(true)}
      >
        <View style={styles.selectedRow}>
          {selectedOption?.color ? (
            <View style={[styles.dot, { backgroundColor: selectedOption.color }]} />
          ) : null}
          <Text style={[
            styles.selectorText,
            { color: theme.colors.text },
            !selectedOption && { color: theme.colors.muted, fontWeight: '500' },
          ]}>
            {selectedOption?.label || displayPlaceholder}
          </Text>
        </View>
        <Text style={[styles.arrow, { color: theme.colors.muted }]}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.modal,
              {
                backgroundColor: theme.colors.modalBg,
                borderColor: isDark ? theme.colors.border : 'transparent',
                borderWidth: isDark ? 1 : 0,
              },
            ]}
            onPress={() => {}}
          >
            <Text style={[
              styles.modalTitle,
              { color: theme.colors.text, borderBottomColor: theme.colors.border },
            ]}>
              {label || t('select')}
            </Text>

            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      {
                        borderBottomColor: isDark ? theme.colors.border : '#f1f5f9',
                        backgroundColor: isSelected
                          ? theme.colors.primarySoft
                          : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      selectionHaptic();
                      onChange(item.value);
                      setVisible(false);
                    }}
                  >
                    {item.color ? (
                      <View style={[styles.dot, { backgroundColor: item.color }]} />
                    ) : null}
                    <Text style={[
                      styles.optionText,
                      { color: theme.colors.text },
                      isSelected && { color: theme.colors.primary, fontWeight: '800' },
                    ]}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Text style={[styles.checkmark, { color: theme.colors.primary }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 7, letterSpacing: 0.3 },
  selector: {
    borderWidth: 1.3,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectorText: { fontSize: 15, fontWeight: '600' },
  arrow: { fontSize: 18, fontWeight: '900', paddingHorizontal: 4 },
  overlay: { flex: 1, justifyContent: 'center', padding: 22 },
  modal: {
    borderRadius: 20,
    maxHeight: '70%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    padding: 18,
    borderBottomWidth: 1,
  },
  option: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  optionText: { fontSize: 16, fontWeight: '600', flex: 1 },
  checkmark: { fontSize: 16, fontWeight: '900' },
  dot: { width: 13, height: 13, borderRadius: 7, marginRight: 10 },
});