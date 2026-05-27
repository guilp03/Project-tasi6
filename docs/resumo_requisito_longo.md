# Resumo dos Requisitos — Sistema de Auditoria Inteligente de Pull Requests

**Projeto:** TASI6 — Auditoria Automatizada de Documentação com IA  
**Domínio:** D3 — Documentação Automatizada  
**Versão:** 1.0  
**Data:** 24/05/2026  

---

## 1. Visão Geral

O sistema tem como objetivo apoiar a auditoria de documentação em Pull Requests, identificando automaticamente mudanças relevantes no código e verificando se essas mudanças estão refletidas na documentação do projeto.

A aplicação será executada inicialmente via CLI, utilizando IA para analisar diffs, detectar gaps documentais, classificar criticidade e gerar um relatório em Markdown. O histórico das análises será armazenado em MongoDB para garantir rastreabilidade e permitir consultas futuras.

---

## 2. Usuários Principais

| Usuário | Necessidade |
|---|---|
| PMO / Reviewer | Validar rapidamente se a documentação está atualizada antes da aprovação de um PR |
| Developer | Receber feedback claro sobre o que precisa ser documentado |
| Security / Compliance | Identificar mudanças sensíveis que exigem atenção documental |

---

## 3. Requisitos Funcionais — Resumo

| Código | Requisito | Descrição curta |
|---|---|---|
| RF-001 | Captura de diff | Receber e processar arquivos de diff de Pull Requests |
| RF-002 | Parâmetros via CLI | Permitir entrada por argumentos como `--diff`, `--docs` e `--output` |
| RF-003 | Extração semântica com IA | Identificar mudanças funcionais, estruturais e sensíveis no código |
| RF-004 | Leitura de documentação | Ler arquivos ou diretórios de documentação fornecidos |
| RF-005 | Comparação documental | Comparar mudanças do PR com a documentação existente |
| RF-006 | Detecção de gaps | Apontar documentação ausente, incompleta ou contraditória |
| RF-007 | Classificação de criticidade | Classificar gaps como baixa, média, alta ou crítica |
| RF-008 | Alerta de mudanças sensíveis | Sinalizar alterações em segurança, infraestrutura, autenticação ou compliance |
| RF-009 | Relatório em Markdown | Gerar relatório claro com status, criticidade, gaps e recomendações |
| RF-010 | Exportação do relatório | Exibir relatório no terminal ou salvar em arquivo `.md` |
| RF-011 | Histórico no MongoDB | Persistir auditorias com metadados, relatório e criticidade |
| RF-012 | Consulta de histórico | Permitir consulta básica das análises salvas no banco |
| RF-013 | Tratamento de falhas do LLM | Lidar com erros, timeouts, respostas inválidas e fallback de modelo |
| RF-014 | Comentário no PR | Permitir publicação futura do relatório como comentário no GitHub |

---

## 4. Requisitos Não Funcionais — Resumo

| Código | Requisito | Descrição curta |
|---|---|---|
| RNF-001 | Desempenho | Buscar execução em até 30 segundos por PR nos cenários padrão |
| RNF-002 | Baixo custo | Manter custo médio por análise abaixo de R$ 0,10 quando possível |
| RNF-003 | Fallback de LLM | Permitir uso de modelo alternativo em falhas ou casos críticos |
| RNF-004 | Segurança de credenciais | Não expor tokens, chaves de API ou URIs sensíveis |
| RNF-005 | Redução de falsos negativos | Priorizar alertas preventivos em mudanças críticas |
| RNF-006 | Usabilidade via CLI | Fornecer comandos claros e mensagens orientadas à ação |
| RNF-007 | Persistência | Armazenar histórico das análises em MongoDB |
| RNF-008 | Limite de contexto | Tratar diffs grandes com truncamento, divisão ou modelo alternativo |
| RNF-009 | Transparência | Justificar gaps, criticidade e limitações da análise |
| RNF-010 | Manutenibilidade | Organizar o código em módulos separados |
| RNF-011 | Testabilidade | Permitir testes automatizados com mocks de LLM |
| RNF-012 | GitHub Actions | Ser compatível com execução em ambiente Node.js 20+ |

---

## 5. Regras de Negócio Principais

| Código | Regra |
|---|---|
| RN-001 | Mudanças em segurança, autenticação, infraestrutura, secrets ou compliance devem ser tratadas como relevantes |
| RN-002 | Mudanças críticas sem documentação devem gerar alerta alto ou crítico |
| RN-003 | Refatorações internas sem impacto funcional podem ser ignoradas |
| RN-004 | O sistema não aprova nem reprova Pull Requests automaticamente |
| RN-005 | Toda recomendação da IA deve conter justificativa |
| RN-006 | Em caso de ambiguidade em mudanças críticas, o sistema deve preferir alertar preventivamente |

---

## 6. Escopo do MVP

### Entra no MVP inicial

- Execução via CLI;
- Entrada de diff por arquivo;
- Entrada de documentação por arquivo ou diretório;
- Análise do diff com IA;
- Identificação de mudanças relevantes;
- Comparação com documentação existente;
- Detecção de gaps documentais;
- Classificação de criticidade;
- Geração de relatório em Markdown;
- Exportação do relatório;
- Persistência básica do histórico em MongoDB;
- Tratamento de erros básicos da LLM.

### MVP estendido ou pós-MVP

- Consulta de histórico via `--history`;
- Publicação automática de comentário no Pull Request;
- Integração completa com GitHub Actions;
- Estratégias avançadas de feedback learning;
- Dashboards ou interface web.

---

## 7. Critérios Gerais de Sucesso

O sistema será considerado bem-sucedido no MVP se conseguir:

- analisar um diff de Pull Request;
- identificar mudanças relevantes;
- detectar gaps entre código e documentação;
- classificar criticidade com justificativa;
- gerar relatório compreensível para PMO e desenvolvedor;
- salvar o resultado da análise no MongoDB;
- deixar claras as limitações da análise quando houver falta de contexto ou erro.

---

## 8. Síntese Final

O projeto propõe uma ferramenta de apoio à auditoria documental em Pull Requests. A IA atua como mecanismo central para interpretar mudanças no código, identificar documentação ausente ou inconsistente e gerar um relatório estruturado para apoiar a decisão humana.

O foco do MVP é validar o fluxo essencial: receber diff e documentação, analisar com IA, gerar relatório e armazenar o histórico da auditoria.
