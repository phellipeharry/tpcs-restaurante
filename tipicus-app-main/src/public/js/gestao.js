/* ==========================================================================
   GESTÃO JS - 2 BOTÕES (IMPRIMIR E FINALIZAR)
   ========================================================================== */

let PEDIDOS_CACHE = []; 
let pedidoParaFinalizarId = null; 

window.addEventListener('load', () => {
    carregarDados();
    setInterval(carregarDados, 5000);
    
    // Configura o botão SIM do modal para FINALIZAR
    document.getElementById('btn-confirm-yes').onclick = async () => {
        if(pedidoParaFinalizarId) {
            await executarFinalizacao(pedidoParaFinalizarId);
            document.getElementById('modal-confirm-custom').style.display = 'none';
        }
    };
});

async function carregarDados() {
    try {
        const res = await fetch('/api/pedidos-ativos');
        const pedidos = await res.json();
        
        PEDIDOS_CACHE = pedidos; 
        renderizarBoard(pedidos);
    } catch (e) { console.error("Erro ao carregar dados:", e); }
}

function renderizarBoard(pedidos) {
    const listaNovos = document.getElementById('lista-novos');
    const listaPreparo = document.getElementById('lista-preparo');
    const listaFinalizados = document.getElementById('lista-finalizados');
    
    if(!listaNovos) return;

    listaNovos.innerHTML = '';
    listaPreparo.innerHTML = '';
    listaFinalizados.innerHTML = '';

    let counts = { novos: 0, preparo: 0, finalizados: 0 };

    pedidos.forEach(p => {
        let status = p.status || 'novos';
        
        if (status === 'pendente' || status === 'aceito') status = 'novos';
        if (status === 'preparo' || status === 'pronto') status = 'preparo';
        if (status === 'finalizado') status = 'finalizados';

        if (counts[status] !== undefined) counts[status]++;
        
        criarCard(p, status, listaNovos, listaPreparo, listaFinalizados);
    });

    document.getElementById('count-novos').innerText = counts.novos;
    document.getElementById('count-preparo').innerText = counts.preparo;
    document.getElementById('count-finalizados').innerText = counts.finalizados;
}

function criarCard(p, status, listaNovos, listaPreparo, listaFinalizados) {
    let itensArray = p.itens;
    if (typeof itensArray === 'string') {
        try { itensArray = JSON.parse(itensArray); } catch(e) { itensArray = []; }
    }
    let htmlItens = Array.isArray(itensArray) 
        ? itensArray.map(i => `<div>${i.qtd || 1}x ${i.nome}</div>`).join('') 
        : '';

    let btnHtml = '';
    let corBorda = '#FFC300'; // Amarelo padrão

    if (status === 'novos') {
        // Botão Único: Aceitar
        btnHtml = `<button class="btn-action btn-amarelo" onclick="atualizarStatus(${p.id}, 'preparo')">
            <i class="fas fa-fire"></i> Mudar p/ Preparo
        </button>`;
    } else if (status === 'preparo') {
        // --- AQUI ESTÁ A MUDANÇA: 2 BOTÕES ---
        btnHtml = `
            <div class="card-actions">
                <button class="btn-action btn-azul" onclick="apenasImprimir(${p.id})">
                    <i class="fas fa-print"></i> Imprimir
                </button>
                <button class="btn-action btn-verde" onclick="abrirModalFinalizar(${p.id})">
                    <i class="fas fa-check"></i> Finalizar
                </button>
            </div>
        `;
    } else if (status === 'finalizados') {
        // Apenas texto visual
        btnHtml = `<div style="text-align:right; color:#28a745; font-weight:bold; font-size:0.85rem; margin-top:10px;">
            <i class="fas fa-check-square"></i> Pedido Concluído
        </div>`;
    }

    if(p.cliente_nome.includes('WhatsApp')) corBorda = '#25D366'; // Verde Zap

    const dataObj = new Date(p.data_pedido);
    const hora = isNaN(dataObj) ? '--:--' : dataObj.toLocaleTimeString('pt-BR').slice(0,5);
    
    const div = document.createElement('div');
    div.className = 'order-card';
    div.style.borderLeft = `5px solid ${corBorda}`;
    
    div.innerHTML = `
        <div class="order-info"><strong>#${p.id}</strong><span style="color:#666">${hora}</span></div>
        <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px; color:#333;">${p.cliente_nome}</div>
        <div class="order-items" style="margin-bottom:10px; font-size:0.95rem; line-height:1.4;">
            ${htmlItens} 
            ${p.observacao ? `<div style="background:#FFF3CD; color:#856404; padding:5px; margin-top:5px; border-radius:4px; font-size:0.85rem;">⚠️ ${p.observacao}</div>` : ''}
        </div>
        <div style="font-weight:bold; color:#2e7d32; text-align:right; margin-bottom:5px;">Total: R$ ${parseFloat(p.total).toFixed(2).replace('.',',')}</div>
        ${btnHtml}
    `;

    if (status === 'novos') listaNovos.appendChild(div);
    else if (status === 'preparo') listaPreparo.appendChild(div);
    else listaFinalizados.appendChild(div);
}

