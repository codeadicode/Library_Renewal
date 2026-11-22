import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Avatar, Field, PrimaryButton } from '@/src/components/ui';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { spacing } from '@/src/theme/tokens';

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useStyles();
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    course: user?.course ?? '',
    academicYear: user?.academicYear ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const changed =
    form.name !== user.name ||
    form.email !== user.email ||
    form.course !== user.course ||
    form.academicYear !== user.academicYear;

  async function onSave() {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile(form);
      await queryClient.invalidateQueries();
      Alert.alert('Profile updated', 'Your changes were saved for this session.');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Avatar name={form.name.trim() || user.name} size={80} />
          <AppText variant="caption">Your avatar colour and initials follow your name.</AppText>
        </View>
        <Field label="Student ID" value={user.studentId} onChangeText={() => {}} editable={false} />
        <Field label="Full name" value={form.name} onChangeText={set('name')} autoCapitalize="words" />
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field label="Course / department" value={form.course} onChangeText={set('course')} />
        <Field label="Academic year" value={form.academicYear} onChangeText={set('academicYear')} />
        {error ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}
        <PrimaryButton label={busy ? 'Saving…' : 'Save changes'} onPress={onSave} disabled={busy || !changed} />
        <PrimaryButton label="Cancel" tone="neutral" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
}));
