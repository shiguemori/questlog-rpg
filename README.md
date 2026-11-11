# QuestLog (`questlog-rpg`)

App mobile Shiguemori que transforma tarefas reais em quests de RPG. Display name: **QuestLog**. Repo: **questlog-rpg**.

## Loop MVP

Onboarding (nome + classe) → registrar quest → concluir → XP / streak.

Critério de pronto: **abre no celular e joga ~2 minutos**.

## Estrutura

```text
mobile/     Expo (iOS + Android) — app principal
web/        Protótipo Vite legado (referência)
docs/       Palácio enxuto
assets/     placeholders + pipeline Blender (congelado)
```

## Rodar

```bash
cd mobile
npm install
npm start          # Expo Go / emulador
npm test           # domínio XP
npm run typecheck
```

Protótipo web (opcional): `cd web && npm install && npm run dev`.

## Docs

Comece em [`docs/README.md`](docs/README.md). Plano longo: [`PRODUCT_PLAN.md`](PRODUCT_PLAN.md). Agentes: [`AGENTS.md`](AGENTS.md).

## Repo

https://github.com/shiguemori/questlog-rpg
