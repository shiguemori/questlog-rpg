# Batalha por turnos

Ao concluir uma quest **que daria XP**, abre um combate em pixel art. O motor é puro, em `mobile/src/domain/battle.ts`. A tela é `BattleOverlay` (com `components/battle/*`). A recompensa continua em `completeQuest`, e a vida entre lutas fica em `domain/vitals.ts`.

## Quando a luta começa

`planQuestCompletion` decide:

| Plano | O que acontece |
|-------|----------------|
| `BATTLE` | O anti-farm liberaria XP. A quest **não** muda até o fim da luta. |
| `BLOCKED` | Menos de 1 minuto ou 10 quests com XP no dia. Conclui na hora, sem luta. |
| `REJECTED` | Quest inexistente ou já concluída. |

O anti-farm não muda: 1 minuto desde `createdAt` e no máximo 10 concessões de XP por dia civil.

## Turno

1. O herói escolhe 1 das 6 habilidades que levou (5 do loadout + Respirar Fundo). Custo de energia e recarga valem.
2. O golpe resolve: esquiva, crítico, guarda, escudo, defesa e status.
3. O monstro age: primeiro queimadura/veneno/regeneração, depois o golpe escolhido pela IA. A tela não mostra o próximo golpe dele.
4. Começa o turno do herói: status ticam, a energia volta +3, as recargas andam.
5. Até um lado zerar a vida ou o herói passar de **12 turnos** (derrota: “não aguenta mais”).

Atordoado perde a vez. Se for o herói, o monstro age de novo.

## Atributos

| Atributo | Efeito |
|----------|--------|
| Força / Inteligência / Agilidade | Escalam as habilidades da classe (Guerreiro, Mago, Ladino). |
| Vitalidade | Vida `24 + 6×VIT` e defesa `VIT/2`. Escala a Muralha. |
| Inteligência | Energia máxima `12 + 2×INT`. |
| Agilidade | Crítico `5% + 3%×AGI` (teto 50%) e esquiva de golpe físico `2%×AGI` (teto 25%). |

Dano: `(base + atributo × razão) × fúria/fraqueza × bônus × crítico(1,5) × guarda − defesa`, mínimo 1. Magia ignora metade da defesa. Escudo absorve antes da vida. A ficha do herói mostra o efeito de cada atributo com o valor atual.

## Habilidades

O tema é o dia a dia: o herói é uma pessoa comum e os golpes são coisas de casa, estudo e rotina. Os ids internos (`warrior.*`, `mage.*`, `rogue.*`) não mudaram.

Toda classe tem **Respirar Fundo** (guarda 50% no próximo golpe, +3 energia).

| Classe (energia) | Habilidade | Custo | Recarga | Efeito |
|------------------|------------|-------|---------|--------|
| Guerreiro (Disposição) | Vassourada | 0 | – | 5 + 1,3×FOR |
| | Chinelada | 5 | 3 | dano + trava 1 turno |
| | Playlist Animada | 4 | 4 | Animado +40% por 3 turnos |
| | Tampa de Panela | 4 | 2 | escudo 6 + 2,5×VIT |
| | Faxina Final | 7 | 2 | 8 + 1,3×FOR, dobro com alvo ≤35% |
| Mago (Foco) | Post-it | 0 | – | 4 + 1×INT, mental |
| | Café Fervendo | 6 | 2 | dano + fervendo 3 turnos |
| | Modo Avião | 6 | 3 | dano + trava 1 turno |
| | Agenda em Dia | 4 | 2 | escudo 3 + 1,6×INT |
| | Lista Riscada | 9 | 3 | 7 + 1,4×INT, +50% em alvo fervendo |
| Ladino (Fôlego) | Atalho | 0 | – | 4 + 1×AGI, +15% crítico |
| | Lembrete Chato | 4 | – | dano + incomodado (acumula até 3) |
| | Sair de Fininho | 5 | 3 | o próximo golpe do monstro erra |
| | Pegadinha | 7 | 2 | 7 + 1,6×AGI, crítico certo se incomodado |
| | Multitarefa | 6 | 3 | 3 golpes, cada um rola crítico |

