/**
 * Curva que passa um pouco do ponto e volta (ease-out-back).
 * Feita à mão porque o `Easing.back` do Reanimated não existe no mock dos testes.
 */
export function overshoot(amount = 1.6) {
  return (t: number): number => {
    'worklet';
    const c = amount + 1;
    const x = t - 1;
    return 1 + c * x * x * x + amount * x * x;
  };
}
