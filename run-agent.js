require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

/**
 * ============================================================
 * ⚙️ CONFIGURAÇÕES DE AMBIENTE
 * ============================================================
 */
const CONTEXT_DIR = path.join(__dirname, "ai-context");
const PROJECT_REF_PATH = path.join(__dirname, "project-ref");

if (!fs.existsSync(CONTEXT_DIR)) fs.mkdirSync(CONTEXT_DIR);

/**
 * ============================================================
 * 🔍 TRATAMENTO DE TEXTO E EXTRAÇÃO ADF (JIRA)
 * ============================================================
 */
function sanitize(text) {
    if (!text) return "";
    return text.replace(/\s+/g, " ").trim();
}

function extractADF(field) {
    if (!field) return "";
    if (typeof field === "string") return sanitize(field);
    let result = "";
    const walk = (node) => {
        if (!node) return;
        if (node.text) result += node.text + " ";
        if (Array.isArray(node.content)) node.content.forEach(walk);
    };
    walk(field);
    return sanitize(result);
}

/**
 * ============================================================
 * 📚 EXTRATOR DE REGRAS DE NEGÓCIO (PROJECT-REF)
 * ============================================================
 */
function getBusinessRulesContext(targetProject) {
    if (!fs.existsSync(PROJECT_REF_PATH)) return "⚠️ project-ref não configurado.\n";

    let rulesContext = "## 📚 Referência de Regras de Negócio (Código)\n";
    const projectsToLoad = [];

    if (targetProject === "ambos") {
        projectsToLoad.push(...fs.readdirSync(PROJECT_REF_PATH));
    } else if (targetProject) {
        projectsToLoad.push(targetProject);
    }

    if (projectsToLoad.length === 0) return "⚠️ Nenhum projeto selecionado para análise de regras.\n";

    projectsToLoad.forEach(proj => {
        const projPath = path.join(PROJECT_REF_PATH, proj);
        if (fs.existsSync(projPath) && fs.lstatSync(projPath).isSymbolicLink()) {
            rulesContext += `### 📂 Projeto: ${proj}\n`;
            
            // Defina aqui os arquivos que contêm as regras de negócio centrais
            const ruleFiles = ["src/rules/liquidacao.ts", "src/constants/financeiro.js"];
            
            ruleFiles.forEach(file => {
                const fullPath = path.join(projPath, file);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, "utf-8");
                    rulesContext += `#### Local: ${file}\n\`\`\`javascript\n${content}\n\`\`\`\n\n`;
                }
            });
        }
    });

    return rulesContext;
}

/**
 * ============================================================
 * 🌐 MOTOR DE EXTRAÇÃO RECURSIVA (MULTI-CARD)
 * ============================================================
 */
async function fetchFullJiraContext(id, processedIds = new Set()) {
    if (processedIds.has(id)) return null;
    processedIds.add(id);

    try {
        const url = `${process.env.JIRA_URL}/rest/api/3/issue/${id}`;
        const { data: issue } = await axios.get(url, {
            auth: { username: process.env.JIRA_EMAIL, password: process.env.JIRA_TOKEN }
        });

        const ticket = {
            id,
            title: sanitize(issue.fields.summary),
            description: extractADF(issue.fields.description),
            comments: (issue.fields.comment?.comments || []).map(c => ({
                author: c.author?.displayName || "Sistema",
                body: extractADF(c.body),
                date: new Date(c.created).toLocaleString("pt-BR")
            })),
            linkedTickets: []
        };

        const links = issue.fields.issuelinks || [];
        const relatedIds = links.map(l => l.outwardIssue?.key || l.inwardIssue?.key).filter(Boolean);

        for (const relatedId of relatedIds) {
            const relatedData = await fetchFullJiraContext(relatedId, processedIds);
            if (relatedData) ticket.linkedTickets.push(relatedData);
        }

        return ticket;
    } catch (e) {
        console.error(`❌ Erro ao buscar ${id}: ${e.message}`);
        return null;
    }
}

/**
 * ============================================================
 * 📄 GERADOR DE RELATÓRIO INTEGRADO
 * ============================================================
 */
function buildDeepContextMarkdown(mainTicket, targetProject) {
    const BOM = "\ufeff";
    let md = `# 🧩 CONTEXTO INTEGRADO: ${mainTicket.id}\n\n`;

    md += `> **MISSÃO DO AGENTE:** Realizar análise idônea cruzando os tickets abaixo com as regras de negócio injetadas do 'project-ref'. Identificar discrepâncias entre o comportamento relatado e a implementação técnica.\n\n`;

    // 1. Injeção de Código (Regras de Negócio)
    md += getBusinessRulesContext(targetProject);

    // 2. Dados do Ticket e Comentários
    md += `## 📋 Ticket Principal: ${mainTicket.id}\n`;
    md += `**Título:** ${mainTicket.title}\n`;
    md += `**Descrição:** ${mainTicket.description}\n\n`;

    // 3. Dados de Tickets Vinculados
    if (mainTicket.linkedTickets.length > 0) {
        md += `## 🔗 Tickets Vinculados (Contexto Expandido)\n`;
        mainTicket.linkedTickets.forEach(lt => {
            md += `### 📎 ${lt.id}: ${lt.title}\n> ${lt.description}\n\n`;
            lt.comments.forEach(c => md += `- **${c.author}** [${c.date}]: ${c.body}\n`);
            md += `\n`;
        });
    }

    // 4. Comentários do Principal
    md += `## 💬 Histórico de Comentários (${mainTicket.id})\n`;
    mainTicket.comments.forEach(c => md += `#### ${c.author} | ${c.date}\n${c.body}\n\n---\n`);

    return BOM + md;
}

/**
 * ============================================================
 * 🚀 EXECUÇÃO
 * ============================================================
 */
async function run() {
    const id = process.argv[2];
    const targetProject = process.argv[3]; // 'projeto-a', 'projeto-b' ou 'ambos'

    if (!id) return console.log("Uso: node run-agent.js ID_TICKET [projeto-a|projeto-b|ambos]");

    console.log(`📡 Coletando contexto total para ${id}...`);
    const fullContext = await fetchFullJiraContext(id);
    
    if (fullContext) {
        const content = buildDeepContextMarkdown(fullContext, targetProject);
        fs.writeFileSync(path.join(CONTEXT_DIR, `${id}.md`), content, "utf-8");
        console.log(`✅ Análise idônea gerada em: ai-context/${id}.md`);
    }
}

run();