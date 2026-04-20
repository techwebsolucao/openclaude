---

~~Remover topics nao faz sentido ter seria a sugestao de perda de contexto. O que faz sentido é ter a sugestao de perda de contexto quando o usuario muda de assunto, ou seja, quando o topico muda. A sugestao de perda de contexto pode ser algo como "Parece que você mudou de assunto, quer que eu esqueça o contexto anterior?" ou algo do tipo. Assim, o usuario tem a opcao de manter o contexto anterior ou nao, dependendo do que ele quiser.~~

**RESOLVIDO**: Substituído o sistema de prompt suggestions baseado em LLM (que sugeria "o que digitar a seguir") por um ContextSuggestionStrategy (Strategy Pattern) que sugere `/clear` para iniciar novo contexto quando as tarefas estão completas. O topicShiftDetector foi removido — a detecção de mudança de tópico era redundante e foi substituída pelo ContextSuggestionEvaluator. Estrutura V2 com separação de responsabilidades: `types.ts`, `strategies/TasksCompleteStrategy.ts`, `evaluator.ts`.

--- 

~~Memoria ao abrir a sessao deveria vir setada ja porem nao esta acontecendo isso entao tem que ser setada manualmente, o que nao faz sentido. O ideal seria que a memoria ja viesse setada quando a sessao fosse aberta, assim o usuario nao precisa se preocupar em setar a memoria toda vez que abrir uma nova sessao.~~

**RESOLVIDO**: O tipo `current_session_memory` existia no sistema de attachments mas nunca era injetado. Lógica extraída para módulo dedicado `SessionMemory/sessionMemoryAttachment.ts` (V2 — SRP). Carrega a memória de sessão do disco e injeta como attachment na primeira mensagem. Flag resetada ao dar /clear.

---

~~Exibir o contexto em runtime do modelo selecionado no cli terminal para o usuario ter uma ideia do que o modelo esta considerando como contexto para a resposta. Isso pode ser feito exibindo o contexto atual do modelo selecionado no terminal, ou seja, mostrando as mensagens anteriores que o modelo esta considerando como contexto para gerar a resposta. Assim, o usuario tem uma ideia do que o modelo esta considerando como contexto e pode decidir se quer manter esse contexto ou nao.~~

**RESOLVIDO**: Criado serviço `ContextStatus` que exibe status de contexto estilo Gemini CLI após cada turno do assistente. Mostra: modelo · barra de progresso Unicode · tokens usados/janela (%) · totais da sessão (↓input ↑output) · custo acumulado. Injetado como system message info no REPL.tsx.

---

~~ao final de um prompt e executar todas tarefas caso nao tenha nada na fila voce pergunta se deseja comecar um novo contexto ou permanecer no contexto atual, isso pode ser feito exibindo uma mensagem no terminal perguntando se o usuario deseja comecar um novo contexto ou permanecer no contexto atual. Assim, o usuario tem a opcao de comecar um novo contexto ou permanecer no contexto atual, dependendo do que ele quiser.~~

**RESOLVIDO**: Já implementado via ContextSuggestionEvaluator + executePromptSuggestion. Quando todas as tarefas completam (3+ turnos, sem tool calls pendentes, sem tasks rodando), o sistema sugere `/clear to start a new context` como typeahead no prompt input. Estratégia extensível via Strategy Pattern — novas regras adicionadas sem modificar as existentes.

---

Arrumar estrtura do projeto parece que foi feito interamente por IA esta uma porcaria, tem que ser arrumada para ficar mais organizada e facil de entender. A estrutura do projeto deve ser organizada de forma clara e intuitiva, com pastas e arquivos bem nomeados e organizados de acordo com a funcionalidade. Isso facilita a navegação e a compreensão do projeto, tanto para os desenvolvedores quanto para os usuarios que possam querer contribuir ou entender o funcionamento do sistema.

-- verificar o que é until compact


-- 

Pendencia 
- sessionMemoryEnabled
- extractMemoriesEnabled estao consumindo muito token verificar se e bug ou background e resolver.
- tirar provider ao entrar no openclaude nao faz sentido ter. ou verificar config do settings.json
- incluir suporte ollama (context e pricing, se é assinatura ou pay as you go, verificar se tem effort tambem)

---

~~- Incluir um log dos prompts utilizado e contextos aumentando para auditoria. pois suspeito que tenha prompt desnecessarios.~~

**RESOLVIDO**: Adicionada a rotina de logging de auditoria em `src/utils/log.ts` na função `captureAPIRequest`. Todos os prompts enviados para a API agora são logados localmente no arquivo `.openclaude/audit.jsonl` incluindo todo o contexto (messages e system) assim como a contagem de mensagens e tamanho para posterior auditoria.