Habilidades da árvore de talentos (começam bloqueadas):

| Classe | Habilidade | Custo | Recarga | Efeito |
|--------|------------|-------|---------|--------|
| Guerreiro | Esfregão Giratório | 4 | 2 | 2 golpes de 3 + 0,8×FOR |
| | Marmita Caprichada | 5 | 3 | cura 6 + 1,5×VIT |
| | Despertador | 4 | 3 | dano + monstro cansado 2 turnos |
| | Aspirador Turbo | 10 | 4 | 12 + 1,8×FOR, +50% com alvo ≤35% |
| Mago | Marca-Texto | 3 | 1 | 5 + 1,1×INT, +25% crítico |
| | Chá de Camomila | 4 | 4 | descansando 3 turnos (3 + 0,6×INT) |
| | Pomodoro | 0 | 4 | +6 energia e Animado +30% por 2 turnos |
| | Virada de Estudo | 11 | 4 | 10 + 2×INT, mas você fica cansado 1 turno |
| Ladino | Cupom Relâmpago | 4 | 2 | 5 + 1,1×AGI, metade volta como vida |
| | Guarda-Chuva | 4 | 2 | escudo 4 + 1,4×AGI |
| | Energético | 0 | 4 | +5 energia e Animado +30% por 2 turnos |
| | Entrega Expressa | 10 | 4 | 4 golpes + incomodado 3 turnos |

Status: Fervendo (dano por turno), Incomodado (dano por turno, acumula), Travado (perde a vez), Cansado (−30% de dano), Animado (+40% de dano), Esquiva, Descansando (cura por turno), Guarda.

## Talentos, loadout e reset

Regras em `mobile/src/domain/talents.ts`; telas nas abas Talentos e Golpes da folha do herói.

- **Pontos de talento:** 1 por nível depois do 1. Não ficam no save: são o nível − 1 menos os talentos aprendidos (`character.talents`).
- **Árvore:** 3 ramos por classe (Mão na massa, Autocuidado, Rotina), 3 talentos cada. Cada um pede o anterior do ramo e um nível mínimo (2, 3 e 5).

| Ramo | 1 (nível 2) | 2 (nível 3) | 3 (nível 5) |
|------|-------------|-------------|-------------|
| Mão na massa | +10% de dano | libera o golpe de ataque | +10% de crítico |
| Autocuidado | +8 de vida máxima | libera o golpe de cura ou escudo | +30% nos escudos |
| Rotina | +4 de energia máxima | libera o golpe de energia | libera o golpe final |

- **Devolver talentos:** devolve todos os pontos. Golpes da árvore saem do loadout.
- **Loadout:** até 5 golpes (`character.loadout`). Respirar Fundo vai sempre. Sem escolha salva, valem os 5 iniciais. Não dá para tirar o último.
- **Devolver atributos:** os atributos voltam ao valor inicial da classe e os pontos gastos voltam para `attributePoints`.
- A vida máxima com talento entra na vida entre lutas (`heroMaxHpFor`).

## Monstros por categoria

A vida (30 / 46 / 50) e os atributos vêm da dificuldade e sobem com o nível do herói: +7 de vida por nível, e +1 em força e inteligência a cada `ENEMY_LEVEL_STEP` níveis (fácil 2, médio 1,5, difícil 1). A vitalidade sobe na metade desse ritmo, para a defesa não punir só os golpes físicos.

| Categoria | Monstro | Golpes | Jeito próprio (`ENEMY_TRAITS`) |
|-----------|---------|--------|--------------------------------|
| Estudo | Distração (celular) | Notificação, Rolagem Infinita (cansado), Abas Novas (2 golpes), Modo Soneca (cura) | **Mais abas:** com metade da vida, +30% de dano por 2 turnos, uma vez |
| Trabalho | Caos (tornado) | Urgência, Reunião Surpresa (trava), Prazo Apertado (estresse), Hora Extra (animado) | **Acumula:** +10% de dano a cada turno dele, até +40% |
| Saúde | Preguiça (no sofá) | Sofá Macio, Soneca (descansa), Desculpa Pronta (escudo), Peso nas Pernas (cansado) | **Espreguiça:** se o golpe do herói não causou dano, recupera 8% da vida |
| Casa | Bagunça (pilha) | Pilha de Roupa, Poeira (alergia), Avalanche (pesado), Debaixo do Tapete (esquiva) | **A pilha cresce:** a cada 3 turnos ganha escudo de 12% da vida máxima |
| Outro | Sombra (fantasma) | Garra Sombria, Sussurro (cansado), Drenar (rouba vida), Névoa (esquiva) | **Some de vista:** com metade da vida, esquiva o próximo golpe, uma vez |

