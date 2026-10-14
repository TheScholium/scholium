/**
 * A drawing shown with plain Views: every segment is a thin rotated box.
 * No SVG library is needed, so the plugin stays pure JavaScript.
 */
import React, { memo } from 'react';
import { Text, View } from 'react-native';
import type { Drawing } from '../core/types';
import { flatten } from '../core/preview';

interface Props { drawing: Drawing | null; w: number; h: number; inkLabels: boolean; border?: boolean; }

function PreviewImpl({ drawing, w, h, inkLabels, border = true }: Props) {
  const flat = drawing ? flatten(drawing, { w, h }, { inkLabels }) : null;
  return (
    <View style={{ width: w, height: h, backgroundColor: '#ffffff', borderWidth: border ? 1 : 0, borderColor: '#000000', overflow: 'hidden' }}>
      {flat?.segs.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute', left: s.x - s.len / 2, top: s.y - s.w / 2, width: s.len, height: s.w,
            backgroundColor: s.color, transform: [{ rotate: `${s.angle}rad` }],
          }}
        />
      ))}
      {flat?.texts.map((t, i) => {
        const tw = t.text.length * t.size * 0.62;
        const left = t.anchor.includes('e') ? t.x - tw : t.anchor.includes('w') ? t.x : t.x - tw / 2;
        const top = t.anchor.includes('n') ? t.y - t.size * 0.15 : t.anchor.includes('s') ? t.y - t.size * 1.15 : t.y - t.size * 0.65;
        return (
          <Text key={`t${i}`} style={{ position: 'absolute', left, top, width: tw, fontSize: t.size, color: t.color, textAlign: t.anchor.includes('e') ? 'right' : t.anchor.includes('w') ? 'left' : 'center' }} numberOfLines={1}>
            {t.text}
          </Text>
        );
      })}
    </View>
  );
}

export const Preview = memo(PreviewImpl);
