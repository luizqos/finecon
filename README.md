# 📊 Finecon - Conciliação JD vs Core

O **Finecon** é uma ferramenta de auditoria e reconciliação financeira desenvolvida para realizar o cruzamento de dados entre relatórios da **JD** e do **Core**. O sistema foi concebido para identificar divergências em transações (E2E IDs), calcular discrepâncias de valores e automatizar processos de suporte técnico.

## 🚀 Finalidade e Funcionalidades

- **Cruzamento de Dados**: Processamento eficiente de ficheiros CSV com lógica de identificação de pendências cruzadas.
- **Interface de Auditoria**: Visualização clara de métricas com indicadores de discrepância e animações de transição fluídas.
- **Automação para JIRA**: Geração de resumos em *Jira Wiki Markup* para agilizar a abertura de chamados.
- **Arquitetura BFF (Backend for Frontend)**: Camada de backend dedicada em Node.js para processamento pesado e segurança de dados.
- **Exportação de Relatórios**: Geração de ficheiros Excel detalhados para análises externas.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 15, Tailwind CSS, Lucide React.
- **Backend**: Node.js, Express, TypeScript (BFF).
- **Processamento**: Node.js Streams (leitura eficiente de grandes CSVs).
- **Testes**: Jest (Unitários e de Integração).
- **Infraestrutura**: Docker e Docker Compose.

---

## 💻 Execução Local (Sem Docker)

Esta modalidade é ideal para o desenvolvimento e depuração da lógica de negócio.

### Pré-requisitos
- Node.js 20.x ou superior.
- NPM ou Yarn.

### Instruções
1.  **Instalar dependências**:
    ```bash
    npm install
    ```

2.  **Configurar Variáveis de Ambiente**:
    Crie um ficheiro `.env.local` na raiz com base no `.env` fornecido:
    ```env
    PORT=3001
    UPLOAD_DIR=uploads
    ```

3.  **Executar o Pre-flight Check**:
    Verifique se o ambiente cumpre todos os requisitos:
    ```bash
    npm run preflight
    ```

4.  **Iniciar o Ambiente de Desenvolvimento**:
    ```bash
    npm run dev
    ```
    O frontend estará disponível em `http://localhost:3000` e a API em `http://localhost:3001`.

---

## 🐳 Execução via Docker (Produção/VPS)

Recomendado para ambientes de VPS Linux, garantindo isolamento e facilidade de deploy.

### Pré-requisitos
- Docker e Docker Compose instalados.

### Instruções
1.  **Build e Inicialização**:
    O Dockerfile utiliza *multi-stage build* para otimizar o tamanho da imagem final:
    ```bash
    docker-compose up -d --build
    ```

2.  **Volumes e Persistência**:
    - O container mapeia a pasta `./uploads` local para persistir os CSVs processados e ficheiros Excel gerados.

3.  **Verificar Logs**:
    ```bash
    docker logs -f finecon_app
    ```

---
