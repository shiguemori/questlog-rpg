# Checklist de testes manuais — QuestLog

O que os testes automatizados **não** provam: toque, teclado, áreas seguras, háptico, leitor de tela e o comportamento real do Expo Go. Rode esta lista em **um Android e um iPhone** antes de considerar uma entrega validada.

Marque `[x]` ao passar. Anote aparelho, sistema e versão do Expo Go no fim.

## 0. Preparar

```bash
cd mobile
npm install
npx expo start -c      # -c limpa o cache do Metro (as dependências mudaram)
```

- [ ] Expo Go do aparelho é da **SDK 58** (mesma do projeto).
- [ ] Abrir pelo QR code. Para recarregar: tecla `r` no terminal, ou sacudir o aparelho → **Reload**.
- [ ] Se aparecer erro antigo: fechar o Expo Go à força, abrir de novo e escanear o QR.

## 1. Bugs P0

- [ ] **AsyncStorage:** o app abre sem a tela vermelha "AsyncStorageError: Native module is null".
- [ ] Não aparece a faixa vermelha "O armazenamento do aparelho não respondeu" (se aparecer, o módulo nativo não carregou — anotar).
- [ ] **Barra de XP:** criar "Beber água", esperar o contador zerar, tocar "Feito" → lutar até o monstro cair → Continuar → barra mostra um filete âmbar e o texto `10/100 XP`.
- [ ] Concluir mais quests: a barra cresce a cada uma, proporcional ao texto.
- [ ] Fechar o app por completo e abrir: a barra volta preenchida no mesmo ponto.

## 2. Onboarding

- [ ] "Começar jornada" com nome vazio mostra o erro embaixo do campo (não é botão morto).
- [ ] Com o teclado aberto dá para rolar até o botão.
- [ ] Trocar de classe muda o avatar de prévia.
- [ ] Nome com 24 caracteres não quebra o cabeçalho da tela principal.

## 3. Quests

- [ ] Atalho rápido cria a quest no topo com "XP libera em 60s" contando para baixo.
- [ ] Botão "+" abre o modal; o campo recebe foco e o **teclado não cobre** os botões.
- [ ] Título vazio → "Dê um nome para a quest." embaixo do campo.
- [ ] Filtro por categoria mostra só as quests daquela categoria; "Todas" volta tudo.
- [ ] "×" pede confirmação; "Cancelar" mantém, "Excluir" remove.
- [ ] Com mais de 5 concluídas aparece "Ver todas (N)"; "Limpar concluídas" pede confirmação.
- [ ] Lista com 30+ quests rola sem engasgos.

## 4. Anti-farm (não pode enfraquecer)

- [ ] "Feito" antes de 1 min abre "Concluir sem XP?".
  - [ ] "Esperar" não muda nada.
  - [ ] "Concluir sem XP" marca a quest, mostra "Quest marcada" (sem arena) e o XP **não** sobe.
- [ ] Depois de 1 min o botão fica âmbar cheio e concluir dá XP sem perguntar.
- [ ] Na 11ª quest com XP do dia: cena "Sem recompensa" e aviso de limite diário no cabeçalho (`XP hoje 10/10`).
- [ ] Mudar a data do aparelho para amanhã: contador volta a `0/10` e o streak sobe ao concluir.

## 5. XP, level up e folha do herói

- [ ] Ao fechar 100 XP: batalha vencida → "Level up!" → barra recomeça no novo nível (não fica cheia nem vazia errada).
- [ ] Cabeçalho mostra "+2 pontos"; tocar no herói abre a folha.
- [ ] "+" em um atributo aumenta o número e reduz os pontos; sem pontos o "+" fica apagado.
- [ ] Estatísticas batem com o que foi jogado (XP total, quests, streak, melhor streak).
- [ ] Conquista "Primeira vitória" aparece desbloqueada após o primeiro XP; aviso âmbar no topo ao desbloquear.
- [ ] "Reiniciar jornada" pede confirmação e volta ao onboarding; reabrir o app continua no onboarding.
- [ ] Vilão muda com a categoria (Estudo → Distração, Saúde → Preguiça…).
- [ ] Só curar até a luta acabar: a quest conta, o streak sobe e o XP é a metade da base, sem bônus.
- [ ] Botão voltar no meio da luta não foge; na tela de resultado, fecha.

