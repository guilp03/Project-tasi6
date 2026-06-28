"""Preenche o template oficial do Relatório Final IF1015.

O script clona o template .docx, substitui os placeholders da capa e das
seções, preenche as tabelas de economicidade e gera o arquivo final
`Relatorio_Final_Equipe3.docx`.
"""

import copy
import shutil
from pathlib import Path

from docx import Document
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

from report_content import (
    ANALISE_COMPARATIVA,
    CAMADA1_CUSTO_IA,
    CAMADA2_ESFORCO_HUMANO,
    CAMADA3_CONTRAFACTUAL,
    CAPA,
    DISCLAIMER,
    SECAO_10_LICOES,
    SECAO_11_REFERENCIAS,
    SECAO_12_APENDICES,
    SECAO_1_INTRODUCAO,
    SECAO_2_METODOLOGIA,
    SECAO_3_EXPOSICAO,
    SECAO_4_COMPOSICAO,
    SECAO_5_ENSAIO,
    SECAO_6_RESSONANCIA,
    SECAO_7_ECONOMICIDADE,
    SECAO_8_DISCUSSOES,
    SECAO_9_ETICA,
)

TEMPLATE = Path("IF1015 - Template – Relatório Final do Projeto.docx")
OUTPUT = Path("Relatorio_Final_Equipe3.docx")


def set_run_font(run, font_name="Montserrat"):
    run.font.name = font_name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font_name)


def replace_paragraph_text(paragraph, new_text):
    paragraph.clear()
    run = paragraph.add_run(new_text)
    set_run_font(run)


def insert_paragraph_after(paragraph, text, style="normal"):
    """Insert a new paragraph after the given one."""
    new_p = OxmlElement("w:p")
    paragraph._element.addnext(new_p)
    new_paragraph = Paragraph(new_p, paragraph._parent)
    new_paragraph.text = text
    new_paragraph.style = style
    return new_paragraph


def insert_bullet_after(paragraph, text):
    """Insert a bulleted paragraph after the given one."""
    new_p = insert_paragraph_after(paragraph, text)
    # Try to apply List Bullet style; fallback to normal if unavailable.
    try:
        new_p.style = "List Bullet"
    except Exception:
        new_p.style = "normal"
    return new_p


def find_paragraph(doc, needle):
    for p in doc.paragraphs:
        if needle in p.text:
            return p
    return None


def fill_table(table, rows):
    """Preenche uma tabela do template com lista de listas (rows)."""
    for i, row_data in enumerate(rows):
        if i >= len(table.rows):
            break
        for j, text in enumerate(row_data):
            if j >= len(table.rows[i].cells):
                break
            cell = table.rows[i].cells[j]
            cell.text = ""
            run = cell.paragraphs[0].add_run(text)
            set_run_font(run)


def insert_table_after(doc, paragraph, headers, rows):
    """Cria uma tabela nova e a insere logo após o parágrafo dado."""
    table = doc.add_table(rows=1, cols=len(headers))
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = ""
        run = hdr_cells[i].paragraphs[0].add_run(h)
        set_run_font(run)
    for row_data in rows:
        row_cells = table.add_row().cells
        for i, text in enumerate(row_data):
            row_cells[i].text = ""
            run = row_cells[i].paragraphs[0].add_run(text)
            set_run_font(run)
    paragraph._element.addnext(table._element)
    return table


def fill_capa(doc):
    """Preenche os campos da capa."""
    for p in doc.paragraphs:
        if "<Nome do Projeto>" in p.text:
            replace_paragraph_text(p, CAPA["nome_projeto"])
        elif "<Nome da Equipe>" in p.text:
            replace_paragraph_text(p, CAPA["equipe"])
        elif "<URL — deve conter README.md, BUILD.md, diagramas e os 14 artefatos>" in p.text:
            replace_paragraph_text(p, CAPA["repo_url"])
        elif p.text.strip() == "<URL>" or "Sistema em produção" in p.text:
            if "<URL>" in p.text:
                replace_paragraph_text(p, CAPA["sistema_producao"])
        elif "<Nomes do integrante (login)>" in p.text:
            # Apenas o primeiro placeholder é preenchido com os nomes;
            # os demais são esvaziados para evitar duplicação.
            if not getattr(fill_capa, "_integrantes_preenchidos", False):
                replace_paragraph_text(p, "\n".join(CAPA["integrantes"]))
                fill_capa._integrantes_preenchidos = True
            else:
                replace_paragraph_text(p, "")
        elif "<Data da entrega>" in p.text:
            replace_paragraph_text(p, CAPA["data"].replace("Recife, ", ""))