O jeito age no começo do turno do monstro (`applyEnemyTrait`), vira um evento `TRAIT` (texto "JEITO DO MONSTRO" em cima dele) e aparece na placa do monstro. Muda a melhor jogada de cada luta: contra o Caos, termine rápido; contra a Preguiça, não fique só defendendo.

IA (não aparece na tela): com ≤45% de vida prefere cura/escudo; em turnos alternados aplica um status que o herói ainda não tem; no resto usa o golpe mais forte disponível. O cartão de cada quest mostra o monstro da categoria.

## Vida entre lutas

- A vida que sobra é gravada em `character.vitals = { hp, updatedAt }` (ISO 8601). Sem registro = vida cheia.
- Recupera **10% da vida máxima por hora**. Level up enche.
- A luta começa com pelo menos 20% da vida, para ser jogável depois de uma derrota.
- A tela principal mostra a barra de vida e quanto falta para encher.

Isso cria a estratégia: gastar vida numa quest difícil pesa na próxima.

## Sorte

Crítico e esquiva usam um gerador com semente (`mulberry32`) guardado no estado. O app usa o horário como semente; os testes fixam a semente, então a luta é reproduzível.

## Balanceamento

`npx tsx scripts/simulate-battles.ts` (em `mobile/`) roda 300 lutas por classe × monstro × dificuldade × nível (1, 3, 5, 8). O herói simulado usa o golpe de mais dano e, com pouca vida, cura ou escudo; atributos e talentos seguem uma build comum. Vitórias depois do ajuste de 13/11/2026:

| | Nível 1 | Nível 3 | Nível 5 | Nível 8 |
|-|---------|---------|---------|---------|
| Fácil | 100% | 100% | 100% | 100% |
| Médio | 66–100% | 99–100% | 99–100% | 96–100% |
| Difícil | 23–100% | 81–100% | 58–100% | 40–100% |

O que mudou nesse ajuste: difícil começa mais baixo (vida 50, atributos 4) e sobe a cada nível; o Ladino ganhou esquiva +10 (passiva), Atalho mais forte e que rouba 25% do dano, e Lembrete Chato incomoda mais; Lista Riscada e Avalanche bateram um pouco menos. Pontos fracos que ficam por escolha: Ladino contra Distração (dano mental, a esquiva não ajuda) e Guerreiro contra Caos (o dano acumulado pune lutas longas). O jogador real usa Respirar Fundo e escudo; o simulado não, então os números reais tendem a ser melhores.

## Arte e efeitos

