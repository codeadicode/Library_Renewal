import { Link, Stack } from 'expo-router';

import { AppText, Screen } from '@/src/components/ui';
import { useTheme } from '@/src/theme/ThemeContext';
import { spacing } from '@/src/theme/tokens';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <AppText variant="heading">This screen does not exist.</AppText>
        <Link href="/">
          <AppText variant="bodyStrong" style={{ color: colors.accent }}>
            Back to LibTrack
          </AppText>
        </Link>
      </Screen>
    </>
  );
}
