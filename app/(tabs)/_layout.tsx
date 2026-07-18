import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useAppSettings, FEATURE_KEYS } from '../../src/context/AppSettingsContext';
import { useLanguage } from '../../src/context/LanguageContext';

export default function TabLayout() {
  const { theme } = useTheme();

  let moneyEnabled = true;
  let expenseEnabled = true;
  let trackerEnabled = true;
  let organizerEnabled = true;
  
  try {
    const { isEnabled } = useAppSettings();
    moneyEnabled = isEnabled(FEATURE_KEYS.MODULE_MONEY);
    expenseEnabled = isEnabled(FEATURE_KEYS.MODULE_EXPENSE);
    trackerEnabled = isEnabled(FEATURE_KEYS.MODULE_TRACKER);
    organizerEnabled = isEnabled(FEATURE_KEYS.MODULE_ORGANIZER);
  } catch {}

  let tabDashboard = 'Dashboard';
  let tabMoney = 'Money';
  let tabExpenses = 'Expenses';
  let tabTracker = 'Tracker';
  let tabOrganizer = 'Organizer';
  let tabMore = 'More';
  try {
    const { t } = useLanguage();
    tabDashboard = t('tab_dashboard');
    tabMoney = t('tab_money');
    tabExpenses = t('tab_expenses');
    tabTracker = t('tab_tracker');
    tabOrganizer = t('tab_organizer');
    tabMore = t('tab_more');
  } catch {}

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { fontWeight: '600', color: theme.colors.text },
        tabBarStyle: {
          paddingBottom: 5,
          height: 60,
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.tabBarBorder,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: tabDashboard,
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: tabMoney,
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>💰</Text>,
          href: moneyEnabled ? '/(tabs)/money' : null,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: tabExpenses,
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>💸</Text>,
          href: expenseEnabled ? '/(tabs)/expenses' : null,
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: tabTracker,
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>⏱️</Text>,
          href: trackerEnabled ? '/(tabs)/tracker' : null,
        }}
      />
      <Tabs.Screen
        name="organizer"
        options={{
          title: tabOrganizer,
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>📒</Text>,
          href: organizerEnabled ? '/(tabs)/organizer' : null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: tabMore,
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}