- Heróis são pessoas comuns: Guerreiro de bandana com vassoura e tampa de panela, Mago estudante de óculos com café e agenda, Ladino de boné, moletom e mochila.
- Personagens modelados no Blender por código (formas estilizadas, sombreamento toon em 3 faixas, contraluz e contorno de casco invertido). Fonte: `assets/blender/sources/battle-characters.blend`; o script do kit está no texto `qlkit` dentro do arquivo.
- Renders 1024×1024 com fundo transparente em `mobile/assets/battle/` (`hero-*.png`, `enemy-*.png`), ligados por `CharacterArt` pelo `assetKey`. Heróis olham para a direita, monstros para a esquerda. O topo da tela principal, a folha do herói, o level up e o cartão de cada quest usam os mesmos retratos.
- **Cenários (v2):** 5 cômodos inteiros com luz de verdade: quarto de estudo à noite (estante, janela com lua, varal de luzinhas, escrivaninha com notebook e luminária), escritório no pôr do sol (janelão com prédios, dois monitores, pilhas de papel), academia em casa de manhã (sol entrando, tapete de yoga, halteres), cozinha à tarde (pia com louça, geladeira com ímãs, cesto de roupa) e parque à noite (pinheiros, poste, vaga-lumes). Materiais com luz (Principled), EEVEE com sombras e raytracing, brilho no compositor e AgX. Kit no texto `qlkit2` do `.blend`, raízes `arena2_*`, função `arena_render`. Saída 1080×1350 JPEG (~100–130 KB) em `mobile/assets/battle/arena-*.jpg`.
- **Tela da luta:** a arena vai de ponta a ponta até o topo, com degradê escuro em cima (para a placa do monstro) e embaixo (para fundir com o painel). Em cima: placa do monstro (nome, vida com marcas a cada 10, nível, jeito próprio, status) e o turno. Embaixo: legenda da ação, barra do herói (vida e energia lado a lado) e os 6 golpes em cartões com ícone grande, custo no canto do ícone e recarga em cima do ícone. O painel reserva 352 de altura; a arena fica com o resto (300–560). Personagens: herói até 220, monstro 6% maior.
- **Golpe do herói:** recua e encolhe (preparo, 150 ms), estica no avanço, o objeto do golpe sai com rastro (`SkillCast.tsx`), e no alvo: clarão, onda de choque, linhas de impacto e partículas no padrão do elemento (estouro, faíscas que sobem, cacos de gelo, bolhas, fumaça, anel). O alvo pisca branco (cópia da silhueta com `tintColor`), recua e achata. Crítico: tudo maior, número com "CRÍTICO", clarão na arena inteira e tremida.
- **Escudo** vira uma bolha em volta do lutador enquanto durar. **Travado** mostra estrelinhas girando. Cura e bônus dão um brilho verde. Sombra no chão acompanha pulos e investidas.
- **Começo e fim:** faixa "Fulano apareceu!" cruza a arena; monstro desce e herói entra pela esquerda. O resultado espera a última animação; na vitória, raios girando, confete e o XP contando.
- **Som e vibração** (`platform/battleCues.ts`): sons curtos gerados por código em `mobile/assets/sfx/` (golpe, crítico, cura, escudo, deslocamento). Vibração leve ao bater, média ao apanhar, forte no crítico. Som só com Ajustes → Som ligado.
- **Primeira luta:** dica "Como lutar" (3 linhas) até a pessoa usar um golpe ou tocar em Entendi (`settings.battleTutorialDone`).
- **Level up:** retrato do herói pulando, o nível grande, o que ganhou (+2 atributos, +1 talento), a camada nova da árvore quando abre, confete, e "Usar os pontos" abre a folha do herói.
- O turno do monstro espera a animação do herói: `1000 ms` até `1700 ms`, conforme o número de eventos.
- Segurar um golpe abre o detalhe com o texto inteiro, custo, recarga e o efeito de agora. Funciona com o golpe bloqueado.
- "Reduzir movimento" desliga deslocamentos, partículas, objetos e confete; números e textos continuam.
- Preview no navegador: `npx expo start --web` (o projeto tem `react-native-web`). Serve para ver layout; animações e sombras de verdade só no aparelho.

## XP

| Resultado | XP |
|-----------|----|
| Vitória | Base + bônus de atributo + bônus de streak. |
| Derrota | `piso(base / 2)`, no mínimo 1, sem bônus. Gasta 1 vaga das 10 do dia. |
| Anti-farm | 0. Sem luta. |

Se o app fechar no meio da luta, a quest continua aberta e a vida não muda.

## Testar no Expo Go

```bash
cd mobile
npm install
npx expo start -c
```

- Fácil com o ataque grátis → vence. Difícil no nível 1 pede estratégia (escudo, Respirar Fundo).
- Segure um golpe para ler o que ele faz. Use Respirar Fundo ou escudo quando a vida cair.
- No nível 2, abra a folha do herói → Talentos e aprenda o primeiro talento; em Golpes, troque o que vai para a luta.
- Depois da luta, a vida na tela principal fica como terminou e sobe com o tempo.
