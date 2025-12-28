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
const PONTOS_DIARIO  = [10, 7, 5, 3, 1];
const PONTOS_SEMANAL = [50, 35, 25, 15, 5];
const PONTOS_MENSAL  = [150, 100, 75, 45, 15];

const FICHAS_DIARIO  = [3, 2, 1];
const FICHAS_SEMANAL = [10, 7, 3];
const FICHAS_MENSAL  = [50, 30, 10];

// --- 3. FUNÇÕES AUXILIARES ---

// Gera um recibo no extrato do usuário (IGUAL AO FRONTEND)
async function gerarExtrato(userId, valor, motivo) {
    try {
        const serial = `JUIZ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        await db.collection('users').doc(userId).collection('extrato').add({
            data: admin.firestore.FieldValue.serverTimestamp(),
            valor: valor,
            motivo: motivo,
            serial: serial,
            origem: "SISTEMA AUTOMATICO"
        });
        console.log(`   🧾 Extrato gerado para ${userId}: ${valor} Fichas`);
    } catch (e) {
        console.error(`   ❌ Erro ao gerar extrato para ${userId}:`, e.message);
    }
}

async function enviarNotificacao(userId, titulo, corpo) {
    try {
        await db.collection('users').doc(userId).collection('mensagens').add({
            titulo: titulo,
            corpo: corpo,
            data: admin.firestore.FieldValue.serverTimestamp(),
            lida: false
        });
    } catch (e) { console.error(`Erro msg ${userId}`, e); }
}

// --- 4. O JUIZ (Premiar e Resetar) ---
async function processarRanking(listaUsuarios, campoScore, arrayPontos, arrayFichas, nomeRanking) {
    console.log(`\n🏆 Processando ${nomeRanking}...`);
    
    // 1. Ordena os vencedores
    // Filtra quem tem score > 0 para não premiar inativos
    const classificados = listaUsuarios.filter(u => (u[campoScore] || 0) > 0);
    classificados.sort((a, b) => b[campoScore] - a[campoScore]);

    // 2. Distribui Prêmios (Top 5)
    const top5 = classificados.slice(0, 5);
    
    for (let i = 0; i < top5.length; i++) {
        const user = top5[i];
        const pontosGanhos = arrayPontos[i] || 0;
        const fichasGanhas = arrayFichas[i] || 0; // Só Top 3 ganham fichas na tabela

        console.log(`   #${i + 1} ${user.nome || user.id}: +${pontosGanhos} pts / +${fichasGanhas} fichas`);

        const updates = {
            pontosCampeao: admin.firestore.FieldValue.increment(pontosGanhos)
        };

        // Se ganhou fichas, adiciona e GERA O EXTRATO
        if (fichasGanhas > 0) {
            updates.fichas = admin.firestore.FieldValue.increment(fichasGanhas);
            await gerarExtrato(user.id, fichasGanhas, `Prêmio Ranking ${nomeRanking} (#${i+1})`);
        }

        await db.collection('users').doc(user.id).update(updates);

        let textoFichas = fichasGanhas > 0 ? ` e <strong>${fichasGanhas} Fichas</strong>` : ``;
        await enviarNotificacao(
            user.id, 
            `🏆 Top ${i+1} ${nomeRanking}!`, 
            `Parabéns! Com ${user[campoScore]} pontos você ficou em <strong>${i+1}º Lugar</strong>.<br>
             Prêmios: ⭐ +${pontosGanhos} Rank${textoFichas}.`
        );
    }

    // 3. O GRANDE RESET (Zerar o placar para a próxima temporada)
    console.log(`   🧹 Resetando ${campoScore} de todos os usuários...`);
    const batchSize = 500;
    let batch = db.batch();
    let count = 0;

    for (const user of classificados) {
        const ref = db.collection('users').doc(user.id);
        // Zera o campo do ranking atual (ex: scoreDiario = 0)
        batch.update(ref, { [campoScore]: 0 });
        count++;

        if (count >= batchSize) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    if (count > 0) await batch.commit();
    console.log(`   ✅ Ranking ${nomeRanking} resetado com sucesso.`);
}

// --- 5. LIMPEZA ---
async function lixeiro() {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 3);
    // ... (Lógica de limpeza de mensagens antigas igual) ...
}

// --- 6. START ---
async function startJuiz() {
    console.log("⚖️ Juiz v3.0 (Com Extrato e Reset) Iniciado...");

    const snapshot = await db.collection('users').get();
    if (snapshot.empty) return;

    let usuarios = [];
    snapshot.forEach(doc => usuarios.push({ id: doc.id, ...doc.data() }));

    // Fuso Horário Brasil (-3)
    const agora = new Date();
    agora.setHours(agora.getHours() - 3); 
    const diaSemana = agora.getDay(); // 0 = Domingo, ..., 5 = Sexta
    const diaMes = agora.getDate();

    // 1. SEMPRE RODA O DIÁRIO
    await processarRanking([...usuarios], 'scoreDiario', PONTOS_DIARIO, FICHAS_DIARIO, 'Diário');

    // 2. SEXTA-FEIRA? RODA O SEMANAL
    if (diaSemana === 5) { 
        await processarRanking([...usuarios], 'scoreSemanal', PONTOS_SEMANAL, FICHAS_SEMANAL, 'Semanal');
    }

    // 3. DIA 01? RODA O MENSAL
    if (diaMes === 1) {
        await processarRanking([...usuarios], 'scoreMensal', PONTOS_MENSAL, FICHAS_MENSAL, 'Mensal');
    }

    console.log("\n🏁 Fim da execução.");
}

startJuiz().catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
});
