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

| Arqueiro (Mira) | Elástico | 0 | – | 5 + 1,25×AGI, +10% crítico |
| | Tachinha | 4 | – | dano + incomodado (acumula até 3) |
| | Chuva de Clipes | 6 | 3 | 3 golpes, cada um rola crítico |
| | Mirar com Calma | 4 | 4 | Animado +35% por 3 turnos |
| | Tiro Certeiro | 8 | 3 | 7 + 1,3×AGI, +50% em alvo incomodado |
| Druida (Seiva) | Cutucada de Cacto | 0 | – | 5 + 1,15×INT, mental |
| | Composteira | 5 | – | dano + incomodado 3 turnos |
| | Trepadeira | 6 | 3 | dano + trava 1 turno |
| | Regar as Plantas | 4 | 3 | descansando 3 turnos (3 + 0,7×INT) |
| | Casca de Árvore | 4 | 2 | escudo 4 + 2,2×VIT |
| Bardo (Ritmo) | Riff de Violão | 0 | – | 5 + 1,2×INT, mental |
| | Música Chiclete | 4 | – | dano + incomodado (acumula até 3) |
| | Nota Desafinada | 4 | 3 | dano + monstro cansado 2 turnos |
| | Hino da Galera | 4 | 4 | Animado +40% por 3 turnos |
| | Bis! | 8 | 3 | 8 + 1,45×INT, +50% em alvo incomodado |
| Monge (Paz) | Palma Aberta | 0 | – | 4 + 0,9×VIT |
| | Saudação ao Sol | 5 | 3 | 3 golpes, cada um rola crítico |
| | Meditação | 2 | 3 | descansando 3 turnos (3 + 0,4×VIT) e +3 energia |
| | Postura da Montanha | 4 | 2 | escudo 5 + 1,8×VIT |
| | Golpe Zen | 7 | 2 | 7 + 1×VIT, +60% com alvo ≤35% |

O Monge é a única classe que ataca com Vitalidade: o mesmo atributo dá vida e dano, por isso os golpes dele têm razão menor. Talentos das classes novas: Arqueiro (Avião de Papel, Atrás do Sofá, Garrafinha, Chuva de Elásticos), Druida (Pólen, Banho de Sol, Chá de Ervas, Floresta Inteira), Bardo (Canção de Ninar, Fone Antirruído, Chá com Mel, Show Lotado), Monge (Ponto de Pressão, Água com Limão, Silêncio, Sopro do Dragão).

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

**Combos** (`comboPartners`, `comboReady`): um golpe com bônus condicional combina com o golpe do mesmo herói que deixa o status pedido. Lembrete Chato → Pegadinha, Café Fervendo → Lista Riscada, Tachinha → Tiro Certeiro, Música Chiclete → Bis!, Composteira → Floresta Inteira. O dano que veio de combo sai marcado no evento (`combo: true`) e aparece como "COMBO!" com estouro grande, tremor e vibração forte. Quando o bônus vale agora, o botão ganha borda âmbar e o rótulo "Combo"; segurar o golpe mostra "Combina com" e, se for o caso, "Combo: pronto agora". Golpes de vida baixa (Faxina Final, Aspirador Turbo) também acendem quando o monstro está com 35% ou menos.

**Como lutar**: a dica abre sozinha só na primeira luta (fica marcada como vista já no começo dela, para o fim da luta não desfazer). Depois, o botão "?" no canto de cima abre e fecha a dica. A descrição do golpe (segurar) aparece no meio da tela.

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

### Segundo jeito (`ENEMY_TRAITS_ALT`)

A partir do **nível 3**, metade das lutas de cada cômodo vem com o segundo jeito no lugar do primeiro (`rollEnemyTrait`, pela semente). O bestiário mostra os dois e marca os já vistos.

| Categoria | Segundo jeito | O que faz |
|-----------|---------------|-----------|
| Estudo | **Resposta pronta** | Devolve 25% do dano mágico que recebe. Golpe físico não volta |
| Trabalho | **Vira duas tarefas** | Com metade da vida, cada golpe dele sai em dois, de 60% do dano |
| Saúde | **Cansaço acumula** | Depois do 5º turno dele, +40% de dano até o fim |
| Casa | **Cacos no chão** | Devolve 20% do dano físico que recebe. Magia não volta |
| Outro | **Puxa a atenção** | Cada vez que age, tira 2 de energia do herói |

