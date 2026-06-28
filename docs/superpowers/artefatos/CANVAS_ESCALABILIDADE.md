> ⚠️ Conteúdo deduzido indutivamente a partir do `ESCOPO_MVP_ATUALIZADO.md` (não-features) e lições do workflow. Revisar antes da entrega final.

# Canvas de Escalabilidade

## Eixo técnico
- Integrar como GitHub Actions oficial (webhook de PR).
- Implementar redaction/mascaramento de secrets antes do envio à LLM.
- Adicionar fallback para modelos maiores (Claude/GPT-4) quando contexto exceder 128k.
- Fragmentar análise por arquivo para PRs muito grandes.

## Eixo de produto
- Dashboard web para PMO consultar histórico de auditorias.
- Notificações em Slack/e-mail para gaps críticos.
- Suporte a múltiplos formatos de documentação (Swagger/OpenAPI, Confluence, Wiki).
- Feedback learning: usar histórico MongoDB para refinar prompts.

## Eixo de adoção
- Publicar como Action no GitHub Marketplace.
- Suporte a múltiplas linguagens e frameworks.
- Modo SaaS com múltiplos repositórios e times.

## Próximos 3 passos (pós-MVP)
1. Validar end-to-end com APIs reais e ajustar threshold de roteamento.
2. Implementar redaction de secrets e fail-closed para criticidade Crítica.
3. Criar workflow de GitHub Actions e publicar resumo sanitizado no PR.