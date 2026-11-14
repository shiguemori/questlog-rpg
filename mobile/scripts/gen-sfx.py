"""
Gera os efeitos curtos da batalha que acompanham as poses (assets/sfx/*.wav).

Uso (na pasta mobile/):  python scripts/gen-sfx.py

- windup: o herói ou o monstro toma impulso (zumbido que sobe).
- ko: alguém cai (pancada grave que desce).
- trait: o jeito do monstro agiu ou o chefe mudou de fase (sino duplo, tenso).
- chest: o baú abre no resultado (brilho em arpejo).

Síntese simples com numpy; mono 22050 Hz, 16 bits. Os outros efeitos (hit, crit, heal,
shield, whoosh) já existiam e ficam como estão.
"""

import os
import wave

import numpy as np

RATE = 22050
OUT = "assets/sfx"


def env(n: int, attack: float, release: float) -> np.ndarray:
    a = max(1, int(attack * RATE))
    r = max(1, int(release * RATE))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def sweep(f0: float, f1: float, dur: float, kind: str = "sine") -> np.ndarray:
    n = int(dur * RATE)
    f = np.linspace(f0, f1, n)
    phase = 2 * np.pi * np.cumsum(f) / RATE
    w = np.sin(phase)
    if kind == "saw":
        w = sum(np.sin(phase * k) / k for k in (1, 2, 3, 4))
    return w


def noise(dur: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.uniform(-1, 1, int(dur * RATE))


def windup() -> np.ndarray:
    dur = 0.32
    w = sweep(180, 520, dur, "saw") * 0.35 + noise(dur, 1) * 0.06
    return w * env(len(w), 0.12, 0.05)


def ko() -> np.ndarray:
    dur = 0.55
    body = sweep(150, 45, dur) * 0.8
    thud = noise(0.08, 2) * np.linspace(1, 0, int(0.08 * RATE)) * 0.6
    w = body * env(len(body), 0.005, 0.3)
    w[: len(thud)] += thud
    return w


def trait() -> np.ndarray:
    n = int(0.6 * RATE)
    t = np.arange(n) / RATE
    w = np.zeros(n)
    for start, f in ((0.0, 660), (0.16, 622)):
        s = int(start * RATE)
        seg = t[: n - s]
        tone = (np.sin(2 * np.pi * f * seg) + 0.4 * np.sin(2 * np.pi * f * 2.01 * seg)) * np.exp(
            -seg * 7
        )
        w[s:] += tone * 0.5
    return w * env(n, 0.003, 0.08)


def chest() -> np.ndarray:
    notes = (784, 988, 1175, 1568)
    n = int(0.7 * RATE)
    w = np.zeros(n)
    for i, f in enumerate(notes):
        s = int(i * 0.07 * RATE)
        seg = np.arange(n - s) / RATE
        w[s:] += np.sin(2 * np.pi * f * seg) * np.exp(-seg * 5) * 0.32
    sparkle = noise(0.7, 3)[:n] * np.exp(-np.arange(n) / RATE * 9) * 0.05
    return (w + sparkle) * env(n, 0.003, 0.15)


def write(name: str, samples: np.ndarray) -> None:
    os.makedirs(OUT, exist_ok=True)
    peak = np.max(np.abs(samples)) or 1.0
    pcm = (samples / peak * 0.8 * 32767).astype(np.int16)
    with wave.open(f"{OUT}/{name}.wav", "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(pcm.tobytes())


if __name__ == "__main__":
    for name, make in (("windup", windup), ("ko", ko), ("trait", trait), ("chest", chest)):
        write(name, make())
        print(name, f"{os.path.getsize(f'{OUT}/{name}.wav') / 1024:.0f} KB")