O dano devolvido nunca derruba o herói (fica com 1 de vida). No simulador (`npx tsx scripts/simulate-battles.ts tracos`) o segundo jeito vence tanto quanto o primeiro: 95–100% no difícil a partir do nível 3.

### Elite

Em luta média ou difícil, a partir do nível 2, o monstro tem 12% de chance de vir de **elite** (`rollEnemyVariant`, pela semente): vida ×1,25, +1 em força, inteligência e vitalidade, arte própria (roxo e rosa com coroa dourada, `enemy.*+elite`) e "Elite ·" na placa. Elite sempre deixa item.

### Chefe da semana (`boss.ts`)

Quatro chefes em rodízio, um por semana (`bossOfWeek`, contando semanas desde 05/01/2026). Todos seguem o mesmo molde (`bossKit`): golpe físico, um status, uma trava e uma defesa na fase 1; dois golpes seguidos, um status forte e um golpe pesado na fase 2.

| Chefe | Cômodo | Fase 1 | Fase 2 | Arena |
|-------|--------|--------|--------|-------|
| **Procrastinação** (despertador derretendo) | Outro | Soneca do Despertador, Depois Eu Faço (cansado), Só Mais um Vídeo (trava), Desculpa Perfeita (escudo) | Alarme Estridente, Prazo Estourado (estresse), Pânico da Última Hora | quarto com relógios e luz vermelha |
| **Montanha de Tralha** (cesto de roupa com caixas) | Casa | Pilha de Roupa, Nuvem de Poeira (incômodo), Peça no Chão (trava), Muralha de Caixas (escudo) | Avalanche de Caixas, Cheiro de Mofo (cansado), Tudo Desaba | cozinha à noite com caixas e roupa no chão |
| **Sedentarismo** (sofá com controle remoto) | Saúde | Almofadada, Afundar no Sofá (cansado), Só Mais um Episódio (trava), Lanchinho (se cura 3 turnos) | Zapear, Farelo no Sofá (incômodo), Abraço do Sofá | academia com TV ligada e salgadinho |
| **Reunião Infinita** (notebook com janelas de chamada) | Trabalho | Pauta Extra, Vamos Alinhar (cansado), Pode Repetir? (trava), Ata de 40 Páginas (escudo) | Responder a Todos, Mais 30 Minutos (estresse), Oitenta Slides | escritório com quadro de post-its |

- Aparece a partir do **nível 3**, depois de **5 vitórias** na semana (segunda a domingo). O cartão na tela principal mostra qual chefe é, o progresso e, quando liberado, o botão Enfrentar.
- Uma tentativa por dia. Vencido, some até a segunda seguinte.
- Vida de difícil ×2,1, ataque de monstro médio um nível abaixo: a luta é longa, não injusta. Limite de 18 turnos (`BOSS_MAX_TURNS`).
- **Fase 2** (`TWO_PHASES`, na metade da vida): recupera 10% da vida, +15% de dano, troca os golpes e a arte (versão em brasa, `enemy.clutter+phase2`). Uma faixa própria de cada chefe anuncia a fase ("Fase 2: o armário abriu!").
- Vitória: `120 + 15 × (nível − 1)` de XP e sempre um equipamento raro ou épico. Cada chefe tem arena e trilha próprias.
- Simulador (`npx tsx scripts/simulate-battles.ts chefes`): 59–100% de vitória a partir do nível 3 para as três classes, nos quatro chefes.

### Luta rápida

Em luta **fácil** de quest aparece "Resolver agora" embaixo dos golpes, antes da primeira jogada. O herói joga sozinho (`autoBattle`: com pouca vida cura ou se protege; no resto, o golpe pronto de mais dano), sem gastar poção, e o resultado aparece na hora. A mesma semente dá o mesmo resultado.

IA (não aparece na tela): com ≤45% de vida prefere cura/escudo; em turnos alternados aplica um status que o herói ainda não tem; no resto usa o golpe mais forte disponível. O cartão de cada quest mostra o monstro da categoria.

