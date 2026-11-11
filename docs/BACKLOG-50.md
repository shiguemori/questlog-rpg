# Backlog 50 — QuestLog

50 itens priorizados (P0 → P3) para o app mobile. Cada um tem critério de aceite curto.

**Status**

- **FEITO** — código no `main` com testes automatizados verdes (domínio, integração e/ou componente). Ainda falta a conferência em aparelho: ver [checklist manual](MANUAL-TEST-CHECKLIST.md).
- **TODO** — só backlog, nada implementado.

**Contagem:** 10 fixes · 22 melhorias · 18 features. **34 FEITO · 16 TODO.**

Regra fixa para tudo abaixo: o anti-farm (XP só 1 min após criar a quest; máx. 10 quests com XP por dia) não pode ser enfraquecido.

## P0 — Bugs que quebram o loop (7/7 feitos)

| # | Tipo | Área | Item | Critério de aceite | Status |
|---|------|------|------|--------------------|--------|
| 1 | Fix | Android/iOS | AsyncStorage fixado em `2.2.0` (a versão do SDK 58 / Expo Go) e pacotes Expo alinhados | `npx expo install --check` responde "Dependencies are up to date"; lockfile resolve `async-storage@2.2.0` | FEITO |
| 2 | Fix | Qualidade | Armazenamento protegido: carregamento tardio do módulo + espelho em memória | Com o módulo nativo nulo o app abre, joga e mostra aviso de "não está salvando"; nenhum crash | FEITO |
| 3 | Fix | UX | Barra de XP preenche ao ganhar XP | Concluir quest com XP muda a largura da faixa para `xp/maxXp`; valor certo mesmo com animação interrompida | FEITO |
| 4 | Fix | Gamificação | Barra no level up enche até 100% e recomeça | Ao subir de nível a barra termina na fração do novo nível, nunca "anda para trás" nem estoura | FEITO |
| 5 | Fix | Qualidade | Gravação segura do save | `save` nunca rejeita; só grava depois de carregar; rajada de gravações termina com o estado mais recente; não regrava conteúdo idêntico | FEITO |
| 6 | Fix | Produto | Dia do jogador pelo relógio do aparelho (antes era UTC) | Quest concluída às 23h30 locais conta no dia local; streak e limite diário viram à meia-noite local | FEITO |
| 7 | Fix | UX | Concluir quest antes de 1 min deixa claro que não dá XP | Linha mostra "XP libera em Ns"; tocar em "Feito" antes disso pede confirmação "Concluir sem XP?" | FEITO |

## P1 — Alto impacto (18/18 feitos)

| # | Tipo | Área | Item | Critério de aceite | Status |
|---|------|------|------|--------------------|--------|
| 8 | Melhoria | Qualidade | Validação e migração do save ao carregar | Save antigo ou com campos inválidos vira estado jogável; save ilegível recomeça limpo e fica guardado em chave de backup | FEITO |
| 9 | Fix | Qualidade | XP nunca trava nem estoura | `maxXp` inválido não gera loop infinito; XP acima do teto vira níveis reais ao carregar | FEITO |
| 10 | Feature | Gamificação | Folha do herói com gasto de pontos de atributo | Com pontos disponíveis, "+" aumenta o atributo e reduz 1 ponto; sem pontos, botão desabilitado | FEITO |
| 11 | Feature | UX | Excluir quest | "×" na linha pede confirmação; ao confirmar a quest some e XP/streak não mudam | FEITO |
| 12 | Feature | Gamificação | 8 conquistas (XP total, streak, nível) | Desbloqueiam só com XP real, nível ou dias distintos; quest sem XP não desbloqueia nada; aviso ao desbloquear | FEITO |
| 13 | Feature | Produto | Estatísticas da jornada | Folha mostra XP total, quests concluídas, streak atual e melhor streak | FEITO |
| 14 | Melhoria | UX | Resumo do dia no cabeçalho | Mostra "Streak Nd" e "XP hoje N/10"; ao bater 10 aparece aviso de limite diário | FEITO |
| 15 | Fix | Android/iOS | Área segura real | Conteúdo não fica sob a barra de status nem sob a barra de gestos; botão "+" respeita a borda inferior | FEITO |
| 16 | Fix | UX | Teclado não cobre formulários | Modal de criação sobe com o teclado; onboarding rola em telas pequenas | FEITO |
| 17 | Melhoria | UX | Validação de título com erro contextual | Título vazio/curto/longo mostra a mensagem embaixo do campo; contador `n/60` | FEITO |
| 18 | Melhoria | Acessibilidade | Barra de XP legível por leitor de tela | Papel `progressbar` com valor "Nível N, X de Y XP" | FEITO |
| 19 | Melhoria | Acessibilidade | Anúncios para leitor de tela | Quest registrada, XP ganho, XP negado e level up são anunciados | FEITO |
| 20 | Melhoria | Acessibilidade | Papéis e rótulos corretos | Classe, categoria, dificuldade e filtro são `radio`; botões têm rótulo descritivo; alvos ≥ 44pt | FEITO |
| 21 | Melhoria | Acessibilidade | "Reduzir movimento" reativo; overlays sem espera | Com a opção ligada só há fade; cards de vitória/level up nunca ficam invisíveis esperando o sistema | FEITO |
| 22 | Melhoria | Gamificação | Resposta háptica | Um háptico por ação: sucesso ao ganhar XP/level up, alerta ao ficar sem XP, toque leve ao gastar ponto; falha em silêncio | FEITO |
| 23 | Melhoria | Performance | Lista de quests virtualizada | `SectionList` com linha memoizada; contador de 1 s só roda em quests em espera | FEITO |
| 24 | Melhoria | Qualidade | ESLint no CI e testes no typecheck | `npm run lint` com zero avisos; `tsc` também checa arquivos de teste | FEITO |
| 25 | Melhoria | Qualidade | Suíte de testes ampliada | Domínio + integração (node:test) e componente/fluxo (jest-expo + Testing Library) rodam em `npm test` e no CI | FEITO |

