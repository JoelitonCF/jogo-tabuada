// Inicializar Socket.IO
const socket = io();

// Elementos da interface - Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content > div');

// Elementos da interface - Configurações
const configForm = document.getElementById('configForm');
const operacaoSelect = document.getElementById('operacaoAtual');
const tabuadaSelect = document.getElementById('tabuadaAtual');
const tempoLimiteInput = document.getElementById('tempoLimite');
const numQuestoesInput = document.getElementById('numQuestoes');
const configStatus = document.getElementById('configStatus');
const numConnectedSpan = document.getElementById('numConnected');
const estatisticasOperacoesDiv = document.getElementById('estatisticasOperacoes');

// Elementos da interface - Ranking
const btnExportarCSV = document.getElementById('exportarCSV');
const rankingBody = document.getElementById('rankingBody');

// Elementos da interface - Relatórios
const dadosGeraisDiv = document.getElementById('dadosGerais');
const relatorioAlunosBody = document.getElementById('relatorioAlunosBody');

// Receber informações sobre usuários conectados
socket.on('user_count', function(count) {
    numConnectedSpan.textContent = count;
});

// Event listeners
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        tab.classList.add('active');

        // Hide all tab content
        tabContents.forEach(content => {
            content.classList.remove('active');
        });

        // Show the selected tab content
        const tabId = tab.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');

        // Carregar dados específicos da aba
        if (tabId === 'rankingTab') {
            carregarRanking();
        } else if (tabId === 'relatoriosTab') {
            carregarRelatorios();
        }
    });
});

// Salvar configurações
configForm.addEventListener('submit', function (e) {
    e.preventDefault();
    salvarConfiguracoes();
});

// Exportar CSV
btnExportarCSV.addEventListener('click', exportarCSV);

// Carregar configurações ao iniciar a página
window.addEventListener('load', function () {
    carregarConfiguracoes();

    // Carregar dados da tab ativa inicialmente
    if (document.getElementById('rankingTab').classList.contains('active')) {
        carregarRanking();
    } else if (document.getElementById('relatoriosTab').classList.contains('active')) {
        carregarRelatorios();
    }
});

// função para alterar nome das operaçoes
function formatarNomeOperacao(operacao) {
    const nomes = {
        multiplicacao: 'Multiplicação',
        divisao: 'Divisão',
        soma: 'Soma',
        subtracao: 'Subtração'
    };
    return nomes[operacao] || operacao;
}

function carregarConfiguracoes() {
    fetch('/api/config')
        .then(response => response.json())
        .then(data => {
            operacaoSelect.value = data.operacaoAtual;
            tabuadaSelect.value = data.tabuadaAtual;
            tempoLimiteInput.value = data.tempoLimite;
            numQuestoesInput.value = data.numeroQuestoes;
        })
        .catch(error => {
            console.error('Erro ao carregar configurações:', error);
            mostrarMensagem('Erro ao carregar configurações do servidor.', false);
        });
}

function salvarConfiguracoes() {
    const novasConfiguracoes = {
        operacaoAtual: operacaoSelect.value,
        tabuadaAtual: tabuadaSelect.value,
        tempoLimite: parseInt(tempoLimiteInput.value),
        numeroQuestoes: parseInt(numQuestoesInput.value)
    };

    fetch('/api/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(novasConfiguracoes)
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                mostrarMensagem('Configurações salvas com sucesso! Todos os alunos conectados foram atualizados.', true);
            } else {
                mostrarMensagem('Erro ao salvar configurações: ' + data.error, false);
            }
        })
        .catch(error => {
            console.error('Erro ao salvar configurações:', error);
            mostrarMensagem('Erro ao comunicar com o servidor.', false);
        });
}

function mostrarMensagem(mensagem, sucesso) {
    configStatus.textContent = mensagem;
    configStatus.className = 'config-status';
    configStatus.classList.add(sucesso ? 'success-msg' : 'error-msg');
    configStatus.style.display = 'block';

    setTimeout(() => {
        configStatus.style.display = 'none';
    }, 3000);
}

