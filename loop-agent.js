const fs = require("fs");
const { execSync } = require("child_process");

const MAX_ITERATIONS = 5;

function runTests() {
    try {
        execSync("npm test", { stdio: "pipe" });
        return { success: true };
    } catch (err) {
        return {
            success: false,
            output: err.stdout?.toString() || err.message
        };
    }
}

function callAI(context, errorOutput) {
    const prompt = `
Você é um engenheiro sênior.

Contexto do problema:
${context}

Erro atual:
${errorOutput}

Tarefa:
1. Identifique a causa raiz
2. Sugira correção mínima
3. Mostre o patch

Formato:
---FILE: caminho/do/arquivo.php
(código corrigido)
`;

    // Simulação (aqui você pluga Cursor ou OpenAI)
    return execSync(`echo "${prompt}" | cursor-cli`, { encoding: "utf-8" });
}

function applyPatch(aiResponse) {
    const match = aiResponse.match(/---FILE: (.+)\n([\s\S]+)/);

    if (!match) return false;

    const filePath = match[1].trim();
    const code = match[2];

    fs.writeFileSync(filePath, code);

    return true;
}

function run() {
    const context = fs.readFileSync("ai-context/AS-10820.md", "utf-8");

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        console.log(`\n?? Iteração ${i + 1}`);

        const result = runTests();

        if (result.success) {
            console.log("? Tudo passou!");
            return;
        }

        console.log("? Falhou, chamando IA...");

        const aiResponse = callAI(context, result.output);

        const applied = applyPatch(aiResponse);

        if (!applied) {
            console.log("?? IA não retornou patch válido");
            return;
        }
    }

    console.log("? Não convergiu após várias tentativas");
}

run();