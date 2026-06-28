> ⚠️ Conteúdo deduzido indutivamente a partir de `docs/Missao.MD`. Revisar antes da entrega final.

# Métricas de Sucesso

| Métrica | Alvo | Tipo | Como medir |
|---|---|---|---|
| Tempo médio por análise | < 30 segundos | Técnico | Cronometrar execução da CLI de fetch até relatório |
| Precisão na detecção de gaps | > 90 % | Técnico | Comparar saída da IA com resultado esperado nos 8 cenários do Canvas de Experimento |
| Custo por análise | < US$ 0,02 | Negócio/Técnico | Tokens in/out × preço do provedor usado |
| Redução de tempo manual | > 80 % | Negócio | Tempo humano estimado sem IA vs com IA |
| Falsos negativos em segurança | 0 % | Técnico/Compliance | Nenhuma mudança crítica (auth, infra, secrets) deve passar sem sinalização |
| Clareza do relatório | Compreensível sem explicação extra | Negócio | Avaliação humana pelo PMO (persona Carolina) |