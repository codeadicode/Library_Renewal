import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Badge, Card, Chip, DemoBanner, Field, PrimaryButton } from '@/src/components/ui';
import { AssessmentType } from '@/src/domain/types';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { spacing } from '@/src/theme/tokens';

const TYPES: AssessmentType[] = ['EXAM', 'ASSIGNMENT', 'PROJECT', 'INTERNAL', 'OTHER'];

export default function NeedsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useStyles();
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppText variant="caption">
        Optional. When renewal is blocked, suggested alternatives prefer the topics you list here.
      </AppText>
      {(list.data ?? []).map((need) => (
        <Card key={need.id} style={{ gap: 6 }}>
          <AppText variant="bodyStrong">{need.topic}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Badge label={need.assessmentType} fg={colors.pink} bg={colors.pinkMuted} />
            <Badge label={need.assessmentDate} fg={colors.info} bg={colors.infoMuted} />
          </View>
          <AppText variant="caption">{need.course}</AppText>
          <Pressable onPress={() => remove.mutate(need.id)} hitSlop={8}>
            <AppText variant="bodyStrong" style={{ color: colors.danger }}>
              Remove
            </AppText>
          </Pressable>
        </Card>
      ))}
      <AppText variant="heading">Add a need</AppText>
      <Field label="Course / subject" value={form.course} onChangeText={(v) => setForm({ ...form, course: v })} />
      <Field label="Required topic" value={form.topic} onChangeText={(v) => setForm({ ...form, topic: v })} />
      <AppText variant="label">ASSESSMENT TYPE</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {TYPES.map((t) => (
          <Chip key={t} label={t} selected={form.assessmentType === t} onPress={() => setForm({ ...form, assessmentType: t })} />
        ))}
      </View>
      <Field
        label="Assessment date (YYYY-MM-DD)"
        value={form.assessmentDate}
        onChangeText={(v) => setForm({ ...form, assessmentDate: v })}
        autoCapitalize="none"
      />
      <Field
        label="Needed until (YYYY-MM-DD)"
        value={form.neededUntil}
        onChangeText={(v) => setForm({ ...form, neededUntil: v })}
        autoCapitalize="none"
      />
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
      <DemoBanner />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
}));
