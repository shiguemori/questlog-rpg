# AGENTS.md — QuestLog (questlog-rpg)

Produto mobile Shiguemori: gamificar hábitos como quests de RPG. Display **QuestLog**; casing de repo sempre `questlog-rpg`.

## Leia primeiro

1. Este arquivo.
2. `docs/README.md` — palácio (máx ~8 docs).
3. `PRODUCT_PLAN.md` — discovery; não descartar.
4. `PENDING_TASKS.md` na raiz do workspace ou do projeto, se existir.

## Stack

| Camada | Ferramenta |
|--------|------------|
| Mobile | Expo + React Native (`mobile/`) |
| Domínio | TypeScript puro em `mobile/src/domain/` |
| Persistência MVP | AsyncStorage local |
| Web legado | Vite React em `web/` |
| CI | GitHub Actions `.github/workflows/ci.yml` |

## Prioridade

1. Loop jogável (onboarding → quest log).
2. CI verde.
3. Só então polish / Blender assets.

**Abortar** polish e Blender se o app ainda não abre e joga 2 minutos.

## Não fazer no MVP

OCR, IA, sync cloud, social, loja de cosméticos, idle RPG, clonar features de pintura do Tintinha.
