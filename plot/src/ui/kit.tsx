/**
 * Small e-ink widgets: black on white, square corners, big targets,
 * no animation, no gray fills that smear on refresh.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

export const C = { ink: '#000000', paper: '#ffffff', mid: '#555555', light: '#a0a0a0' };
export const SERIF = 'serif';

export function Chip({ label, on, onPress, wide, disabled }: { label: string; on?: boolean; onPress: () => void; wide?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={[s.chip, on && s.chipOn, wide && { flexGrow: 1 }, disabled && { borderColor: C.light }]}>
      <Text style={[s.chipText, on && s.chipTextOn, disabled && { color: C.light }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** One-of-many chips. */
export function Choice<T extends string>({ value, options, onChange, disabled }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <View style={s.row}>
      {options.map((o) => <Chip key={o.v} label={o.label} on={o.v === value} onPress={() => onChange(o.v)} disabled={disabled} />)}
    </View>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return <Chip label={(on ? '■ ' : '□ ') + label} on={false} onPress={() => onChange(!on)} />;
}

export function Row({ label, children, style }: { label?: string; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[s.optRow, style]}>
      {label ? <Text style={s.optLabel}>{label}</Text> : null}
      <View style={[s.row, { flex: 1 }]}>{children}</View>
    </View>
  );
}

export function Button({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={[s.btn, primary && s.btnPrimary, disabled && { borderColor: C.light, backgroundColor: C.paper }]}>
      <Text style={[s.btnText, primary && s.btnTextPrimary, disabled && { color: C.light }]}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  chip: { borderWidth: 1.5, borderColor: C.ink, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8, minHeight: 44, justifyContent: 'center', backgroundColor: C.paper },
  chipOn: { backgroundColor: C.ink },
  chipText: { fontSize: 17, color: C.ink, textAlign: 'center' },
  chipTextOn: { color: C.paper },
  optRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 },
  optLabel: { width: 110, fontSize: 16, color: C.mid, paddingTop: 12, fontStyle: 'italic', fontFamily: SERIF },
  btn: { borderWidth: 2, borderColor: C.ink, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', minHeight: 56, backgroundColor: C.paper },
  btnPrimary: { backgroundColor: C.ink },
  btnText: { fontSize: 20, color: C.ink, fontWeight: '600' },
  btnTextPrimary: { color: C.paper },
});
