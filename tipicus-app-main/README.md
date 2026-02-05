## 🤖 Bot WhatsApp – Estabilidade de Sessão (Atualização Técnica)

### Contexto

O projeto **Tipicus App** possui um bot de WhatsApp integrado ao fluxo operacional do restaurante, responsável pelo atendimento automático, recebimento de pedidos e integração direta com a API interna do sistema.

O bot utiliza a biblioteca **WPPConnect**, que depende do **Chrome/Puppeteer** para manter sessões ativas do WhatsApp Web. Em ambientes **Docker**, especialmente após reinicializações de containers, foi identificado um problema recorrente relacionado à persistência de sessão do navegador.

---

### Problema Identificado

Durante a inicialização do bot, o seguinte erro era observado:

> `The profile appears to be in use by another Google Chrome process`

Esse erro ocorre quando:
- O container é reiniciado abruptamente
- O processo do Chrome não encerra corretamente
- O perfil do navegador permanece bloqueado (lock de sessão)
- O Puppeteer não consegue reutilizar o diretório de sessão

Como consequência:
- O QR Code não é gerado
- O bot não inicia
- É necessária intervenção manual para limpeza de sessão

---

### Solução Implementada

Foi aplicada uma solução definitiva para garantir **estabilidade total da sessão**, mesmo em cenários de falha ou reinicialização.

A solução é composta por **três camadas complementares**:

---

#### 1. Limpeza forçada da sessão antes da inicialização

Antes de iniciar o bot, qualquer sessão antiga do WhatsApp é removida automaticamente:

```txt
/tmp/wppconnect/tipicus-bot
````

Essa limpeza elimina:

* Perfis bloqueados
* Sessões corrompidas
* Locks de processo do Chrome

Isso garante que o Puppeteer sempre inicie com um perfil limpo.

---

#### 2. Uso de diretório temporário para sessão

O armazenamento da sessão foi movido explicitamente para um diretório temporário (`/tmp`), evitando persistência indevida entre ciclos do container:

```js
sessionPath: '/tmp/wppconnect'
```

Benefícios:

* Evita conflitos de sessão
* Compatível com ambientes Docker
* Não depende de volumes persistentes

---

#### 3. Auto-restart do bot em falhas críticas

O bot foi configurado para se recuperar automaticamente em situações como:

* Fechamento inesperado do navegador
* Falha na leitura do QR Code
* Erros críticos na inicialização

Nesses casos, o bot:

* Marca o status como desconectado
* Aguarda alguns segundos
* Reinicia automaticamente o processo de conexão

Nenhuma ação manual é necessária.

---

### Resultado Final

Com essas melhorias, o bot passou a apresentar:

* ✅ Inicialização estável do navegador
* ✅ Geração consistente do QR Code
* ✅ Recuperação automática em falhas
* ✅ Operação contínua com o mesmo número de WhatsApp
* ✅ Total compatibilidade com Docker

Essa abordagem é ideal para ambientes de produção e uso diário do sistema.

---

### Arquivo Afetado

A atualização foi aplicada exclusivamente no seguinte arquivo:

```txt
whatsapp.js
```

Nenhuma outra parte da aplicação do restaurante (API, banco de dados, frontend ou regras de negócio) foi alterada.

---

### Observações Importantes

* O bot foi projetado para operar sempre com **o mesmo número de WhatsApp**
* A limpeza de sessão ocorre apenas no ciclo de inicialização
* Em caso de logout manual, o QR Code será solicitado novamente
* O comportamento garante máxima estabilidade sem comprometer segurança

---

### Status da Implementação

✔ Implementado
✔ Testado em ambiente Docker
✔ Pronto para produção

```