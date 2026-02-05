const wppconnect = require('@wppconnect-team/wppconnect');
const axios = require('axios');

// --- VARIÁVEIS GLOBAIS ---
let qrCodeImage = null;
let botStatus = 'iniciando';
let clientWpp = null;
let hostNumber = null; // Variável para guardar o número conectado
const clientes = {}; 

const API_URL = 'http://localhost:3000/api';
const MIN_DELAY = 1500;
const MAX_DELAY = 3000;

module.exports = {
    startBot: iniciar,
    getStatus: () => ({ status: botStatus, qr: qrCodeImage, number: hostNumber }), // Exporta o número
    logout: async () => {
        if (clientWpp) {
            try {
                await clientWpp.logout();
                botStatus = 'aguardando_qr';
                hostNumber = null; // Limpa ao desconectar
                console.log('Bot desconectado manualmente.');
                return true;
            } catch (e) { console.error(e); return false; }
        }
        return false;
    }
};

const delayRandomico = () => {
    const tempo = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY);
    return new Promise(resolve => setTimeout(resolve, tempo));
};

const fs = require('fs');

function iniciar() {
    const SESSION_PATH = '/tmp/wppconnect/tipicus-bot';

    // Limpeza de sessão
    if (fs.existsSync(SESSION_PATH)) {
        fs.rmSync(SESSION_PATH, { recursive: true, force: true });
    }

    wppconnect.create({
        session: 'tipicus-bot',
        sessionPath: '/tmp/wppconnect',
        autoClose: false,
        headless: true,
        logQR: false,
        puppeteerOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        },
        catchQR: (base64Qr) => {
            if (botStatus !== 'conectado') {
                console.log('📱 QR Code novo gerado.');
                qrCodeImage = base64Qr;
                botStatus = 'aguardando_qr';
            }
        },
        statusFind: (statusSession) => {
            if (statusSession === 'isLogged' || statusSession === 'inChat') {
                botStatus = 'conectado';
                qrCodeImage = null;
            }
            if (statusSession === 'browserClose' || statusSession === 'qrReadFail') {
                botStatus = 'desconectado';
                setTimeout(iniciar, 5000);
            }
        }
    })
    .then(async (client) => {
        clientWpp = client;
        
        // --- CORREÇÃO BUG #03: Pega o número conectado ---
        try {
            const me = await client.getMe();
            // Pega o número (ex: 5511999999999)
            if(me && me.wid) hostNumber = me.wid.user; 
            console.log("✅ Bot conectado no número:", hostNumber);
        } catch(e) { console.error("Erro ao pegar número:", e); }
        // -------------------------------------------------

        start(client);
    })
    .catch((error) => {
        console.error('❌ Erro ao iniciar o bot:', error);
        setTimeout(iniciar, 5000);
    });
}

