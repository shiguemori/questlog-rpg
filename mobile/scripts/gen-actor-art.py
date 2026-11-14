"""
Converte os quadros renderizados no Blender em WebP e gera `src/components/actorArt.ts`.

Uso (na pasta mobile/):
    python scripts/gen-actor-art.py <pasta-dos-png-dos-personagens> <pasta-dos-png-dos-itens>

Os PNG vêm do texto `qlpose` dentro de `assets/blender/sources/battle-characters.blend`
(render_variants): `hero_warrior-cap-attack.png`, `enemy_study-elite-idle.png`, `item_hat_cap.png`.
Sem argumentos, só regenera o registro a partir de `assets/actors` e `assets/items`.
"""

import glob
import os
import sys

POSES = ["idle", "windup", "attack", "hurt", "victory", "ko"]
ACTORS = "assets/actors"
ITEMS = "assets/items"


def convert(png_dir: str, icon_dir: str) -> None:
    from PIL import Image

    os.makedirs(ACTORS + "/portrait", exist_ok=True)
    os.makedirs(ITEMS, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(png_dir, "*.png"))):
        stem = os.path.basename(path)[:-4].replace("hero_", "hero-").replace("enemy_", "enemy-")
        image = Image.open(path).convert("RGBA")
        image.save(f"{ACTORS}/{stem}.webp", "WEBP", quality=82, method=6)
        if stem.endswith("-idle"):
            # Retrato: recorta pela transparência e centraliza num quadrado.
            box = image.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
            crop = image.crop(box)
            w, h = crop.size
            side = max(w, h) + 16
            square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            square.alpha_composite(crop, ((side - w) // 2, (side - h) // 2))
            square.resize((384, 384), Image.LANCZOS).save(
                f"{ACTORS}/portrait/{stem[:-5]}.webp", "WEBP", quality=85, method=6
            )
    for path in sorted(glob.glob(os.path.join(icon_dir, "*.png"))):
        stem = os.path.basename(path)[:-4].replace("item_", "").replace("_", "-")
        image = Image.open(path).convert("RGBA")
        crop = image.crop(image.getchannel("A").getbbox())
        w, h = crop.size
        side = max(w, h) + 8
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.alpha_composite(crop, ((side - w) // 2, (side - h) // 2))
        square.resize((192, 192), Image.LANCZOS).save(
            f"{ITEMS}/{stem}.webp", "WEBP", quality=85, method=6
        )


def art_key(stem: str) -> str:
    """hero-warrior-cap -> hero.warrior+cap; enemy-boss-phase2 -> enemy.boss+phase2."""
    parts = stem.split("-")
    base = f"{parts[0]}.{parts[1]}"
    return base + ("+" + "-".join(parts[2:]) if len(parts) > 2 else "")


def write_registry() -> None:
    files = sorted(f for f in os.listdir(ACTORS) if f.endswith(".webp"))
    stems = sorted({f.rsplit("-", 1)[0] for f in files})
    out = [
        "// Gerado por scripts/gen-actor-art.py a partir de assets/actors. Não edite à mão.",
        "// Quadros 640×640 renderizados no Blender (battle-characters.blend), câmera fixa por personagem.",
        "import type { ImageSourcePropType } from 'react-native';",
        "",
        "export type ActorPose = 'idle' | 'windup' | 'attack' | 'hurt' | 'victory' | 'ko';",
        "",
        "export const ACTOR_POSES: Record<string, Record<ActorPose, ImageSourcePropType>> = {",
    ]
    for stem in stems:
        out.append(f"  '{art_key(stem)}': {{")
        for pose in POSES:
            out.append(f"    {pose}: require('../../assets/actors/{stem}-{pose}.webp'),")
        out.append("  },")
    out += [
        "};",
        "",
        "/** Retrato recortado (quadro parado), para avatares e listas. */",
        "export const ACTOR_PORTRAITS: Record<string, ImageSourcePropType> = {",
    ]
    for name in sorted(os.listdir(ACTORS + "/portrait")):
        out.append(f"  '{art_key(name[:-5])}': require('../../assets/actors/portrait/{name}'),")
    out += [
        "};",
        "",
        "/** Ícones dos itens (assets/items). */",
        "export const ITEM_ART: Record<string, ImageSourcePropType> = {",
    ]
    for name in sorted(os.listdir(ITEMS)):
        out.append(f"  '{name[:-5]}': require('../../assets/items/{name}'),")
    out.append("};")
    with open("src/components/actorArt.ts", "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(out) + "\n")


if __name__ == "__main__":
    if len(sys.argv) == 3:
        convert(sys.argv[1], sys.argv[2])
    write_registry()