window.atualizarStatus = async function(id, novoStatus) {
    try {
        await fetch(`/api/pedidos/${id}/status`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: novoStatus })
        });
        carregarDados();
    } catch(e) { alert("Erro ao atualizar status"); }
}

// 1. Função APENAS Imprimir (Não finaliza)
window.apenasImprimir = function(id) {
    const p = PEDIDOS_CACHE.find(item => item.id == id);
    if (!p) return;
    gerarHTMLCupom(p);
    setTimeout(() => window.print(), 100);
}

// 2. Função APENAS abre modal de Finalizar
window.abrirModalFinalizar = function(id) {
    pedidoParaFinalizarId = id;
    document.getElementById('modal-confirm-custom').style.display = 'flex';
}

// Executa a finalização real no banco
async function executarFinalizacao(id) {
    await atualizarStatus(id, 'finalizado');
}

function gerarHTMLCupom(p) {
    const area = document.getElementById('printable-area');
    const dataHoje = new Date().toLocaleString('pt-BR');
    let itens = p.itens;
    if(typeof itens === 'string') itens = JSON.parse(itens);
    
    let htmlItens = itens.map(i => `
        <div class="cupom-item">
            <span>${i.qtd || 1}x ${i.nome}</span>
            <span>R$ ${parseFloat(i.preco || 0).toFixed(2).replace('.',',')}</span>
        </div>
    `).join('');

    area.innerHTML = `
        <div class="cupom-header">
            <div style="font-size:16px; font-weight:bold;">TIPICU'S</div>
            <div>PEDIDO #${p.id}</div>
            <div>${dataHoje}</div>
        </div>
        <div style="text-align:left; margin-bottom:5px; border-bottom:1px dashed #000; padding-bottom:5px;">
            <strong>CLIENTE:</strong><br>${p.cliente_nome}
        </div>
        <div class="cupom-body">${htmlItens}</div>
        ${p.observacao ? `<div class="cupom-obs">OBS: ${p.observacao}</div>` : ''}
        <div class="cupom-total">TOTAL: R$ ${parseFloat(p.total).toFixed(2).replace('.',',')}</div>
        <div class="cupom-footer">www.tipicus.com.br</div>
    `;
}

window.baixarRelatorioDia = function() {
    if (PEDIDOS_CACHE.length === 0) {
        alert("Sem dados para gerar relatório hoje.");
        return;
    }

    const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID;Hora;Cliente;Status;Total;Itens\n";

    PEDIDOS_CACHE.forEach(p => {
        const hora = new Date(p.data_pedido).toLocaleTimeString('pt-BR');
        let itensTexto = "";
        let itens = p.itens;
        if (typeof itens === 'string') {
            try { itens = JSON.parse(itens); } catch(e) {}
        }
        if (Array.isArray(itens)) {
            itensTexto = itens.map(i => `${i.qtd}x ${i.nome}`).join(" | ");
        }

        const linha = `${p.id};${hora};${p.cliente_nome};${p.status};${p.total};${itensTexto}`;
        csvContent += linha + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_Vendas_${dataHoje}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* --- MANUAL --- */
async function carregarPratosParaManual() {
    try {
        const res = await fetch('/api/cardapio');
        const data = await res.json();
        const lista = document.getElementById('manual-lista-pratos');
        lista.innerHTML = '';
        data.produtos.forEach(p => {
            if(p.ativo) {
                lista.innerHTML += `
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px solid #f0f0f0;">
                        <label><input type="checkbox" class="chk-manual" value="${p.id}" data-nome="${p.nome}" data-preco="${p.preco}"> ${p.nome}</label>
                        <span>R$ ${p.preco}</span>
                    </div>`;
            }
        });
    } catch(e) { console.error(e); }
}

window.abrirModalManual = function() {
    carregarPratosParaManual();
    document.getElementById('modal-manual').style.display = 'flex';
}

window.enviarManual = async function() {
    const nome = document.getElementById('manual-nome').value || 'Balcão';
    const obs = document.getElementById('manual-obs').value;
    const checks = document.querySelectorAll('.chk-manual:checked');
    if(checks.length === 0) return alert("Selecione pelo menos um prato!");
    const itens = [];
    let total = 0;
    checks.forEach(chk => {
        const preco = parseFloat(chk.getAttribute('data-preco'));
        itens.push({ nome: chk.getAttribute('data-nome'), preco: preco, qtd: 1 });
        total += preco;
    });
    const pedido = { cliente: nome, itens: itens, total: total, obs: obs, status: 'pendente' };
    try {
        await fetch('/api/pedidos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(pedido)
        });
        document.getElementById('modal-manual').style.display = 'none';
        carregarDados();
        document.getElementById('manual-nome').value = '';
        document.getElementById('manual-obs').value = '';
    } catch(e) { alert("Erro ao lançar pedido manual"); }
}