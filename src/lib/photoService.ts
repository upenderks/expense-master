import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

const PHOTOS_DIR = `${FileSystem.documentDirectory}expense-photos/`;

// Ensure photos directory exists
async function ensurePhotosDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

// Pick from camera
export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Needed',
      'Camera permission is required to take receipt photos.'
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: [3, 4],
  });

  if (result.canceled) return null;

  return await savePhoto(result.assets[0].uri);
}

// Pick from gallery
export async function pickPhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Needed',
      'Gallery permission is required to select receipt photos.'
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: [3, 4],
  });

  if (result.canceled) return null;

  return await savePhoto(result.assets[0].uri);
}

// Save photo to app's document directory
async function savePhoto(tempUri: string): Promise<string> {
  await ensurePhotosDir();

  const fileName = `receipt_${Date.now()}.jpg`;
  const destUri = `${PHOTOS_DIR}${fileName}`;

  await FileSystem.copyAsync({
    from: tempUri,
    to: destUri,
  });

  return destUri;
}

// Delete photo from storage
export async function deletePhoto(photoUri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(photoUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(photoUri, { idempotent: true });
    }
  } catch (error) {
    console.error('Delete photo error:', error);
  }
}

// Check if photo exists
export async function photoExists(photoUri: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(photoUri);
    return fileInfo.exists;
  } catch {
    return false;
  }
}