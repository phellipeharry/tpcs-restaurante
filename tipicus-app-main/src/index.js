const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const whatsapp = require('./whatsapp'); 
const path = require('path');
const app = express();

app.use(cors());

// AUMENTO DO LIMITE PARA ACEITAR IMAGENS GRANDES (Base64)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve os arquivos do frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do Banco de Dados
const dbConfig = {
    host: process.env.DB_HOST || 'db_mysql', // Nome do serviço no docker-compose
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'senha_root_super_forte_2024',
    database: process.env.DB_NAME || 'bot_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// ==============================================================================
// 0. INICIALIZAÇÃO DO BANCO (CRIA TABELAS SE NÃO EXISTIREM)
// ==============================================================================
async function initDB() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        
        // Tabela Produtos
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS produtos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                descricao TEXT,
                preco DECIMAL(10,2),
                imagem LONGTEXT, 
                categoria VARCHAR(50),
                opcoes_bebida TEXT,
                ativo TINYINT(1) DEFAULT 1
            )
        `);

        // Tabela Pedidos
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cliente_nome VARCHAR(255),
                itens JSON,
                total DECIMAL(10,2),
                observacao TEXT,
                status VARCHAR(50) DEFAULT 'pendente',
                data_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela Configs
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS configs (
                chave VARCHAR(100) PRIMARY KEY,
                valor TEXT
            )
        `);

        console.log("✅ Banco de Dados e Tabelas verificados/criados com sucesso!");
        await conn.end();
    } catch (error) {
        console.error("❌ Erro ao iniciar Banco de Dados:", error.message);
    }
}
initDB();

// ==============================================================================
// 1. ROTAS DO DASHBOARD (FINANCEIRO)
// ==============================================================================

app.get('/api/pedidos/hoje', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const sql = `SELECT * FROM pedidos WHERE DATE(data_pedido) = CURDATE() ORDER BY id DESC`;
        const [rows] = await conn.execute(sql);
        await conn.end();
        res.json(rows);
    } catch (error) {
        console.error("Erro dashboard:", error);
        res.status(500).json([]); 
    }
});

// ==============================================================================
// 2. ROTAS DO CLIENTE E BOT (CARDÁPIO E PEDIDOS)
// ==============================================================================

// Buscar Cardápio
app.get('/api/cardapio', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [produtos] = await conn.execute('SELECT * FROM produtos WHERE ativo = 1');
        const [configs] = await conn.execute('SELECT * FROM configs');
        await conn.end();

        const configMap = {};
        configs.forEach(c => configMap[c.chave] = c.valor);

        // Injeta o número do bot se estiver conectado
        const statusBot = whatsapp.getStatus();
        configMap['whatsapp_number'] = statusBot.number || '5511999999999';

        res.json({ produtos, configs: configMap });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao buscar cardápio');
    }
});

// Salvar Novo Pedido
app.post('/api/pedidos', async (req, res) => {
    const { cliente, itens, total, obs, status } = req.body;
    try {
        const conn = await mysql.createConnection(dbConfig);
        const itensJson = JSON.stringify(itens);
        const statusFinal = status || 'pendente';

        const [result] = await conn.execute(
            'INSERT INTO pedidos (cliente_nome, itens, total, observacao, status) VALUES (?, ?, ?, ?, ?)',
            [cliente, itensJson, total, obs, statusFinal]
        );
        await conn.end();
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao salvar pedido');
    }
});

app.get('/api/pedidos/:id', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.execute('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
        await conn.end();
        
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).send('Não encontrado');
    } catch (error) { res.status(500).send('Erro'); }
});

// ==============================================================================
// 3. ROTAS DA COZINHA (QUADRO E PEDIDOS)
// ==============================================================================

