import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/auth/AuthContext';
import { AppText, DemoBanner, Field, PrimaryButton } from '@/src/components/ui';
import { colors, spacing } from '@/src/theme/tokens';

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('1RV25CS013');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(identifier, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label">LIBTRACK</AppText>
            <AppText variant="title">Sign in</AppText>
            <AppText variant="caption">
              Student borrowing, renewal checks, and alternative resources. This prototype uses simulated
              campus data.
            </AppText>
          </View>
          <DemoBanner />
          <Field label="Student ID or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
          <Field label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" />
          {error ? (
            <AppText variant="caption" style={{ color: colors.danger }}>
              {error}
            </AppText>
          ) : null}
          <PrimaryButton label={busy ? 'Signing in…' : 'Sign in'} onPress={onSubmit} disabled={busy} />
          <AppText variant="caption">
            Demo accounts: 1RV25CS013 (Akash Dhuri - CSE), 1RZ25CS003 (Aadya Tiwari - CSE), 1RV25EC045 (Leila - ECE), 1RV25EC078 (Dev - ECE), 1RV25EC092 (Priya - ECE) / password demo1234.
          </AppText>
          <Link href="/(auth)/register">
            <AppText variant="bodyStrong" style={{ color: colors.accent }}>
              Create a demo account
            </AppText>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
