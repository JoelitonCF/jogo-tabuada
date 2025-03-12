// Arquivo: servidor.js
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
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
      const { nome, pontuacao, total, percentual, data } = req.body;
  
      if (!nome || pontuacao === undefined || total === undefined) {
        return res.status(400).json({ error: 'Dados incompletos' });
      }
  
      // Ler ranking atual
      let rankingData = JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8'));
  
      // Procurar o aluno no ranking
      const alunoExistente = rankingData.find(aluno => aluno.nome === nome);
  
      if (alunoExistente) {
        // Atualiza os dados do aluno existente
        alunoExistente.pontuacao += pontuacao;  // Soma os pontos
        alunoExistente.total += total;  // Soma o total de questões
        alunoExistente.percentual = ((alunoExistente.pontuacao / alunoExistente.total) * 100).toFixed(1);
        alunoExistente.data = data || new Date().toLocaleDateString();
        alunoExistente.timestamp = new Date().getTime();
      } else {
        // Adiciona um novo aluno ao ranking
        rankingData.push({
          nome,
          pontuacao,
          total,
          percentual,
          data: data || new Date().toLocaleDateString(),
          timestamp: new Date().getTime()
        });
      }
  
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
    const totalPontos = rankingData.reduce((sum, aluno) => sum + aluno.pontuacao, 0);
    const totalQuestoes = rankingData.reduce((sum, aluno) => sum + aluno.total, 0);
    const mediaPercentual = totalQuestoes > 0 ? (totalPontos / totalQuestoes * 100).toFixed(1) : 0;
    
    // Agrupar por aluno (pega a média de todas as tentativas)
    const porAluno = {};
    rankingData.forEach(item => {
      const key = item.nome;
      if (!porAluno[key]) {
        porAluno[key] = {
          nome: item.nome,
          tentativas: [],
          totalPontos: 0,
          totalQuestoes: 0
        };
      }
      porAluno[key].tentativas.push(item);
      porAluno[key].totalPontos += item.pontuacao;
      porAluno[key].totalQuestoes += item.total;
    });
    
    const relatorioAlunos = Object.values(porAluno).map(aluno => {
      return {
        nome: aluno.nome,
        tentativas: aluno.tentativas.length,
        mediaPercentual: ((aluno.totalPontos / aluno.totalQuestoes) * 100).toFixed(1),
        ultimaTentativa: new Date(Math.max(...aluno.tentativas.map(t => t.timestamp))).toLocaleDateString()
      };
    });
    
    res.json({
      dadosGerais: {
        totalAlunos: Object.keys(porAluno).length,
        totalTentativas: rankingData.length,
        mediaPercentual: parseFloat(mediaPercentual),
        totalPontos,
        totalQuestoes
      },
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

// Iniciar o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Área do Professor: http://localhost:${PORT}/professor`);
  console.log(`Os alunos podem acessar usando o endereço IP local da sua máquina: http://SEU_IP_LOCAL:${PORT}`);
});