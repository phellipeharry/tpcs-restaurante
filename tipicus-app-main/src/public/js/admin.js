/* ADMIN JS - VERSÃO FINAL SINCRONIZADA */
let botPollingInterval = null;
let PRODUTOS_CACHE = [];

document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard();
    carregarProdutos(); 
    setInterval(carregarDashboard, 15000);
    verificarBotCiclo(3000);
});

/* ============================================================
   1. GESTÃO DE PRODUTOS
   ============================================================ */
async function carregarProdutos() {
    try {
        const res = await fetch('http://localhost:3000/api/produtos');
        const produtos = await res.json();
        PRODUTOS_CACHE = produtos;

        // Mapeia as colunas do HTML
        const cols = {
            'semana': document.getElementById('lista-semana'),
            'fim_semana': document.getElementById('lista-fim_semana'),
            'bebida': document.getElementById('lista-bebida')
        };

        // Limpa tudo
        Object.values(cols).forEach(el => { if(el) el.innerHTML = ''; });

        produtos.forEach(p => {
            let catCrua = p.categoria_aba ? p.categoria_aba.toLowerCase().trim() : 'semana';
            let container = cols[catCrua];
            
            // Fallback se categoria vier estranha
            if (!container) {
                if (catCrua.includes('bebida')) container = cols['bebida'];
                else if (catCrua.includes('fim')) container = cols['fim_semana'];
                else container = cols['semana'];
            }

            const imgShow = p.imagem ? p.imagem : 'https://placehold.co/150?text=Sem+Foto';

            if (container) {
                container.innerHTML += `
                    <div class="prod-card">
                        <img src="${imgShow}" alt="${p.nome}" style="object-fit:cover;" onerror="this.src='https://placehold.co/150?text=Sem+Foto'">
                        <div style="padding:10px; flex:1;">
                            <h4 style="margin:5px 0; font-size:1rem;">${p.nome}</h4>
                            <div style="color:green; font-weight:bold;">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</div>
                            <p style="font-size:0.8rem; color:#666; margin:5px 0;">${p.descricao || ''}</p>
                        </div>
                        <div class="prod-actions" style="padding:10px; display:flex; gap: 5px;">
                            <button onclick="abrirModalProduto(${p.id})" style="flex:1; background:#f39c12; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deletarProduto(${p.id})" style="flex:1; background:#d32f2f; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
        });
    } catch(e) { console.error("Erro ao carregar produtos", e); }
}

// CONVERSÃO DE IMAGEM
const lerArquivo = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

window.converterImagem = async function() {
    const file = document.getElementById('prod-file').files[0];
    const preview = document.getElementById('img-preview');
    if(file) {
        try {
            const base64 = await lerArquivo(file);
            preview.src = base64;
            preview.style.display = 'block';
            // Salva no hidden input para garantir
            document.getElementById('prod-img-base64').value = base64;
        } catch(err) { console.error(err); }
    }
}

window.abrirModalProduto = function(id = null) {
    const elFile = document.getElementById('prod-file');
    const elPreview = document.getElementById('img-preview');
    const elImgBase64 = document.getElementById('prod-img-base64');
    
    // Limpa estado anterior
    elFile.value = '';

    if(id) {
        const p = PRODUTOS_CACHE.find(item => item.id === id);
        if(p) {
            document.getElementById('prod-id').value = p.id;
            document.getElementById('prod-nome').value = p.nome;
            document.getElementById('prod-preco').value = p.preco;
            document.getElementById('prod-categoria').value = p.categoria_aba || 'semana';
            document.getElementById('prod-desc').value = p.descricao || '';
            
            elImgBase64.value = p.imagem || '';
            if(p.imagem) {
                elPreview.src = p.imagem;
                elPreview.style.display = 'block';
            } else {
                elPreview.style.display = 'none';
            }
        }
    } else {
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-nome').value = '';
        document.getElementById('prod-preco').value = '';
        document.getElementById('prod-categoria').value = 'semana';
        document.getElementById('prod-desc').value = '';
        elImgBase64.value = '';
        elPreview.src = '';
        elPreview.style.display = 'none';
    }
    document.getElementById('modal-produto').style.display = 'flex';
}

window.fecharModal = function() {
    document.getElementById('modal-produto').style.display = 'none';
}

window.salvarProduto = async function() {
    const id = document.getElementById('prod-id').value;
    const fileInput = document.getElementById('prod-file');
    
    // Pega a imagem que já estava lá (hidden) ou a nova
    let imagemFinal = document.getElementById('prod-img-base64').value;

    // Se usuário escolheu arquivo novo agora, converte e sobrescreve
    if(fileInput.files.length > 0) {
        try {
            imagemFinal = await lerArquivo(fileInput.files[0]);
        } catch(err) {
            alert("Erro ao processar imagem");
            return;
        }
    }

    const produto = {
        id: id ? parseInt(id) : null,
        nome: document.getElementById('prod-nome').value,
        preco: parseFloat(document.getElementById('prod-preco').value),
        categoriaAba: document.getElementById('prod-categoria').value,
        imagem: imagemFinal,
        descricao: document.getElementById('prod-desc').value,
        tipo: document.getElementById('prod-categoria').value === 'bebida' ? 'bebida' : 'prato',
        hidden: false
    };

    if(!produto.nome || !produto.preco) return alert("Preencha nome e preço!");

    try {
        await fetch('/api/produtos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(produto)
        });
        fecharModal();
        carregarProdutos();
    } catch(e) { 
        console.error(e);
        alert("Erro ao salvar."); 
    }
}

window.deletarProduto = async function(id) {
    if(confirm("Deseja apagar?")) {
        await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
        carregarProdutos();
    }
}

/* ============================================================
   2. BOT E QR CODE
   ============================================================ */
function verificarBotCiclo(tempo) {
    if (botPollingInterval) clearInterval(botPollingInterval);
    carregarStatusBot(); 
    botPollingInterval = setInterval(carregarStatusBot, tempo);
}

async function carregarStatusBot() {
    try {
        const res = await fetch('/api/bot/status');
        const data = await res.json();
        
        const statusText = document.getElementById('bot-status-text');
        const qrImg = document.getElementById('qr-image');
        const btnLogout = document.getElementById('btn-logout');

        if (data.status === 'conectado') {
            statusText.innerHTML = '<span class="status-badge st-conectado">✅ Conectado</span>';
            qrImg.style.display = 'none';
            btnLogout.style.display = 'inline-block';
        } else if (data.status === 'aguardando_qr' && data.qr) {
            statusText.innerHTML = '<span class="status-badge st-aguardando">🟡 Ler QR Code</span>';
            qrImg.src = data.qr; qrImg.style.display = 'block';
            btnLogout.style.display = 'none';
        } else {
            statusText.innerHTML = '⏳ Iniciando...';
            qrImg.style.display = 'none';
            btnLogout.style.display = 'none';
        }
    } catch (e) { console.error("Erro bot", e); }
}

async function desconectarBot() {
    if(confirm("Desconectar?")) {
        await fetch('/api/bot/logout', { method: 'POST' });
        verificarBotCiclo(3000);
    }
}

/* ============================================================
   3. DASHBOARD
   ============================================================ */
async function carregarDashboard() {
    try {
        const res = await fetch('/api/pedidos/hoje');
        if (!res.ok) return;
        
        const vendas = await res.json();
        if (!vendas || !Array.isArray(vendas)) return;

        const elQtd = document.getElementById('dash-qtd');
        const elTotal = document.getElementById('dash-total');
        const elMedio = document.getElementById('dash-medio');
        const elTbody = document.getElementById('lista-vendas');

        if (!elQtd || !elTbody) return;

        const validas = vendas.filter(v => v.status !== 'cancelado');
        const total = validas.reduce((acc, v) => acc + parseFloat(v.total), 0);
        const qtd = vendas.length;
        const medio = qtd > 0 ? total/qtd : 0;

        elQtd.innerText = qtd;
        elTotal.innerText = 'R$ ' + total.toFixed(2).replace('.',',');
        elMedio.innerText = 'R$ ' + medio.toFixed(2).replace('.',',');

        elTbody.innerHTML = '';
        vendas.forEach(v => {
            let hora = '--:--';
            if(v.data_pedido) hora = new Date(v.data_pedido).toLocaleTimeString('pt-BR').slice(0,5);
            
            let styleBadge = 'background:#ccc; color:#333;';
            if(v.status == 'finalizado') styleBadge = 'background:#d4edda; color:#155724;';
            if(v.status == 'cancelado') styleBadge = 'background:#f8d7da; color:#721c24;';
            if(v.status == 'preparando') styleBadge = 'background:#fff3cd; color:#856404;';

            elTbody.innerHTML += `
                <tr>
                    <td>#${v.id}</td>
                    <td>${hora}</td>
                    <td>${v.cliente_nome || 'Cliente'}</td>
                    <td>R$ ${parseFloat(v.total).toFixed(2).replace('.',',')}</td>
                    <td><span class="status-badge" style="${styleBadge}">${v.status}</span></td>
                </tr>`;
        });

    } catch (e) { console.error(e); }
}

window.abrirAba = function(nomeAba) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-'+nomeAba).classList.add('active');
    
    // Ativa botão (gambiarra visual segura)
    const btns = document.querySelectorAll('.tab-btn');
    for(let b of btns) {
        if(b.onclick.toString().includes(nomeAba)) b.classList.add('active');
    }
}

// Abre o modal e define as datas padrão (hoje)
function abrirModalRelatorio() {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('relatorio-inicio').value = hoje;
    document.getElementById('relatorio-fim').value = hoje;
    document.getElementById('modal-relatorio').style.display = 'flex';
}

function fecharModalRelatorio() {
    document.getElementById('modal-relatorio').style.display = 'none';
}

function confirmarDownloadRelatorio() {
    const inicio = document.getElementById('relatorio-inicio').value;
    const fim = document.getElementById('relatorio-fim').value;

    if (!inicio || !fim) {
        notificar("Selecione as duas datas!", "erro"); // Usa sua função nova de notificação
        return;
    }

    // Redireciona para a rota do backend que força o download
    window.location.href = `/download-relatorio?inicio=${inicio}&fim=${fim}`;
    
    fecharModalRelatorio();
    notificar("Gerando relatório...", "sucesso");
}