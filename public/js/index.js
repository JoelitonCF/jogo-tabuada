// Inicializar Socket.IO
const socket = io();

// Elementos da interface
const telaInicio = document.getElementById('inicio');
const telaJogo = document.getElementById('jogo');
const telaFim = document.getElementById('fim');
const telaRanking = document.getElementById('ranking');
const notification = document.getElementById('notification');

// Botões
const btnComecar = document.getElementById('comecar');
const btnConfirmar = document.getElementById('confirmar');
const btnReiniciar = document.getElementById('reiniciar');
const btnVerRanking = document.getElementById('verRanking');
const btnVoltarInicio = document.getElementById('voltarInicio');

// Campos de entrada e exibição
const inputNome = document.getElementById('nome');
const inputResposta = document.getElementById('resposta');
const jogadorInfo = document.getElementById('jogadorInfo');
const operacaoInfo = document.getElementById('operacaoInfo');
const timerDiv = document.getElementById('timer');
const perguntaDiv = document.getElementById('pergunta');
const feedbackDiv = document.getElementById('feedback');
const progressoAtual = document.getElementById('atual');
const progressoTotal = document.getElementById('total');
const pontuacaoFinalDiv = document.getElementById('pontuacaoFinal');
const rankingBody = document.getElementById('rankingBody');

// Variáveis do jogo
let nomeJogador = '';
let numPerguntas = 10;
let perguntaAtual = 0;
let pontuacao = 0;
let perguntaCorreta = 0;
let numeroA = 0;
let numeroB = 0;
let tempoRestante = 10;
let timerInterval = null;
let vidas = 3;
let configuracoes = {
    operacaoAtual: 'multiplicacao',
    tabuadaAtual: 'random',
    tempoLimite: 10,
    numeroQuestoes: 10
};
let operacoesTexto = {
    multiplicacao: 'Multiplicação',
    divisao: 'Divisão',
    soma: 'Soma',
    subtracao: 'Subtração'
};
let simbolosOperacao = {
    multiplicacao: '×',
    divisao: '÷',
    soma: '+',
    subtracao: '−'
};

// Flag para controlar se o jogo está em andamento
let jogoEmAndamento = false;

// Event listeners
btnComecar.addEventListener('click', iniciarJogo);
btnConfirmar.addEventListener('click', verificarResposta);
btnReiniciar.addEventListener('click', voltarInicio);
btnVerRanking.addEventListener('click', carregarRanking);
btnVoltarInicio.addEventListener('click', voltarInicio);

// Permitir pressionar Enter para confirmar resposta
inputResposta.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        verificarResposta();
    }
});

// Receber configurações iniciais do servidor
socket.on('initial_config', function(data) {
    configuracoes = data;
    console.log('Configurações iniciais recebidas:', configuracoes);
});

// Receber atualizações de configuração do servidor
socket.on('config_updated', function(novasConfiguracoes) {
    // Salvar antigas configurações para comparação
    const configAntigas = {...configuracoes};
    
    // Atualizar configurações
    configuracoes = novasConfiguracoes;
    console.log('Configurações atualizadas:', configuracoes);
    
    // Mostrar notificação
    mostrarNotificacao();
    
    // Se o jogo estiver em andamento, aplicar as novas configurações
    if (jogoEmAndamento) {
        // Atualizar o tipo de operação na interface
        operacaoInfo.textContent = `Operação: ${operacoesTexto[configuracoes.operacaoAtual]}`;
        
        // Atualizar o número total de perguntas se for diferente
        if (configAntigas.numeroQuestoes !== configuracoes.numeroQuestoes) {
            numPerguntas = configuracoes.numeroQuestoes;
            progressoTotal.textContent = numPerguntas;
            
            // Se o jogador já respondeu mais perguntas do que o novo total, finalize o jogo
            if (perguntaAtual >= numPerguntas) {
                finalizarJogo();
            }
        }
        
        // Atualizar o temporizador se for diferente
        if (configAntigas.tempoLimite !== configuracoes.tempoLimite) {
            // Reiniciar o temporizador com o novo tempo limite
            if (timerInterval) {
                clearInterval(timerInterval);
            }
            tempoRestante = configuracoes.tempoLimite;
            timerDiv.textContent = `Tempo: ${tempoRestante}`;
            iniciarTemporizador();
        }
    }
});

