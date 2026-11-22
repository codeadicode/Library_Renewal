import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { api } from '@/src/api';
import { now } from '@/src/config';
import { formatDate } from '@/src/domain/loanDisplay';
import { addDays, formatISO } from 'date-fns';
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
    assessmentDate: formatISO(addDays(now(), 7), { representation: 'date' }),
    neededUntil: formatISO(addDays(now(), 7), { representation: 'date' }),
  });
  const list = useQuery({
    queryKey: ['needs', user?.id],
    queryFn: () => api.listNeeds(user!.id),
    enabled: Boolean(user),
  });
  const add = useMutation({
    mutationFn: () => api.addNeed(user!.id, form),
    onSuccess: async () => {
      setForm((prev) => ({ ...prev, topic: '' }));
      // Needs change eligibility context, action priorities and alternative ranking.
      await queryClient.invalidateQueries();
    },
    onError: (e: Error) => Alert.alert('Could not save', e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteNeed(user!.id, id),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (!user) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppText variant="caption">
        Tell LibTrack what you are studying for. A book you need until after its due date is flagged early on
        your dashboard, renewal advice says whether one renewal covers the date, and alternatives favour these
        topics (more strongly as the assessment gets closer). Needs stop counting after their needed-until date.
      </AppText>
      {(list.data ?? []).map((need) => (
        <Card key={need.id} style={{ gap: 6 }}>
          <AppText variant="bodyStrong">{need.topic}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Badge label={need.assessmentType} fg={colors.pink} bg={colors.pinkMuted} />
            <Badge label={'Assessment ' + formatDate(need.assessmentDate)} fg={colors.info} bg={colors.infoMuted} />
            <Badge label={'Needed until ' + formatDate(need.neededUntil)} fg={colors.accent} bg={colors.accentMuted} />
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
