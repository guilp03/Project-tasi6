# Escopo do MVP — Auditoria Automatizada de Documentação com IA

## 1. Objetivo do MVP

O MVP do projeto será uma ferramenta inicial de auditoria automatizada de documentação em Pull Requests, voltada para apoiar PMOs, Team Leads e desenvolvedores na identificação de mudanças relevantes no código ou na infraestrutura que possam exigir atualização da documentação do projeto.

A proposta está alinhada ao domínio **D3 — Documentação Automatizada**, tendo como foco reduzir o gargalo de manter documentação atualizada em projetos de software, especialmente em contextos de release, auditoria, testes de funcionalidades e segurança.

O objetivo principal do MVP é validar se o uso de IA consegue reduzir o esforço manual de auditoria documental, oferecendo uma análise rápida, estruturada e explicável sobre possíveis gaps entre as mudanças realizadas em um PR e a documentação existente.

---

## 2. Problema que o MVP busca resolver

Atualmente, profissionais de PMO ou responsáveis por auditoria de releases precisam revisar manualmente Pull Requests para verificar se alguma alteração exige atualização de documentação. Como esses profissionais frequentemente não possuem conhecimento técnico profundo do código ou do repositório, acabam dependendo de desenvolvedores para confirmar se a documentação está correta, completa ou desatualizada.

Esse processo gera alguns problemas recorrentes:

- atraso na aprovação de Pull Requests;
- bloqueio de releases aguardando validação técnica;
- dependência constante de desenvolvedores para confirmação documental;
- risco de alterações importantes passarem sem documentação;
- inconsistências entre código, infraestrutura e documentação;
- maior custo operacional no processo de revisão.

O MVP busca reduzir esse atrito por meio de uma análise automatizada assistida por IA, funcionando como um apoio à decisão, e não como substituto da revisão humana.

---

## 3. Usuários-alvo do MVP

### Persona primária: PMO / Project Manager

Profissional responsável por garantir que alterações relevantes estejam documentadas antes da aprovação de releases. Seu principal problema é a dificuldade de validar documentação técnica sem depender constantemente dos desenvolvedores.

### Persona secundária: Desenvolvedor / Software Engineer

Profissional responsável por implementar mudanças no sistema e abrir Pull Requests. Seu principal problema é receber retrabalho por documentação ausente, incompleta ou inconsistente, muitas vezes somente no final do fluxo de revisão.

---

## 4. Funcionalidades que entram no MVP

### 4.1 Entrada de dados do Pull Request

A primeira versão da ferramenta deverá receber informações básicas de um Pull Request, como:

- título do PR;
- descrição do PR;
- lista de arquivos alterados;
- trechos de diff ou resumo das mudanças;
- documentação existente relacionada, quando disponível.

Inicialmente, essa entrada poderá ser feita por meio de CLI ou por arquivo estruturado simulando os dados de um Pull Request. A integração automática com GitHub Actions ou bot de comentário em PR real ficará fora do primeiro MVP.

---

### 4.2 Análise assistida por IA das mudanças

A IA deverá analisar o conteúdo do PR para identificar mudanças relevantes que possam impactar a documentação do projeto.

Exemplos de mudanças a serem observadas:

- criação ou alteração de endpoints;
- mudanças em regras de negócio;
- alterações em autenticação ou autorização;
- mudanças em arquivos de infraestrutura;
- alterações em variáveis de ambiente ou configuração;
- mudanças que impactem uso, instalação ou comportamento do sistema.

Essa será a funcionalidade central do MVP, pois a IA atuará como um auditor automático de documentação.

---

### 4.3 Detecção de possíveis gaps de documentação

A ferramenta deverá indicar quando uma mudança presente no PR aparenta não estar refletida na documentação analisada.

Exemplo de gap esperado:

> O PR adiciona um novo endpoint `/users/export`, mas não foi identificada atualização correspondente na documentação de API ou no README.

Nesta primeira versão, o foco será detectar e sinalizar gaps documentais. A geração automática de correções completas na documentação ficará fora do MVP.

---

### 4.4 Classificação de criticidade

O MVP deverá classificar o resultado da auditoria em níveis simples de criticidade, ajudando o usuário a priorizar a revisão.

