import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/theme/ThemeContext';
import { OpeningHours } from '@/types';

import { closingSoon, openStatus } from './openingHours';

export type OpenState = 'open' | 'soon' | 'closed' | 'unknown';

/** Öffnungsstatus als Text + Farbe, inkl. „Schließt in 20 Min.". */
export function useOpenState(hours: OpeningHours | null | undefined) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const status = openStatus(hours ?? {});
  const left = status === 'open' ? closingSoon(hours ?? {}) : null;
  const state: OpenState = left != null ? 'soon' : status;
  const label =
    state === 'soon'
      ? t('common.closingSoon', { n: left ?? 0 })
      : state === 'open'
        ? t('common.open')
        : state === 'closed'
          ? t('common.closed')
          : t('common.hoursUnknown');
  const color =
    state === 'soon'
      ? theme.colors.warning
      : state === 'open'
        ? theme.colors.success
        : state === 'closed'
          ? theme.colors.danger
          : theme.colors.textSecondary;
  return { state, label, color };
}
