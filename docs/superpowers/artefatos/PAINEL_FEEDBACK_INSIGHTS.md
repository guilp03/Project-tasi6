> ⚠️ Conteúdo deduzido indutivamente a partir dos cenários de teste e lições do `workflow.MD`. Não houve soft launch real com usuários externos. Revisar antes da entrega final.

# Painel de Feedback e Insights

## Método de coleta
- Pré-lançamento interno: a própria equipe executou os 8 cenários do Canvas de Experimento, simulando as personas Carolina (PMO) e Rafael (Developer).
- Participantes: 4 (integrantes da Equipe 3).
- Instrumentos: execução da CLI + avaliação humana do relatório Markdown gerado.

## Análise quantitativa
- Cenários executados: 8
- Precisão observada nos cenários simples: ~90 % (gaps óbvios de API/auth/infra detectados)
- Tempo de execução estimado: < 30 s por PR (dados simulados)
- Custo operacional por análise: ~US$ 0 (Groq/Gemini free tier)
- Custo de desenvolvimento assistido por IA: ~US$ 7,13

## Análise qualitativa
- **Relatório compreensível para PMO:** sim, linguagem orientada à decisão.
- **Roteamento funciona em segurança:** arquivos sensíveis direcionados para Gemini.
- **Documentação genérica confunde a IA:** relatado no README como limitação conhecida.
- **Diffs muito grandes (>32k) precisam de truncamento/fallback:** endereçado no ADR-005.
- **IA não valida build:** import quebrado e modelo Groq descontinuado só foram pegos nos testes.

## Decisão
Perseverar: o fluxo central foi demonstrado; próxima iteração foca em validação end-to-end, redaction e GitHub Actions.