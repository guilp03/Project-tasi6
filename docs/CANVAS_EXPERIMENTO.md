# Canvas de Experimento — Auditoria Automatizada de Documentação com IA

**Projeto:** Documentação Automatizada com IA  
**Domínio:** D3 — Documentação Automatizada  
**Checkpoint:** CP2 — Composição  
**Versão:** 1.0  

---

## 1. Hipótese principal

Acreditamos que uma aplicação assistida por IA consegue analisar Pull Requests, identificar mudanças relevantes, comparar essas mudanças com a documentação existente e apontar gaps documentais de forma útil para PMOs, desenvolvedores e responsáveis por segurança.

A hipótese será considerada válida se a ferramenta gerar relatórios claros, com boa precisão na identificação de gaps e sem deixar passar mudanças críticas relacionadas a segurança, autenticação, infraestrutura ou compliance.

---

## 2. Problema a ser validado

Durante o ciclo de desenvolvimento de software, mudanças relevantes em Pull Requests podem não ser refletidas na documentação do projeto.

Isso causa:

- documentação desatualizada;
- retrabalho para desenvolvedores;
- atrasos em releases;
- dependência técnica do PMO em relação ao time de desenvolvimento;
- risco de mudanças críticas passarem sem documentação adequada.

O experimento busca validar se a IA pode atuar como um primeiro filtro confiável para auditoria documental.

---

## 3. Usuários envolvidos

### Usuário primário — PMO / Project Manager / Reviewer

Responsável por verificar se a documentação está consistente antes da aprovação de uma release. Precisa de um relatório rápido, claro e orientado à decisão.

### Usuário secundário — Developer

Responsável por abrir Pull Requests e corrigir ou complementar a documentação quando gaps forem identificados.

### Usuário complementar — Security / Compliance

Interessado em alertas de mudanças sensíveis, especialmente em autenticação, autorização, infraestrutura, variáveis de ambiente e dados sensíveis.

---

## 4. Objetivo do experimento

Validar se o pipeline de análise da aplicação consegue:

1. receber dados de um Pull Request;
2. extrair mudanças relevantes do diff;
3. comparar as mudanças com a documentação existente;
4. detectar gaps documentais;
5. classificar a criticidade dos gaps;
6. gerar relatório estruturado em Markdown;
7. armazenar o resultado da análise em MongoDB.

O experimento não tem como objetivo validar uma solução completa de produção, mas sim testar o fluxo central do MVP.

---

## 5. Experimento proposto

A equipe executará a aplicação sobre um conjunto controlado de Pull Requests simulados ou reais simplificados.

Cada caso de teste deverá conter:

- título do Pull Request;
- descrição do Pull Request;
- lista de arquivos alterados;
- diff ou resumo das mudanças;
- documentação existente relacionada;
- resultado esperado;
- nível de criticidade esperado;
- indicação se a análise deve ou não ser salva no MongoDB.

A aplicação deverá gerar um relatório e persistir a análise no banco.

---

## 6. Fluxo experimental

```text
Entrada do PR
        ↓
PROMPT-001: Extração de mudanças relevantes
        ↓
PROMPT-002: Detecção de gaps documentais
        ↓
PROMPT-003: Classificação de criticidade
        ↓
PROMPT-005: Alerta de mudanças sensíveis
        ↓
PROMPT-004: Geração de relatório estruturado
        ↓
Persistência da análise no MongoDB
        ↓
Avaliação humana do resultado
```

---

## 7. O que será testado

| Área testada | Pergunta de validação |
|---|---|
| Extração de mudanças | A IA entende quais mudanças do PR são relevantes? |
| Detecção de gaps | A IA identifica quando a documentação não cobre a mudança? |
| Criticidade | A IA classifica corretamente mudanças baixas, médias, altas e críticas? |
| Alertas sensíveis | A IA sinaliza segurança, autenticação, infraestrutura e variáveis de ambiente? |
| Relatório | A saída é compreensível para PMO e útil para desenvolvedor? |
| Persistência | O resultado é salvo corretamente no MongoDB? |
| Economicidade | O tempo e custo por análise são aceitáveis para uso recorrente? |

