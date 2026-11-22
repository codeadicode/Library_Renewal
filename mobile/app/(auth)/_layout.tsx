import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { colors } from '@/src/theme/tokens';

export default function AuthLayout() {
  const { user } = useAuth();
  if (user) return <Redirect href="/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        contentStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
    </Stack>
  );
}
