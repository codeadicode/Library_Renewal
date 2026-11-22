import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Chip, DemoBanner, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { NotificationPreference } from '@/src/domain/types';
import { colors, radius, spacing } from '@/src/theme/tokens';

const PREFS: { id: NotificationPreference; label: string; hint: string }[] = [
  { id: 'DIGEST', label: 'Daily digest', hint: 'One summary a day' },
  { id: 'IMPORTANT', label: 'Important only', hint: 'Urgent and overdue' },
  { id: 'NORMAL', label: 'Normal', hint: 'Due windows and renewals' },
  { id: 'QUIET', label: 'Quiet mode', hint: 'No reminder spam' },
];

export default function ProfileScreen() {
  const { user, logout, refresh } = useAuth();
  const router = useRouter();
  const finesQuery = useQuery({
    queryKey: ['fines', user?.id],
    queryFn: () => mockApi.listFines(user!.id),
    enabled: Boolean(user),
  });
  const needsQuery = useQuery({
    queryKey: ['needs', user?.id],
    queryFn: () => mockApi.listNeeds(user!.id),
    enabled: Boolean(user),
  });

  if (!user) return null;
  const currentFine = (finesQuery.data ?? []).reduce((sum, f) => sum + f.amount, 0);

  async function setPref(id: NotificationPreference) {
    await mockApi.updatePreferences(user!.id, id);
    await refresh();
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View>
        <AppText variant="title">{user.name}</AppText>
        <AppText variant="caption">{user.studentId} · {user.email}</AppText>
        <AppText variant="caption">{user.course} · {user.academicYear}</AppText>
      </View>
      <DemoBanner />
      {user.restricted ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          This demo account is marked restricted. Renewals will fail with ACCOUNT_RESTRICTED.
        </AppText>
      ) : null}

      <SectionTitle>Notification preference</SectionTitle>
      <AppText variant="caption">
        Preferences are stored in this session only. Local notifications are not scheduled in Phase 1.
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {PREFS.map((p) => (
          <Chip key={p.id} label={p.label} selected={user.notificationPreference === p.id} onPress={() => setPref(p.id)} />
        ))}
      </View>
      <AppText variant="caption">
        {PREFS.find((p) => p.id === user.notificationPreference)?.hint}
      </AppText>

      <Pressable onPress={() => router.push('/fines')} style={styles.row}>
        <View>
          <AppText variant="bodyStrong">Simulated fines</AppText>
          <AppText variant="caption">Current demo balance ₹{currentFine}</AppText>
        </View>
        <AppText variant="caption">View</AppText>
      </Pressable>

      <Pressable onPress={() => router.push('/needs')} style={styles.row}>
        <View>
          <AppText variant="bodyStrong">Academic needs planner</AppText>
          <AppText variant="caption">{needsQuery.data?.length ?? 0} optional topic{needsQuery.data?.length === 1 ? '' : 's'}</AppText>
        </View>
        <AppText variant="caption">Edit</AppText>
      </Pressable>

      <PrimaryButton label="Sign out" tone="neutral" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
