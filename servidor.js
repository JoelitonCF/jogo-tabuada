// Arquivo: servidor.js
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server); // Adicionar Socket.IO
const PORT = 3000;

// Pasta para armazenar dados de ranking
const RANKING_FILE = path.join(__dirname, 'ranking.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Inicializar o arquivo de ranking se não existir
if (!fs.existsSync(RANKING_FILE)) {
  fs.writeFileSync(RANKING_FILE, JSON.stringify([]));
}

// Inicializar o arquivo de configuração se não existir
if (!fs.existsSync(CONFIG_FILE)) {
  const configPadrao = {
    operacaoAtual: 'multiplicacao', // multiplicacao, divisao, soma, subtracao
    tabuadaAtual: 'random',
    tempoLimite: 10, // segundos
    numeroQuestoes: 10  // número de questões que o professor vai definir
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configPadrao));
}

// Middleware para processar JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota para página principal (alunos)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para página do professor
app.get('/professor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'professor.html'));
});

// API para obter o ranking
app.get('/api/ranking', (req, res) => {
  try {
    const rankingData = JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8'));
    res.json(rankingData);
  } catch (error) {
    console.error('Erro ao ler o ranking:', error);
    res.status(500).json({ error: 'Erro ao ler dados do ranking' });
  }
});

