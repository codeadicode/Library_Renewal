import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { AuthProvider } from '@/src/auth/AuthContext';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book/[id]" options={{ title: 'My loan' }} />
        <Stack.Screen name="catalogue/[id]" options={{ title: 'Book details' }} />
        <Stack.Screen name="alternatives/[bookId]" options={{ title: 'Alternatives' }} />
        <Stack.Screen name="decision/[loanId]" options={{ title: 'Still need this?' }} />
        <Stack.Screen name="needs" options={{ title: 'Academic needs' }} />
        <Stack.Screen name="fines" options={{ title: 'Fines (demo)' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
      </Stack>
    </>
  );
}
