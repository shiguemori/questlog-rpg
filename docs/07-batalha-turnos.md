# Batalha por turnos

Ao concluir uma quest **que daria XP**, abre um combate estilo Game Boy. O motor é puro, em `mobile/src/domain/battle.ts`. A tela é `BattleOverlay`. A recompensa continua em `completeQuest`.

## Quando a luta começa

`planQuestCompletion` decide:

| Plano | O que acontece |
|-------|----------------|
| `BATTLE` | Anti-farm liberaria XP. A quest **não** muda até o fim da luta. |
| `BLOCKED` | Menos de 1 minuto ou 10 quests com XP no dia. Conclui na hora, feedback curto, **sem luta**. |
| `REJECTED` | Quest inexistente ou já concluída. |

O anti-farm não muda: 1 minuto desde `createdAt` e no máximo 10 concessões de XP por dia civil.

## Turnos

1. O herói escolhe 1 de 4 golpes.
2. O golpe resolve.
3. Se o monstro ainda tem HP, ele age (a lista é fixa: pula cura com HP cheio e guarda se já está guardando).
4. Repete até um lado zerar o HP, ou até **8 golpes do herói**. No oitavo, se o monstro segue de pé, é derrota (“não aguenta mais”).

Todo golpe causa pelo menos 1 de dano. A guarda reduz o **próximo** golpe e depois some.

## Atributos e dificuldade

| Peça | Fórmula |
|------|---------|
| HP do herói | `24 + vitalidade × 6` |
| Ataque | Guerreiro: Força. Mago: Inteligência. Ladino: Agilidade |
| Defesa | `piso(vitalidade / 2)`, subtraída do dano recebido |
| Dano | `max(1, piso((poder + ataque) × (100 − guarda) / 100) − defesa)` |
| Cura | `poder + defesa`, sem passar do HP máximo |
| HP / ataque do monstro | Fácil 30 / +2, Médio 44 / +5, Difícil 60 / +8 |

## Golpes do herói

| Classe | Golpe | Efeito | Poder |
|--------|-------|--------|-------|
| Guerreiro | Corte | dano | 8 |
| Guerreiro | Postura | guarda | 50 |
| Guerreiro | Investida | dano | 14 |
| Guerreiro | Fôlego | cura | 10 |
| Mago | Faísca | dano | 7 |
| Mago | Barreira | guarda | 55 |
| Mago | Rajada | dano | 15 |
| Mago | Cura | cura | 9 |
| Ladino | Punhalada | dano | 9 |
| Ladino | Esquiva | guarda | 45 |
| Ladino | Golpe baixo | dano | 13 |
| Ladino | Trago | cura | 7 |

## Golpes do monstro

O nome vem da categoria (Distração, Caos, Preguiça, Bagunça, Sombra).

| Categoria | Golpes (dano, dano, guarda, cura) |
|-----------|-----------------------------------|
| Estudo | Notificação 6, Aba nova 10, Rolagem 30, Cochilo 6 |
| Trabalho | Urgência 7, Reunião 11, Protocolo 35, Café 6 |
| Saúde | Adiar 5, Sofá 10, Desculpa 40, Soneca 8 |
| Casa | Pilha 6, Entulho 11, Empurrar 30, Recolher 5 |
| Outro | Sussurro 6, Garra 11, Névoa 35, Reforma 6 |

## XP

A quest **sempre conclui** no fim da luta. Streak, meta do dia e contagem de conclusão seguem iguais. Desfazer (5 s) só aparece no resultado — no meio da luta não dá para fugir.

| Resultado | XP |
|-----------|----|
| Vitória | Base da quest + bônus de atributo + bônus de streak. Igual ao fluxo de antes. |
| Derrota | `piso(base / 2)`, no mínimo 1. Sem bônus. Exemplos: 10→5, 25→12, 50→25. |
| Anti-farm | 0. Sem luta. |

Derrota com XP gasta 1 vaga das 10 do dia. Não dá para transformar derrota em um 11º XP.

Se o app fechar no meio da luta, a quest continua aberta: o save só muda quando a luta acaba.

## Arte (placeholder)

Sprites finais ainda não existem. Cada ator tem `assetKey`. O mapa `BATTLE_SPRITE_SOURCES` em `mobile/src/components/battleSprites.ts` está `null` e a tela desenha retângulo + emoji.

| assetKey | Arquivo futuro | Placeholder |
|----------|----------------|-------------|
| `hero.warrior` | `mobile/assets/battle/hero-warrior.png` | ⚔️ |
| `hero.mage` | `mobile/assets/battle/hero-mage.png` | 🔮 |
| `hero.rogue` | `mobile/assets/battle/hero-rogue.png` | 🗡️ |
| `enemy.study` | `mobile/assets/battle/enemy-study.png` | 📱 |
| `enemy.work` | `mobile/assets/battle/enemy-work.png` | 🌀 |
| `enemy.health` | `mobile/assets/battle/enemy-health.png` | 😴 |
| `enemy.home` | `mobile/assets/battle/enemy-home.png` | 🧹 |
| `enemy.other` | `mobile/assets/battle/enemy-other.png` | 🌑 |

Golpes usam `move.<id>` (ex.: `move.mage.burst`) e hoje são só texto no menu.

Para plugar a arte: trocar o `null` da chave por `require('../../assets/battle/hero-mage.png')`.

## Testar no Expo Go

```bash
cd mobile
npm install
npx expo start -c
```

SDK 58. Criar uma quest, esperar o contador de 1 minuto, tocar em Feito.

- Escolher golpes até o monstro cair → Continuar → XP integral e, se encheu a barra, “Level up!”.
- Só curar até a luta acabar → a quest conta, com metade do XP e sem bônus. O streak sobe.
- Tocar em Feito antes de 1 minuto e confirmar → “Quest marcada”, sem arena.
- Na tela de resultado, Desfazer em até 5 s devolve XP e streak. O botão voltar do Android fecha o resultado; no meio da luta ele não foge.
