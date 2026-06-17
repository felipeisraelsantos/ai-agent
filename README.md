# ai-agent

Agente de apoio para análise de tickets Jira e validação de contexto técnico.

## O que este agente faz

O fluxo principal está em [run-agent.js](run-agent.js). Ele:

1. Recebe um ID de ticket do Jira.
2. Busca o ticket principal na API do Jira usando as credenciais do arquivo de ambiente.
3. Carrega comentários, descrição e tickets vinculados.
4. Injeta, quando disponível, trechos de regras de negócio do projeto de referência em [project-ref](project-ref).
5. Gera um arquivo Markdown em [ai-context](ai-context) com o contexto consolidado para análise manual ou por outra ferramenta.

Existe também o fluxo de testes em [run-tests.js](run-tests.js), que tenta executar a suíte do projeto de referência e, se houver falha, prepara o terreno para um ciclo de correção automática. Esse fluxo hoje espera que o projeto referenciado tenha um comando de teste funcional.

## O que precisa para funcionar

- Node.js instalado.
- Dependências do projeto instaladas com `npm install`.
- Variáveis de ambiente do Jira configuradas em um arquivo [.env](.env): `JIRA_URL`, `JIRA_EMAIL` e `JIRA_TOKEN`.
- A pasta [project-ref](project-ref) apontando para o código que será usado como referência de regras de negócio.
- A estrutura esperada pelo gerador de contexto, se você quiser a parte de regras de negócio, é algo como `src/rules/liquidacao.ts` e `src/constants/financeiro.js` dentro do projeto referenciado.

Observação: o arquivo [run-tests.js](run-tests.js) executa `npm test` dentro do projeto de referência. Se esse projeto não tiver um script de teste configurado, essa etapa não vai funcionar sem ajuste.

## Estrutura do repositório

- [run-agent.js](run-agent.js): gera o contexto completo do ticket Jira em Markdown.
- [run-tests.js](run-tests.js): roda testes do projeto de referência e prepara o ciclo de correção.
- [loop-agent.js](loop-agent.js): variante de loop para rodar testes e aplicar respostas automáticas.
- [ai-context](ai-context): pasta onde os contextos gerados são salvos.
- [project-ref](project-ref): referência de código para regras de negócio.

## Passo a passo de uso

### 1. Instalar as dependências

```bash
npm install
```

### 2. Configurar o ambiente

Crie ou ajuste o arquivo [.env](.env) com os dados do Jira:

```env
JIRA_URL=https://sua-instancia.atlassian.net
JIRA_EMAIL=seu-email@empresa.com
JIRA_TOKEN=seu-token
```

### 3. Preparar o projeto de referência

Garanta que [project-ref](project-ref) aponte para o código que você quer usar como base de comparação. Se quiser que o agente injete regras de negócio, mantenha os arquivos esperados no caminho configurado dentro desse projeto.

### 4. Gerar o contexto de um ticket

Execute o gerador informando o ID do ticket:

```bash
node run-agent.js AS-10820
```

Se quiser indicar um projeto específico para carregar regras de negócio, passe o segundo argumento:

```bash
node run-agent.js AS-10820 ambos
```

O resultado será salvo em [ai-context](ai-context), por exemplo em [ai-context/AS-10820.md](ai-context/AS-10820.md).

### 5. Revisar o contexto gerado

Abra o arquivo Markdown criado em [ai-context](ai-context) para ler:

- título e descrição do ticket;
- comentários;
- tickets vinculados;
- regras de negócio carregadas do projeto de referência.

### 6. Rodar o fluxo de testes, se aplicável

Se o projeto de referência tiver um comando de testes válido, você pode executar o loop:

```bash
node run-tests.js
```

Esse fluxo tenta rodar a suíte, detectar falhas e pedir uma resposta automatizada para aplicar correções.

## Como ele funciona por dentro

O agente trata o ticket como fonte de verdade inicial e monta um contexto expandido com:

- descrição do ticket;
- comentários;
- tickets vinculados;
- regras de negócio carregadas do código;
- comparação entre relato funcional e implementação, para apoiar análise de divergências.

Em resumo, ele não substitui a análise humana: ele organiza o material necessário para investigar o problema com menos atrito.

## Saídas geradas

- Arquivos Markdown em [ai-context](ai-context) com o contexto consolidado.
- Logs no terminal durante a coleta do Jira e durante a execução dos testes.

## Dicas rápidas

- Use um ID de ticket válido do Jira.
- Verifique se o token do Jira tem permissão de leitura.
- Se a parte de regras de negócio não aparecer, confirme se o projeto de referência existe e se os caminhos esperados estão presentes.
- Se o loop de testes falhar logo no início, valide se o projeto de referência tem um comando `npm test` funcional.