function carregarRanking() {
    // Limpar tabela
    rankingBody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

    // Carregar ranking do servidor
    fetch('/api/ranking')
        .then(response => response.json())
        .then(data => {
            rankingBody.innerHTML = '';

            if (data.length === 0) {
                rankingBody.innerHTML = '<tr><td colspan="5">Nenhum registro encontrado</td></tr>';
                return;
            }

            data.forEach(item => {
                const row = document.createElement('tr');

                const nomeCell = document.createElement('td');
                nomeCell.textContent = item.nome;

                const pontuacaoCell = document.createElement('td');
                pontuacaoCell.textContent = item.pontuacao;

                const totalCell = document.createElement('td');
                totalCell.textContent = item.total;

                const percentualCell = document.createElement('td');
                percentualCell.textContent = `${item.percentual}%`;

                const dataCell = document.createElement('td');
                dataCell.textContent = item.data;

                row.appendChild(nomeCell);
                row.appendChild(pontuacaoCell);
                row.appendChild(totalCell);
                row.appendChild(percentualCell);
                row.appendChild(dataCell);

                rankingBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar ranking:', error);
            rankingBody.innerHTML = '<tr><td colspan="5">Erro ao carregar dados</td></tr>';
        });
}

function carregarRelatorios() {
    // Limpar dados
    dadosGeraisDiv.innerHTML = 'Carregando...';
    estatisticasOperacoesDiv.innerHTML = 'Carregando...';
    relatorioAlunosBody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

    // Carregar relatórios do servidor
    fetch('/api/relatorios')
        .then(response => response.json())
        .then(data => {
            // Exibir dados gerais
            const dadosGerais = data.dadosGerais;
            dadosGeraisDiv.innerHTML = `
                <table>
                    <tr>
                        <td><strong>Total de Alunos:</strong></td>
                        <td>${dadosGerais.totalAlunos}</td>
                    </tr>
                    <tr>
                        <td><strong>Total de Tentativas:</strong></td>
                        <td>${dadosGerais.totalTentativas}</td>
                    </tr>
                    <tr>
                        <td><strong>Média de Acertos:</strong></td>
                        <td>${dadosGerais.mediaPercentual}%</td>
                    </tr>
                    <tr>
                        <td><strong>Total de Acertos:</strong></td>
                        <td>${dadosGerais.totalPontos} de ${dadosGerais.totalQuestoes}</td>
                    </tr>
                </table>
            `;

            // Exibir estatísticas por operação
            const operacoes = data.estatisticasOperacoes;
            let estatisticasHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Operação</th>
                            <th>Tentativas</th>
                            <th>Acertos</th>
                            <th>Taxa de Acerto</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            Object.keys(operacoes).forEach(opKey => {
                const op = operacoes[opKey];
                if (op.tentativas > 0) {
                    estatisticasHTML += `
                        <tr>
                            <td>${formatarNomeOperacao(opKey)}</td>
                            <td>${op.tentativas}</td>
                            <td>${op.pontos} de ${op.total}</td>
                            <td>${op.percentual}%</td>
                        </tr>
                    `;
                }
            });

            estatisticasHTML += `
                    </tbody>
                </table>
            `;
            estatisticasOperacoesDiv.innerHTML = estatisticasHTML;

            // Exibir relatório por aluno
            relatorioAlunosBody.innerHTML = '';

            if (data.relatorioAlunos.length === 0) {
                relatorioAlunosBody.innerHTML = '<tr><td colspan="5">Nenhum registro encontrado</td></tr>';
                return;
            }

            data.relatorioAlunos.forEach(aluno => {
                const row = document.createElement('tr');

                const nomeCell = document.createElement('td');
                nomeCell.textContent = aluno.nome;

                const tentativasCell = document.createElement('td');
                tentativasCell.textContent = aluno.tentativas;

                const mediaCell = document.createElement('td');
                mediaCell.textContent = `${aluno.mediaPercentual}%`;

                const ultimaCell = document.createElement('td');
                ultimaCell.textContent = aluno.ultimaTentativa;

                // Nova célula para mostrar detalhes por operação
                const operacoesCell = document.createElement('td');
                
                // Criar botão para mostrar detalhes
                const detalhesBtn = document.createElement('button');
                detalhesBtn.textContent = 'Ver Detalhes';
                detalhesBtn.className = 'action-button';
                detalhesBtn.onclick = function() {
                    // Criar e mostrar um modal com detalhes das operações
                    mostrarDetalhesOperacoes(aluno);
                };
                
                operacoesCell.appendChild(detalhesBtn);

                row.appendChild(nomeCell);
                row.appendChild(tentativasCell);
                row.appendChild(mediaCell);
                row.appendChild(ultimaCell);
                row.appendChild(operacoesCell);

                relatorioAlunosBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar relatórios:', error);
            dadosGeraisDiv.innerHTML = 'Erro ao carregar dados gerais';
            estatisticasOperacoesDiv.innerHTML = 'Erro ao carregar estatísticas';
            relatorioAlunosBody.innerHTML = '<tr><td colspan="5">Erro ao carregar dados</td></tr>';
        });
}

// Modal para mostrar detalhes de operações por aluno
function mostrarDetalhesOperacoes(aluno) {
    // Criar o modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // Criar conteúdo do modal
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Cabeçalho do modal
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const title = document.createElement('h3');
    title.textContent = `Detalhes de ${aluno.nome}`;
    
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-modal';
    closeBtn.textContent = '×';
    closeBtn.onclick = function() {
        document.body.removeChild(modal);
    };
    
    modalHeader.appendChild(title);
    modalHeader.appendChild(closeBtn);
    
    // Corpo do modal com tabela de operações
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Operação</th>
                    <th>Tentativas</th>
                    <th>Acertos</th>
                    <th>Taxa de Acerto</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    Object.keys(aluno.operacoes).forEach(opKey => {
        const op = aluno.operacoes[opKey];
        if (op.tentativas > 0) {
            tableHTML += `
                <tr>
                    <td>${formatarNomeOperacao(opKey)}</td>
                    <td>${op.tentativas}</td>
                    <td>${op.pontos} de ${op.total}</td>
                    <td>${op.percentual}%</td>
                </tr>
            `;
        }
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    modalBody.innerHTML = tableHTML;
    
    // Montar o modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    
    // Adicionar ao corpo da página
    document.body.appendChild(modal);
    
    // Fechar modal se clicar fora
    window.onclick = function(event) {
        if (event.target == modal) {
            document.body.removeChild(modal);
        }
    };
}