---

## 8. Cenários de teste

### Cenário 1 — Novo endpoint de API sem documentação

**Entrada:** PR adiciona um endpoint `POST /api/v1/auth/login`, mas a documentação de API não foi atualizada.

**Resultado esperado:** Gap documental identificado com criticidade alta.

---

### Cenário 2 — Mudança em autenticação

**Entrada:** PR altera regra de autenticação ou autorização sem atualização no README ou documentação técnica.

**Resultado esperado:** Gap crítico identificado. A ferramenta deve sinalizar risco de segurança/compliance.

---

### Cenário 3 — Nova variável de ambiente

**Entrada:** PR adiciona uma variável `JWT_SECRET` ou `DATABASE_URL`, mas o README não explica a nova configuração.

**Resultado esperado:** Gap documental identificado com criticidade média ou alta.

---

### Cenário 4 — Refatoração interna sem impacto externo

**Entrada:** PR renomeia funções internas ou reorganiza código sem alterar comportamento externo.

**Resultado esperado:** Nenhum gap documental relevante. A ferramenta pode classificar como baixa criticidade.

---

### Cenário 5 — Alteração em infraestrutura

**Entrada:** PR modifica Dockerfile, GitHub Actions, Terraform ou outro arquivo de infraestrutura sem atualização documental.

**Resultado esperado:** Gap documental ou alerta de revisão identificado.

---

### Cenário 6 — Documentação atualizada corretamente

**Entrada:** PR altera uma funcionalidade e também atualiza a documentação correspondente.

**Resultado esperado:** Nenhum gap relevante encontrado.

---

### Cenário 7 — Mudança pequena de estilo

**Entrada:** PR altera formatação, comentários internos ou nomes de variáveis sem impacto no comportamento.

**Resultado esperado:** Nenhuma atualização documental exigida.

---

### Cenário 8 — Mudança sensível documentada parcialmente

**Entrada:** PR altera autenticação e atualiza parcialmente a documentação, mas deixa de explicar uma nova regra ou configuração.

**Resultado esperado:** Gap parcial identificado com criticidade alta ou crítica.

---

## 9. Dados registrados no MongoDB

Cada execução do experimento deverá gerar um documento no MongoDB com os principais dados da análise.

Estrutura mínima esperada:

```json
{
  "experimentId": "EXP-001",
  "repository": "repo-de-teste",
  "pullRequest": {
    "id": "1",
    "title": "Adicionar login com JWT",
    "description": "Implementa endpoint de login usando JWT"
  },
  "input": {
    "changedFiles": [],
    "diffSummary": "",
    "documentationProvided": ""
  },
  "expectedResult": {
    "hasGap": true,
    "expectedCriticality": "Alta"
  },
  "actualResult": {
    "hasGap": true,
    "criticality": "Alta",
    "detectedGaps": [],
    "recommendations": []
  },
  "llm": {
    "provider": "Groq ou Claude",
    "model": "modelo-utilizado",
    "inputTokens": 0,
    "outputTokens": 0,
    "estimatedCost": 0
  },
  "evaluation": {
    "isCorrect": true,
    "falsePositive": false,
    "falseNegative": false,
    "humanNotes": ""
  },
  "createdAt": "timestamp-da-execucao"
}
```

---

## 10. Métricas de avaliação

| Métrica | Como medir | Meta inicial |
|---|---|---|
| Precisão na detecção de gaps | Comparar saída da IA com resultado esperado | ≥ 80% |
| Falsos negativos em segurança | Verificar se mudanças críticas passaram despercebidas | 0 casos críticos não detectados |
| Falsos positivos | Casos em que a IA aponta gap inexistente | Até 20% aceitável |
| Tempo médio de análise | Medir tempo total por execução | ≤ 30 segundos por PR |
| Clareza do relatório | Avaliação humana pela equipe | Compreensível sem explicação extra |
| Persistência | Verificar se análise foi salva no MongoDB | 100% das execuções salvas |
| Custo por análise | Estimar tokens e custo por modelo | Baixo o suficiente para uso recorrente |

