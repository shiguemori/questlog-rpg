/**
 * Som curto só quando a pessoa ligou e a quest deu XP.
 * Começa desligado. Falha em silêncio (aparelho mudo ou módulo ausente).
 */
export async function playVictorySound(enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    const { createAudioPlayer, setAudioModeAsync } = await import('expo-audio');
    await setAudioModeAsync({ playsInSilentMode: false });
    const player = createAudioPlayer(require('../../assets/victory.wav'));
    player.play();
  } catch {
    // Som é complemento. O XP e a cena já aconteceram.
  }
}
