const admin = require('firebase-admin');

// --- 1. CONFIGURAÇÃO E SEGURANÇA ---
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("❌ ERRO CRÍTICO: Chave de segurança não encontrada.");
    process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// --- 2. TABELAS DE PREMIAÇÃO ---

// PONTOS DE CAMPEÃO (Fama) -> Para os TOP 5
const PONTOS_DIARIO  = [10, 7, 5, 3, 1];
const PONTOS_SEMANAL = [50, 35, 25, 15, 5];
const PONTOS_MENSAL  = [150, 100, 75, 45, 15];

// FICHAS (Dinheiro) -> Apenas para os TOP 3
const FICHAS_DIARIO  = [3, 2, 1];
const FICHAS_SEMANAL = [10, 7, 3];
const FICHAS_MENSAL  = [50, 30, 10];

// --- 3. FUNÇÃO PARA ENVIAR NOTIFICAÇÃO ---
async function enviarNotificacao(userId, titulo, corpo) {
    try {
        await db.collection('users').doc(userId).collection('mensagens').add({
            titulo: titulo,
            corpo: corpo,
            data: admin.firestore.FieldValue.serverTimestamp(),
            lida: false
        });
        console.log(`   📩 Mensagem enviada para ${userId}`);
    } catch (e) {
        console.error(`   ❌ Erro ao enviar mensagem para ${userId}:`, e.message);
    }
}

// --- 4. FUNÇÃO DO JUIZ (Distribuir Prêmios) ---
async function distribuirPremios(listaUsuarios, tipoRanking, arrayPontos, arrayFichas, nomeRanking) {
    // Ordena do maior score para o menor
    listaUsuarios.sort((a, b) => (b[tipoRanking] || 0) - (a[tipoRanking] || 0));
    
    // Pega os Top 5 (máximo de premiados em Pontos)
    const top5 = listaUsuarios.slice(0, 5);

    console.log(`\n🏆 Processando Ranking ${nomeRanking}...`);

    for (let i = 0; i < top5.length; i++) {
        const user = top5[i];
        const score = user[tipoRanking] || 0;

        // Só premia se tiver pontuado
        if (score > 0) {
            // Calcula prêmios
            const pontosGanhos = arrayPontos[i] || 0; // Top 5 ganham
            const fichasGanhas = arrayFichas[i] || 0; // Só Top 3 ganham (se i < 3)

            console.log(`   #${i + 1} ${user.nome}: +${pontosGanhos} Rank / +${fichasGanhas} Fichas`);
            
            // A. Atualiza o Banco de Dados (Atomicamente)
            const updates = {
                pontosCampeao: admin.firestore.FieldValue.increment(pontosGanhos)
            };
            
            // Só adiciona fichas no update se tiver ganho alguma
            if (fichasGanhas > 0) {
                updates.fichas = admin.firestore.FieldValue.increment(fichasGanhas);
            }

            await db.collection('users').doc(user.id).update(updates);

            // B. Monta a Mensagem Personalizada
            let textoFichas = fichasGanhas > 0 ? ` e <strong>${fichasGanhas} Fichas</strong>` : ``;
            
            await enviarNotificacao(
                user.id, 
                `🏆 Top ${i+1} ${nomeRanking}!`, 
                `Parabéns! Sua pontuação de ${score} garantiu o <strong>${i+1}º Lugar</strong>.<br><br>
                 Você recebeu:<br>
                 ⭐ <strong>${pontosGanhos} Pontos de Campeão</strong>${textoFichas}.<br><br>
                 Continue jogando para se manter no topo!`
            );
        }
    }
}

// --- 5. FUNÇÃO DE LIMPEZA (Lixeiro) ---
async function limparMensagensAntigas() {
    console.log("\n🧹 O Lixeiro está verificando mensagens antigas...");
    
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 3); // 3 dias atrás

    const usuariosSnapshot = await db.collection('users').get();
    let totalApagadas = 0;

    for (const userDoc of usuariosSnapshot.docs) {
        const msgsRef = userDoc.ref.collection('mensagens');
        
        const snapshot = await msgsRef
            .where('lida', '==', true)
            .where('lidaEm', '<', dataLimite)
            .get();

        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            totalApagadas += snapshot.size;
        }
    }
    console.log(`✅ Lixeiro finalizado. ${totalApagadas} mensagens antigas removidas.`);
}

// --- 6. START ---
async function startJuiz() {
    console.log("⚖️ Juiz Automatico v2.1 (Rank + Fichas) Iniciado...");

    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) return;

    let usuarios = [];
    snapshot.forEach(doc => usuarios.push({ id: doc.id, ...doc.data() }));

    // Fuso Horário
    const agora = new Date();
    agora.setHours(agora.getHours() - 3); 
    const diaSemana = agora.getDay();
    const diaMes = agora.getDate();

    // 1. DIÁRIO
    await distribuirPremios([...usuarios], 'scoreDiario', PONTOS_DIARIO, FICHAS_DIARIO, 'Diário');

    // 2. SEMANAL (Sexta)
    if (diaSemana === 5) { 
        await distribuirPremios([...usuarios], 'scoreSemanal', PONTOS_SEMANAL, FICHAS_SEMANAL, 'Semanal');
    }

    // 3. MENSAL (Dia 01)
    if (diaMes === 1) {
        await distribuirPremios([...usuarios], 'scoreMensal', PONTOS_MENSAL, FICHAS_MENSAL, 'Mensal');
    }

    await limparMensagensAntigas();
    console.log("\n🏁 Fim da execução.");
}

startJuiz().catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
});
