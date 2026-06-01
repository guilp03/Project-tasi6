# Pré-Proposta de Projeto

**Equipe:** Documentação Automatizada com IA

**Membros:** Alexandre Moreno, Stela Nascimento, Guilherme Pereira, Reilson Fonseca

**Data:** 07/05/2026

**Versão:** 0.2

---

## 1. Domínio escolhido

**D3 — Documentação Automatizada**

Escolhemos o domínio de automação de documentação porque identificamos um gargalo crítico em projetos de software: a manutenção contínua de documentação durante ciclos de desenvolvimento ágil, especialmente para profissionais de PMO que não possuem expertise técnica profunda. Nota-se que a adoção de ferramentas automatizadas em demasia se mostra custosa para tarefas tangenciais do processo, caso que é contemplado pela D3.

---

## 2. Problema que queremos resolver

**Quem é o usuário:** Project Managers (PMOs) e Team Leads responsáveis por auditoria de releases, compliance e testes de funcionalidades e segurança.

**O que ele faz hoje:**
1. Recebe Pull Requests para aprovar releases
2. Precisa verificar manualmente se a documentação foi atualizada
3. Como não possui expertise em código, precisa chamar um developer para confirmar
4. Fica aguardando confirmação enquanto a PR fica bloqueada
5. Gasta 15-20 minutos por PR em verificações manuais

**O que está errado ou faltando:**
- ⏰ **Lentidão:** Tempo de 15-20 min por PR inviabiliza scaling com múltiplas PRs/dia
- 🚫 **Bloqueio de releases:** Dependência de developer feedback atrasa deployments
- 🔒 **Risco de segurança:** Mudanças de segurança/infraestrutura podem passar despercebidas
- 📋 **Documentação inconsistente:** Sem automação, gaps de documentação são comuns
- 💼 **Falta de autonomia:** PMO sem expertise técnica fica dependente de devs

---

## 3. Hipótese de solução

**Como a IA entra na solução:**

A IA funcionará como um **auditor automático de documentação** que:

1. **Analisa PRs automaticamente** — Detecta mudanças relevantes no código/infraestrutura (APIs, schemas, segurança, features)
2. **Compara com documentação existente** — Verifica se há gaps entre mudanças e docs atualizadas
3. **Gera relatório estruturado** — Aponta exatamente o que foi alterado e o que não está documentado
4. **Dispara alertas de segurança** — Flag especial para mudanças sensíveis (auth, compliance, dados pessoais)
5. **Reduz decisão manual** — PMO toma decisão em 30 segundos em vez de 15-20 minutos

O papel central é **automação com transparência**: não é um substituto para revisão humana, mas um filtro inteligente que reduz 80% do tempo de análise manual.


---

## 4. Tipo de aplicação imaginada

**Formato:** CLI + GitHub Bot integrado ao fluxo de CI/CD

**Por que faz sentido:**
- É ferramenta de CI/CD → Acionada automaticamente em toda PR via webhook GitHub
- Não precisa de interface web amigável → PMO não interage diretamente; resultado fica no PR como comentário
- Escalabilidade automática → Pode processar 50+ PRs/dia sem overhead de UI
- Integração nativa → Funciona no fluxo existente sem mudança de ferramentas
- Custo eficiente → Roda sem servidor dedicado, apenas quando PR é aberta

**Fluxo esperado:**
```
Developer abre PR → GitHub trigger → CLI/Bot analisa → Comenta resultado na PR → PMO revisa 30s
```

---

## 5. Uma dúvida ou risco que já identificamos

**Riscos técnicos:**
- 📊 **Taxa de erro da LLM** — Se acurácia cair abaixo de 80%, ferramenta vira ruído. Precisamos validar modelos (Claude, GPT-4, etc.)
- 💰 **Custo de tokens** — Se custo/PR exceder R$ 0,50, não compensa economicamente
- ⚡ **Performance** — A análise não pode demorar muito, pois esse caso indicaria que o PM tenderia a não olhar o resultado
- 📝 **Qualidade das correções** — Se a IA gerar sugestões ruins, PMO precisará refazer tudo
- 🔍 **Detecção de falsos positivos** — Muitos alertas falsos = ferramenta ignorada

**Riscos de escopo:**
- Qual documentação é relevante? (README? Swagger? Wiki? Código comentado?)
- Como lidar com multi-linguagem (repos em PT-BR, EN, etc.)?
- Deve sugerir correções ou apenas alertar?
- Como decidir a verbosidade, quanto da tarefa automatizar?

**Plano de validação:**
- MVP focado em detecção de gaps, não em sugestões automáticas
- Testar com 3-5 modelos de LLM para comparar custo × qualidade
- Estabelecer threshold de 90%+ acurácia antes de deployar

---

## 6. Referência inicial

**Trabalhos, ferramentas e papers relacionados:**

1. **AST Diffing + LLMs para sincronizar docs com código**  
   https://dev.to/elshadhu/how-i-use-ast-diffing-and-llms-to-keep-docs-in-sync-with-code-2a97  
   → Demonstra viabilidade de detectar mudanças estruturais e gerar sugestões

2. **Automated Documentation Generation Survey (ArXiv 2024)**  
   https://arxiv.org/abs/2406.14836  
   → Resumo do estado-da-arte em automação de docs com IA

3. **Preventing Documentation Drift in Enterprise Systems**  
   https://www.scitepress.org/Papers/2025/132868/132868.pdf  
   → Abordagem formal para manter docs sincronizadas

4. **Large Language Models for Code Documentation (ArXiv 2024)**  
   https://arxiv.org/abs/2402.16667  
   → Análise de capacidades de LLMs em gerar/validar documentação

5. **Portfolio: Preventing Drift Between Code and Docs**  
   https://djw.fyi/portfolio/preventing-drift/  
   → Case study prático de implementação em projeto real

---
