# Painel de Tickets AMS

Este projeto é um painel interativo desenvolvido com Next.js para visualizar e gerenciar solicitações de suporte, integrando-se com o sistema Chatwoot. Ele oferece uma interface centralizada para acompanhar o status dos tickets, pesquisar informações e acessar o histórico completo das conversas.

## Funcionalidades Principais

*   **Listagem e Visualização de Tickets**: Exibe uma lista abrangente de todos os tickets de suporte.
*   **Pesquisa e Filtragem Avançada**: Permite buscar tickets por assunto, ID, empresa, solicitante ou agente.
*   **Paginação Eficiente**: Facilita a navegação por grandes volumes de tickets.
*   **Histórico de Conversas Detalhado**: Um modal exibe o histórico completo de mensagens de cada ticket, incluindo texto e anexos (imagens, áudios, vídeos e outros arquivos).
*   **Sistema de Autenticação**: Garante acesso seguro ao painel.
*   **Atualização Automática**: Os dados dos tickets são atualizados periodicamente para manter as informações sempre em dia.

## Tecnologias Utilizadas

O projeto é construído com as seguintes tecnologias:

*   **Next.js**: Framework React para desenvolvimento de aplicações web.
*   **React**: Biblioteca JavaScript para construção de interfaces de usuário.
*   **TypeScript**: Superset do JavaScript que adiciona tipagem estática.
*   **Tailwind CSS**: Framework CSS utilitário para estilização rápida e responsiva.
*   **bcryptjs**: Biblioteca para hashing de senhas, utilizada na autenticação.
*   **jose** e **jsonwebtoken**: Bibliotecas para manipulação de JSON Web Tokens (JWT) para autenticação.
*   **Chatwoot API**: Integração com a API do Chatwoot para buscar dados de conversas e tickets.

## Configuração e Execução Local

Siga os passos abaixo para configurar e executar o projeto em seu ambiente local:

### 1. Clonar o Repositório

```bash
git clone [URL_DO_REPOSITORIO]
cd ams-tickets-pre/code
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto e adicione as seguintes variáveis:

```
CHATWOOT_URL="Sua URL do Chatwoot (ex: https://app.chatwoot.com)"
CHATWOOT_ACCOUNT_ID="Seu ID de Conta do Chatwoot"
CHATWOOT_API_TOKEN="Seu Token de Acesso à API do Chatwoot"
JWT_SECRET="Uma string secreta forte para JWT (ex: gerada com 'openssl rand -base64 32')"
ADMIN_USERNAME="Nome de usuário padrão para login (ex: admin)"
ADMIN_PASSWORD_HASH="Hash da senha padrão para login (ex: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy para 'password')"
```

**Nota**: Para `ADMIN_PASSWORD_HASH`, você pode gerar um hash de senha usando uma ferramenta como `bcryptjs` em um script separado ou online. O exemplo fornecido é para a senha 'password'.

### 4. Executar o Servidor de Desenvolvimento

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:3000`.

### 5. Construir e Iniciar para Produção

Para construir o aplicativo para produção:

```bash
npm run build
```

Para iniciar o aplicativo em modo de produção:

```bash
npm run start
```

## Estrutura do Projeto

O projeto segue a estrutura de pastas padrão do Next.js, com algumas adições:

```
.
├── app/                  # Páginas, rotas e APIs da aplicação Next.js
│   ├── api/              # Rotas de API (autenticação, histórico de tickets)
│   ├── chat/             # Página de chat (placeholder)
│   ├── login/            # Página de login
│   └── ...               # Outras páginas e layouts
├── components/           # Componentes React reutilizáveis (ex: ChatMessage, LoadingState)
├── public/               # Ativos estáticos (imagens, ícones)
├── styles/               # Arquivos de estilo globais e módulos CSS
├── .gitignore            # Arquivos e pastas a serem ignorados pelo Git
├── package.json          # Metadados do projeto e dependências
├── next.config.js        # Configuração do Next.js
├── tsconfig.json         # Configuração do TypeScript
└── README.md             # Este arquivo
```

## Diagrama de Arquitetura

```mermaid
graph TD
    A[Usuário] -->|Acessa| B(Painel de Tickets - Frontend Next.js)
    B -->|Requisição de Dados| C{API Interna: /api/ticket-history}
    B -->|Requisição de Autenticação| D{API Interna: /api/auth}
    C -->|Busca Conversas/Mensagens| E[Chatwoot API]
    D -->|Verifica Credenciais| F[Autenticação (bcryptjs, JWT)]
    E -->|Retorna Dados| C
    C -->|Transforma Dados| B
    F -->|Gera Token| D
    D -->|Define Cookie| B
```

## Licença

MIT License