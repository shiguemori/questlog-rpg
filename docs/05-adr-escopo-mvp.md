# ADR — Escopo MVP

**Status:** aceito (council 2026-11-11)  
**Contexto:** App novo; risco de documentação-teatro e fábrica de assets antes de jogabilidade.

## Decisão

1. Um único loop jogável (onboarding → log de quest).
2. Palácio ≤ ~8 docs curtos; `PRODUCT_PLAN.md` permanece e evolui.
3. Blender = pastas + contrato de naming; zero produção de mesh agora.
4. Stack: Expo (iOS+Android); protótipo Vite fica em `web/` como referência.
5. Sem OCR, IA, sync cloud, social no MVP.

## Consequências

- Entrega medida por “2 minutos no celular”, não por pages de brand.
- Assets 3D entram só depois do loop estável + CI verde.

Próximo: [pipeline Blender](06-pipeline-blender.md).
