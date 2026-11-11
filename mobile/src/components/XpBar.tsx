import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme/colors';

export interface XpBarProps {
  xp: number;
  maxXp: number;
  level: number;
}

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Barra de XP — state indication (occasional).
 * Fill via translateX (GPU, clipped). Glow em opacity. Reduced motion: snap.
 */
export function XpBar({ xp, maxXp, level }: XpBarProps) {
  const ratio = maxXp > 0 ? Math.min(1, Math.max(0, xp / maxXp)) : 0;
  const progress = useRef(new Animated.Value(ratio)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const [displayXp, setDisplayXp] = useState(xp);
  const prevXp = useRef(xp);

  useEffect(() => {
    let cancelled = false;
    const gained = xp > prevXp.current;
    prevXp.current = xp;

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      setDisplayXp(xp);

      if (reduce) {
        progress.setValue(ratio);
        glow.setValue(0);
        return;
      }

      Animated.timing(progress, {
        toValue: ratio,
        duration: 240,
        easing: EASE_OUT,
        useNativeDriver: true,
      }).start();

      if (gained) {
        glow.setValue(0);
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 140,
            easing: EASE_OUT,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 220,
            easing: EASE_OUT,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [xp, maxXp, ratio, progress, glow]);

  const slide =
    trackWidth > 0
      ? progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-trackWidth, 0],
        })
      : 0;

  return (
    <View style={styles.wrap} accessibilityRole="progressbar">
      <View style={styles.metaRow}>
        <Text style={styles.level}>Nv. {level}</Text>
        <Text style={styles.values}>
          {displayXp}/{maxXp} XP
        </Text>
      </View>
      <View
        style={styles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        {trackWidth > 0 ? (
          <>
            <Animated.View
              style={[
                styles.fill,
                { width: trackWidth, transform: [{ translateX: slide }] },
              ]}
            />
            <Animated.View
              style={[
                styles.glow,
                {
                  width: trackWidth,
                  opacity: glow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.55],
                  }),
                  transform: [{ translateX: slide }],
                },
              ]}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  level: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.amberSoft,
  },
  values: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.amber,
  },
  glow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.amberSoft,
  },
});