## P2 — Valor claro, sem urgência (9 feitos · 11 TODO)

| # | Tipo | Área | Item | Critério de aceite | Status |
|---|------|------|------|--------------------|--------|
| 26 | Feature | Gamificação | Vilão por categoria | Estudo → Distração, Trabalho → Caos, Saúde → Preguiça, Casa → Bagunça, Outro → Sombra | FEITO |
| 27 | Feature | Gamificação | Título do herói por nível | Aprendiz (1) → Aventureiro (3) → Veterano (6) → Campeão (10) → Lenda (15) | FEITO |
| 28 | Feature | Produto | Reiniciar jornada | Confirmação destrutiva; apaga o save e volta ao onboarding | FEITO |
| 29 | Melhoria | Qualidade | Tela amigável para erro inesperado | Erro de renderização mostra "Algo deu errado por aqui" + "Tentar de novo" | FEITO |
| 30 | Melhoria | UX | Esqueleto no carregamento | Boot mostra silhueta da tela em vez de spinner | FEITO |
| 31 | Melhoria | UX | Histórico de concluídas enxuto | Mostra 5; "Ver todas (N)"; "Limpar concluídas" com confirmação | FEITO |
| 32 | Melhoria | UX | Estado vazio com ação | Sem quests abertas aparece texto + botão "Criar quest" | FEITO |
| 33 | Melhoria | Qualidade | Teto de 50 quests abertas e IDs únicos | 51ª quest aberta é recusada com mensagem; IDs não colidem no mesmo milissegundo | FEITO |
| 34 | Melhoria | Produto Shiguemori | Assinatura do produto | Rodapé da folha: "QuestLog v{versão} · Shiguemori" | FEITO |
| 35 | Feature | UX | Editar quest | Trocar título/categoria; dificuldade trava após criar (não burla XP) | TODO |
| 36 | Feature | UX | Desfazer conclusão acidental | Por 5 s dá para desfazer; XP, streak e contagem diária voltam ao valor anterior | TODO |
| 37 | Feature | Gamificação | Quests recorrentes (diárias) | Quest diária reaparece no dia seguinte; segue limite de 10/dia | TODO |
| 38 | Feature | Produto | Lembrete diário local | Notificação no horário escolhido; funciona sem backend (validar limites do Expo Go) | TODO |
| 39 | Feature | Produto | Exportar/importar save | Gera JSON e restaura passando pela mesma validação do carregamento | TODO |
| 40 | Feature | UX | Renomear herói e pular onboarding | "Pular" cria herói padrão; nome/classe editáveis na folha | TODO |
| 41 | Melhoria | UX | Cena do vilão só em momentos raros | 1ª quest do dia e quests difíceis mostram a cena; as demais, aviso discreto | TODO |
| 42 | Melhoria | Performance | Animações em Reanimated 4 | Press feedback e overlays rodam na thread de UI; sem regressão no Expo Go | TODO |
| 43 | Melhoria | Android/iOS | Auditoria de plataforma | Fonte grande (200%) sem cortes; voltar/gesto preditivo fecha modais no Android | TODO |
| 44 | Melhoria | Qualidade | Prettier no CI | `prettier --check` verde com config versionada | TODO |
| 45 | Melhoria | Qualidade | Cobertura mínima no CI | Domínio ≥ 90% de linhas; CI falha abaixo disso | TODO |

## P3 — Depois do MVP (0 feitos · 5 TODO)

| # | Tipo | Área | Item | Critério de aceite | Status |
|---|------|------|------|--------------------|--------|
| 46 | Feature | Gamificação | Atributos com efeito | Atributo da categoria dá bônus pequeno de XP, com teto e teste de equilíbrio | TODO |
| 47 | Feature | Gamificação | Bônus de streak | A partir de 3 dias, bônus de XP limitado; não fura o limite diário | TODO |
| 48 | Feature | Android/iOS | Build EAS com ícone e splash finais | Build interno instalável (TestFlight / Play interno) | TODO |
| 49 | Feature | Produto | Conta e sincronização em nuvem | Fora do MVP (ADR 05); só após o loop validado | TODO |
| 50 | Feature | Produto Shiguemori | Avatar 3D (Blender) | Congelado; placeholder geométrico segue valendo | TODO |

## Onde está cada coisa

- Domínio puro: `mobile/src/domain/` (`xpBar`, `dates`, `quests`, `progression`, `state`, `antiFarm`, `completeQuest`, `victory`, `xp`).
- Persistência: `mobile/src/storage/` (`stateStore` = regra; `persist` = ligação com o aparelho).
- Testes: `*.test.ts` (node:test) e `mobile/src/__tests__/*.spec.tsx` (Jest).
