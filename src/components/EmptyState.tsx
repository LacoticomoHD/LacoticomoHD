import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { tapLight } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeContext';

interface Action {
  label: string;
  icon?: IconName;
  onPress: () => void;
}

interface Props {
  icon: IconName;
  text: string;
  /** Bis zu zwei Knöpfe, damit man aus der Sackgasse direkt weiterkommt. */
  actions?: Action[];
  compact?: boolean;
}

/** Leerer Zustand mit Symbol, Erklärung und passender Aktion. */
export function EmptyState({ icon, text, actions = [], compact }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.wrap, compact ? styles.compact : null]}>
      <View style={[styles.iconCircle, { backgroundColor: c.surfaceVariant, borderColor: c.border }]}>
        <Icon name={icon} size={26} color={c.primary} />
      </View>
      <Text style={[styles.text, { color: c.textSecondary }]}>{text}</Text>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              onPressIn={tapLight}
              onPress={a.onPress}
              style={({ pressed }) => [
                styles.button,
                i === 0
                  ? { backgroundColor: c.primary, borderColor: c.primary }
                  : { backgroundColor: c.surface, borderColor: c.border },
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {a.icon ? <Icon name={a.icon} size={16} color={i === 0 ? c.onPrimary : c.text} /> : null}
              <Text style={{ color: i === 0 ? c.onPrimary : c.text, fontSize: 14, fontWeight: '700' }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 16 },
  button: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  compact: { marginTop: 16 },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    marginBottom: 14,
    width: 60,
  },
  text: { fontSize: 14.5, lineHeight: 21, maxWidth: 320, textAlign: 'center' },
  wrap: { alignItems: 'center', marginTop: 40, paddingHorizontal: 24 },
});