def fill_disclaimer(doc):
    p = find_paragraph(doc, "Template oficial")
    if p:
        replace_paragraph_text(p, DISCLAIMER)


def fill_economicidade(doc):
    fill_table(doc.tables[0], CAMADA1_CUSTO_IA)
    fill_table(doc.tables[1], CAMADA2_ESFORCO_HUMANO)
    fill_table(doc.tables[2], CAMADA3_CONTRAFACTUAL)


def replace_section(doc, needle, paragraphs):
    """Substitui o parágrafo-guia pelo primeiro parágrafo e insere os demais."""
    p = find_paragraph(doc, needle)
    if not p:
        print(f"Aviso: parágrafo-guia não encontrado: {needle}")
        return None
    replace_paragraph_text(p, paragraphs[0])
    last = p
    for text in paragraphs[1:]:
        last = insert_paragraph_after(last, text)
    return last


def add_subsection(paragraph, title, content):
    """Insere um subtítulo em negrito e parágrafos de conteúdo."""
    last = insert_paragraph_after(paragraph, title)
    last.runs[0].bold = True
    for text in content:
        last = insert_paragraph_after(last, text)
    return last


def fill_section_3(doc):
    last = replace_section(doc, "Artefatos da Exposição", [SECAO_3_EXPOSICAO["intro"]])
    if not last:
        return
    last = add_subsection(last, "Canvas de Estratégia e Ação (deduzido)", SECAO_3_EXPOSICAO["canvas_estrategia"])
    last = add_subsection(last, "Personas", SECAO_3_EXPOSICAO["personas"])
    last = add_subsection(last, "Missão e Visão", SECAO_3_EXPOSICAO["missao"])
    last = add_subsection(last, "Métricas de Sucesso (deduzido)", [SECAO_3_EXPOSICAO["metricas"]])
    last = add_subsection(last, "Matriz de Impacto × Esforço (deduzida)", [SECAO_3_EXPOSICAO["matriz"]])
    last = add_subsection(last, "Escopo do MVP", SECAO_3_EXPOSICAO["escopo"])


def fill_section_4(doc):
    last = replace_section(doc, "Artefatos da Composição", [SECAO_4_COMPOSICAO["intro"]])
    if not last:
        return
    last = add_subsection(last, "C4 Model (Níveis 1, 2 e 3)", SECAO_4_COMPOSICAO["c4"])
    last = add_subsection(last, "Registro de Decisões Arquiteturais", SECAO_4_COMPOSICAO["adrs"])

    # Tabela resumida dos ADRs
    adr_headers = ["ADR", "Decisão", "Trade-off principal"]
    adr_rows = [
        ["ADR-001", "GITHUB_TOKEN do GitHub Actions", "Token temporário, escopo automático, mas menos granular que GitHub App"],
        ["ADR-002", "Node.js + TypeScript CLI", "Startup rápido e ecossistema CLI, mas menos libs de LLM que Python"],
        ["ADR-003", "MongoDB para histórico", "Flexibilidade JSON e feedback learning, mas custo cloud e sem transações"],
        ["ADR-004", "Execução via GitHub Actions", "Sem servidor, integração nativa, mas logging limitado"],
        ["ADR-005", "Groq-first + fallback Gemini", "Custo baixo no caminho feliz e segurança nos casos críticos"],
        ["ADR-006", "CLI com Commander.js", "Subcomandos profissionais com help/validação"],
        ["ADR-007", "Promoção do extrator de PR", "Serviço reutilizável e testável, substituindo POC isolada"],
    ]
    last = insert_paragraph_after(last, "Resumo das decisões:")
    last = insert_table_after(doc, last, adr_headers, adr_rows)

    last = add_subsection(last, "Catálogo de Registros de Prompt", [SECAO_4_COMPOSICAO["catalogo"]])
    last = add_subsection(last, "Canvas de Design de Experimento", [SECAO_4_COMPOSICAO["experimento"]])
    last = add_subsection(last, "Protótipos, wireframes ou mockups", [SECAO_4_COMPOSICAO["prototipos"]])


