import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * `Animated.Value` estável entre renders. O `useAnimatedValue` do React Native não
 * existe no react-native-web; este funciona nos dois.
 */
export function useAnimatedValue(initial: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