## 6. Persistência

- [ ] Criar 2 quests, concluir 1, fechar o app à força e abrir: tudo igual.
- [ ] Modo avião não muda nada (app é 100% local).

## 7. Acessibilidade

- [ ] **TalkBack / VoiceOver:** a barra é lida como "Experiência do herói, Nível N, X de Y XP".
- [ ] Ao concluir quest o leitor anuncia o XP ganho (ou o motivo de não ganhar).
- [ ] Chips de categoria/dificuldade/classe são lidos como opção selecionada / não selecionada.
- [ ] **Reduzir movimento** ligado: overlays só fazem fade; a barra salta para o valor final.
- [ ] Fonte do sistema no máximo: nenhum texto essencial cortado (anotar o que cortar — item 43 do backlog).
- [ ] Todos os botões são fáceis de acertar com o polegar (mín. 44pt).

## 8. Específico por plataforma

**Android**

- [ ] Conteúdo não fica sob a barra de status nem sob a barra de gestos; o "+" não encosta na borda.
- [ ] Botão/gesto voltar fecha o modal de criação, o resultado da batalha, a cena sem XP, o level up e a folha do herói. No meio da luta, voltar não foge.
- [ ] Háptico ao ganhar XP (se o aparelho tiver motor).

**iPhone**

- [ ] Notch / Dynamic Island não cobrem o cabeçalho; a barra inferior não cobre o "+".
- [ ] Teclado sobe o modal de criação junto.
- [ ] Háptico de sucesso ao ganhar XP e ao subir de nível.

## 9. Hábito (engajamento)

- [ ] Onboarding mostra "O hábito cabe num minuto" e o botão **Pular** entra com o herói "Herói".
- [ ] Cabeçalho mostra `Meta 0/1`, uma frase de retorno e a semana de 7 dias.
- [ ] Concluir 1 quest (mesmo sem XP, se confirmar) muda para `Meta 1/1` e a frase aponta para amanhã. O XP **não** sobe se foi antes de 1 min.
- [ ] Na cena, "Desfazer" em até 5 s devolve XP, streak e a meta. Depois disso o botão some.
- [ ] Atividades rápidas mostram título, categoria · dificuldade e XP; o filtro de categoria também filtra os atalhos. Depois de criar uma quest, "De novo" repete a última.
- [ ] Cabeçalho: XP e Vida lado a lado; Streak e Meta embaixo do nome; "Semana" e "Chefe" abrem painéis que sobem do rodapé.
- [ ] "Desafios de hoje" recolhe e abre pela seta e lembra a escolha.
- [ ] Criar quest com o teclado aberto: o campo do título continua visível enquanto digita; o resto do formulário rola.
- [ ] Excluir quest, limpar concluídas, devolver pontos e reiniciar jornada usam o diálogo do app (não o do Android).
- [ ] Foco: "Foco" na quest → escolher o tempo → cronômetro em tela cheia, tela acesa, voltar do Android não sai. Bloquear o celular e voltar: o tempo seguiu. No fim, notificação "Foco concluído" e "Concluir quest" abre a batalha. "Desistir" pergunta antes.
- [ ] Batalha: a dica "Como lutar" só aparece na primeira luta; o "?" abre de novo. Segurar um golpe mostra a descrição no meio da tela. Ladino: depois do Lembrete Chato, a Pegadinha fica com borda âmbar e "Combo".
- [ ] Nada disso dispara notificação.

## 10. Visual

- [ ] Paleta Slate/Âmbar em todas as telas (nada roxo, nada branco ou preto puros).
- [ ] Estados cobertos: carregando (esqueleto), vazio (texto + "Criar quest"), erro (faixa vermelha), sucesso (cena / aviso âmbar).

## Registro da rodada

| Data | Aparelho | Sistema | Expo Go | Resultado | Observações |
|------|----------|---------|---------|-----------|-------------|
|      |          |         |         |           |             |