def fill_section_5(doc):
    last = replace_section(doc, "Artefatos do Ensaio", [SECAO_5_ENSAIO["intro"]])
    if not last:
        return
    last = add_subsection(last, "Estratégia de desenvolvimento e tecnologias", SECAO_5_ENSAIO["dev"])
    last = add_subsection(last, "Fluxo de integração com LLMs", SECAO_5_ENSAIO["llm"])
    last = add_subsection(last, "Canvas de Testes e Validação (deduzido)", [SECAO_5_ENSAIO["testes"]])
    last = add_subsection(last, "Evidências de versionamento", [SECAO_5_ENSAIO["versionamento"]])
    last = add_subsection(last, "Análise de segurança (Aula 30)", SECAO_5_ENSAIO["seguranca"])

    # Tabela de achados de segurança
    sec_headers = ["Achado", "Severidade", "Resumo da mitigação"]
    sec_rows = [
        ["AS-01", "Alta", "Implementar redaction de secrets antes da LLM"],
        ["AS-02", "Alta", "Falhar o job para criticidade Crítica"],
        ["AS-03", "Alta", "Tornar MongoDB obrigatório em CI/CD"],
        ["AS-04", "Alta", "Modelo append-only para histórico"],
        ["AS-05", "Alta", "Publicar apenas resumo sanitizado no PR"],
        ["AS-06", "Média/Alta", "Delimitar dados não confiáveis e regras determinísticas"],
        ["AS-07", "Média", "Falhar fechado em erro de parsing"],
        ["AS-08", "Média", "Permissões mínimas no GITHUB_TOKEN"],
        ["AS-09", "Média/Alta", "Gate de supply chain (npm audit)"],
        ["AS-10", "Média", "Retenção mínima de artefatos brutos"],
    ]
    last = insert_paragraph_after(last, "Priorização das ações:")
    last = insert_table_after(doc, last, sec_headers, sec_rows)

    last = add_subsection(last, "Checklist de Lançamento (deduzido)", [SECAO_5_ENSAIO["checklist"]])
    last = add_subsection(last, "Evidências de funcionamento", [SECAO_5_ENSAIO["evidencias"]])


def fill_section_6(doc):
    last = replace_section(doc, "Artefatos da Ressonância", [SECAO_6_RESSONANCIA["intro"]])
    if not last:
        return
    last = add_subsection(last, "Lançamento e coleta de feedback (deduzido)", [SECAO_6_RESSONANCIA["lancamento"]])
    last = add_subsection(last, "Painel de Feedback e Insights (deduzido)", [SECAO_6_RESSONANCIA["painel"]])
    last = add_subsection(last, "Validação das hipóteses", [SECAO_6_RESSONANCIA["hipoteses"]])
    last = add_subsection(last, "Decisão estratégica", [SECAO_6_RESSONANCIA["decisao"]])
    last = add_subsection(last, "Canvas de Escalabilidade (deduzido)", [SECAO_6_RESSONANCIA["escalabilidade"]])
    last = add_subsection(last, "Interlídio — evolução para v0.2.0", SECAO_6_RESSONANCIA["interludio"])


