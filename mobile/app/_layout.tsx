import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { AuthProvider } from '@/src/auth/AuthContext';
import { colors } from '@/src/theme/tokens';

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
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.background },
            headerTitleStyle: { fontWeight: '600', color: colors.text },
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="book/[id]" options={{ title: 'Book' }} />
          <Stack.Screen name="catalogue/[id]" options={{ title: 'Catalogue' }} />
          <Stack.Screen name="alternatives/[bookId]" options={{ title: 'Alternatives' }} />
          <Stack.Screen name="decision/[loanId]" options={{ title: 'Still need this?' }} />
          <Stack.Screen name="needs" options={{ title: 'Academic needs' }} />
          <Stack.Screen name="fines" options={{ title: 'Fines (demo)' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