| Nível | Significado |
|---|---|
| Baixo | A mudança provavelmente não exige atualização documental |
| Médio | A mudança pode exigir atualização documental |
| Alto | Existe mudança relevante sem documentação identificada |
| Crítico | Existe mudança sensível relacionada a segurança, infraestrutura ou compliance |

Essa classificação deve ajudar principalmente o PMO a tomar uma decisão mais rápida sobre a necessidade de revisão adicional.

---

### 4.5 Geração de relatório estruturado

Ao final da análise, o sistema deverá gerar um relatório simples e estruturado contendo:

- resumo das mudanças analisadas;
- documentos possivelmente impactados;
- gaps de documentação encontrados;
- nível de criticidade;
- justificativa da IA;
- recomendação para o PMO ou desenvolvedor.

Exemplo de saída esperada:

```md
## Resultado da Auditoria de Documentação

Status: Atenção necessária
Criticidade: Alta

Mudanças identificadas:
- Novo endpoint de autenticação adicionado.
- Alteração em regra de autorização de usuários.

Possível gap:
- Não foi encontrada atualização na documentação de API.
- Não foi encontrada explicação sobre a nova regra de autorização.

Recomendação:
- Atualizar documentação de API.
- Revisar seção de autenticação/autorização antes da aprovação do PR.
```

---

## 5. Fluxo principal do MVP

O fluxo mínimo demonstrável do MVP será:

```text
Usuário fornece dados de um Pull Request
        ↓
Sistema identifica arquivos e mudanças relevantes
        ↓
IA analisa se as mudanças impactam documentação
        ↓
Sistema compara as mudanças com a documentação fornecida
        ↓
Sistema identifica possíveis gaps documentais
        ↓
Sistema classifica a criticidade da situação
        ↓
Sistema gera um relatório estruturado para apoio à decisão
```

Esse fluxo garante que a aplicação possua uma funcionalidade completa e demonstrável, com a IA no centro da solução.

---

## 6. O que fica fora do MVP

Para manter o escopo viável e adequado ao tempo do projeto, a primeira versão não incluirá:

- integração completa com GitHub Actions;
- bot comentando automaticamente em Pull Requests reais;
- dashboard web;
- autenticação de usuários;
- análise de repositórios muito grandes;
- suporte a múltiplas linguagens de programação;
- geração automática completa de documentação;
- correção automática de arquivos Markdown;
- análise completa de qualidade de código;
- substituição da revisão humana;
- armazenamento histórico de análises;
- sistema de permissões ou perfis de acesso.

Essas funcionalidades poderão ser consideradas em versões futuras, caso o MVP valide a utilidade da solução.

---

## 7. Critérios de sucesso do MVP

O MVP será considerado bem-sucedido se conseguir:

- analisar um exemplo de Pull Request com mudanças simuladas ou reais;
- identificar corretamente pelo menos um possível gap de documentação;
- gerar um relatório claro e útil para PMO ou desenvolvedor;
- classificar a criticidade da mudança analisada;
- sinalizar mudanças sensíveis relacionadas a segurança, infraestrutura ou compliance;
- executar o fluxo completo via CLI ou entrada estruturada;
- reduzir o esforço manual de interpretação inicial do PR.

Como metas iniciais, a equipe poderá considerar:

- tempo médio de análise inferior a 30 segundos por PR;
- redução de tempo manual acima de 80%;
- custo operacional baixo por análise;
- ausência de falsos negativos em mudanças críticas de segurança.

---

## 8. Hipótese principal a validar

A hipótese principal do MVP é que uma ferramenta assistida por IA consegue identificar, de forma rápida e explicável, possíveis gaps entre mudanças realizadas em Pull Requests e a documentação existente, reduzindo a dependência de validação manual por desenvolvedores e acelerando o processo de auditoria de releases.

---

## 9. Resumo do escopo

O MVP será uma ferramenta simples, inicialmente executada via CLI ou entrada estruturada, que recebe informações de um Pull Request, analisa as mudanças com apoio de IA, identifica possíveis impactos na documentação, classifica a criticidade e gera um relatório estruturado para apoiar a decisão de PMOs, Team Leads e desenvolvedores.

O foco da primeira versão não será substituir a revisão humana nem gerar documentação automaticamente, mas sim oferecer uma camada inicial de auditoria documental automatizada, reduzindo gargalos e aumentando a segurança no processo de aprovação de Pull Requests.