// API para salvar pontuação no ranking (atualizando caso o aluno já exista)
app.post('/api/ranking', (req, res) => {
  try {
    const { nome, pontuacao, total, percentual, data, operacao } = req.body;

    if (!nome || pontuacao === undefined || total === undefined) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Ler ranking atual
    let rankingData = JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8'));

    // Adicionar nova tentativa com identificador único
    const tentativaId = new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
    
    rankingData.push({
      id: tentativaId,
      nome,
      pontuacao,
      total,
      percentual,
      data: data || new Date().toLocaleDateString(),
      timestamp: new Date().getTime(),
      operacao: operacao || 'multiplicacao' // Registrar o tipo de operação
    });
    
    // Ordenar ranking por percentual e depois por pontuação
    rankingData.sort((a, b) => {
      if (b.percentual === a.percentual) {
        return b.pontuacao - a.pontuacao;
      }
      return b.percentual - a.percentual;
    });

    // Salvar ranking atualizado
    fs.writeFileSync(RANKING_FILE, JSON.stringify(rankingData, null, 2));

    res.json({ success: true, message: 'Pontuação salva com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar pontuação:', error);
    res.status(500).json({ error: 'Erro ao salvar pontuação' });
  }
});

// API para obter configurações atuais
app.get('/api/config', (req, res) => {
  try {
    const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    res.json(configData);
  } catch (error) {
    console.error('Erro ao ler configurações:', error);
    res.status(500).json({ error: 'Erro ao ler configurações' });
  }
});

// API para atualizar configurações
app.post('/api/config', (req, res) => {
  try {
    const { operacaoAtual, tabuadaAtual, tempoLimite, numeroQuestoes } = req.body;
    
    // Validar dados
    if (!operacaoAtual || !tabuadaAtual || !tempoLimite || !numeroQuestoes) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Atualizar configurações
    const configData = {
      operacaoAtual,
      tabuadaAtual,
      tempoLimite: parseInt(tempoLimite),
      numeroQuestoes: parseInt(numeroQuestoes) // Número de questões que o professor vai definir
    };
    
    // Salvar configurações
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2));
    
    // Emitir evento para todos os clientes conectados
    io.emit('config_updated', configData);
    
    res.json({ success: true, message: 'Configurações atualizadas com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

// API para obter relatórios
app.get('/api/relatorios', (req, res) => {
  try {
    const rankingData = JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8'));
    
    // Calcular médias gerais
    const totalPontos = rankingData.reduce((sum, item) => sum + item.pontuacao, 0);
    const totalQuestoes = rankingData.reduce((sum, item) => sum + item.total, 0);
    const mediaPercentual = totalQuestoes > 0 ? (totalPontos / totalQuestoes * 100).toFixed(1) : 0;
    
    // Estatísticas por operação
    const operacoes = {
      multiplicacao: { pontos: 0, total: 0, tentativas: 0 },
      divisao: { pontos: 0, total: 0, tentativas: 0 },
      soma: { pontos: 0, total: 0, tentativas: 0 },
      subtracao: { pontos: 0, total: 0, tentativas: 0 }
    };
    
    // Calcular estatísticas por operação
    rankingData.forEach(item => {
      const opTipo = item.operacao || 'multiplicacao'; // Default para registros antigos
      if (operacoes[opTipo]) {
        operacoes[opTipo].pontos += item.pontuacao;
        operacoes[opTipo].total += item.total;
        operacoes[opTipo].tentativas += 1;
      }
    });
    
    // Calcular percentuais por operação
    Object.keys(operacoes).forEach(opKey => {
      const op = operacoes[opKey];
      op.percentual = op.total > 0 ? (op.pontos / op.total * 100).toFixed(1) : 0;
    });
    
    // Agrupar por aluno para relatório de alunos
    const alunoMap = {};
    rankingData.forEach(item => {
      const nome = item.nome;
      
      if (!alunoMap[nome]) {
        alunoMap[nome] = {
          nome: nome,
          tentativas: [],
          totalPontos: 0,
          totalQuestoes: 0,
          operacoes: {
            multiplicacao: { pontos: 0, total: 0, tentativas: 0 },
            divisao: { pontos: 0, total: 0, tentativas: 0 },
            soma: { pontos: 0, total: 0, tentativas: 0 },
            subtracao: { pontos: 0, total: 0, tentativas: 0 }
          }
        };
      }
      
      alunoMap[nome].tentativas.push(item);
      alunoMap[nome].totalPontos += item.pontuacao;
      alunoMap[nome].totalQuestoes += item.total;
      
      // Adicionar estatísticas por operação para o aluno
      const opTipo = item.operacao || 'multiplicacao';
      if (alunoMap[nome].operacoes[opTipo]) {
        alunoMap[nome].operacoes[opTipo].pontos += item.pontuacao;
        alunoMap[nome].operacoes[opTipo].total += item.total;
        alunoMap[nome].operacoes[opTipo].tentativas += 1;
      }
    });
    
    // Converter para formato de relatório por aluno
    const relatorioAlunos = Object.values(alunoMap).map(aluno => {
      // Calcular percentual por operação para o aluno
      Object.keys(aluno.operacoes).forEach(opKey => {
        const op = aluno.operacoes[opKey];
        op.percentual = op.total > 0 ? (op.pontos / op.total * 100).toFixed(1) : 0;
      });
      
      return {
        nome: aluno.nome,
        tentativas: aluno.tentativas.length,
        mediaPercentual: ((aluno.totalPontos / aluno.totalQuestoes) * 100).toFixed(1),
        ultimaTentativa: new Date(Math.max(...aluno.tentativas.map(t => t.timestamp))).toLocaleDateString(),
        operacoes: aluno.operacoes
      };
    });
    
    res.json({
      dadosGerais: {
        totalAlunos: Object.keys(alunoMap).length,
        totalTentativas: rankingData.length,
        mediaPercentual: parseFloat(mediaPercentual),
        totalPontos,
        totalQuestoes
      },
      estatisticasOperacoes: operacoes,
      relatorioAlunos
    });
  } catch (error) {
    console.error('Erro ao gerar relatórios:', error);
    res.status(500).json({ error: 'Erro ao gerar relatórios' });
  }
});
// API para exportar dados em CSV
app.get('/api/exportar-csv', (req, res) => {
  try {
    const rankingData = JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8'));
    
    // Criar cabeçalho CSV
    let csv = 'Nome,Pontuação,Total,Percentual,Data\n';
    
    // Adicionar cada linha
    rankingData.forEach(item => {
      csv += `"${item.nome}",${item.pontuacao},${item.total},${item.percentual},"${item.data}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ranking-tabuada.csv');
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
    res.status(500).json({ error: 'Erro ao exportar dados' });
  }
});

// Variável para rastrear o número de usuários conectados
let connectedUsers = 0;

// Configurar Socket.IO
io.on('connection', (socket) => {
  console.log('Um cliente conectou-se');
  connectedUsers++;
  
  // Enviar configurações atuais para o cliente assim que ele se conectar
  try {
    const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    socket.emit('initial_config', configData);
  } catch (error) {
    console.error('Erro ao ler configurações para novo cliente:', error);
  }
  
  // Atualizar a contagem de usuários para todos os clientes
  io.emit('user_count', connectedUsers);
  
  socket.on('disconnect', () => {
    console.log('Um cliente desconectou-se');
    connectedUsers--;
    io.emit('user_count', connectedUsers);
  });
});

// Iniciar o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Área do Professor: http://localhost:${PORT}/professor`);
  console.log(`Os alunos podem acessar usando o endereço IP local da sua máquina: http://SEU_IP_LOCAL:${PORT}`);
});