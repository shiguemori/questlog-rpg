# Publicar no Android (EAS + Play, teste interno)

Objetivo: testar o QuestLog instalado de verdade (fora do Expo Go), com música, vibração e desempenho reais, e depois distribuir para testadores pela Play.

## O que já está pronto no repositório

- `mobile/app.json`: pacote `com.shiguemori.questlog`, `versionCode` 1, ícone adaptativo, splash pelo plugin `expo-splash-screen`, plugins de áudio, notificações e assets.
- `mobile/eas.json`:
  - `preview`: APK de distribuição interna (instala direto no celular por link).
  - `production`: AAB para a Play, com `autoIncrement` do `versionCode`.
  - `submit.production`: envia para a faixa **interna** da Play como rascunho, com a chave em `mobile/keys/play-service-account.json` (a pasta `keys/` fica fora do Git).
- `npx expo-doctor`: 20 de 20 verificações passando (inclui `react-native-worklets`, que o Reanimated 4 exige fora do Expo Go).

## O que depende da sua conta (uma vez)

1. Entrar no Expo: `npx eas-cli@latest login`.
2. Ligar o projeto: na pasta `mobile/`, `npx eas-cli@latest init` (grava o `projectId` no `app.json`).
3. Play Console (conta de organização, D-U-N-S 967462754): criar o app **QuestLog** com o pacote `com.shiguemori.questlog`.
4. Conta de serviço do Google Cloud com acesso à Play Console; baixar o JSON e salvar em `mobile/keys/play-service-account.json`.

## Rodar

APK para instalar direto (sem Play):

```bash
npx eas-cli@latest build -p android --profile preview
```

AAB e envio para o teste interno:

```bash
npx eas-cli@latest build -p android --profile production
```

```bash
npx eas-cli@latest submit -p android --profile production --latest
```

A primeira subida na Play às vezes precisa ser manual (enviar o AAB pelo Console uma vez); depois o `submit` funciona sozinho.

## Conferir no aparelho

Use o [checklist manual](MANUAL-TEST-CHECKLIST.md). O que só o aparelho mostra:

- música de cada arena e dos 4 chefes, e o volume de Ajustes;
- vibração do golpe, do nocaute, da troca de fase e do baú;
- a troca de pose sem piscar num Android mais fraco (a pré-carga baixa as poses 1,5 s depois de abrir o app);
- o tamanho do pacote (as artes somam ~5,4 MB, a música ~1,1 MB).
