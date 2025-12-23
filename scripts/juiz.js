const admin = require('firebase-admin');

// 1. Configuração de Segurança
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("❌ ERRO CRÍTICO: Chave de segurança não encontrada.");
    process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// --- TABELA DE PONTOS (Top 5) ---
// Índices: 0=1º lugar, 1=2º lugar, etc.
const PONTOS_DIARIO  = [10, 7, 5, 3, 1];
const PONTOS_SEMANAL = [50, 35, 25, 15, 5];
const PONTOS_MENSAL  = [150, 100, 75, 45, 15];

async function distribuirPontos(listaUsuarios, tipoRanking, arrayPontos) {
    // Ordena do maior score para o menor
    // Ex: scoreDiario, scoreSemanal...
    listaUsuarios.sort((a, b) => (b[tipoRanking] || 0) - (a[tipoRanking] || 0));

    // Pega só os 5 primeiros
    const top5 = listaUsuarios.slice(0, 5);

    console.log(`\n🏆 Processando Ranking: ${tipoRanking.toUpperCase()}`);

    for (let i = 0; i < top5.length; i++) {
        const user = top5[i];
        const pontosGanhos = arrayPontos[i];
        const scoreAtual = user[tipoRanking] || 0;

        // Só premia se o usuário tiver pontuado algo (> 0)
        if (scoreAtual > 0) {
            console.log(`   #${i + 1} ${user.nome}: Ganhou +${pontosGanhos} Pontos de Campeão (Score: ${scoreAtual})`);
            
            // Atualiza no Firebase
            await db.collection('users').doc(user.id).update({
                pontosCampeao: admin.firestore.FieldValue.increment(pontosGanhos)
            });
        }
    }
}

async function startJuiz() {
    console.log("⚖️ O Juiz acordou! Iniciando sessão (Brasília)...");

    // Pega todos os usuários
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
        console.log('Nenhum usuário encontrado.');
        return;
    }

    let usuarios = [];
    snapshot.forEach(doc => {
        usuarios.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📊 Analisando ${usuarios.length} jogadores...`);

    // Ajuste de Fuso Horário (GitHub roda em UTC, Brasil é UTC-3)
    const agora = new Date();
    agora.setHours(agora.getHours() - 3); 
    const diaSemana = agora.getDay(); // 5 = Sexta
    const diaMes = agora.getDate();   // 1 = Primeiro dia

    // 1. SEMPRE RODA: Premiação Diária
    await distribuirPontos([...usuarios], 'scoreDiario', PONTOS_DIARIO);

    // 2. SEXTA-FEIRA: Premiação Semanal
    if (diaSemana === 5) { 
        console.log("📅 Hoje é Sexta-feira! Liberando prêmios semanais...");
        await distribuirPontos([...usuarios], 'scoreSemanal', PONTOS_SEMANAL);
    }

    // 3. DIA 01: Premiação Mensal
    if (diaMes === 1) {
        console.log("📅 Hoje é dia 01! Liberando prêmios MENSAIS...");
        await distribuirPontos([...usuarios], 'scoreMensal', PONTOS_MENSAL);
    }

    console.log("\n✅ Sessão do Juiz encerrada com sucesso.");
}

startJuiz().catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
});
