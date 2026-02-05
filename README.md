# 🍔 Tipicu's - Sistema de Gestão de Pedidos

![Status](https://img.shields.io/badge/Status-Em_Desenvolvimento-yellow)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue)
![Node.js](https://img.shields.io/badge/Backend-Node.js-green)

Sistema completo para gerenciamento de delivery e restaurante, integrando pedidos via WhatsApp, painel administrativo financeiro e controle de produção em tempo real na cozinha (KDS - Kitchen Display System).

## 📋 Sobre o Projeto

Este projeto foi desenvolvido para automatizar e organizar o fluxo de uma operação de delivery. O sistema captura pedidos (automatizados via Bot ou manuais), exibe-os para a cozinha e gera relatórios financeiros para a administração, tudo rodando em um ambiente containerizado com Docker.

### ✨ Funcionalidades Principais

* **🤖 Bot de Atendimento (WhatsApp):** Integração via QR Code para recebimento automático de pedidos.
* **🛠️ Painel Administrativo:**
    * Dashboard financeiro com métricas do dia (Faturamento, Ticket Médio).
    * Gerenciamento de Cardápio (Criação e edição de pratos/produtos).
    * Geração de Relatórios em CSV/Excel.
    * Monitoramento de conexão do Bot.
* **🧑‍🍳 KDS (Tela da Cozinha):**
    * Visualização de pedidos em tempo real.
    * Alertas visuais e organização por ordem de chegada.
    * Finalização de pedidos e impressão.
* **📱 Cardápio Digital:** Interface para visualização dos produtos disponíveis.

---

## 🚀 Tecnologias Utilizadas

* **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
* **Backend:** Node.js.
* **Banco de Dados:** Estrutura de dados otimizada para performance local.
* **Infraestrutura:** Docker & Docker Compose.
* **API:** Integração com WhatsApp Web API.

---

## 👥 Créditos e Equipe

Este projeto foi possível graças à colaboração das seguintes áreas:

| Membro | Função / Responsabilidade |
| :--- | :--- |
| **Phellipe H.** | 🎨 **Desenvolvimento Frontend**<br>Responsável pela criação das interfaces, experiência do usuário (UX/UI), interatividade das telas e design responsivo. |
| **Vinicius S.** | 🗄️ **Banco de Dados e Backend**<br>Responsável pela lógica do servidor, estruturação dos dados, regras de negócio e persistência das informações. |
| **André S.** | 🚀 **Gestão de Projeto, API e Docker**<br>Responsável pela arquitetura em containers, integração com a API do WhatsApp e gerenciamento geral do ciclo de vida do projeto. |

---

## 📄 Licença

Este projeto é de uso privado e proprietário.
