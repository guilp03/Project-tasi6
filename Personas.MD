# Personas — Documentação Automatizada (D3)

**Versão:** 0.1  
**Última atualização:** 2026-05-04  
**Responsável:** Equipe 3

---

## 👤 PERSONA PRIMÁRIA: Carolina Oliveira

### **Quem é**
- **Cargo:** Project Manager / PMO Senior
- **Experiência:** 8 anos em gestão, 2 anos na empresa
- **Conhecimento técnico:** Básico (Git, PRs, mas não escreve código)
- **Responsabilidade:** Garantir documentação atualizada para releases, auditoria e testes

---

### **Suas Dores**
- 😤 Não consegue auditar documentação sozinha (precisa chamar developer)
- ⏰ Gasta ~15-20 min por PR verificando manualmente
- 📋 Documentação inconsistente e fácil de passar despercebido
- 🔒 Risco: mudanças de segurança/infra podem não ser documentadas
- 🚫 Bloqueia releases enquanto aguarda confirmação de devs

---

### **O que faz no dia a dia**
1. Recebe PR para review
2. Verifica: "A documentação foi atualizada?"
3. Como não tem expertise em código, precisa **chamar um dev** para confirmar
4. Espera resposta enquanto PR fica bloqueado
5. Aprova quando dev confirma que docs estão ok

---

### **Como a aplicação ajuda**
- ✅ Automatiza a auditoria de documentação
- ✅ Detecta mudanças que **não estão documentadas**
- ✅ Gera alertas para verificar gaps de documentação
- ✅ Carolina toma decisão sozinha em 30 segundos (ao invés de 15-20 min)

---

### **Por que IA é melhor que manual**
- **Manual:** Carolina lê código, busca docs, compara tudo manualmente → Erro alto, lento
- **IA:** Analisa PR automaticamente, busca docs, compara estruturalmente → Sem erro humano, instantâneo, escalável com 50+ PRs/dia

---

## 👤 PERSONA SECUNDÁRIA: Rafael Santos — Developer

### **Quem é**
- **Cargo:** Software Engineer / Full-stack Developer
- **Experiência:** 5 anos de desenvolvimento, 1 ano na empresa
- **Conhecimento técnico:** Alto (escreve código, conhece arquitetura do projeto)
- **Responsabilidade:** Implementar features, correções, manutenção de código

---

### **Suas Dores**
- 😤 Muitas vezes esquece de atualizar documentação após mudanças
- ⏰ Interrupção frequente do PMO pedindo para documentar
- 📋 Não sabe exatamente qual documentação precisa atualizar
- 🔄 Revisão em PR demora porque volta pedindo "atualize os docs"
- 😶 Culpa/constrangimento quando esqueça algo importante (segurança)

---

### **O que faz no dia a dia**
1. Implementa feature ou correção
2. Submete PR
3. PMO pede: "Atualizou a documentação?"
4. Rafael precisa procurar qual doc atualizar (README? Swagger? Wiki?)
5. Faz update, reenvia PR

---

### **Como a aplicação ajuda**
- ✅ Aviso automático sobre o que precisa documentar (não precisa adivinhar)
- ✅ Evita interrupção do PMO
- ✅ PR aprova mais rápido
- ✅ Menos revisões por falta de doc

---

### **Por que IA é melhor que manual**
- **Manual:** Rafael depende de feedback do PMO → lento, frustrante
- **IA:** Ferramenta aponta exatamente o que falta documentar → rápido, sem depender de pessoas

---

## 👤 PERSONA SECUNDÁRIA: [A ser definida]