def fill_section_7(doc):
    last = replace_section(doc, "Esta seção apresenta o consolidado", [SECAO_7_ECONOMICIDADE["nota_moeda"]])
    if not last:
        return

    # 7.1
    last = insert_paragraph_after(last, "7.1 Camada 1 — Custo real de IA (total do projeto)", "Heading 3")
    last = insert_paragraph_after(last, SECAO_7_ECONOMICIDADE["camada1"])
    # A tabela do template já foi preenchida em fill_economicidade.

    # 7.2
    last = insert_paragraph_after(last, "7.2 Camada 2 — Esforço humano real (consolidado)", "Heading 3")
    last = insert_paragraph_after(last, SECAO_7_ECONOMICIDADE["camada2"])

    # 7.3
    last = insert_paragraph_after(last, "7.3 Camada 3 — Custo contrafactual humano (total do projeto)", "Heading 3")
    last = insert_paragraph_after(last, SECAO_7_ECONOMICIDADE["camada3"])

    # 7.4
    last = insert_paragraph_after(last, "7.4 Análise comparativa", "Heading 3")
    last = insert_paragraph_after(last, SECAO_7_ECONOMICIDADE["comparativa"])
    comp_texts = [
        f"Custo total com IA (R$): R$ {ANALISE_COMPARATIVA['custo_com_ia_total_brl']} (tokens: R$ {ANALISE_COMPARATIVA['custo_com_ia_tokens_brl']} + horas humanas: R$ {ANALISE_COMPARATIVA['custo_com_ia_horas_brl']})",
        f"Custo total estimado sem IA (R$): R$ {ANALISE_COMPARATIVA['custo_sem_ia_brl']}",
        f"Razão de economicidade: {ANALISE_COMPARATIVA['razao']}",
        f"Saving estimado (R$): R$ {ANALISE_COMPARATIVA['saving_reais']}",
        f"Saving estimado (%): {ANALISE_COMPARATIVA['saving_percentual']}",
    ]
    for txt in comp_texts:
        last = insert_paragraph_after(last, txt)

    # 7.5
    last = insert_paragraph_after(last, "7.5 Limitações da análise", "Heading 3")
    for text in SECAO_7_ECONOMICIDADE["limitacoes"]:
        last = insert_paragraph_after(last, text)


def fill_section_8(doc):
    replace_section(doc, "Decisões arquiteturais justificadas", SECAO_8_DISCUSSOES)


def fill_section_9(doc):
    replace_section(doc, "Identificação de riscos, vieses", SECAO_9_ETICA)


def fill_section_10(doc):
    last = replace_section(doc, "Reflexões sobre a experiência", [SECAO_10_LICOES["sinfonia"]])
    if not last:
        return
    last = add_subsection(last, "Avaliação da proposta de valor entregue", [SECAO_10_LICOES["valor"]])
    last = add_subsection(last, "Pontos de melhoria", [SECAO_10_LICOES["melhorias"]])
    last = add_subsection(last, "Aprendizados sobre o uso de IA generativa", [SECAO_10_LICOES["ia"]])
    last = add_subsection(last, "Relato individual de cada integrante", SECAO_10_LICOES["relatos"])


def fill_section_11(doc):
    p = find_paragraph(doc, "Fontes teóricas, técnicas")
    if not p:
        return
    replace_paragraph_text(p, "As referências utilizadas incluem fundamentos de engenharia de software, documentação de arquitetura, papers sobre manutenção de documentação com LLMs, legislação de proteção de dados e documentação das APIs e ferramentas empregadas.")
    last = p
    for ref in SECAO_11_REFERENCIAS:
        last = insert_bullet_after(last, ref)


def fill_section_12(doc):
    p = find_paragraph(doc, "Workflow Document completo")
    if not p:
        return
    replace_paragraph_text(p, "Os apêndices reúnem os artefatos produzidos ao longo do projeto.")
    last = p
    for item in SECAO_12_APENDICES:
        last = insert_bullet_after(last, item)


def main():
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Template não encontrado: {TEMPLATE}")

    shutil.copy(TEMPLATE, OUTPUT)
    doc = Document(OUTPUT)

    fill_capa(doc)
    fill_disclaimer(doc)
    fill_economicidade(doc)

    replace_section(doc, "Contextualização do problema de engenharia de software", SECAO_1_INTRODUCAO)
    replace_section(doc, "As duas entregas indissociáveis", SECAO_2_METODOLOGIA)

    fill_section_3(doc)
    fill_section_4(doc)
    fill_section_5(doc)
    fill_section_6(doc)
    fill_section_7(doc)
    fill_section_8(doc)
    fill_section_9(doc)
    fill_section_10(doc)
    fill_section_11(doc)
    fill_section_12(doc)

    doc.save(OUTPUT)
    print(f"Relatório gerado: {OUTPUT}")


if __name__ == "__main__":
    main()
