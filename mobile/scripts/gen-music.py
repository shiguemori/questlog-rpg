"""
Gera as trilhas em loop das arenas (assets/music/*.mp3) com síntese simples (numpy + ffmpeg).

Uso (na pasta mobile/):  python scripts/gen-music.py

Cada arena tem clima próprio: tom, andamento e instrumentos. O loop fecha em compassos
inteiros, então emenda sem clique. Precisa de numpy e do ffmpeg no PATH.
"""

import os
import subprocess
import tempfile
import wave

import numpy as np

RATE = 22050
OUT = "assets/music"

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
        "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def midi(name: str, octave: int) -> int:
    return 12 * (octave + 1) + NOTE[name]


def freq(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


CHORD = {"maj": (0, 4, 7), "min": (0, 3, 7), "maj7": (0, 4, 7, 11), "min7": (0, 3, 7, 10),
         "dom7": (0, 4, 7, 10), "sus2": (0, 2, 7)}


def env(n: int, attack: float, release: float) -> np.ndarray:
    a = max(1, int(attack * RATE))
    r = max(1, int(release * RATE))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    if r < n:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def tone(f: float, dur: float, kind: str = "sine", attack=0.01, release=0.1, decay=None):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    if kind == "sine":
        w = np.sin(2 * np.pi * f * t)
    elif kind == "tri":
        w = 2 * np.abs(2 * ((f * t) % 1) - 1) - 1
    elif kind == "square":
        # Quadrada suavizada (poucos harmônicos): som de chip, sem aspereza.
        w = sum(np.sin(2 * np.pi * f * k * t) / k for k in (1, 3, 5, 7))
        w *= 0.8
    elif kind == "pluck":
        w = sum(np.sin(2 * np.pi * f * k * t) * (0.6 ** (k - 1)) for k in (1, 2, 3, 4))
        w *= 0.6
    else:
        raise ValueError(kind)
    e = env(n, attack, release)
    if decay:
        e *= np.exp(-t / decay)
    return w * e


def kick(dur=0.25):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    f = 110 * np.exp(-t * 18) + 42
    phase = 2 * np.pi * np.cumsum(f) / RATE
    return np.sin(phase) * np.exp(-t * 10)


def hat(dur=0.06, seed=0):
    rng = np.random.default_rng(seed)
    n = int(dur * RATE)
    noise = rng.uniform(-1, 1, n)
    noise = np.diff(noise, prepend=0)  # passa-alta simples
    return noise * np.exp(-np.arange(n) / RATE * 60) * 0.5


def tick(dur=0.05, high=True):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    return np.sin(2 * np.pi * (2400 if high else 1800) * t) * np.exp(-t * 90)


def place(buf: np.ndarray, sound: np.ndarray, at: float, gain: float):
    i = int(at * RATE) % len(buf)
    end = i + len(sound)
    if end <= len(buf):
        buf[i:end] += sound * gain
    else:  # dá a volta no loop: o rabo do som entra no começo
        cut = len(buf) - i
        buf[i:] += sound[:cut] * gain
        buf[: end - len(buf)] += sound[cut:] * gain


def echo(buf: np.ndarray, delay: float, feedback: float, mix: float) -> np.ndarray:
    d = int(delay * RATE)
    out = buf.copy()
    tap = buf.copy()
    for _ in range(4):
        tap = np.roll(tap, d) * feedback
        out += tap * mix
    return out


def song(spec: dict) -> np.ndarray:
    bpm = spec["bpm"]
    beat = 60 / bpm
    bars = spec["progression"] * spec.get("repeat", 2)
    total = len(bars) * 4 * beat
    buf = np.zeros(int(total * RATE))
    lead = np.zeros_like(buf)
    rng = np.random.default_rng(spec.get("seed", 1))

    for b, (root, quality, octave) in enumerate(bars):
        start = b * 4 * beat
        notes = [midi(root, octave) + i for i in CHORD[quality]]
        # Pad: acorde longo e macio.
        for m in notes:
            place(buf, tone(freq(m), 4 * beat, spec.get("pad", "tri"), attack=0.25, release=0.6),
                  start, spec.get("pad_gain", 0.08))
        # Baixo.
        bass_m = midi(root, octave - 1)
        for step in spec["bass"]:
            place(buf, tone(freq(bass_m), beat * 0.9, "sine", attack=0.005, release=0.08),
                  start + step * beat, spec.get("bass_gain", 0.32))
        # Arpejo.
        pattern = spec["arp"]
        step_len = 4 * beat / len(pattern)
        for k, idx in enumerate(pattern):
            if idx is None:
                continue
            m = notes[idx % len(notes)] + 12 * (idx // len(notes)) + 12
            place(lead, tone(freq(m), step_len * 1.6, spec.get("arp_kind", "pluck"),
                             attack=0.004, release=0.05, decay=spec.get("arp_decay", 0.18)),
                  start + k * step_len, spec.get("arp_gain", 0.12))
        # Bateria.
        for step in spec.get("kicks", []):
            place(buf, kick(), start + step * beat, spec.get("kick_gain", 0.5))
        for step in spec.get("hats", []):
            place(buf, hat(seed=int(rng.integers(0, 999))), start + step * beat,
                  spec.get("hat_gain", 0.18))
        for step in spec.get("ticks", []):
            place(buf, tick(high=(step * 2) % 2 == 0), start + step * beat, 0.12)

    if spec.get("echo"):
        lead = echo(lead, beat * 0.75, 0.45, 0.6)
    mix = buf + lead
    mix /= max(1e-6, np.max(np.abs(mix))) / 0.85
    return mix


SONGS = {
    # Quarto à noite: lo-fi calmo.
    "study": dict(bpm=78, progression=[("A", "min7", 3), ("F", "maj7", 3), ("C", "maj7", 3), ("G", "sus2", 3)],
                  bass=[0, 2.5], arp=[0, 2, 1, 3, None, 2, 1, None], arp_decay=0.3,
                  kicks=[0, 2.5], hats=[1, 3], hat_gain=0.08, kick_gain=0.3, echo=True, pad="sine"),
    # Escritório: animado, ocupado.
    "work": dict(bpm=116, progression=[("C", "maj", 3), ("G", "maj", 3), ("A", "min", 3), ("F", "maj", 3)],
                 bass=[0, 1, 2, 3], arp=[0, 1, 2, 1, 0, 2, 3, 2], arp_kind="square", arp_gain=0.07,
                 kicks=[0, 2], hats=[0.5, 1.5, 2.5, 3.5], hat_gain=0.14),
    # Academia: energia.
    "health": dict(bpm=128, progression=[("E", "min", 3), ("C", "maj", 3), ("G", "maj", 3), ("D", "maj", 3)],
                   bass=[0, 0.5, 1.5, 2, 2.5, 3.5], arp=[0, 2, 3, 2, 1, 2, 3, 4], arp_kind="square",
                   arp_gain=0.07, kicks=[0, 1, 2, 3], hats=[0.5, 1.5, 2.5, 3.5], kick_gain=0.55),
    # Cozinha: brincalhão.
    "home": dict(bpm=104, progression=[("F", "maj", 3), ("D", "min", 3), ("Bb", "maj", 3), ("C", "dom7", 3)],
                 bass=[0, 1.5, 2, 3], arp=[0, None, 2, 1, None, 3, 2, None], arp_gain=0.14,
                 kicks=[0, 2], hats=[1, 3, 3.5], hat_gain=0.12, pad="sine"),
    # Parque à noite: mistério.
    "other": dict(bpm=84, progression=[("D", "min", 3), ("Bb", "maj", 3), ("G", "min", 3), ("A", "dom7", 3)],
                  bass=[0, 3], arp=[0, None, 2, None, 1, None, 3, None], arp_decay=0.45,
                  kicks=[0], hats=[2], hat_gain=0.06, echo=True, pad="sine", pad_gain=0.1),
    # Chefe: relógio correndo.
    "boss": dict(bpm=140, progression=[("C", "min", 3), ("Ab", "maj", 3), ("Bb", "maj", 3), ("G", "dom7", 3)],
                 bass=[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], bass_gain=0.26, arp=[0, 1, 2, 3, 2, 1, 0, 1],
                 arp_kind="square", arp_gain=0.08, kicks=[0, 1, 2, 3], kick_gain=0.55,
                 ticks=[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], hats=[], seed=7),
    # Montanha de Tralha: tropeçando, tudo caindo.
    "boss-clutter": dict(bpm=132, progression=[("E", "min", 3), ("C", "maj", 3), ("F#", "dom7", 3), ("B", "dom7", 3)],
                         bass=[0, 0.75, 1.5, 2, 2.75, 3.5], bass_gain=0.26, arp=[0, 2, 1, 3, 0, 3, 1, 2],
                         arp_kind="square", arp_gain=0.08, kicks=[0, 1.5, 2, 3.5], kick_gain=0.55,
                         hats=[0.5, 1, 2.5, 3], hat_gain=0.14, seed=11),
    # Sedentarismo: groove arrastado, preguiçoso e pesado.
    "boss-couch": dict(bpm=96, progression=[("G", "min", 3), ("Eb", "maj", 3), ("C", "min", 3), ("D", "dom7", 3)],
                       bass=[0, 1.5, 2, 3], bass_gain=0.3, arp=[0, None, 2, None, 1, None, 3, 2],
                       arp_kind="square", arp_gain=0.08, arp_decay=0.4, kicks=[0, 2, 2.5], kick_gain=0.6,
                       hats=[1, 3], hat_gain=0.1, pad="sine", pad_gain=0.08, seed=13),
    # Reunião Infinita: o mesmo compasso sem fim, cada vez mais tenso.
    "boss-meeting": dict(bpm=124, progression=[("A", "min", 3), ("A", "min", 3), ("F", "maj", 3), ("E", "dom7", 3)],
                         bass=[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], bass_gain=0.24, arp=[0, 1, 0, 2, 0, 1, 0, 3],
                         arp_kind="square", arp_gain=0.07, kicks=[0, 1, 2, 3], kick_gain=0.5,
                         ticks=[0.5, 1.5, 2.5, 3.5], hats=[0.25, 0.75, 1.25, 1.75], hat_gain=0.08, seed=17),
}


def write_mp3(name: str, samples: np.ndarray) -> None:
    os.makedirs(OUT, exist_ok=True)
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = os.path.join(tmp, f"{name}.wav")
        with wave.open(wav_path, "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(RATE)
            handle.writeframes(pcm.tobytes())
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-codec:a", "libmp3lame",
             "-b:a", "64k", f"{OUT}/{name}.mp3"],
            check=True,
        )


if __name__ == "__main__":
    import sys

    only = set(sys.argv[1:])
    for key, spec in SONGS.items():
        if only and key not in only:
            continue
        write_mp3(key, song(spec))
        print(key, f"{os.path.getsize(f'{OUT}/{key}.mp3') / 1024:.0f} KB")
