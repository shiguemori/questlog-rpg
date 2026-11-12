# Domínio (contrato MVP)

Fonte de verdade no app: `mobile/src/domain/*`.

## Entidades

- **Character** — `name`, `characterClass`, `level`, `xp`, `maxXp`, `attributes`, `attributePoints`
- **Quest** — `id`, `title`, `category`, `difficulty`, `xp`, `completed`, `createdAt` (ISO-8601), `completedAt?` (ISO-8601)
- **UserStats** — `streak`, `bestStreak`, `lastCompletedDate` (`YYYY-MM-DD` \| null), totais, `dailyXpCompletions`, `dailyXpCompletionsDate`, `dailyCompletions`, `dailyCompletionsDate`, `completionDays` (até 120 dias `YYYY-MM-DD`)
- **Category** — `STUDY` \| `WORK` \| `HEALTH` \| `HOME` \| `OTHER`

## Regras

| Dificuldade | XP |
|-------------|-----|
| EASY | 10 |
| MEDIUM | 25 |
| HARD | 50 |

- Level up: enquanto `xp >= maxXp`, sobe nível; `maxXp = floor(maxXp * 1.5)`; +2 pontos de atributo.
- Streak: dias consecutivos com pelo menos 1 quest concluída.
- Meta do dia: 1 conclusão (com ou sem XP). O anti-farm não muda: XP só depois de 1 min e no máximo 10 quests com XP por dia.
- Desfazer conclusão: por 5 s o app restaura o estado anterior (XP, streak, meta e log).
- Anti-farm (`completeQuest` + `antiFarm`):
  - máx. 10 quests com XP por dia civil;
  - quest concluída com menos de 1 min desde `createdAt` não gera XP (ainda assim marca como concluída).

- **Dia do jogador** = dia do relógio do aparelho (`dates.localIsoDate`), nunca UTC. Vale para streak e limite diário.
- Quest: título de 2 a 60 caracteres; no máximo 50 quests abertas; XP sempre da tabela acima (`quests.addQuest`).
- Excluir quest ou limpar concluídas não altera XP, streak nem a contagem diária.
- Pontos de atributo: 1 ponto = +1 no atributo escolhido (`progression.spendAttributePoint`).
- Conquistas (`progression.ACHIEVEMENTS`) são derivadas de XP total, melhor streak e nível — quest sem XP não desbloqueia nada.
- Barra de XP (`xpBar`): fração `xp / maxXp` entre 0 e 1; no level up enche até 100% e recomeça.

## Casos de uso (`mobile/src/domain`)

| Arquivo | O que decide |
|---------|--------------|
| `completeQuest.ts` | Concluir quest: anti-farm → XP → nível → streak → meta do dia. `planQuestCompletion` decide se abre batalha. `rewardTier: REDUCED` é a derrota (metade do XP base, sem bônus) |
| `battle.ts` | Batalha por turnos: `startBattle`, `applyPlayerMove`, `applyEnemyMove`. Não grava save |
| `engagement.ts` | Meta, ritual de retorno, marcos de streak, semana e repetir quest |
| `quests.ts` | Validar título, registrar, excluir, limpar, separar abertas/concluídas |
| `progression.ts` | Título do herói, gasto de atributo, conquistas |
| `state.ts` | Estado inicial, início da jornada, validação/migração do save |
| `antiFarm.ts` | Elegibilidade de XP, contador regressivo, resumo diário |
| `xpBar.ts` / `dates.ts` / `victory.ts` | Barra de XP, dia local, vilão da cena de vitória |

## Persistência

AsyncStorage chave `QUESTLOG_RPG_MOBILE_V1` (versão fixada em `2.2.0`, a do SDK 58). Sem backend no MVP.

- `storage/stateStore.ts`: `load` e `save` nunca rejeitam. Save antigo é migrado; save ilegível recomeça limpo e fica copiado em `QUESTLOG_RPG_MOBILE_V1_CORROMPIDO`.
- Se o armazenamento do aparelho falhar, a sessão segue em memória e a tela avisa que o progresso pode não ficar salvo.

Próximo: [roadmap](03-roadmap-mvp.md).
