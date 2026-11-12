import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * Feedback de toque na thread de UI (Reanimated 4).
 * O overlay de vitória continua com o fade que já existia.
 */
export function PressScale({
  children,
  style,
  containerStyle,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; containerStyle?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animated, containerStyle]}>
      <Pressable
        {...rest}
        style={style}
        onPressIn={(event) => {
          // Reanimated: o shared value é mutável de propósito.
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withTiming(0.97, { duration: 90 });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withTiming(1, { duration: 140 });
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
