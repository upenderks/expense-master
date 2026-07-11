import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { theme } from '../theme';

interface PhotoPickerProps {
  label?: string;
  photoUri: string | null;
  onTakePhoto: () => void;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  onViewPhoto: () => void;
}

export function PhotoPicker({
  label,
  photoUri,
  onTakePhoto,
  onPickPhoto,
  onRemovePhoto,
  onViewPhoto,
}: PhotoPickerProps) {
  const handleRemove = () => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemovePhoto },
    ]);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {photoUri ? (
        // Photo preview
        <View style={styles.previewContainer}>
          <TouchableOpacity onPress={onViewPhoto} activeOpacity={0.8}>
            <Image source={{ uri: photoUri }} style={styles.preview} />
            <View style={styles.previewOverlay}>
              <Text style={styles.previewOverlayText}>Tap to view</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={onTakePhoto}
            >
              <Text style={styles.changeButtonText}>📷 Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={onPickPhoto}
            >
              <Text style={styles.changeButtonText}>🖼️ Change</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.changeButton, styles.removeButton]}
              onPress={handleRemove}
            >
              <Text style={styles.removeButtonText}>🗑️ Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // No photo - show picker buttons
        <View style={styles.pickerContainer}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>🧾</Text>
          </View>
          <Text style={styles.emptyText}>Add receipt photo</Text>
          <View style={styles.pickerButtons}>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={onTakePhoto}
            >
              <Text style={styles.pickerButtonIcon}>📷</Text>
              <Text style={styles.pickerButtonText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={onPickPhoto}
            >
              <Text style={styles.pickerButtonIcon}>🖼️</Text>
              <Text style={styles.pickerButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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

  // Empty state
  pickerContainer: {
    borderWidth: 1.5,
    borderColor: theme.colors.inputBorder,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyIconText: {
    fontSize: 24,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.muted,
    marginBottom: 14,
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radius.sm,
  },
  pickerButtonIcon: {
    fontSize: 16,
  },
  pickerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Preview state
  previewContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  preview: {
    width: '100%',
    height: 200,
    backgroundColor: '#e2e8f0',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  previewOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  changeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.sm,
  },
  changeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primaryDark,
  },
  removeButton: {
    backgroundColor: theme.colors.dangerSoft,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.danger,
  },
});