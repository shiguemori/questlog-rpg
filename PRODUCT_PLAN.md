# QuestLog (`questlog-rpg`): Product Discovery & Planning

> Repo/pacote: `questlog-rpg`. Display: **QuestLog**. Marca: Shiguemori.  
> Palácio enxuto: [`docs/README.md`](docs/README.md). App principal: `mobile/` (Expo).

## A) Visão do Produto & Persona Principal

**Visão do Produto:**
O QuestLog transforma a gestão de tarefas mundanas em uma jornada épica de RPG. O objetivo é gamificar a produtividade diária, tornando a conclusão de hábitos e obrigações uma fonte de gratificação imediata através de XP, evolução de personagem e validação social. Diferente de apps de tarefas comuns, o QuestLog foca no "sentimento de progressão" e na "competição saudável", transformando a disciplina em um jogo onde o jogador é o herói da sua própria vida.

**Persona Principal:**
*   **Nome:** Lucas, o "Aventureiro Desorganizado".
*   **Perfil:** Jovem profissional ou estudante de 20-35 anos, fã de RPGs/Games, que sente dificuldade em manter constância em hábitos saudáveis (estudo, academia, leitura) usando métodos tradicionais.
*   **Dor:** Sente que listas de tarefas são chatas e punitivas.
*   **Motivação:** Busca dopamina rápida ao concluir tarefas e quer se sentir parte de uma guilda onde o progresso dele é visto e valorizado por amigos.

---

## B) Loops do Jogo (Core & Secondary)

**Core Loop (O Ciclo de Hábito):**
1.  **Gatilho:** Notificação de "Nova Quest" ou rotina diária.
2.  **Ação:** Concluir uma tarefa na vida real (ex: Beber 2L de água).
3.  **Recompensa:** XP imediato, som de "Level Up", moedas virtuais e animação visual de conquista.
4.  **Investimento:** Alocar pontos de atributo (Força, Inteligência, etc) e ver o personagem subir no ranking.

**Loop Secundário (Social/Competitivo):**
1.  **Social:** Ver o progresso de um amigo no feed -> Sentir motivação/inveja saudável -> Criar/Concluir mais Quests.
2.  **Desafio:** Aceitar um "Duelo de Hábitos" 1v1 -> Competir por 7 dias -> Ganhar título exclusivo.

---

## C) Lista de Features por Prioridade

### MVP (Mínimo Produto Viável)
- [ ] Cadastro de tarefas (Quest) com Dificuldade (Fácil, Médio, Difícil).
- [ ] Sistema de XP e Level Up (Baseado no `constants.ts` atual).
- [ ] Atributos de Personagem (Força, Agilidade, Inteligência, Vitalidade).
- [ ] Dashboard visual com tema Slate/Amber.
- [ ] Persistência local (LocalStorage/SQLite offline-first).
- [ ] Streak diária (Foguinho de constância).

### V1 (Social & Sincronização)
- [ ] Autenticação (Login com Social/Email).
- [ ] Sincronização Cloud (Backup de dados).
- [ ] Lista de Amigos (Adicionar via @username).
- [ ] Feed de Atividades (Ver quem subiu de nível).
- [ ] Ranking Semanal (Global e entre amigos).

### V2 (Avançado & Economia)
- [ ] Loja de Cosméticos (Equipar itens no avatar).
- [ ] Desafios de Grupo (Guildas para derrotar "Chefões" através de tarefas coletivas).
- [ ] Estatísticas Avançadas (Gráficos de produtividade por categoria).
- [ ] Notificações Push inteligentes (lembretes baseados em IA).

---

## D) Fluxos e Telas do App

**1. Onboarding:**
- Tela de boas-vindas épica -> Seleção de Classe (Guerreiro, Mago, Ladino) -> Criação do nome do Herói -> Tutorial rápido de como criar a primeira Quest.

**2. Home (QuestLog):**
- Top bar com Streak e Level -> Lista de Quests do dia -> Filtros por Categoria (Work, Health, Study). Estética Slate com acentos em Amber para ações principais.

**3. Criar/Editar Quest:**
- Modal simples: Nome da Quest, Seleção de Categoria (Ícones), Seletor de Dificuldade (Impacta XP).

**4. Concluir Quest:**
- Se o anti-farm libera XP, abre batalha por turnos ([docs/07-batalha-turnos.md](docs/07-batalha-turnos.md)). Vitória: XP integral. Derrota: a quest conclui, com metade do XP base e sem bônus. Sem XP: aviso curto, sem luta.
- Depois do resultado a barra de XP sobe. Se subir de nível, overlay de "LEVEL UP".

**5. Perfil do Personagem (Hero):**
- Visualização do Avatar -> Distribuição de pontos de atributo -> Histórico de Títulos e Conquistas.

**6. Social (Guilda):**
- Lista de amigos com seus respectivos níveis e classes -> Botão para "Dar um Cheer" (incentivo).

**7. Ranking (The Hall of Fame):**
- Lista vertical com os top players da semana, destacando a posição do usuário.

---

## E) Modelo de Dados Sugerido (NoSQL ou Relacional)

**Coleção/Tabela: Users**
- `id`: UUID (PK)
- `username`: String (Unique)
- `email`: String
- `character_class`: Enum (WARRIOR, MAGE, ROGUE)
- `level`: Integer
- `xp`: Integer
- `streak`: Integer
- `total_tasks_completed`: Integer
- `last_active`: Timestamp

**Coleção/Tabela: Tasks (Quests)**
- `id`: UUID (PK)
- `user_id`: UUID (FK)
- `title`: String
- `category`: Enum (STUDY, WORK, HEALTH, HOME, OTHER)
- `difficulty`: Enum (EASY, MEDIUM, HARD)
- `is_recurring`: Boolean
- `completed`: Boolean
- `due_date`: Timestamp
- `created_at`: Timestamp

