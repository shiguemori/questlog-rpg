# Domínio (contrato MVP)

Fonte de verdade no app: `mobile/src/domain/*`.

## Entidades

- **Character** — `name`, `characterClass`, `level`, `xp`, `maxXp`, `attributes`, `attributePoints`
- **Quest** — `id`, `title`, `category`, `difficulty`, `xp`, `completed`, `createdAt` (ISO-8601)
- **UserStats** — `streak`, `lastCompletedDate` (`YYYY-MM-DD` \| null), totais, `dailyXpCompletions`, `dailyXpCompletionsDate`
- **Category** — `STUDY` \| `WORK` \| `HEALTH` \| `HOME` \| `OTHER`

## Regras

| Dificuldade | XP |
|-------------|-----|
| EASY | 10 |
| MEDIUM | 25 |
| HARD | 50 |

- Level up: enquanto `xp >= maxXp`, sobe nível; `maxXp = floor(maxXp * 1.5)`; +2 pontos de atributo.
- Streak: dias consecutivos com pelo menos 1 quest concluída.
- Anti-farm (`completeQuest` + `antiFarm`):
  - máx. 10 quests com XP por dia civil;
  - quest concluída com menos de 1 min desde `createdAt` não gera XP (ainda assim marca como concluída).

## Persistência

AsyncStorage chave `QUESTLOG_RPG_MOBILE_V1`. Sem backend no MVP.

Próximo: [roadmap](03-roadmap-mvp.md).