## Loot, mochila e poções (`loot.ts`)

Depois da vitória, o monstro pode deixar um item. O sorteio usa a semente da luta (mesma luta, mesmo item). Não existe loja: item só vem de luta e dos desafios do dia.

| Fonte | Chance de cair algo | Equipamento × poção | Raridade do equipamento |
|-------|---------------------|---------------------|-------------------------|
| Luta comum | fácil 30%, médio 45%, difícil 60% | 35% equipamento | comum 70, raro 27, épico 3 |
| Elite | 100% | 70% equipamento | comum 30, raro 55, épico 15 |
| Chefe | 100% | só equipamento | raro 40, épico 60 |

Sorteada a raridade, em 75% das vezes vem uma peça nova dela (se ainda houver); no resto, uma peça qualquer da raridade. **Peça repetida vira fragmentos**: 2 (comum), 4 (raro) ou 6 (épico).

| Espaço | Item | Raridade | Bônus | Conjunto |
|--------|------|----------|-------|----------|
| Chapéu | Boné da Sorte | Comum | +3% crítico | Sorte Grande |
| Chapéu | Gorro de Lã | Comum | +6 vida | Aconchego |
| Chapéu | Capacete de Obra | Raro | +15% escudo, +4 vida | Mão na Massa |
| Chapéu | Chapéu Pontudo | Raro | +3 energia, +4% dano | Arcano |
| Chapéu | Coroa da Rotina | Épico | +8% dano, +4% crítico | Realeza |
| Arma | Arma em Brasa | Comum | +5% dano | Mão na Massa |
| Arma | Arma de Gelo | Raro | +5% dano, +3% crítico | Arcano |
| Arma | Arma Dourada | Épico | +9% dano, +3 energia | Realeza |
| Capa | Capa Vermelha | Comum | +7 vida | Aconchego |
| Capa | Capa de Viagem | Raro | +10% escudo, +3 energia | Mão na Massa |
| Capa | Capa Estrelada | Épico | +5% crítico, +8 vida | Realeza |
| Amuleto | Trevo de Quatro Folhas | Comum | +4% crítico | Sorte Grande |
| Amuleto | Coração de Pelúcia | Comum | +8 vida | Aconchego |
| Amuleto | Ampulheta | Raro | +4 energia | Arcano |
| Amuleto | Estrela Dourada | Épico | +10% dano | Realeza |

- **Conjuntos:** duas peças vestidas do mesmo conjunto somam um bônus extra: Sorte Grande +4% crítico, Aconchego +8 vida, Mão na Massa +5% dano, Arcano +3 energia, Realeza +5% dano.
- **Aprimorar:** fragmentos sobem a peça uma raridade (comum → raro custa 5; raro → épico custa 10). Cada passo soma 50% ao bônus original. Peça épica não sobe mais. A raridade mostrada (moldura e texto) é a aprimorada.
- **Chapéu, arma e capa aparecem no herói.** O chapéu é variação do quadro (`hero.mage+crown`). Capa e arma são camadas com a mesma câmera: a capa vai por baixo do quadro, a arma por cima (o objeto da mão do herói muda de material: brasa, gelo ou ouro). Chaves `layer.mage+cape-red`, `layer.mage+weapon-frost` (`heroLayers`). A primeira peça de cada espaço já vai para o corpo.
- O bônus do equipamento soma com o dos talentos (`mergeBonus`).
- **Poções:** Garrafa d'Água (35% da vida) e Café Forte (60% da energia). Usar gasta o turno; no máximo 2 por luta; teto de 9 de cada. As gastas saem da mochila mesmo na derrota (`applyBattleSpoils`).
- **Mochila** na folha do herói: os 4 espaços, o bônus vestido, os conjuntos em andamento, os fragmentos, a coleção (o que falta em silhueta) e as poções. Tocar numa peça abre o painel com Vestir/Tirar (ação principal) e Aprimorar.
- Fim da luta: o baú treme e abre no item, com a moldura na cor da raridade (cinza, azul, roxo), vibração de sucesso e um brilho sonoro.
- Save: `inventory: { gear, equipped: { HEAD, WEAPON, CAPE, CHARM }, potions, fragments, upgrades: { [GearId]: passos } }` e `weeklyBoss: { weekKey, wins, beatenWeek, triedOn }` (YYYY-MM-DD). Item inventado, repetido, vestido sem ter ou aprimoramento acima do épico é descartado na leitura.

