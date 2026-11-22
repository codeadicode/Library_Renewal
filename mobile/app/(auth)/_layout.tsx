import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';

export default function AuthLayout() {
  const { user } = useAuth();
  const { colors } = useTheme();
  if (user) return <Redirect href="/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        contentStyle: { backgroundColor: colors.background },
        headerTintColor: colors.accent,
      }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
    </Stack>
  );
}
