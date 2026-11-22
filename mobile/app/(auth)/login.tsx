import { Link } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Avatar, Field, PrimaryButton } from '@/src/components/ui';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { radius, spacing } from '@/src/theme/tokens';

const DEMO_ACCOUNTS = [
  { id: '1RZ25CS003', name: 'Aadya Dhuri', dept: 'CSE' },
  { id: '1RV25CS013', name: 'Akash Tiwari', dept: 'CSE' },
  { id: '1RV25EC045', name: 'Leila Khan', dept: 'ECE' },
  { id: '1RV25EC078', name: 'Dev Nair', dept: 'ECE' },
  { id: '1RV25EC092', name: 'Priya Sharma', dept: 'ECE' },
];

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('1RZ25CS003');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(id: string) {
    setError(null);
    setBusy(true);
    try {
      await login(id, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.logo}>
            <BookOpen size={30} color={colors.hero} />
          </View>
          <Text style={styles.brand}>LibTrack</Text>
          <Text style={styles.tagline}>Track your books, renew on time, and find what's available.</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <AppText variant="heading">Sign in</AppText>
            <Field
              label="Student ID or email"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secure
              autoCapitalize="none"
              placeholder="Any password works in this demo"
            />
            {error ? (
              <AppText variant="caption" style={{ color: colors.danger }}>
                {error}
              </AppText>
            ) : null}
            <PrimaryButton label={busy ? 'Signing in…' : 'Sign in'} onPress={() => signIn(identifier)} disabled={busy} />
          </View>

          <AppText variant="label">QUICK SIGN-IN · DEMO ACCOUNTS</AppText>
          <View style={{ gap: spacing.sm }}>
            {DEMO_ACCOUNTS.map((a) => (
              <Pressable
                key={a.id}
                disabled={busy}
                onPress={() => {
                  setIdentifier(a.id);
                  signIn(a.id);
                }}
                style={({ pressed }) => [styles.account, { opacity: pressed ? 0.8 : 1 }]}>
                <Avatar name={a.name} size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{a.name}</AppText>
                  <AppText variant="caption">
                    {a.id} · {a.dept}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" style={{ color: colors.accent }}>
                  Sign in
                </AppText>
              </Pressable>
            ))}
          </View>

          <Link href="/(auth)/register" style={{ alignSelf: 'center' }}>
            <AppText variant="bodyStrong" style={{ color: colors.accent }}>
              Create a demo account
            </AppText>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  hero: {
    backgroundColor: c.hero,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: 56,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: spacing.sm,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  tagline: { color: 'rgba(255,255,255,0.88)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: -36 },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
  },
}));