## Bestiário (`bestiary.ts`)

Aba **Bestiário** na folha do herói: os 5 monstros dos cômodos e os 4 chefes, com quantas vezes cada um foi vencido, uma frase de cada e os dois jeitos de lutar (o que ainda não apareceu fica "ainda não visto"). Quem nunca foi vencido aparece em silhueta e "???". O jeito conta como visto mesmo na derrota; a vitória só na vitória. Save: `bestiary: { defeats: { STUDY… }, elites, bosses: { clutter: 1 }, traits: [EnemyTraitId] }`.

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

`npx tsx scripts/simulate-battles.ts especiais` simula elite (difícil) e chefe, com 2 águas e 1 café:

| | Nível 3 | Nível 5 | Nível 8 |
|-|---------|---------|---------|
| Elite (difícil) | 60–68% | 39–88% | 60–84% |
| Chefe | 64–99% | 83–91% | 59–99% |

No nível 2 o chefe venceria quase sempre o Mago e o Ladino (pouca vida para uma luta longa); por isso ele só aparece no nível 3.

O que mudou nesse ajuste: difícil começa mais baixo (vida 50, atributos 4) e sobe a cada nível; o Ladino ganhou esquiva +10 (passiva), Atalho mais forte e que rouba 25% do dano, e Lembrete Chato incomoda mais; Lista Riscada e Avalanche bateram um pouco menos. Pontos fracos que ficam por escolha: Ladino contra Distração (dano mental, a esquiva não ajuda) e Guerreiro contra Caos (o dano acumulado pune lutas longas). O jogador real usa Respirar Fundo e escudo; o simulado não, então os números reais tendem a ser melhores.

## Arte e efeitos

