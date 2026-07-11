import React from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';

interface PhotoViewerProps {
  visible: boolean;
  photoUri: string;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export function PhotoViewer({ visible, photoUri, onClose }: PhotoViewerProps) {
  if (!photoUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />

        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Photo */}
        <Image
          source={{ uri: photoUri }}
          style={styles.image}
          resizeMode="contain"
        />

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <Text style={styles.bottomText}>📷 Receipt Photo</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  image: {
    width: width - 32,
    height: height * 0.7,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  doneText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
});