---

## 11. Critério de sucesso

O experimento será considerado bem-sucedido se a ferramenta conseguir:

- identificar corretamente a maioria dos gaps documentais;
- não deixar passar mudanças críticas de segurança ou infraestrutura;
- diferenciar casos que exigem documentação de casos que não exigem;
- gerar relatório em Markdown compreensível para PMO e desenvolvedor;
- armazenar corretamente cada análise no MongoDB;
- permitir inspeção posterior do histórico salvo;
- executar dentro de tempo e custo aceitáveis para um fluxo de Pull Request.

---

## 12. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| IA gerar falsos positivos demais | PMO pode ignorar a ferramenta | Refinar prompt de gaps e exigir justificativa para cada alerta |
| IA deixar passar mudança crítica | Risco de documentação incompleta em segurança | Usar prompt específico para mudanças sensíveis e fallback para modelo mais forte |
| Diff muito grande | Estouro de contexto ou análise superficial | Dividir análise por arquivo ou resumir diff antes da análise principal |
| Documentação genérica demais | IA pode não saber se há gap real | Usar documentação mínima mais objetiva nos casos de teste |
| Relatório muito técnico | PMO pode não entender a saída | Ajustar prompt de relatório para linguagem orientada à decisão |
| Falha ao salvar no MongoDB | Perda de histórico | Implementar tratamento de erro e log local da análise |
| Custo de tokens alto | Redução da viabilidade econômica | Usar extração prévia de mudanças e modelo mais barato como padrão |

---

## 13. Aprendizado esperado

Com o experimento, a equipe espera descobrir:

- se os prompts atuais são suficientes para detectar gaps documentais;
- quais tipos de mudança a IA identifica melhor;
- quais tipos de mudança geram mais falsos positivos;
- se a classificação de criticidade é coerente;
- se o relatório gerado apoia a tomada de decisão;
- se o armazenamento em MongoDB é suficiente para histórico simples;
- se o escopo do MVP precisa ser reduzido para APIs, segurança ou infraestrutura.

---

## 14. Decisão após o experimento

Se o experimento atingir os critérios mínimos de sucesso, a equipe seguirá com a implementação do MVP completo via CLI, com integração progressiva ao GitHub Actions e persistência em MongoDB.

Se os resultados forem insuficientes, a equipe deverá ajustar o escopo, podendo limitar a primeira versão para:

- apenas mudanças em endpoints de API;
- apenas mudanças de autenticação e segurança;
- apenas comparação entre README e diff;
- apenas geração de relatório, sem comentário automático em PR;
- armazenamento local temporário antes do MongoDB.

---

## 15. Exemplo de saída esperada

```md
# Relatório de Auditoria de Documentação

## Status
Atenção necessária

## Criticidade
Alta

## Mudanças identificadas
- Novo endpoint `POST /api/v1/auth/login`.
- Nova regra de autenticação baseada em token JWT.

## Gaps documentais encontrados
- A documentação da API não descreve o novo endpoint.
- O README não explica a nova configuração de autenticação.

## Recomendação
Atualizar a documentação da API e a seção de autenticação antes da aprovação do Pull Request.

## Justificativa
A mudança afeta comportamento externo do sistema e impacta diretamente usuários e integradores da API.
```

---

## 16. Resumo do Canvas

Este experimento valida o núcleo da proposta: usar IA para auditar documentação em Pull Requests. A avaliação será feita com cenários controlados, métricas de precisão, tempo, custo, criticidade e persistência. O MongoDB será usado para armazenar o histórico das análises, permitindo rastreabilidade e preparação para melhorias futuras.
