/**
 * A math keypad, so equations can be entered without the system keyboard
 * covering half the screen. Fields show a cursor bar; ← and → move it.
 */
import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { C, SERIF } from './kit';

export type KeyAction = { ins: string; back?: number } | { act: 'del' | 'left' | 'right' | 'clear' | 'abc' | 'next' };
type Key = { label: string; k: KeyAction; wide?: number };

const ins = (t: string, back = 0): KeyAction => ({ ins: t, back });

const ROWS: Key[][] = [
  [{ label: 'x', k: ins('x') }, { label: 'y', k: ins('y') }, { label: 't', k: ins('t') }, { label: 'θ', k: ins('θ') }, { label: 'π', k: ins('π') }, { label: 'e', k: ins('e') }, { label: '(', k: ins('(') }, { label: ')', k: ins(')') }],
  [{ label: '7', k: ins('7') }, { label: '8', k: ins('8') }, { label: '9', k: ins('9') }, { label: '÷', k: ins('/') }, { label: 'xⁿ', k: ins('^') }, { label: 'x²', k: ins('^2') }, { label: '√', k: ins('√()', 1) }, { label: '|x|', k: ins('||', 1) }],
  [{ label: '4', k: ins('4') }, { label: '5', k: ins('5') }, { label: '6', k: ins('6') }, { label: '×', k: ins('·') }, { label: 'sin', k: ins('sin()', 1) }, { label: 'cos', k: ins('cos()', 1) }, { label: 'tan', k: ins('tan()', 1) }, { label: 'ln', k: ins('ln()', 1) }],
  [{ label: '1', k: ins('1') }, { label: '2', k: ins('2') }, { label: '3', k: ins('3') }, { label: '−', k: ins('-') }, { label: '=', k: ins(' = ') }, { label: ',', k: ins(', ') }, { label: "y'", k: ins("y' = ") }, { label: 'eˣ', k: ins('e^()', 1) }],
  [{ label: '0', k: ins('0') }, { label: '.', k: ins('.') }, { label: '+', k: ins('+') }, { label: '←', k: { act: 'left' } }, { label: '→', k: { act: 'right' } }, { label: 'abc', k: { act: 'abc' } }, { label: '⌫', k: { act: 'del' } }, { label: 'clear', k: { act: 'clear' } }],
];

export function Keypad({ onKey, width }: { onKey: (k: KeyAction) => void; width: number }) {
  const kw = Math.floor((width - 7 * 6) / 8);
  return (
    <View style={{ width }}>
      {ROWS.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 6 }}>
          {row.map((key, j) => (
            <Pressable key={j} onPress={() => onKey(key.k)} style={[st.key, { width: kw, marginRight: j < row.length - 1 ? 6 : 0 }, 'act' in key.k && st.keyAct]}>
              <Text style={[st.keyText, key.label.length > 2 && { fontSize: 18 }]}>{key.label}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Apply a key to a string with a cursor. */
export function applyKey(text: string, cursor: number, k: KeyAction): { text: string; cursor: number } {
  const c = Math.max(0, Math.min(text.length, cursor));
  if ('ins' in k) {
    let t = k.ins;
    // " = " typed into an empty field, or next to a space, should not double the spaces
    if (t.startsWith(' ') && (c === 0 || text[c - 1] === ' ')) t = t.trimStart();
    return { text: text.slice(0, c) + t + text.slice(c), cursor: c + t.length - (k.back ?? 0) };
  }
  switch (k.act) {
    case 'del': {
      if (c === 0) return { text, cursor: c };
      // delete a whole function name with its bracket: "sin(" in one go
      const m = /(?:sin|cos|tan|ln|log|sqrt|√|e\^)\($/.exec(text.slice(0, c));
      const n = m && text[c] === ')' ? m[0].length : 0;
      if (n) return { text: text.slice(0, c - n) + text.slice(c + 1), cursor: c - n };
      return { text: text.slice(0, c - 1) + text.slice(c), cursor: c - 1 };
    }
    case 'left': return { text, cursor: Math.max(0, c - 1) };
    case 'right': return { text, cursor: Math.min(text.length, c + 1) };
    case 'clear': return { text: '', cursor: 0 };
    default: return { text, cursor: c };
  }
}

/** A tappable field that shows its cursor when focused. */
export function MathField({ value, focused, cursor, onFocus, placeholder, error, style, small }: {
  value: string; focused: boolean; cursor: number; onFocus: () => void; placeholder?: string; error?: boolean; style?: object; small?: boolean;
}) {
  const c = Math.min(cursor, value.length);
  return (
    <Pressable onPress={onFocus} style={[st.field, focused && st.fieldFocus, error && st.fieldError, style]}>
      <Text style={[st.fieldText, small && { fontSize: 20 }, !value && { color: C.light }]} numberOfLines={1}>
        {value ? (focused ? <>{value.slice(0, c)}<Text style={st.cursor}>│</Text>{value.slice(c)}</> : value) : (focused ? <Text style={st.cursor}>│</Text> : placeholder ?? '')}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  key: { height: 54, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  keyAct: { borderStyle: 'dashed' },
  keyText: { fontSize: 22, color: C.ink, fontFamily: SERIF },
  field: { borderBottomWidth: 1.5, borderColor: C.light, paddingVertical: 8, paddingHorizontal: 6, minHeight: 48, justifyContent: 'center' },
  fieldFocus: { borderBottomWidth: 3, borderColor: C.ink },
  fieldError: { borderStyle: 'dashed', borderBottomWidth: 3, borderColor: C.ink },
  fieldText: { fontSize: 24, color: C.ink, fontFamily: SERIF },
  cursor: { fontWeight: '300', color: C.ink },
});
