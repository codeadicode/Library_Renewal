import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, DemoBanner, Field, PrimaryButton } from '@/src/components/ui';
import { AssessmentType } from '@/src/domain/types';
import { colors, radius, spacing } from '@/src/theme/tokens';

export default function NeedsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    course: '',
    topic: '',
    assessmentType: 'INTERNAL' as AssessmentType,
    assessmentDate: '2026-11-28',
    neededUntil: '2026-11-28',
  });
  const list = useQuery({
    queryKey: ['needs', user?.id],
    queryFn: () => mockApi.listNeeds(user!.id),
    enabled: Boolean(user),
  });
  const add = useMutation({
    mutationFn: () => mockApi.addNeed(user!.id, form),
    onSuccess: async () => {
      setForm((prev) => ({ ...prev, topic: '' }));
      await queryClient.invalidateQueries({ queryKey: ['needs', user?.id] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => mockApi.deleteNeed(user!.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['needs', user?.id] }),
  });

  if (!user) return null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DemoBanner />
      <AppText variant="caption">
        Optional. When renewal is blocked, alternatives prefer topics you list here. This is not required to
        use LibTrack.
      </AppText>
      {(list.data ?? []).map((need) => (
        <View key={need.id} style={styles.card}>
          <AppText variant="bodyStrong">{need.topic}</AppText>
          <AppText variant="caption">
            {need.course} · {need.assessmentType} · {need.assessmentDate}
          </AppText>
          <Pressable onPress={() => remove.mutate(need.id)}>
            <AppText variant="caption" style={{ color: colors.danger }}>
              Remove
            </AppText>
          </Pressable>
        </View>
      ))}
      <AppText variant="heading">Add a need</AppText>
      <Field label="Course / subject" value={form.course} onChangeText={(v) => setForm({ ...form, course: v })} />
      <Field label="Required topic" value={form.topic} onChangeText={(v) => setForm({ ...form, topic: v })} />
      <Field
        label="Assessment type (EXAM, ASSIGNMENT, PROJECT, INTERNAL, OTHER)"
        value={form.assessmentType}
        onChangeText={(v) => setForm({ ...form, assessmentType: v.toUpperCase() as AssessmentType })}
        autoCapitalize="none"
      />
      <Field label="Assessment date (YYYY-MM-DD)" value={form.assessmentDate} onChangeText={(v) => setForm({ ...form, assessmentDate: v })} autoCapitalize="none" />
      <Field label="Needed until" value={form.neededUntil} onChangeText={(v) => setForm({ ...form, neededUntil: v })} autoCapitalize="none" />
      <PrimaryButton
        label="Save need"
        onPress={() => {
          if (!form.course.trim() || !form.topic.trim()) {
            Alert.alert('Missing fields', 'Course and topic are required.');
            return;
          }
          add.mutate();
        }}
        disabled={add.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
});