app.get('/api/pedidos-ativos', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        
        // --- ALTERAÇÃO IMPORTANTE PARA A 3ª COLUNA ---
        // Buscamos TUDO que não foi cancelado E que é de HOJE.
        // Isso inclui 'novos', 'preparo' e 'finalizado'.
        const [rows] = await conn.execute("SELECT * FROM pedidos WHERE status != 'cancelado' AND DATE(data_pedido) = CURDATE() ORDER BY id ASC");
        
        await conn.end();
        res.json(rows);
    } catch (error) { res.status(500).send('Erro ao buscar pedidos ativos'); }
});

app.put('/api/pedidos/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute('UPDATE pedidos SET status = ? WHERE id = ?', [status, req.params.id]);
        await conn.end();
        res.json({ success: true });
    } catch (error) { res.status(500).send('Erro ao atualizar status'); }
});

// ==============================================================================
// 4. ROTAS DO ADMIN (PRODUTOS)
// ==============================================================================

app.get('/api/produtos', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.execute('SELECT * FROM produtos ORDER BY id DESC');
        await conn.end();

        const formatados = rows.map(p => ({
            id: p.id,
            nome: p.nome,
            descricao: p.descricao,
            preco: p.preco,
            imagem: p.imagem, 
            visivel: p.ativo === 1,
            // Mantém a lógica visual correta
            tipo: p.categoria === 'bebida' ? 'bebida' : 'prato',
            
            // Correção para Admin e Cliente funcionarem juntos:
            categoria: p.categoria,     
            categoria_aba: p.categoria, 
            
            opcoes_bebida: p.opcoes_bebida
        }));

        res.json(formatados);
    } catch (error) { res.status(500).send('Erro ao listar produtos'); }
});