function start(client) {    
    client.onMessage(async (message) => {
        if (message.isGroupMsg || message.body === 'status@broadcast' || message.from === 'status@broadcast') return;
    
        const chatId = message.from;
        const texto = message.body.toLowerCase().trim();
        const nomeZap = message.sender.pushname || 'Cliente';

        // ... MANTIVE O RESTO DA SUA LÓGICA DE MENSAGEM IGUAL ...
        if (texto.includes('#')) {
            const match = texto.match(/#(\d+)/); 
            if (match) {
                const idPedido = match[1];
                try {
                    const res = await axios.get(`${API_URL}/pedidos/${idPedido}`);
                    const pedido = res.data;
                    if (pedido) {
                        let itens = pedido.itens;
                        if (typeof itens === 'string') itens = JSON.parse(itens);

                        let resumo = `✅ *Recebi seu Pedido #${idPedido} vindo do Site!* \n\n`;
                        resumo += `👤 Cliente: ${pedido.cliente_nome}\n`;
                        resumo += `📋 Itens:\n`;
                        itens.forEach(i => resumo += `   - ${i.qtd}x ${i.nome}\n`);
                        resumo += `\n💰 Total: R$ ${parseFloat(pedido.total).toFixed(2)}`;
                        if(pedido.observacao) resumo += `\n⚠️ Obs: ${pedido.observacao}`;
                        resumo += `\n\n🚀 *Já enviei para a cozinha!* É só aguardar.`;

                        await client.sendText(chatId, resumo);
                        if(clientes[chatId]) delete clientes[chatId];
                        return; 
                    }
                } catch (e) { }
            }
        }

        if (!clientes[chatId]) { clientes[chatId] = { etapa: 'inicio', itens: [], nome: nomeZap, erros: 0 }; }
        const estado = clientes[chatId];
        if (estado.etapa === 'humano') return;

        if (estado.etapa === 'inicio' || ['oi', 'ola', 'menu', 'cardapio'].some(t => texto.includes(t))) {
            estado.etapa = 'menu';
            estado.itens = []; estado.erros = 0;
            await delayRandomico();
            try {
                const res = await axios.get(`${API_URL}/cardapio`);
                const hoje = new Date().getDay(); 
                const isFimDeSemana = (hoje === 0 || hoje === 6);
                const produtos = res.data.produtos.filter(p => {
                    if (p.ativo !== 1) return false;
                    if (p.categoria === 'bebida') return true;
                    return isFimDeSemana ? p.categoria === 'fim_semana' : p.categoria === 'semana';
                });
                estado.menuCache = produtos;
                let saudacao = isFimDeSemana ? "🌞 Bom Fim de Semana" : "👋 Olá";
                let msg = `${saudacao} *${nomeZap}*! Cardápio de hoje:\n\n`;
                produtos.forEach((p, index) => msg += `*${index + 1}.* ${p.nome} - R$ ${parseFloat(p.preco).toFixed(2)}\n`);
                msg += `\n📝 Digite o *NÚMERO* do prato.\nQuando terminar, digite *FECHAR*.`;
                await client.sendText(chatId, msg);
            } catch (e) { await client.sendText(chatId, "Erro no cardápio."); }
            return;
        }
    
        if (estado.etapa === 'menu') {
            if (!isNaN(texto)) {
                const index = parseInt(texto) - 1;
                if (estado.menuCache && estado.menuCache[index]) {
                    const p = estado.menuCache[index];
                    estado.itens.push({ nome: p.nome, preco: p.preco, qtd: 1 });
                    await delayRandomico();
                    await client.sendText(chatId, `✅ *${p.nome}* adicionado! Peça mais ou digite *FECHAR*.`);
                } else { await client.sendText(chatId, "❌ Número inválido."); }
                return;
            }
            if (['fechar', 'fim'].includes(texto)) {
                if (estado.itens.length === 0) return client.sendText(chatId, "Carrinho vazio!");
                estado.etapa = 'observacao';
                await delayRandomico();
                await client.sendText(chatId, "📝 Alguma *observação*? (Se não, digite *NÃO*)");
                return;
            }
        }

        if (estado.etapa === 'observacao') {
            estado.obs = (['nao', 'não', 'n'].includes(texto)) ? '' : message.body;
            estado.etapa = 'confirmacao';
            estado.erros = 0;
            const total = estado.itens.reduce((acc, i) => acc + parseFloat(i.preco), 0);
            let resumo = `🧐 *Confirma?*\n`;
            estado.itens.forEach(i => resumo += `▪️ ${i.nome}\n`);
            if(estado.obs) resumo += `📝 Obs: ${estado.obs}\n`;
            resumo += `💰 Total: R$ ${total.toFixed(2)}\n\nDigite *SIM* ou *CANCELAR*.`;
            await delayRandomico();
            await client.sendText(chatId, resumo);
            return;
        }

        if (estado.etapa === 'confirmacao') {
            if (['sim', 's', 'ok'].includes(texto)) {
                const total = estado.itens.reduce((acc, i) => acc + parseFloat(i.preco), 0);
                try {
                    await axios.post(`${API_URL}/pedidos`, {
                        cliente: `${estado.nome} (WhatsApp)`, itens: estado.itens, total, obs: estado.obs || "Via Bot", status: 'pendente'
                    });
                    await client.sendText(chatId, "🎉 Pedido enviado!");
                    delete clientes[chatId];
                } catch (e) { await client.sendText(chatId, "Erro ao enviar."); }
            } else if (['cancelar', 'nao'].includes(texto)) {
                await client.sendText(chatId, "❌ Cancelado. Digite *OI*.");
                delete clientes[chatId];
            } else {
                estado.erros++;
                if (estado.erros >= 3) {
                    await client.sendText(chatId, "⚠️ Transferindo para humano...");
                    estado.etapa = 'humano';
                } else { await client.sendText(chatId, `❌ Digite *SIM* ou *CANCELAR*.`); }
            }
            return;
        }
    });
}