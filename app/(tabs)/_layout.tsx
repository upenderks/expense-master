import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useAppSettings, FEATURE_KEYS } from '../../src/context/AppSettingsContext';
import { useLanguage } from '../../src/context/LanguageContext';

export default function TabLayout() {
  const { theme, isDark } = useTheme();

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

  const renderTabIcon = (emoji: string, focused: boolean) => (
    <View style={{
      width: 42,
      height: 42,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: focused
        ? isDark ? theme.colors.primarySoft : theme.colors.accentGlow
        : 'transparent',
    }}>
      <Text style={{
        fontSize: focused ? 24 : 22,
      }}>
        {emoji}
      </Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        headerStyle: {
          backgroundColor: theme.colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTitleStyle: {
          fontWeight: '700',
          color: theme.colors.text,
          fontSize: 18,
        },
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.tabBarBorder,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: tabDashboard,
          tabBarIcon: ({ focused }) => renderTabIcon('📊', focused),
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: tabMoney,
          tabBarIcon: ({ focused }) => renderTabIcon('💰', focused),
          href: moneyEnabled ? '/(tabs)/money' : null,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: tabExpenses,
          tabBarIcon: ({ focused }) => renderTabIcon('💸', focused),
          href: expenseEnabled ? '/(tabs)/expenses' : null,
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: tabTracker,
          tabBarIcon: ({ focused }) => renderTabIcon('⏱️', focused),
          href: trackerEnabled ? '/(tabs)/tracker' : null,
        }}
      />
      <Tabs.Screen
        name="organizer"
        options={{
          title: tabOrganizer,
          tabBarIcon: ({ focused }) => renderTabIcon('📒', focused),
          href: organizerEnabled ? '/(tabs)/organizer' : null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: tabMore,
          tabBarIcon: ({ focused }) => renderTabIcon('⚙️', focused),
        }}
      />
    </Tabs>
  );
}