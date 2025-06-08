# Painel de Solicitações AMS

Este projeto é um painel de controle para visualizar e gerenciar solicitações (tickets) do sistema AMS. Ele permite que os usuários autenticados vejam uma lista de tickets, pesquisem por informações específicas e visualizem o histórico completo de conversas de cada ticket, incluindo mensagens e anexos.

Construído com [Next.js](https://nextjs.org), este painel oferece uma interface responsiva e eficiente para acompanhar o fluxo de trabalho das solicitações.

## Funcionalidades

*   **Visualização de Tickets:** Exibe uma lista paginada de todas as solicitações com detalhes como ID, Assunto, Empresa, Solicitante, Agente Responsável, Data de Criação, Última Atualização e Status.
*   **Pesquisa e Filtragem:** Permite buscar tickets por diversos campos (Assunto, ID, Empresa, Solicitante, Agente).
*   **Histórico de Conversas:** Ao clicar em um ticket, um modal é exibido mostrando o histórico completo das mensagens trocadas, incluindo a identificação do remetente (Agente ou Cliente), data/hora e anexos (imagens, áudios, vídeos, arquivos).
*   **Status Visual:** O status de cada ticket é destacado visualmente na tabela.
*   **Autenticação:** Inclui um fluxo básico de autenticação para acesso ao painel.

## Primeiros Passos

Para configurar e executar o projeto localmente, siga os passos abaixo.

### Pré-requisitos

Certifique-se de ter o Node.js e o npm (ou yarn, pnpm, bun) instalados em sua máquina.

### Instalação

1.  Clone o repositório:
    ```bash
    git clone [URL_DO_REPOSITORIO]
    cd ams-tickets
    ```
    *(Nota: Substitua `[URL_DO_REPOSITORIO]` pela URL real do repositório)*

2.  Instale as dependências:
    ```bash
    npm install
    # ou
    yarn install
    # ou
    pnpm install
    # ou
    bun install
    ```

3.  Configure as variáveis de ambiente. Crie um arquivo `.env.local` na raiz do projeto e adicione as variáveis necessárias. *(Baseado na estrutura do projeto, pode ser necessário configurar credenciais ou URLs de API. Consulte a documentação interna ou o código para detalhes específicos, se aplicável).*

### Executando o Servidor de Desenvolvimento

Execute o comando abaixo para iniciar o servidor de desenvolvimento:

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
# ou
bun dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para acessar o painel.

## Saiba Mais

Para aprender mais sobre Next.js, consulte a [Documentação do Next.js](https://nextjs.org/docs) e o tutorial [Learn Next.js](https://nextjs.org/learn).

## Deploy na Vercel

A maneira mais fácil de fazer deploy do seu aplicativo Next.js é usar a [Plataforma Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) dos criadores do Next.js.

Confira nossa [documentação de deploy do Next.js](https://nextjs.org/docs/app/building-your-application/deploying) para mais detalhes.
