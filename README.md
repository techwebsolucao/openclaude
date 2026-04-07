# OpenClaude

OpenClaude é um CLI open-source para agentes de programação via terminal.

**ATENÇÃO: Atualmente este projeto funciona apenas com OpenRouter.** Use APIs compatíveis com OpenAI mantendo um único fluxo de trabalho no terminal: prompts, ferramentas, agentes, MCP, comandos de barra e streaming de resposta.

[![PR Checks](https://github.com/Gitlawb/openclaude/actions/workflows/pr-checks.yml/badge.svg?branch=main)](https://github.com/Gitlawb/openclaude/actions/workflows/pr-checks.yml)
[![Release](https://img.shields.io/github/v/tag/Gitlawb/openclaude?label=release&color=0ea5e9)](https://github.com/Gitlawb/openclaude/tags)
[![Discussions](https://img.shields.io/badge/discussions-open-7c3aed)](https://github.com/Gitlawb/openclaude/discussions)
[![Security Policy](https://img.shields.io/badge/security-policy-0f766e)](SECURITY.md)
[![License](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)

[Início rápido](#início-rápido) | [Provedores](#provedores-suportados) | [Build local](#build-local-e-desenvolvimento) | [Extensão VS Code](#extensão-vs-code) | [Comunidade](#comunidade)

## Por que OpenClaude

- Use um único CLI para API OpenRouter
- Salve perfis de provedor com `/provider`
- Trabalhe com OpenAI-compatible via OpenRouter
- Fluxo completo de programação via agente: bash, leitura/edição de arquivos, grep, glob, agentes, tarefas, MCP e web tools
- Extensão VS Code incluso para integração e temas

## Início rápido

```bash
openclaude
```

Dentro do OpenClaude:

- rode `/provider` para configurar um perfil de provedor

> Caso apareça `ripggp not found`, instale o ripgrep no sistema e verifique que `rg --version` funciona antes de iniciar.

## Provedores suportados

**ATENÇÃO: Atualmente apenas OpenRouter é suportado.**

Você pode usar qualquer modelo disponível na plataforma OpenRouter, incluindo modelos OpenAI (GPT-4o, GPT-4 Turbo), Claude, Gemini, Mistral e outros via API compatível com OpenAI.

| Provedor | Caminho | Notas |
| --- | --- | --- |
| OpenRouter | `/provider` ou env vars | Acesso a qualquer modelo OpenAI-compatible disponível no OpenRouter |

## O que funciona

- **Fluxos de código com ferramentas**: Bash, leitura/edição de arquivos, grep, glob, agentes, tarefas, MCP e comandos de barra
- **Streaming de resposta**: Output de tokens em tempo real e progresso de ferramentas
- **Tool calling**: Múltiplas chamadas de ferramentas com execução e respostas de acompanhamento
- **Imagens**: Inputs por URL e base64 para modelos com suporte a visão via OpenRouter
- **Perfis de provedor**: Setup guiado e suporte a `.openclaude-profile.json`
- **Com OpenRouter**: Acesso a modelos compatíveis com OpenAI via API OpenRouter

## Notas sobre provedores

**ATENÇÃO: OpenClaude atualmente suporta apenas OpenRouter.**

- O projeto foi adaptado para funcionar especificamente com OpenRouter
- Você pode usar qualquer modelo disponível na plataforma OpenRouter
- A qualidade das ferramentas depende do modelo selecionado no OpenRouter
- Todos os modelos OpenAI-compatible do OpenRouter são suportados

Para melhores resultados, use modelos com suporte forte a tool/function calling disponíveis no OpenRouter.

## Roteamento de agentes (com OpenRouter)

OpenClaude pode rotear diferentes agentes para diferentes modelos via configurações. Com OpenRouter, você pode configurar múltiplos modelos disponíveis na plataforma.

Adicione em `~/.openclaude/settings.json`:

```json
{
  "agentModels": {
    "gpt-4o": {
      "base_url": "https://openrouter.ai/api/v1",
      "api_key": "sk-or-your-openrouter-key"
    }
  },
  "agentRouting": {
    "Explore": "gpt-4o",
    "Plan": "gpt-4o",
    "general-purpose": "gpt-4o",
    "default": "gpt-4o"
  }
}
```

Quando não há correspondência, o provedor global é usado como fallback.

> **Nota:** Valores de `api_key` em `settings.json` são armazenados em texto plano. Mantenha este arquivo privado e não o commite no version control.

## Busca e acesso web

**ATENÇÃO: Funcionalidades de busca web podem ter comportamento limitado com OpenRouter.**

Por padrão, `WebSearch` funciona usando DuckDuckGo como fallback.

> **Nota:** O fallback DuckDuckGo funciona via scraping e pode ser limitado por rate-limit, bloqueios ou Termos de Serviço.

`WebFetch` funciona, mas o caminho HTTP simples com conversão HTML-para-markdown pode falhar em sites com JavaScript ou que bloqueiam requests plain HTTP.

---

## Servidor gRPC Headless

OpenClaude pode rodar como um serviço gRPC headless, permitindo integrar suas capacidades agentísticas (ferramentas, bash, edição de arquivos) em outras aplicações, pipelines CI/CD, ou interfaces customizadas. O servidor usa streaming bidirecional para enviar chunks de texto, tool calls e solicitar permissões para comandos sensíveis em tempo real.

### 1. Iniciar o servidor gRPC

Inicie a engine como um serviço gRPC em `localhost:50051`:

```bash
npm run dev:grpc
```

#### Configuração

| Variável | Padrão | Descrição |
|-----------|-------------|------------------------------------------------|
| `GRPC_PORT` | `50051` | Porta do servidor gRPC |
| `GRPC_HOST` | `localhost` | Endereço de bind. Use `0.0.0.0` para expor em todas as interfaces (não recomendado sem autenticação) |

### 2. Rodar o CLI de teste

Fornecemos um CLI leve que se comunica exclusivamente via gRPC. Funciona como o CLI interativo principal, renderizando cores, streaming de tokens e solicitando permissões (y/n) via evento `action_required` do gRPC.

Em outro terminal:

```bash
npm run dev:grpc:cli
```

*Nota: As definições gRPC estão em `src/proto/openclaude.proto`. Use este arquivo para gerar clientes em Python, Go, Rust ou outra linguagem.*

---

## Build local e desenvolvimento

```bash
bun install
bun run build
node dist/cli.mjs
```

Comandos úteis:

- `bun run dev`
- `bun test`
- `bun run test:coverage`
- `bun run security:pr-scan -- --base origin/main`
- `bun run smoke`
- `bun run doctor:runtime`
- `bun run verify:privacy`
- `bun test path/to/file.test.ts` para testes em áreas específicas

## Testes e cobertura

OpenClaude usa o runner de testes do Bun para testes unitários.

Rode a suíte completa:

```bash
bun test
```

Gere cobertura:

```bash
bun run test:coverage
```

Abra o relatório visual:

```bash
open coverage/index.html
```

Comandos para validação antes de abrir um PR:

- `bun run build`
- `bun run smoke`
- `bun run test:coverage`
- `bun test path/to/file.test.ts` para as áreas alteradas

A cobertura vai para `coverage/lcov.info`, e OpenClaude gera um heatmap em `coverage/index.html`.

## Estrutura do repositório

- `src/` - core do CLI/runtime
- `scripts/` - scripts de build, verificação e manutenção
- `docs/` - documentação de setup, contribuidores e projeto
- `python/` - helpers Python standalone e testes
- `vscode-extension/openclaude-vscode/` - extensão VS Code
- `.github/` - templates, CI e automação do repositório
- `bin/` - entrypoints do CLI

## Extensão VS Code

O repositório inclui uma extensão VS Code em [`vscode-extension/openclaude-vscode`](vscode-extension/openclaude-vscode) para lançamento integrado, UI de provider-aware e suporte a temas.

## Segurança

Se acredita ter encontrado um problema de segurança, veja [SECURITY.md](SECURITY.md).

## Comunidade

- [GitHub Discussions](https://github.com/Gitlawb/openclaude/discussions) para Q&A, ideias e conversa entre a comunidade
- [GitHub Issues](https://github.com/Gitlawb/openclaude/issues) para bugs confirmados e features

## Contribuindo

Contribuições são bem-vindas.

Para mudanças maiores, abra uma issue primeiro para alinhar o escopo. Comandos úteis de validação:

- `bun run build`
- `bun run test:coverage`
- `bun run smoke`
- `bun test path/to/file.test.ts` para as áreas alteradas

## Disclaimer

OpenClaude é um projeto independente da comunidade e não é afiliado, endossado ou patrocinado pela Anthropic.

OpenClaude origina-se do codebase Claude Code e foi substancialmente modificado para suportar múltiplos provedores e uso aberto. "Claude" e "Claude Code" são marcas registradas da Anthropic PBC. Veja [LICENSE](LICENSE) para detalhes.

## Licença

Veja [LICENSE](LICENSE).
