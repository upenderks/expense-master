import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../src/context/ThemeContext';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = 'onboarding_done';

const slides = [
  {
    emoji: '📓',
    title: 'Welcome to DigiDiary',
    subtitle: 'Your complete digital diary for managing money, expenses, assets and daily life',
    color: '#2563eb',
  },
  {
    emoji: '💰',
    title: 'Track Money & Expenses',
    subtitle: 'Record every rupee. Track borrowers, manage expenses by category, and generate PDF reports',
    color: '#059669',
  },
  {
    emoji: '⏱️',
    title: 'Asset Time Tracking',
    subtitle: 'Track time for assets. Bill customers automatically based on hourly rates',
    color: '#8b5cf6',
  },
  {
    emoji: '📒',
    title: 'Organize Your Life',
    subtitle: 'Track attendance, gas refills, set reminders for birthdays and bills. Build healthy habits',
    color: '#d97706',
  },
  {
    emoji: '🚀',
    title: 'All Set!',
    subtitle: 'Your digital diary is ready. Everything works offline. Your data stays on your phone',
    color: '#dc2626',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [currentSlide, setCurrentSlide] = useState(0);

  const isLastSlide = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];

  const handleNext = async () => {
    if (isLastSlide) {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
      router.replace('/login');
    } else {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handleSkip = async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    router.replace('/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Skip button */}
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={[styles.skipBtnText, { color: theme.colors.muted }]}>
            Skip
          </Text>
        </TouchableOpacity>
      )}

      {/* Slide content */}
      <View style={styles.slideContainer}>
        <View style={[styles.emojiCircle, { backgroundColor: slide.color + '15' }]}>
          <Text style={styles.emojiText}>{slide.emoji}</Text>
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          {slide.title}
        </Text>

        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          {slide.subtitle}
        </Text>
      </View>

      {/* Dots indicator */}
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentSlide
                  ? slide.color
                  : isDark ? '#475569' : '#d1d5db',
                width: index === currentSlide ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        {currentSlide > 0 && (
          <TouchableOpacity
            style={[styles.backBtn, { borderColor: theme.colors.border }]}
            onPress={() => setCurrentSlide(currentSlide - 1)}
          >
            <Text style={[styles.backBtnText, { color: theme.colors.text }]}>
              ← Back
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextBtn,
            { backgroundColor: slide.color },
            currentSlide === 0 && { flex: 1 },
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextBtnText}>
            {isLastSlide ? 'Get Started 🚀' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  skipBtnText: { fontSize: 16, fontWeight: '600' },

  slideContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40,
  },
  emojiCircle: {
    width: 140, height: 140, borderRadius: 70,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
  },
  emojiText: { fontSize: 64 },
  title: {
    fontSize: 28, fontWeight: '800', textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16, textAlign: 'center', lineHeight: 24,
  },

  dotsContainer: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 8, marginBottom: 30,
  },
  dot: { height: 8, borderRadius: 4 },

  buttonsContainer: {
    flexDirection: 'row', paddingHorizontal: 20,
    paddingBottom: 30, gap: 12,
  },
  backBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    borderWidth: 1.5, alignItems: 'center',
  },
  backBtnText: { fontSize: 16, fontWeight: '700' },
  nextBtn: {
    flex: 2, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});