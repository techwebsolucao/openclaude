# OpenClaude

OpenClaude é um CLI open-source para agentes de programação via terminal, baseado no codebase do Claude Code e adaptado para uso com múltiplos provedores via API compatível com OpenAI.

[![PR Checks](https://github.com/Gitlawb/openclaude/actions/workflows/pr-checks.yml/badge.svg?branch=main)](https://github.com/Gitlawb/openclaude/actions/workflows/pr-checks.yml)
[![Release](https://img.shields.io/github/v/tag/Gitlawb/openclaude?label=release&color=0ea5e9)](https://github.com/Gitlawb/openclaude/tags)
[![Discussions](https://img.shields.io/badge/discussions-open-7c3aed)](https://github.com/Gitlawb/openclaude/discussions)
[![Security Policy](https://img.shields.io/badge/security-policy-0f766e)](SECURITY.md)
[![License](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)

[Início rápido](#início-rápido) | [Provedores](#provedores-suportados) | [Features](#features) | [Build local](#build-local-e-desenvolvimento) | [Comunidade](#comunidade)

## Por que OpenClaude

- CLI completo para agentes de código: bash, leitura/edição de arquivos, grep, glob, agentes, tarefas, MCP e web tools
- Suporte a qualquer provedor compatível com OpenAI — OpenRouter, Ollama, LM Studio, DeepSeek, Mistral e outros
- Streaming de resposta em tempo real com tool calling múltiplo
- Counter de contexto e custo visível no rodapé do terminal
- Sugestão automática de `/clear` ao final de uma sequência de tarefas
- Memória de sessão carregada automaticamente ao iniciar

## Início rápido

```bash
openclaude
```

Dentro do OpenClaude:

- rode `/provider` para configurar um perfil de provedor

> Caso apareça `ripgrep not found`, instale o ripgrep no sistema e verifique que `rg --version` funciona antes de iniciar.

## Provedores suportados

OpenClaude funciona com qualquer API compatível com OpenAI. Configure via `/provider` ou variáveis de ambiente:

| Provedor | Variável | Notas |
| --- | --- | --- |
| OpenRouter | `OPENAI_BASE_URL=https://openrouter.ai/api/v1` | Acesso a todos os modelos da plataforma |
| Ollama Cloud | `OPENAI_BASE_URL=https://api.ollama.com/v1` | Modelos Ollama hospedados na nuvem |
| Ollama (local) | `OPENAI_BASE_URL=http://localhost:11434/v1` | Sem custo, sem latência de rede |
| LM Studio | `OPENAI_BASE_URL=http://localhost:1234/v1` | Interface gráfica local |
| DeepSeek | `OPENAI_BASE_URL=https://api.deepseek.com/v1` | API direta |
| Qualquer outro | `OPENAI_BASE_URL=<url>` | Qualquer endpoint OpenAI-compatible |

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-or-...
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
export OPENAI_MODEL=deepseek/deepseek-v3.2
```

## Features

### Counter de contexto e custo no rodapé

O rodapé do terminal exibe em tempo real após cada resposta:

```
✻ deepseek-v3.2 · 15.9k/128k (12%) · ↓86.8k ↑1.1k · $0.023
```

- **15.9k/128k (12%)** — tokens do último request vs. janela de contexto do modelo (uso real do contexto)
- **↓86.8k ↑1.1k** — total de tokens de input e output acumulados na sessão
- **$0.023** — custo real da sessão, reportado pelo provedor (sem estimativa interna)

O custo usa o valor real retornado pelo OpenRouter, evitando cálculos com precificação Anthropic para modelos de terceiros.

### Sugestão automática de `/clear`

Quando todas as tarefas estão concluídas (sem tool calls pendentes, modo assistente parado), o sistema sugere automaticamente `/clear to start a new context` como typeahead no prompt. Evita acúmulo desnecessário de contexto.

### Memória de sessão automática

A memória de sessão é carregada do disco e injetada automaticamente na primeira mensagem, sem necessidade de configuração manual a cada sessão.

### `/clear` reseta contexto e contadores

O comando `/clear` agora reseta também os contadores de tokens e custo, além de limpar o histórico de mensagens. O rodapé começa do zero na nova sessão.

### Roteamento de agentes por modelo

Configure modelos diferentes por tipo de tarefa em `~/.openclaude/settings.json`:

```json
{
  "model": "qwen/qwen3-235b-a22b",
  "enabledPlugins": {},
  "extraKnownMarketplaces": {},
  "autoMemoryEnabled": true,
  "autoDreamEnabled": true,
  "extractMemoriesEnabled": false,
  "sessionMemoryEnabled": false,
  "agentModels": {
    "qwen3.5:397b-cloud": {
      "base_url": "https://api.ollama.com/v1",
      "api_key": "b4abf761305a49ba88398a62d3f2d748.0qCT0Gvw-51zX8B-3M73NJqB"
    },
  },
  "agentRouting": {
    "Explore": "qwen3.5:397b-cloud",
    "Plan": "qwen3.5:397b-cloud",
    "general-purpose": "qwen3.5:397b-cloud",
    "default": "qwen3.5:397b-cloud"
  }
}
```

**Chaves de roteamento disponíveis:**

| Chave | Quando é usada |
|-------|----------------|
| `Explore` | Subagentes de exploração e leitura de código |
| `Plan` | Modo de planejamento (`plan`) |
| `general-purpose` | Loop principal quando não está em modo `plan` |
| `default` | Fallback para qualquer agente não mapeado acima |

> **Nota:** Valores de `api_key` em `settings.json` são armazenados em texto plano. Mantenha este arquivo privado e nunca o comite no repositório.

### Cache semântico de respostas

Respostas puramente textuais (sem tool calls) são cachadas em disco via embeddings neurais. Quando uma pergunta similar é feita novamente, o cache retorna a resposta anterior — **zero tokens gastos**.

Requer Ollama com o modelo `nomic-embed-text` (768 dimensões, threshold: 0.92). Entende sinônimos, paráfrases e reformulações da mesma pergunta. Sem Ollama, o cache fica inativo — sem interferência.

```bash
# Ativar (instalar Ollama + modelo)
brew install ollama
ollama serve                     # em outro terminal
ollama pull nomic-embed-text     # ~274MB, uma vez só

# O openclaude detecta automaticamente na próxima sessão
/semantic-cache          # ver status
/semantic-cache clear    # limpar cache

# Configurar threshold (padrão: 0.92)
/config set semanticCacheConfig.similarityThreshold 0.90
```

Cache salvo em `~/.openclaude/cache/semantic-cache/` — sobrevive entre sessões, max 200 entradas, TTL de 7 dias.

### Busca e acesso web

- `WebSearch` usa DuckDuckGo como fallback por padrão
- `WebFetch` converte HTML para markdown — pode ter limitações em sites com JavaScript ou proteção anti-bot

### Servidor gRPC Headless

OpenClaude pode rodar como serviço gRPC headless para integração em pipelines CI/CD ou interfaces customizadas:

```bash
npm run dev:grpc          # inicia o servidor em localhost:50051
npm run dev:grpc:cli      # CLI de teste que comunica via gRPC
```

As definições gRPC estão em `src/proto/openclaude.proto` — use para gerar clientes em Python, Go, Rust ou outra linguagem.

| Variável | Padrão | Descrição |
|-----------|---------|-----------|
| `GRPC_PORT` | `50051` | Porta do servidor |
| `GRPC_HOST` | `localhost` | Endereço de bind |

## Build local e desenvolvimento

```bash
bun install
bun run build
node dist/cli.mjs
```

Comandos úteis:

| Comando | Descrição |
|---------|-----------|
| `bun run dev` | Modo desenvolvimento |
| `bun test` | Roda todos os testes |
| `bun run test:coverage` | Cobertura de testes |
| `bun run smoke` | Testes de smoke |
| `bun run doctor:runtime` | Verifica dependências do runtime |
| `bun run verify:privacy` | Valida ausência de telemetria |
| `bun run security:pr-scan -- --base origin/main` | Scan de segurança |

## Testes e cobertura

```bash
bun test                         # suíte completa
bun run test:coverage            # gera cobertura
open coverage/index.html         # relatório visual
bun test path/to/file.test.ts    # testes de uma área específica
```

## Estrutura do repositório

| Pasta | Conteúdo |
|-------|----------|
| `src/` | Core do CLI e runtime |
| `scripts/` | Build, verificação e manutenção |
| `docs/` | Documentação de setup e contribuidores |
| `python/` | Helpers Python e testes |
| `bin/` | Entrypoints do CLI |
| `.github/` | Templates, CI e automação |

## Segurança

Se acredita ter encontrado um problema de segurança, veja [SECURITY.md](SECURITY.md).

## Comunidade

- [GitHub Discussions](https://github.com/Gitlawb/openclaude/discussions) para Q&A, ideias e conversa
- [GitHub Issues](https://github.com/Gitlawb/openclaude/issues) para bugs e features

## Contribuindo

Contribuições são bem-vindas. Para mudanças maiores, abra uma issue primeiro para alinhar o escopo.

Antes de abrir um PR:

```bash
bun run build
bun run test:coverage
bun run smoke
bun test path/to/file.test.ts
```

## Disclaimer

OpenClaude é um projeto independente da comunidade e não é afiliado, endossado ou patrocinado pela Anthropic. Origina-se do codebase Claude Code e foi substancialmente modificado para suportar múltiplos provedores e uso aberto. "Claude" e "Claude Code" são marcas registradas da Anthropic PBC. Veja [LICENSE](LICENSE) para detalhes.

## Licença

Veja [LICENSE](LICENSE).