- Heróis são pessoas comuns: Guerreiro de bandana com vassoura e tampa de panela, Mago estudante de óculos com café e agenda, Ladino de boné, moletom e mochila.
- Personagens modelados no Blender por código (formas estilizadas, sombreamento toon em 3 faixas, contraluz e contorno de casco invertido). Fonte: `assets/blender/sources/battle-characters.blend` (no Git LFS); o kit está no texto `qlkit` e as poses no texto `qlpose`.
- **Poses:** cada personagem tem 6 quadros com a câmera fixa: parado, preparo, golpe, apanhando, vitória e nocaute. As partes do corpo giram em volta do ombro e dos pés (`hero_pose`, `enemy_pose`), e o golpe aponta para o adversário na tela. Variações: herói com cada chapéu (5), monstro de elite, os quatro chefes e cada um na fase 2, mais as camadas de capa (3) e arma (3) de cada herói (texto `qllayers`, função `hero_batch`). São 325 quadros 640×640 em WebP (~5,2 MB) em `mobile/assets/actors/`, mais retratos recortados em `actors/portrait/` e ícones dos itens em `mobile/assets/items/`. Com capa ou arma, o retrato é montado a partir do quadro parado.
- `scripts/gen-actor-art.py` converte os PNG do Blender em WebP e gera `src/components/actorArt.ts` (registro com `require` estático). `CharacterArt` usa o retrato fora da luta e, na arena (`mode="stage"`), deixa as 6 poses montadas e mostra só a atual: a troca não pisca. O `ActorStage` troca a pose no mesmo tempo da animação (preparo → golpe → parado; apanha ao levar dano; braços para cima em golpe em si mesmo; vitória e nocaute no fim).
- **Cenários (v2):** 5 cômodos inteiros com luz de verdade: quarto de estudo à noite (estante, janela com lua, varal de luzinhas, escrivaninha com notebook e luminária), escritório no pôr do sol (janelão com prédios, dois monitores, pilhas de papel), academia em casa de manhã (sol entrando, tapete de yoga, halteres), cozinha à tarde (pia com louça, geladeira com ímãs, cesto de roupa) e parque à noite (pinheiros, poste, vaga-lumes). Materiais com luz (Principled), EEVEE com sombras e raytracing, brilho no compositor e AgX. Kit no texto `qlkit2` do `.blend`, raízes `arena2_*`, função `arena_render`. Saída 1080×1350 JPEG (~100–130 KB) em `mobile/assets/battle/arena-*.jpg`.
- **Tela da luta:** a arena vai de ponta a ponta até o topo, com degradê escuro em cima (para a placa do monstro) e embaixo (para fundir com o painel). Em cima: placa do monstro (nome, vida com marcas a cada 10, nível, jeito próprio, status) e o turno. Embaixo: legenda da ação, barra do herói (vida e energia lado a lado) e os 6 golpes em cartões com ícone grande, custo no canto do ícone e recarga em cima do ícone. O painel reserva 352 de altura; a arena fica com o resto (300–560). Personagens: herói até 220, monstro 6% maior.
- **Golpe do herói:** recua e encolhe (preparo, 150 ms), estica no avanço, o objeto do golpe sai com rastro (`SkillCast.tsx`), e no alvo: clarão, onda de choque, linhas de impacto e partículas no padrão do elemento (estouro, faíscas que sobem, cacos de gelo, bolhas, fumaça, anel). O alvo pisca branco (cópia da silhueta com `tintColor`), recua e achata. Crítico: tudo maior, número com "CRÍTICO", clarão na arena inteira e tremida.
- **Escudo** vira uma bolha em volta do lutador enquanto durar. **Travado** mostra estrelinhas girando. Cura e bônus dão um brilho verde. Sombra no chão acompanha pulos e investidas.
- **Começo e fim:** faixa "Fulano apareceu!" cruza a arena; monstro desce e herói entra pela esquerda. O resultado espera a última animação; na vitória, raios girando, confete e o XP contando.
- **Trilha** (`platform/battleMusic.ts`): um loop por arena e um de cada chefe (`boss`, `boss-clutter`, `boss-couch`, `boss-meeting`), gerados por `scripts/gen-music.py` (numpy + ffmpeg, MP3 64 kbps, 108–193 KB). Entra e sai com fade e abaixa no resultado. Ajustes → Música da batalha: desligada, baixa, média (padrão) ou alta; o volume alto fica abaixo dos efeitos.
- **Som e vibração** (`platform/battleCues.ts`): sons curtos gerados por código em `mobile/assets/sfx/` (golpe, crítico, cura, escudo, deslocamento; `scripts/gen-sfx.py` gera os das poses: impulso no preparo, queda no nocaute, sino no jeito do monstro e na troca de fase, brilho do baú). Vibração leve ao bater, média ao apanhar e quando o jeito do monstro age, forte no crítico e no nocaute, de sucesso quando o baú abre. Som só com Ajustes → Som ligado; os tocadores são criados antes da luta (`warmBattleSounds`).
- **Pré-carga** (`platform/preloadArt.ts`): 1,5 s depois de abrir o app, as poses do herói vestido, dos 5 monstros e do chefe da semana são baixadas (`expo-asset`). No Expo Go cada quadro vem do Metro na primeira vez; sem isso a primeira troca de pose podia piscar.
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

- Para ver o chefe rápido: herói no nível 3 ou mais e 5 vitórias na semana.
- Fácil com o ataque grátis → vence. Difícil no nível 1 pede estratégia (escudo, Respirar Fundo).
- Segure um golpe para ler o que ele faz. Use Respirar Fundo ou escudo quando a vida cair.
- No nível 2, abra a folha do herói → Talentos e aprenda o primeiro talento; em Golpes, troque o que vai para a luta.
- Depois da luta, a vida na tela principal fica como terminou e sobe com o tempo.

## Arte dos heróis (v2)

Os 7 heróis são montados pelos textos `qlhero` (corpo: olhos com íris, pupila e dois brilhos, sobrancelha, boca, bochechas, mão com polegar, tênis com sola e cadarço) e `qlhero_cls` (cabelo, roupa e objetos de cada classe) dentro de `battle-characters.blend`. `hero_batch2(root)` renderiza as 12 variantes × 6 poses de um herói; `scripts/gen-actor-art.py` converte para `assets/actors`. Os ícones dos golpes das classes novas vêm do texto `qlprops` (`render_prop`).
