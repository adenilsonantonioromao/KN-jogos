const admin = require('firebase-admin');

// 1. Configuração de Segurança
// O GitHub injeta a chave secreta aqui. Sem isso, não conecta.
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("❌ ERRO: A chave FIREBASE_SERVICE_ACCOUNT não foi encontrada.");
    process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function premiarVencedores() {
    console.log("⚖️ O Juiz iniciou a sessão (Brasília)...");

    // Pega todos os usuários do banco
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
        console.log('👀 Nenhum usuário encontrado no banco.');
        return;
    }

    let usuarios = [];
    snapshot.forEach(doc => {
        let data = doc.data();
        usuarios.push({ id: doc.id, ...data });
    });

    console.log(`📊 Analisando ${usuarios.length} jogadores...`);

    // --- CONFIGURAÇÃO DE DATAS ---
    // O GitHub Actions roda em UTC. Precisamos garantir que seja horário de Brasília.
    // Ajuste simples: subtrair 3 horas do horário atual do servidor
    const agora = new Date();
    agora.setHours(agora.getHours() - 3); 

    const diaSemana = agora.getDay(); // 0=Dom, 1=Seg... 5=Sexta
    const diaMes = agora.getDate();   // 1 a 31

    console.log(`📅 Data simulada (BRT): Dia ${diaMes}, Semana ${diaSemana}`);

    // --- 1. PREMIAÇÃO DIÁRIA (+1 Ponto) ---
    // Quem fez mais pontos ontem (que ainda estão salvos no banco)
    
    // Ordena do maior para o menor scoreDiario
    usuarios.sort((a, b) => (b.scoreDiario || 0) - (a.scoreDiario || 0));
    const topDiario = usuarios[0];

    if (topDiario && topDiario.scoreDiario > 0) {
        console.log(`🥇 Campeão do Dia: ${topDiario.nome} com ${topDiario.scoreDiario} pontos! (+1 Rank)`);
        
        await usersRef.doc(topDiario.id).update({
            pontosCampeao: admin.firestore.FieldValue.increment(1)
        });
    } else {
        console.log("🤷‍♂️ Ninguém pontuou no diário hoje.");
    }

    // --- 2. PREMIAÇÃO SEMANAL (+5 Pontos) ---
    // Regra: Roda toda Sexta-feira (Dia 5)
    if (diaSemana === 5) { 
        console.log("📅 Hoje é Sexta-feira! Verificando Ranking Semanal...");
        
        usuarios.sort((a, b) => (b.scoreSemanal || 0) - (a.scoreSemanal || 0));
        const topSemanal = usuarios[0];
        
        if (topSemanal && topSemanal.scoreSemanal > 0) {
            console.log(`🏆 Campeão da Semana: ${topSemanal.nome} com ${topSemanal.scoreSemanal} pontos! (+5 Rank)`);
            
            await usersRef.doc(topSemanal.id).update({
                pontosCampeao: admin.firestore.FieldValue.increment(5)
            });
        }
    }

    // --- 3. PREMIAÇÃO MENSAL (+15 Pontos) ---
    // Regra: Roda dia 01 de cada mês
    if (diaMes === 1) {
        console.log("📅 Hoje é dia 01! Verificando Ranking Mensal...");
        
        usuarios.sort((a, b) => (b.scoreMensal || 0) - (a.scoreMensal || 0));
        const topMensal = usuarios[0];
        
        if (topMensal && topMensal.scoreMensal > 0) {
            console.log(`👑 IMPERADOR DO MÊS: ${topMensal.nome} com ${topMensal.scoreMensal} pontos! (+15 Rank)`);
            
            await usersRef.doc(topMensal.id).update({
                pontosCampeao: admin.firestore.FieldValue.increment(15)
            });
        }
    }

    console.log("✅ Sessão do Juiz encerrada com sucesso.");
}

// Executa a função
premiarVencedores().catch(err => {
    console.error("❌ Erro fatal no Juiz:", err);
    process.exit(1);
});
