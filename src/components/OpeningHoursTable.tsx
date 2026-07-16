import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n/I18nContext';
import { weekdayKey } from '@/lib/openingHours';
import { useTheme } from '@/theme/ThemeContext';
import { OpeningHours, WEEKDAYS } from '@/types';

export function OpeningHoursTable({ hours }: { hours: OpeningHours }) {
  const { theme } = useTheme();
  const { t, weekdayLabel } = useI18n();
  const today = weekdayKey(new Date());
  return (
    <View>
      {WEEKDAYS.map((day) => {
        const entry = hours[day];
        const isToday = day === today;
        return (
          <View key={day} style={styles.row}>
            <Text
              style={{
                color: theme.colors.text,
                fontWeight: isToday ? '700' : '400',
                width: 110,
              }}
            >
              {weekdayLabel(day)}
            </Text>
            <Text
              style={{
                color: entry ? theme.colors.text : theme.colors.textSecondary,
                fontWeight: isToday ? '700' : '400',
              }}
            >
              {entry ? `${entry.open} – ${entry.close}` : t('common.closed')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 3 },
});
