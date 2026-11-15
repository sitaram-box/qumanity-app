/**
 * A pinch-to-zoom, drag-to-pan frame for a fixed-size drawing (the Whole tree's SVG). Two fingers
 * zoom around the point between them; one or two fingers drag. Gestures run on the UI thread
 * (react-native-gesture-handler + react-native-reanimated, both in Expo Go). The drawing starts
 * fitted to the frame; `fitKey` changing (the screen's "Fit" button) puts it back.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;

const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};

export function ZoomCanvas({ width, height, fitKey, children }: { width: number; height: number; fitKey: number; children: ReactNode }) {
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const fw = useSharedValue(0);
  const fh = useSharedValue(0);

  // Fit the whole drawing in the frame (never enlarged past 1×), centred.
  useEffect(() => {
    if (!frame) return;
    fw.value = frame.w;
    fh.value = frame.h;
    const fit = clamp(Math.min(frame.w / width, frame.h / height, 1), MIN_SCALE, 1);
    scale.value = withTiming(fit);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
  }, [frame, width, height, fitKey, scale, tx, ty, fw, fh]);

  // Keep at least part of the drawing on screen.
  const bound = (t: number, frameSize: number, size: number, s: number) => {
    'worklet';
    const max = (size * s) / 2 + frameSize / 2 - 60;
    return clamp(t, -Math.max(0, max), Math.max(0, max));
  };

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      const next = clamp(scale.value * e.scaleChange, MIN_SCALE, MAX_SCALE);
      const ratio = next / scale.value;
      // Zoom around the fingers: the point under them stays put.
      tx.value = bound(tx.value + (e.focalX - fw.value / 2 - tx.value) * (1 - ratio), fw.value, width, next);
      ty.value = bound(ty.value + (e.focalY - fh.value / 2 - ty.value) * (1 - ratio), fh.value, height, next);
      scale.value = next;
    },
  });
  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      tx.value = bound(tx.value + e.changeX, fw.value, width, scale.value);
      ty.value = bound(ty.value + e.changeY, fh.value, height, scale.value);
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan);

  const moved = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.frame} onLayout={onLayout} collapsable={false}>
        {frame && (
          <Animated.View
            style={[{ position: 'absolute', width, height, left: (frame.w - width) / 2, top: (frame.h - height) / 2 }, moved]}
          >
            {children}
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden' },
});
