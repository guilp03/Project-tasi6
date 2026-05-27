# Catálogo de Registros de Prompt -- Auditoria Automatizada de Documentação

## Metadados

- **Modelo alvo:** Claude 3.5 Sonnet / GPT-4o
- **Versão do catálogo:** 1.0
- **Última atualização:** 14/05/2026

---

## Registro #001

### Identificação
- **ID:** PROMPT-001
- **Nome:** Extração de Mudanças Relevantes do PR
- **Versão:** 1.0
- **Responsável:** Alexandre Magalhaes
- **Data:** 14/05/2026

### Objetivo
Analisar o diff bruto de um Pull Request e extrair apenas as mudanças que possuem impacto semântico ou estrutural (novos endpoints, lógica de negócio, infra), ignorando refatorações simples ou mudanças de estilo.

### Contexto de uso
Chamado na primeira etapa da CLI para reduzir a carga cognitiva e o custo de tokens para as etapas subsequentes.

### Template do prompt
[SYSTEM] Você é um analista técnico focado em extração de metadados de código. Seu objetivo é resumir o impacto functional de um diff.
[USER] Analise o seguinte diff de PR: {pr_diff}
Identifique:
1. Novos recursos (endpoints, classes, métodos públicos).
2. Mudanças em regras de negócio existentes.
3. Alterações em configurações ou infraestrutura (IaC).
Formato de saída esperado: Lista em tópicos técnicos.

### Parâmetros
| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| pr_diff | string | O conteúdo textual do diff gerado pelo git | "diff --git a/src/main.rs..." |

### Exemplo de execução
**Input:** Diff adicionando uma rota POST /api/v1/auth
**Output obtido:** Adição de endpoint de autenticação `/api/v1/auth` e lógica de hashing de senha.

### Avaliação de qualidade
- **Taxa de sucesso estimada:** 95%
- **Casos onde falha:** Diffs extremamente grandes que excedem a janela de contexto.
- **Estratégia de mitigação:** Fragmentação do diff por arquivo se necessário.

---

## Registro #002

### Identificação
- **ID:** PROMPT-002
- **Nome:** Detecção de Gaps Documentais
- **Versão:** 1.0
- **Responsável:** Alexandre Magalhaes
- **Data:** 14/05/2026

### Objetivo
Comparar o resumo das mudanças extraído (PROMPT-001) com a documentação existente para encontrar o que não foi atualizado.

### Contexto de uso
Última etapa da aplicação (Core Analysis).

### Template do prompt
[SYSTEM] Você é um auditor de documentação técnica. Sua missão é garantir que a documentação reflita a realidade do código.
[USER]
Mudanças no código: {resumo_mudancas}
Documentação atual: {doc_projeto}
Quais itens das mudanças no código NÃO possuem correspondência na documentação fornecida?

### Parâmetros
| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| resumo_mudancas | string | Saída do PROMPT-001 | "Novo endpoint /auth" |
| doc_projeto | string | Conteúdo do README ou Swagger | "# API Docs..." |

### Avaliação de qualidade
- **Taxa de sucesso estimada:** 85%
- **Casos onde falha:** Documentações muito genéricas que confundem a IA.
- **Estratégia de mitigação:** Pedir justificativa para cada gap encontrado.

---

## Registro #003

### Identificação
- **ID:** PROMPT-003
- **Nome:** Classificação de Criticidade
- **Versão:** 1.0
- **Responsável:** Alexandre Magalhaes
- **Data:** 14/05/2026

### Objetivo
Atribuir um nível de risco (Baixo a Crítico) para o gap de documentação encontrado, focando em segurança e compliance.

### Contexto de uso
Geração de alertas para o PMO.

### Template do prompt
[SYSTEM] Você é um especialista em compliance e segurança.
[USER] Baseado no gap identificado: {gap_encontrado}, classifique a criticidade da falta dessa documentação em: Baixa, Média, Alta ou Crítica.
Regra: Mudanças em autenticação ou infraestrutura sem doc são sempre CRÍTICAS.

---

## Registro #004

### Identificação
- **ID:** PROMPT-004
- **Nome:** Gerador de Relatório Estruturado
- **Versão:** 1.0
- **Responsável:** Alexandre Magalhaes
- **Data:** 14/05/2026

### Objetivo
Consolidar todas as análises em um formato amigável para o PMO.

### Template do prompt
[SYSTEM] Formate um relatório de auditoria em Markdown.
[USER] Dados da auditoria: {dados_consolidados}
Gere um relatório com Status, Criticidade, Gaps e Recomendações.

---

## Registro #005

### Identificação
- **ID:** PROMPT-005
- **Nome:** Alerta de Mudanças Sensíveis
- **Versão:** 1.0
- **Responsável:** Alexandre Magalhaes
- **Data:** 14/05/2026

### Objetivo
Sinalizar proativamente quando o PR toca em áreas sensíveis, mesmo que a documentação pareça correta.

### Template do prompt
[SYSTEM] Identificador de áreas críticas de código.
[USER] Analise os arquivos alterados: {file_list}. Há algum arquivo de segurança, env ou infra?
