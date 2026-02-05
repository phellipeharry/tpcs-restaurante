/* ==========================================================================
   CLIENTE JS - SITE DO CLIENTE (NAVEGADOR) - VERSÃO CORRIGIDA
   ========================================================================== */

let pedido = { pratos: [], bebidas: [], total: 0 };
let abaAtualPratos = 'semana';
let DADOS_SERVIDOR = null;

// --- INICIALIZAÇÃO ---
window.addEventListener('load', async function() {
    console.log("🚀 Iniciando Client JS...");
    await carregarDadosDoBanco(); 
    detectarData(); // Define se abre na aba Semana ou FDS
    renderizarTudo();
    ativarScrollDesktop();
});

// 1. BUSCAR DADOS DO BACKEND
async function carregarDadosDoBanco() {
    try {
        const res = await fetch('/api/cardapio'); 
        if (!res.ok) throw new Error("Falha na API");
        
        DADOS_SERVIDOR = await res.json();
        console.log("📦 Dados recebidos:", DADOS_SERVIDOR); // Ajuda a ver se os produtos vieram
    } catch (err) {
        console.error("❌ Erro ao conectar com servidor:", err);
        document.getElementById('pratos-list').innerHTML = '<div style="padding:20px; text-align:center; color:red">Erro ao carregar cardápio. Tente atualizar.</div>';
    }
}

// 2. DETECTAR FIM DE SEMANA (Para abrir a aba certa automaticamente)
function detectarData() {
    const dia = new Date().getDay(); // 0 = Domingo, 6 = Sábado
    if (dia === 6 || dia === 0) {
        abaAtualPratos = 'fim_semana';
    } else {
        abaAtualPratos = 'semana';
    }
    
    // Atualiza visual dos botões de navegação
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    
    // Tenta achar o botão certo para marcar como ativo
    const botoes = document.querySelectorAll('.nav-item');
    if (abaAtualPratos === 'semana' && botoes[0]) botoes[0].classList.add('active');
    if (abaAtualPratos === 'fim_semana' && botoes[1]) botoes[1].classList.add('active');
}

// 3. RENDERIZAR TELA (COLOCAR OS PRATOS NO HTML)
function renderizarTudo() {
    if(!DADOS_SERVIDOR || !DADOS_SERVIDOR.produtos) return;

    const containerPratos = document.getElementById('pratos-list');
    const containerBebidas = document.getElementById('bebidas-list');
    
    // Filtragem segura
    // Nota: O backend já filtra 'ativo = 1', mas garantimos aqui também
    const pratosDia = DADOS_SERVIDOR.produtos.filter(p => {
        // Normaliza a categoria para evitar erro de digitação (remove espaços e poe minusculo)
        const catProduto = (p.categoria || '').toLowerCase().trim();
        return catProduto === abaAtualPratos;
    });

    const bebidas = DADOS_SERVIDOR.produtos.filter(p => {
        const catProduto = (p.categoria || '').toLowerCase().trim();
        return catProduto === 'bebida';
    });
    
    // --- PROTEÇÃO CONTRA CONFIG VAZIA (EVITA TELA BRANCA) ---
    const configs = DADOS_SERVIDOR.configs || {};
    const textoSemana = configs.acompanhamentos_semana || 'Arroz, Feijão e Salada'; // Texto padrão se vier vazio
    const textoFds = configs.acompanhamentos_fds || 'Acompanhamentos Especiais';

    const textoAcomp = abaAtualPratos === 'semana' ? textoSemana : textoFds;
    
    if(document.getElementById('display-acompanhamentos')) {
        document.getElementById('display-acompanhamentos').innerText = textoAcomp;
    }
    
    // Renderiza Pratos
    containerPratos.innerHTML = '';
    if(pratosDia.length === 0) {
        containerPratos.innerHTML = `
            <div style="padding:40px; text-align:center; width:100%; color:#888; display:flex; flex-direction:column; align-items:center;">
                <i class="fas fa-store-slash" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i>
                Sem pratos cadastrados para esta categoria (${abaAtualPratos === 'semana' ? 'Semana' : 'Fim de Semana'}).<br>
                <small>Verifique o painel Admin.</small>
            </div>`;
    }
    pratosDia.forEach(item => containerPratos.innerHTML += criarHTMLCard(item, 'prato'));

    // Renderiza Bebidas
    containerBebidas.innerHTML = '';
    if(bebidas.length === 0) {
        containerBebidas.innerHTML = '<div style="padding:20px; text-align:center; width:100%; color:#999; font-size:0.9rem;">Nenhuma bebida disponível.</div>';
    }
    bebidas.forEach(item => containerBebidas.innerHTML += criarHTMLCard(item, 'bebida'));
    
    recuperarEstadoVisual();
}