// Carregar configurações ao iniciar a página
window.addEventListener('load', carregarConfiguracoes);

function carregarConfiguracoes() {
    fetch('/api/config')
        .then(response => response.json())
        .then(data => {
            configuracoes = data;
        })
        .catch(error => {
            console.error('Erro ao carregar configurações:', error);
        });
}

function mostrarNotificacao() {
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function iniciarJogo() {
    nomeJogador = inputNome.value.trim();

    if (!nomeJogador) {
        alert('Por favor, digite seu nome!');
        return;
    }

    numPerguntas = configuracoes.numeroQuestoes || 10;  // Pega o número de questões definido pelo professor ou 10 como padrão

    jogadorInfo.textContent = `Jogador: ${nomeJogador}`;
    progressoTotal.textContent = numPerguntas;

    perguntaAtual = 0;
    pontuacao = 0;
    jogoEmAndamento = true;
    vidas = 3;
    document.getElementById('vidas').textContent = 'Vidas: ❤️❤️❤️';

    telaInicio.classList.add('hidden');
    telaFim.classList.add('hidden');
    telaRanking.classList.add('hidden');
    telaJogo.classList.remove('hidden');

    // Mostrar tipo de operação atual
    operacaoInfo.textContent = `Operação: ${operacoesTexto[configuracoes.operacaoAtual]}`;

    proximaPergunta();
}

function proximaPergunta() {
    perguntaAtual++;
    progressoAtual.textContent = perguntaAtual;

    // Definir números para a pergunta
    if (configuracoes.tabuadaAtual === 'random') {
        numeroA = Math.floor(Math.random() * 10) + 1;
    } else {
        numeroA = parseInt(configuracoes.tabuadaAtual);
    }
    numeroB = Math.floor(Math.random() * 10) + 1;

    if (['divisao', 'subtracao', 'soma'].includes(configuracoes.operacaoAtual)) {
        numeroB = numeroA * numeroB;
    } else {
        // Para soma, mantém o comportamento original
        numeroB = Math.floor(Math.random() * 10) + 1;
    }

    // Calcular resultado correto baseado no tipo de operação
    switch (configuracoes.operacaoAtual) {
        case 'multiplicacao':
            perguntaCorreta = numeroA * numeroB;
            break;
        case 'divisao':
            // Para divisão, garantimos que o resultado seja um número inteiro
            perguntaCorreta = numeroB / numeroA; // Assim, A ÷ B sempre dará um resultado inteiro
            break;
        case 'soma':
            perguntaCorreta = numeroA + numeroB;
            break;
        case 'subtracao':
            // Para subtração, garantimos que o resultado seja positivo
            if (numeroA < numeroB) {
                [numeroA, numeroB] = [numeroB, numeroA]; // Invertemos para resultado positivo
            }
            perguntaCorreta = numeroA - numeroB;
            break;
    }

    // Exibir a pergunta com o símbolo correto da operação
    perguntaDiv.textContent = configuracoes.operacaoAtual === 'divisao' 
    ? `${numeroB} ${simbolosOperacao[configuracoes.operacaoAtual]} ${numeroA} = ?`
    : `${numeroA} ${simbolosOperacao[configuracoes.operacaoAtual]} ${numeroB} = ?`;


    inputResposta.value = '';
    feedbackDiv.textContent = '';
    inputResposta.focus();

    // Iniciar o temporizador
    iniciarTemporizador();
}

function iniciarTemporizador() {
    // Limpar timer anterior se existir
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    // Definir tempo baseado na configuração
    tempoRestante = configuracoes.tempoLimite;
    timerDiv.textContent = `Tempo: ${tempoRestante}`;

    // Iniciar a contagem regressiva
    timerInterval = setInterval(() => {
        tempoRestante--;
        timerDiv.textContent = `Tempo: ${tempoRestante}`;

        if (tempoRestante <= 0) {
            clearInterval(timerInterval);
            // Tempo esgotado, marcar como erro
            feedbackDiv.textContent = `Tempo esgotado! A resposta correta é ${perguntaCorreta}.`;
            feedbackDiv.className = 'result incorrect';

            // Passar para próxima pergunta após um breve momento
            setTimeout(() => {
                if (perguntaAtual < numPerguntas) {
                    proximaPergunta();
                } else {
                    finalizarJogo();
                }
            }, 1500);
        }
    }, 1000);
}

function verificarResposta() {
    // Parar o timer
    clearInterval(timerInterval);

    const resposta = parseInt(inputResposta.value);

    if (isNaN(resposta)) {
        feedbackDiv.textContent = 'Por favor, digite um número!';
        feedbackDiv.className = 'result incorrect';
        // Reiniciar o temporizador
        iniciarTemporizador();
        return;
    }

    if (resposta === perguntaCorreta) {
        feedbackDiv.textContent = 'Correto! 👍';
        feedbackDiv.className = 'result correct';
        pontuacao++;
    } else {
        feedbackDiv.textContent = `Incorreto! A resposta correta é ${perguntaCorreta}.`;
        feedbackDiv.className = 'result incorrect';
        vidas--;
        document.getElementById('vidas').textContent = 'Vidas: ' + '❤️'.repeat(vidas);

        //encerrar o jogo se acabaram as vidas
        if(vidas <= 0){
            setTimeout(finalizarJogo, 1500);
            return;
        }
    }

    // Esperar um pouco para mostrar o feedback
    setTimeout(() => {
        if (perguntaAtual < numPerguntas) {
            proximaPergunta();
        } else {
            finalizarJogo();
        }
    }, 1500);
}

function finalizarJogo() {
    // Parar o timer se ainda estiver rodando
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    jogoEmAndamento = false;

    telaJogo.classList.add('hidden');
    telaFim.classList.remove('hidden');

    const percentual = (pontuacao / numPerguntas * 100).toFixed(0);
    pontuacaoFinalDiv.textContent = `${nomeJogador}, você acertou ${pontuacao} de ${numPerguntas} (${percentual}%)`;

    // Enviar pontuação para o servidor com informação sobre o tipo de operação
    fetch('/api/ranking', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            nome: nomeJogador,
            pontuacao: pontuacao,
            total: numPerguntas,
            percentual: percentual,
            data: new Date().toLocaleDateString(),
            operacao: configuracoes.operacaoAtual // Incluir o tipo de operação
        })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Pontuação salva com sucesso:', data);
        })
        .catch(error => {
            console.error('Erro ao salvar pontuação:', error);
        });
}

