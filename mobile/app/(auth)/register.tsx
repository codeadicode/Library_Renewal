import { useState } from 'react';
import { ScrollView } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Field, PrimaryButton } from '@/src/components/ui';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { spacing } from '@/src/theme/tokens';

export default function RegisterScreen() {
  const { register } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const [form, setForm] = useState({
    studentId: '',
    name: '',
    email: '',
    password: '',
    course: '',
    academicYear: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit() {
    const { password: _password, ...required } = form;
    if (Object.values(required).some((v) => !v.trim())) {
      setError('Fill in every field (password is optional).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppText variant="caption">Demo accounts only last for this app session.</AppText>
      <Field label="Student ID" value={form.studentId} onChangeText={(v) => set('studentId', v)} autoCapitalize="none" />
      <Field label="Name" value={form.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" />
      <Field
        label="Email"
        value={form.email}
        onChangeText={(v) => set('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Password (optional)"
        value={form.password}
        onChangeText={(v) => set('password', v)}
        secure
        autoCapitalize="none"
        placeholder="Not checked in this demo"
      />
      <Field label="Course / department" value={form.course} onChangeText={(v) => set('course', v)} />
      <Field label="Academic year" value={form.academicYear} onChangeText={(v) => set('academicYear', v)} />
      {error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <PrimaryButton label={busy ? 'Creating…' : 'Create account'} onPress={onSubmit} disabled={busy} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md },
}));
