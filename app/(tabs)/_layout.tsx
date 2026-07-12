import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useAppSettings, FEATURE_KEYS } from '../../src/context/AppSettingsContext';

export default function TabLayout() {
  const { theme } = useTheme();
  const { isEnabled } = useAppSettings();

  const moneyEnabled = isEnabled(FEATURE_KEYS.MODULE_MONEY);
  const expenseEnabled = isEnabled(FEATURE_KEYS.MODULE_EXPENSE);

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
          title: 'Dashboard',
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>💰</Text>,
          href: moneyEnabled ? '/(tabs)/money' : null,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>💸</Text>,
          href: expenseEnabled ? '/(tabs)/expenses' : null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}