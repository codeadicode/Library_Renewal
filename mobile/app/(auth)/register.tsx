import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Field, PrimaryButton } from '@/src/components/ui';
import { colors, spacing } from '@/src/theme/tokens';

export default function RegisterScreen() {
  const { register } = useAuth();
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
    if (Object.values(form).some((v) => !v.trim())) {
      setError('Fill in every field.');
      return;
    }
    if (form.password.length < 8) {
      setError('Use at least 8 characters.');
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
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppText variant="caption">
        Accounts stay on this device session only. Phase 2 will persist them in PostgreSQL with hashed
        passwords.
      </AppText>
      <Field label="Student ID" value={form.studentId} onChangeText={(v) => set('studentId', v)} autoCapitalize="none" />
      <Field label="Name" value={form.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" />
      <Field
        label="Email"
        value={form.email}
        onChangeText={(v) => set('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field label="Password" value={form.password} onChangeText={(v) => set('password', v)} secure autoCapitalize="none" />
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

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
});
