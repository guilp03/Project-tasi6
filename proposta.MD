# Pré-Proposta de Projeto

**Equipe:** Equipe 3

**Membros:** Alexandre Moreno, Stela Nascimento, Guilherme Pereira e Reilson Fonseca

**Data:** 13/04/2026

**Versão:** 0.1

---

## 1. Domínio escolhido

> D3 — Documentação Automatizada

## 2. Problema que queremos resolver

> O problema a ser resolvido envolve a manutenção e atualização de documentação de projetos grandes, o objetivo será facilitar esse processo e automatizar a auditoria das documentações do projeto no escopo de código e infraestructure-as-code

> A solução será pensada para um profissional da área de PMO, cuja preocupação envolve garantir a documentação do projeto atualizada para os processos de release, auditoria e testes de funcionalidades e de segurança. Esse profissional frequentemente não possui expertise em código e nem imersão prática no repositório ao dia a dia e por conta disso, existe um claro gargalo ao ter que buscar orientação de desenvolvedores do projeto para esse fim.


## 3. Hipótese de solução

> A IA entraria como uma solução que automatiza a busca por alterações relevantes em um Pull Request que distoem de alguma forma da documentação atual. Além disso, se houver alguma adição ainda não documentada relevante no PR, deve ser disparado um warning para que os responsáveis revisem o trecho marcado para verificar necessidade de documentação.

## 4. Tipo de aplicação imaginada

> CLI

> A aplicação sugerida trata-se de uma ferramente de CI/CD, que portanto será acionada via comandline automatizado, portanto, uma interface mais amigável não traria benfícios justificáveis para tal complexidade adicional.

## 5. Uma dúvida ou risco que já identificamos

> O que vocês não sabem ainda e que pode mudar ou inviabilizar a proposta?
> A proposta pode ser dificultada caso:
 - A taxa de erros de mudança da LLM erradas seja mais alta que um threshold que seja discutido e definido como não aceitável
 - O custo de tokens for muito alto e não justificar a economia de tempo
 - Se for entendido que o tempo gasto revisando as alterações feitas pela ferramenta na documentação for muito parecido com o tempo de manualmente alterá-la
 - Se as correções geradas forem de baixa qualidade

## 6. Referência inicial

> Pelo menos um trabalho, ferramenta ou paper relacionado que encontraram.
> https://dev.to/elshadhu/how-i-use-ast-diffing-and-llms-to-keep-docs-in-sync-with-code-2a97
> https://arxiv.org/abs/2406.14836
> https://www.scitepress.org/Papers/2025/132868/132868.pdf
> https://arxiv.org/abs/2402.16667
> https://djw.fyi/portfolio/preventing-drift/