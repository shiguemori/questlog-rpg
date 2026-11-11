# Pipeline Blender (congelado)

**Não modelar agora.** Só contrato de pastas e naming.

```text
assets/
  blender/
    sources/          # .blend canônicos (vazio no MVP)
    exports/          # glTF/PNG exportados (vazio no MVP)
  placeholders/       # PNGs/SVGs usados pelo app hoje
```

## Naming

`ql_{slot}_{variant}_v{n}.{ext}`

Exemplos futuros: `ql_avatar_warrior_v1.glb`, `ql_icon_quest_v1.png`.

## Quando descongelar

Só após: loop jogável estável + CI verde + fatia 3 do roadmap. Até lá, o app usa placeholders.

Índice: [README do palácio](README.md).