// Criar ou Editar Produto
app.post('/api/produtos', async (req, res) => {
    const { id, tipo, nome, descricao, preco, imagem, categoriaAba, htmlOpcoes, hidden } = req.body;
    
    const valNome = nome || 'Sem Nome';
    const valDesc = descricao || null;
    const valPreco = preco || 0;
    const valImagem = imagem || null;
    const valOpcoes = htmlOpcoes || null;

    let categoriaFinal = (tipo === 'bebida') ? 'bebida' : categoriaAba;
    if (!categoriaFinal && tipo !== 'bebida') categoriaFinal = 'semana';

    const ativo = hidden ? 0 : 1;

    try {
        const conn = await mysql.createConnection(dbConfig);

        if (id) {
            // ATUALIZAR
            await conn.execute(
                `UPDATE produtos SET nome=?, descricao=?, preco=?, imagem=?, categoria=?, opcoes_bebida=?, ativo=? WHERE id=?`,
                [valNome, valDesc, valPreco, valImagem, categoriaFinal, valOpcoes, ativo, id]
            );
        } else {
            // CRIAR NOVO
            await conn.execute(
                `INSERT INTO produtos (nome, descricao, preco, imagem, categoria, opcoes_bebida, ativo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [valNome, valDesc, valPreco, valImagem, categoriaFinal, valOpcoes, ativo]
            );
        }
        await conn.end();
        console.log("✅ Produto salvo com sucesso!");
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Erro ao salvar produto:", error.message);
        res.status(500).send('Erro ao salvar produto: ' + error.message);
    }
});

// Deletar Produto
app.delete('/api/produtos/:id', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute('DELETE FROM produtos WHERE id = ?', [req.params.id]);
        await conn.end();
        res.json({ success: true });
    } catch (error) { res.status(500).send('Erro ao deletar'); }
});

// Configurações
app.get('/api/config', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.execute('SELECT * FROM configs');
        await conn.end();
        const configObj = {};
        rows.forEach(row => configObj[row.chave] = row.valor);
        res.json({
            acompanhamentos: configObj['acompanhamentos_semana'] || '',
            mensagem_topo: configObj['mensagem_topo'] || ''
        });
    } catch (error) { res.status(500).send(error); }
});

app.post('/api/config', async (req, res) => {
    const { acompanhamentos, mensagem_topo } = req.body;
    try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute('REPLACE INTO configs (chave, valor) VALUES (?, ?)', ['acompanhamentos_semana', acompanhamentos]);
        await conn.execute('REPLACE INTO configs (chave, valor) VALUES (?, ?)', ['mensagem_topo', mensagem_topo]);
        await conn.end();
        res.json({ success: true });
    } catch (error) { res.status(500).send(error); }
});

// ==============================================================================
// 5. BOT WHATSAPP
// ==============================================================================

app.get('/api/bot/status', (req, res) => {
    const status = whatsapp.getStatus();
    res.json(status);
});

app.post('/api/bot/logout', async (req, res) => {
    const success = await whatsapp.logout();
    res.json({ success });
});

// Inicia o Bot (assíncrono)
whatsapp.startBot();

// ==============================================================================
// 6. ROTA DE RELATÓRIO (CORRIGIDA)
// ==============================================================================

app.get('/download-relatorio', async (req, res) => {
    const { inicio, fim } = req.query;
    
    // Tratamento de segurança para datas
    if (!inicio || !fim) {
        return res.status(400).send("Datas inválidas.");
    }

    // Força o intervalo pegar o dia inteiro (do começo do dia 1 até o final do dia 2)
    const dataInicio = `${inicio} 00:00:00`;
    const dataFim = `${fim} 23:59:59`;

    console.log(`📥 Tentando baixar relatório de: ${dataInicio} até ${dataFim}`);

    try {
        const conn = await mysql.createConnection(dbConfig);
        
        // SQL Simplificado e Seguro usando BETWEEN
        const sql = `
            SELECT * FROM pedidos 
            WHERE data_pedido BETWEEN ? AND ?
            ORDER BY data_pedido DESC
        `;
        
        const [rows] = await conn.execute(sql, [dataInicio, dataFim]);
        await conn.end();

        console.log(`✅ Registros encontrados: ${rows.length}`);

        // Cabeçalho do CSV
        let csv = 'ID;Data;Hora;Cliente;Itens;Total;Status\n'; 

        if (rows.length === 0) {
            console.log("⚠️ Atenção: Nenhum pedido encontrado neste período.");
        }

        rows.forEach(p => {
            const dataObj = new Date(p.data_pedido);
            const dataStr = dataObj.toLocaleDateString('pt-BR');
            const horaStr = dataObj.toLocaleTimeString('pt-BR');
            
            const cliente = (p.cliente_nome || 'Cliente').replace(/;/g, ' '); 
            const total = parseFloat(p.total || 0).toFixed(2).replace('.', ',');
            const status = p.status || 'indefinido';
            
            // Tenta limpar o JSON de itens
            let resumoItens = '';
            try {
                // Verifica se já é objeto ou string
                const itensObj = (typeof p.itens === 'string') ? JSON.parse(p.itens) : p.itens;
                
                if(Array.isArray(itensObj)) {
                    // Pega quantidade e nome, ex: "1x Coca, 2x Burger"
                    resumoItens = itensObj.map(i => `${i.qtd || 1}x ${i.nome}`).join(' | ');
                }
            } catch(e) { 
                resumoItens = 'Erro ler itens'; 
            }

            // Remove quebras de linha que possam existir na obs ou itens para não quebrar o CSV
            resumoItens = resumoItens.replace(/(\r\n|\n|\r)/gm, " ");

            csv += `${p.id};${dataStr};${horaStr};${cliente};${resumoItens};${total};${status}\n`;
        });

        // Configura headers para download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Relatorio_${inicio}_${fim}.csv`);
        
        // Envia o arquivo
        res.status(200).send(csv);

    } catch (error) {
        console.error("❌ Erro fatal no relatório:", error);
        res.status(500).send("Erro ao gerar relatório no servidor.");
    }
});















// ==============================================================================
// INICIALIZAÇÃO
// ==============================================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📂 Servindo arquivos de: ${path.join(__dirname, 'public')}`);
})