function criarHTMLCard(item, tipo) {
    // Garante que preço é número
    const preco = parseFloat(item.preco || 0);
    const imagem = item.imagem || 'https://placehold.co/400?text=Sem+Foto';

    return `
    <div class="food-card" id="prod-${item.id}">
        <img src="${imagem}" class="card-img" draggable="false" loading="lazy">
        <div class="card-body">
            <h4 class="card-title">${item.nome}</h4>
            <div class="card-desc">${item.descricao || ''}</div>
            <div class="card-footer">
                <span class="price">R$ ${preco.toFixed(2).replace('.',',')}</span>
                <div class="qty-selector">
                    <div class="btn-qty minus" onclick="alterarQtd(${item.id}, -1, '${item.nome.replace(/'/g, "\\'")}', ${preco}, '${tipo}')"><i class="fas fa-minus"></i></div>
                    <span class="qty-display">0</span>
                    <div class="btn-qty plus" onclick="alterarQtd(${item.id}, 1, '${item.nome.replace(/'/g, "\\'")}', ${preco}, '${tipo}')"><i class="fas fa-plus"></i></div>
                </div>
            </div>
        </div>
    </div>`;
}

// 4. LÓGICA DE QUANTIDADE E CARRINHO
window.alterarQtd = function(idDb, mudanca, nome, preco, tipo) {
    const card = document.getElementById(`prod-${idDb}`);
    if(!card) return;

    const display = card.querySelector('.qty-display');
    let novaQtd = parseInt(display.innerText) + mudanca;
    if(novaQtd < 0) novaQtd = 0;
    
    display.innerText = novaQtd;
    
    if(novaQtd > 0) card.classList.add('selected');
    else card.classList.remove('selected');

    const itemObj = { id: idDb, nome, preco };
    
    // Atualiza o array global de pedidos
    if(tipo === 'prato') pedido.pratos = pedido.pratos.filter(p => p.id !== idDb);
    else pedido.bebidas = pedido.bebidas.filter(b => b.id !== idDb);
    
    // Adiciona a nova quantidade
    for(let i=0; i<novaQtd; i++) {
        if(tipo === 'prato') pedido.pratos.push(itemObj);
        else pedido.bebidas.push(itemObj);
    }
    
    calcularTotal();
}

function recuperarEstadoVisual() {
    // Re-aplica as quantidades se a tela for redesenhada (ao trocar de aba)
    const todosItens = [...pedido.pratos, ...pedido.bebidas];
    const contagem = {};
    todosItens.forEach(i => contagem[i.id] = (contagem[i.id] || 0) + 1);

    for (const [id, qtd] of Object.entries(contagem)) {
        const card = document.getElementById(`prod-${id}`);
        if(card) {
            card.querySelector('.qty-display').innerText = qtd;
            card.classList.add('selected');
        }
    }
}

function calcularTotal() {
    pedido.total = [...pedido.pratos, ...pedido.bebidas].reduce((acc, i) => acc + i.preco, 0);
    const count = pedido.pratos.length + pedido.bebidas.length;
    const barra = document.getElementById('barra-checkout');
    
    if(count > 0 && barra) {
        document.getElementById('checkout-total').innerText = 'R$ ' + pedido.total.toFixed(2).replace('.', ',');
        document.getElementById('checkout-count-circle').innerText = count;
        barra.style.display = 'flex';
        // Pequeno delay para animação CSS
        setTimeout(() => barra.classList.add('visible'), 10);
    } else if (barra) {
        barra.classList.remove('visible');
        setTimeout(() => barra.style.display = 'none', 300);
    }
}

// Troca de Abas (Semana / Fim de Semana)
window.mudarAbaPratos = function(novaAba, el) { 
    abaAtualPratos = novaAba; 
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderizarTudo();
}