**Coleção/Tabela: Friendships**
- `id`: UUID
- `user_id_1`: UUID
- `user_id_2`: UUID
- `status`: Enum (PENDING, ACCEPTED)

---

## F) APIs Principais (Contratos Resumidos)

**1. Quest Management**
- `GET /quests`: Lista quests do dia do usuário.
- `POST /quests`: Cria nova quest (Payload: title, category, difficulty).
- `PATCH /quests/{id}/complete`: Marca como concluída e retorna o XP ganho.

**2. Character/Profile**
- `GET /profile/{username}`: Retorna dados do personagem e atributos.
- `POST /profile/allocate-attribute`: Distribui pontos ganhos no level up.

**3. Social**
- `GET /social/ranking`: Retorna o top 50 global ou amigos.
- `POST /social/friends/request`: Envia convite de amizade.

---

## G) Arquitetura Recomendada

**Stack Principal:**
- **Frontend:** React Native (Expo) - Permite desenvolvimento rápido cross-platform.
- **Backend:** Supabase (PostgreSQL + Auth + Realtime) - Ideal para prototipagem rápida e sync em tempo real.
- **Estilo:** Tailwind CSS (NativeWind) - Para manter a consistência visual do protótipo atual.

**Estratégia Offline-First:**
1.  **Local Storage:** Usar `TanStack Query` (React Query) com persistência local.
2.  **Sync:** O app funciona offline salvando no DB local (SQLite/AsyncStorage). Ao detectar conexão, sincroniza as mutações pendentes com o Supabase.
3.  **Optimistic UI:** Ao marcar uma quest, o XP sobe instantaneamente no UI antes mesmo da confirmação do servidor.

---

## H) Regras de Gamificação

**Sistema de XP (Base):**
- **Fácil:** 10 XP
- **Médio:** 25 XP
- **Difícil:** 50 XP
- *Por que:* Valores baixos para evitar inflação rápida, mas com saltos significativos para tarefas difíceis.

**Progressão (Level Up):**
- Fórmula: `MaxXP = 100 * (1.5 ^ (Level - 1))`
- Recompensa: +2 Pontos de Atributo por nível.

**Streak (Multiplicador):**
- 3 dias: 1.1x XP
- 7 dias: 1.25x XP
- 30 dias: 1.5x XP (Título "O Incansável")

**Anti-Abuso:**
- Limite de 10 Quests concluídas por dia para ganho de XP (previne farm artificial). Derrota na batalha também gasta uma vaga quando há XP.
- Quests concluídas em menos de 1 minuto após criação não geram XP (exceto se forem recorrentes) e não abrem batalha.

---

## I) Métricas e Analytics

**Ativação:**
- % de usuários que criam a primeira Quest nos primeiros 5 minutos.
- % de usuários que completam o Onboarding.

**Retenção:**
- Retention D1, D7 e D30 (Vital para apps de hábito).
- "Streak Recovery": Quantos usuários voltam após perder uma streak.

**Engajamento:**
- Média de Quests concluídas por usuário/dia.
- % de usuários que acessam a aba "Hero" para distribuir pontos.

**Social:**
- Média de amigos por usuário.
- % de cliques no ranking.

---

## J) Riscos e Mitigação

1.  **Risco: Perda de interesse após o "brilho inicial".**
    - *Mitigação:* Implementar sistema de temporadas (Season Pass gratuito) com recompensas limitadas no tempo.
2.  **Risco: Abuso/Farm de XP.**
    - *Mitigação:* Limites diários e validação de tempo (conforme Seção H).
3.  **Risco: Interface Poluída.**
    - *Mitigação:* Design Minimalista (Foco total na lista de tarefas na Home).
4.  **Risco: Privacidade Social.**
    - *Mitigação:* Opção de "Perfil Privado" onde apenas o nível e classe aparecem no ranking, sem os nomes das tarefas.

---

## K) Checklist de Implementação MVP (Próximos Passos)

1.  [x] **Expo shell:** `mobile/` com onboarding (nome + classe) → quest log.
2.  [x] **Domínio XP/streak:** `mobile/src/domain/` + testes.
3.  [x] **Persistência mobile:** AsyncStorage (`QUESTLOG_RPG_MOBILE_V1`).
4.  [ ] **Validar 2 min no dispositivo** (Expo Go / emulador).
5.  [x] **Overlay de Level Up** no mobile.
6.  [x] **Categorias na UI** (Study, Health, etc).
7.  [x] **Anti-Abuso:** cooldown / limite diário de XP.
8.  [ ] **Blender:** só após loop estável — ver `docs/06-pipeline-blender.md`.

## L) Concorrentes (pesquisa 2026-11)

| Concorrente | Posicionamento | Implicação MVP QuestLog |
|-------------|----------------|-------------------------|
| **Habitica** | RPG pixel + parties; sync cloud; offline fraco | Diferenciar com **local-first** e loop simples |
| **MainQuest** | Quests + habits + classes + focus timer | Não copiar idle/story mode no MVP |
| **Taskoria** | Boss por location; sem pena por miss | Evitar combate/economia até V2 |
| **Levla** | Idle RPG + 18 skills + guildas | Cortar profundidade de jogo; foco hábito→XP |
| **Habit Quest** | Pixel pet + bosses + Health | Companion/3D só via pipeline Blender depois |
| **Life Quest Journal** | Offline, sem conta, 4.8★ | Validação do corte “abre e joga offline” |

**Corte deliberado:** um loop (onboarding → log → XP). Sem OCR/IA, sem social, sem fábrica de assets.
