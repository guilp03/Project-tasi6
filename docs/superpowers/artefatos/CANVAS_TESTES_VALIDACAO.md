> ⚠️ Conteúdo deduzido indutivamente a partir de `docs/CANVAS_EXPERIMENTO.md`, `docs/RELATORIO_SEGURANCA_APPSEC.md` e `tests/`. Revisar antes da entrega final.

# Canvas de Testes e Validação

## Testes funcionais
- Suite Vitest com 77 testes em 12 arquivos cobrindo `LLMIntegrationService`, `ReportGenerator`, `GitHubExtractorService`, `AnalysisRepository` e comandos CLI.
- Testes de roteamento ADR-005 (regex de segurança, threshold 30k tokens).
- Testes de parsing seguro de JSON (`parseJSONSafely`).
- Testes de CRUD MongoDB com `mongodb-memory-server`.

## Testes de qualidade dos outputs do LLM
- 8 cenários do Canvas de Experimento (novo endpoint, auth, variável de ambiente, refatoração, infraestrutura, doc atualizada, estilo, mudança sensível parcial).
- Meta: ≥ 80 % de precisão na detecção de gaps; 0 falsos negativos em segurança.

## Edge cases
- Diff vazio → interrompe com mensagem "Nenhuma alteração de código detectada."
- ObjectId inválido → retorna `null` sem exceção.
- Diff > 32k tokens → roteia para Gemini ou trunca com alerta.
- Resposta JSON malformada → fallback conservador.

## Performance / latência
- Meta: fluxo completo < 30 segundos por PR.
- Ainda não medido end-to-end contra APIs reais (projeção baseada em mocks).

## Alucinação e mitigação
- Prompt força justificativa para cada gap.
- Structured output JSON reduz variabilidade.
- `parseJSONSafely` retorna estado conservador em falhas.
- Regras determinísticas de roteamento elevam criticidade mínima para auth/infra/secrets independentemente da LLM.