function carregarRanking() {
    telaFim.classList.add('hidden');
    telaRanking.classList.remove('hidden');
    
    // Limpar tabela
    rankingBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';

    // Carregar ranking do servidor
    fetch('/api/ranking')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar o ranking: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            rankingBody.innerHTML = '';

            // Mostrar apenas os 20 melhores
            const topRanking = data.slice(0, 20);

            if (topRanking.length === 0) {
                rankingBody.innerHTML = '<tr><td colspan="3">Nenhum registro encontrado</td></tr>';
                return;
            }

            topRanking.forEach((item, index) => {
                const row = document.createElement('tr');

                const nomeCell = document.createElement('td');
                nomeCell.textContent = item.nome;

                const pontuacaoCell = document.createElement('td');
                pontuacaoCell.textContent = `${item.pontuacao}/${item.total} (${item.percentual}%)`;

                const dataCell = document.createElement('td');
                dataCell.textContent = item.data;

                row.appendChild(nomeCell);
                row.appendChild(pontuacaoCell);
                row.appendChild(dataCell);

                rankingBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar ranking:', error);
            rankingBody.innerHTML = '<tr><td colspan="3">Erro ao carregar dados</td></tr>';
        });
}

function voltarInicio() {
    // Parar o timer se ainda estiver rodando
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    jogoEmAndamento = false;

    telaJogo.classList.add('hidden');
    telaFim.classList.add('hidden');
    telaRanking.classList.add('hidden');
    telaInicio.classList.remove('hidden');

    // Recarregar configurações
    carregarConfiguracoes();
}