import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { theme } from '../theme';

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
  placeholder = 'Select...',
}: SelectProps) {
  const [visible, setVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.selector}
        onPress={() => setVisible(true)}
      >
        <View style={styles.selectedRow}>
          {selectedOption?.color ? (
            <View
              style={[
                styles.dot,
                { backgroundColor: selectedOption.color },
              ]}
            />
          ) : null}

          <Text
            style={[
              styles.selectorText,
              !selectedOption && styles.placeholder,
            ]}
          >
            {selectedOption?.label || placeholder}
          </Text>
        </View>

        <Text style={styles.arrow}>v</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          style={styles.overlay}
          onPress={() => setVisible(false)}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{label || 'Select'}</Text>

            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === value && styles.selectedOption,
                  ]}
                  onPress={() => {
                    onChange(item.value);
                    setVisible(false);
                  }}
                >
                  {item.color ? (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: item.color },
                      ]}
                    />
                  ) : null}

                  <Text
                    style={[
                      styles.optionText,
                      item.value === value && styles.selectedOptionText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 7,
  },
  selector: {
    backgroundColor: '#fff',
    borderWidth: 1.3,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
  },
  placeholder: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  arrow: {
    fontSize: 16,
    color: theme.colors.muted,
    fontWeight: '900',
    paddingHorizontal: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: 22,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: theme.radius.lg,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    padding: 18,
    color: theme.colors.text,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  option: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  selectedOption: {
    backgroundColor: theme.colors.primarySoft,
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  selectedOptionText: {
    color: theme.colors.primaryDark,
    fontWeight: '900',
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    marginRight: 10,
  },
});