// 5. MODAIS
window.abrirModalConfirmacao = function() {
    const lista = document.getElementById('lista-confirmacao');
    lista.innerHTML = '';
    
    // Agrupa itens iguais
    const contagem = {};
    [...pedido.pratos, ...pedido.bebidas].forEach(i => {
        const k = i.nome + '|' + i.preco; // Chave única
        if(!contagem[k]) contagem[k] = { ...i, qtd: 0 };
        contagem[k].qtd++;
    });

    Object.values(contagem).forEach(i => {
        lista.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px dashed #eee; padding-bottom:5px;">
                <div><span style="color:#FFC300; font-weight:bold;">${i.qtd}x</span> ${i.nome}</div>
                <div>R$ ${(i.preco * i.qtd).toFixed(2).replace('.',',')}</div>
            </div>`;
    });
    
    document.getElementById('total-modal').innerText = 'R$ ' + pedido.total.toFixed(2).replace('.', ',');
    document.getElementById('modal-confirmacao').style.display = 'flex';
}

window.fecharModal = function() { document.getElementById('modal-confirmacao').style.display = 'none'; }

// --- FINALIZAR PEDIDO ---
window.finalizarPedido = async function() {
    const nome = document.getElementById('clienteNomeFinal').value.trim();
    if(!nome) { alert('Por favor, digite seu nome!'); return; }
    
    const obs = document.getElementById('observacaoFinal').value;
    const btnEnviar = document.querySelector('button[onclick="finalizarPedido()"]');
    
    // Feedback visual
    const textoOriginal = btnEnviar.innerHTML;
    btnEnviar.innerText = "Enviando...";
    btnEnviar.disabled = true;
    
    // Prepara itens resumidos para o banco
    const itensResumidos = [];
    const contagem = {};
    [...pedido.pratos, ...pedido.bebidas].forEach(i => {
        const k = i.nome;
        if(!contagem[k]) contagem[k] = { nome: i.nome, qtd: 0 };
        contagem[k].qtd++;
    });
    Object.values(contagem).forEach(val => itensResumidos.push(val));

    const dadosPedido = {
        cliente: nome,
        itens: itensResumidos,
        total: pedido.total,
        obs: obs,
        status: 'pendente' 
    };

    try {
        const res = await fetch('/api/pedidos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(dadosPedido)
        });

        if (res.ok) {
            const respostaJson = await res.json(); 
            
            // Mensagem para o Bot ler
            let txt = `Olá! Fiz o pedido *#${respostaJson.id}* pelo site.`;
            txt += `\nSou: *${nome}*`;
            
            // --- CORREÇÃO BUG #03: USA O NÚMERO DINÂMICO ---
            // Tenta pegar o número que veio do servidor (salvo em DADOS_SERVIDOR)
            // Se não tiver, usa um fallback (segurança)
            let numeroZap = '5599999999999';
            if (DADOS_SERVIDOR && DADOS_SERVIDOR.configs && DADOS_SERVIDOR.configs.whatsapp_number) {
                numeroZap = DADOS_SERVIDOR.configs.whatsapp_number;
            }
            
            window.open(`https://wa.me/${numeroZap}?text=${encodeURIComponent(txt)}`, '_blank');
            // -----------------------------------------------
            
            fecharModal();
            location.reload(); 
        } else {
            alert("Erro ao salvar pedido no sistema. Tente novamente.");
            btnEnviar.innerText = textoOriginal;
            btnEnviar.disabled = false;
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão com o servidor.");
        btnEnviar.innerText = textoOriginal;
        btnEnviar.disabled = false;
    }
}

// 6. SCROLL MOUSE (UX) - Permite arrastar o carrossel no PC
function ativarScrollDesktop() {
    const sliders = document.querySelectorAll('.carousel-track');
    sliders.forEach(slider => {
        let isDown = false;
        let startX, scrollLeft;
        slider.addEventListener('mousedown', (e) => {
            isDown = true; slider.style.cursor = 'grabbing'; e.preventDefault(); 
            startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft;
        });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.style.cursor = 'grab'; });
        slider.addEventListener('mouseup', () => { isDown = false; slider.style.cursor = 'grab'; });
        slider.addEventListener('mousemove', (e) => {
            if(!isDown) return; e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            slider.scrollLeft = scrollLeft - (x - startX) * 2; 
        });
    });
}