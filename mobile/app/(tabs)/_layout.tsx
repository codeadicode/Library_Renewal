import { Redirect, Tabs } from 'expo-router';
import { BookOpen, Compass, Home, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/src/auth/AuthContext';
import { colors } from '@/src/theme/tokens';

export default function TabLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  if (!user) return <Redirect href="/(auth)/login" />;

  // Ensure bottom bar accommodates Android 3-button software navigation & gesture bars
  const bottomInset = Math.max(insets.bottom, 12);
  const tabHeight = 54 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: '600', color: colors.text },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: 'My Books',
          tabBarIcon: ({ color }) => <BookOpen color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <Compass color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
