const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("❌ Erro: Chave não encontrada.");
    process.exit(1);
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Configurações de Prêmios
const PONTOS_DIARIO = [10, 7, 5, 3, 1];
const PONTOS_SEMANAL = [50, 35, 25, 15, 5];
const PONTOS_MENSAL = [150, 100, 75, 45, 15];
const FICHAS_DIARIO = [3, 2, 1];
const FICHAS_SEMANAL = [10, 7, 3];
const FICHAS_MENSAL = [50, 30, 10];

// --- O CONTADOR (AUDITORIA E LIMPEZA) ---
async function auditoriaConsolidada(usuarios) {
    console.log("\n🕵️‍♂️ INICIANDO AUDITORIA E LIMPEZA...");
    let suspeitos = 0;
    let totalExtratosApagados = 0;

    for (const user of usuarios) {
        try {
            // 1. Pega o Saldo Auditado Anterior (O "Cofre" do Juiz)
            let saldoSeguro = user.saldo_auditado !== undefined ? user.saldo_auditado : 5;

            // 2. Busca os novos extratos
            const extratosRef = db.collection('users').doc(user.id).collection('extrato');
            const snapshot = await extratosRef.get();

            // --- CORREÇÃO AQUI: Lógica para quem NÃO tem extrato novo ---
            if (snapshot.empty) {
                // Se o saldo atual não bate com o saldo seguro
                if (Math.abs(user.fichas - saldoSeguro) > 5) {
                    console.warn(`🚨 SUSPEITO SEM EXTRATO: ${user.id}`);
                    console.warn(`   Real: ${user.fichas} | Seguro: ${saldoSeguro}`);
                    
                    // CORREÇÃO: Agora forçamos o reset aqui também!
                    await db.collection('users').doc(user.id).update({
                        fichas: saldoSeguro 
                    });

                    await reportarSuspeito(user, saldoSeguro, "Saldo alterado sem extrato (Corrigido)");
                    suspeitos++;
                }
                continue; // Vai para o próximo usuário
            }
            // -------------------------------------------------------------

            // 3. Soma os novos movimentos (Para quem TEM extrato)
            let somaNovos = 0;
            const batch = db.batch();

            snapshot.forEach(doc => {
                somaNovos += (doc.data().valor || 0);
                batch.delete(doc.ref); 
            });

            // 4. Calcula o Novo Saldo Seguro
            const novoSaldoSeguro = saldoSeguro + somaNovos;

            // 5. Teste de Divergência
            if (Math.abs(user.fichas - novoSaldoSeguro) > 5) {
                console.warn(`🚨 SUSPEITO: ${user.id}`);
                
                batch.update(db.collection('users').doc(user.id), { 
                    fichas: novoSaldoSeguro, // Reseta para o valor real
                    saldo_auditado: novoSaldoSeguro 
                });
                
                await reportarSuspeito(user, novoSaldoSeguro, "Divergência Financeira Detectada (Corrigido)");
                suspeitos++;
            } else {
                // Tudo certo!
                batch.update(db.collection('users').doc(user.id), { 
                    saldo_auditado: novoSaldoSeguro 
                });
            }

            // 6. Executa Limpeza
            await batch.commit();
            totalExtratosApagados += snapshot.size;

        } catch (error) {
            console.error(`Erro ao auditar ${user.id}:`, error.message);
        }
    }
    console.log(`✅ Auditoria finalizada. ${suspeitos} correções feitas. ${totalExtratosApagados} extratos arquivados.`);
}

async function reportarSuspeito(user, saldoCalculado, motivo) {
    await db.collection('admin_auditoria').add({
        userId: user.id,
        nome: user.nome || "Desconhecido",
        data: admin.firestore.FieldValue.serverTimestamp(),
        saldoFalso: user.fichas,
        saldoReal: saldoCalculado,
        motivo: motivo
    });
}

// --- FUNÇÕES DE PREMIAÇÃO (Mantidas Iguais) ---
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
    } catch (e) { console.error(`Erro extrato ${userId}:`, e.message); }
}

async function enviarNotificacao(userId, titulo, corpo) {
    try {
        await db.collection('users').doc(userId).collection('mensagens').add({
            titulo, corpo, data: admin.firestore.FieldValue.serverTimestamp(), lida: false
        });
    } catch (e) {}
}

async function processarRanking(listaUsuarios, campoScore, arrayPontos, arrayFichas, nomeRanking) {
    console.log(`\n🏆 Processando ${nomeRanking}...`);
    const classificados = listaUsuarios.filter(u => (u[campoScore] || 0) > 0);
    classificados.sort((a, b) => b[campoScore] - a[campoScore]);

    const top5 = classificados.slice(0, 5);
    for (let i = 0; i < top5.length; i++) {
        const user = top5[i];
        const pts = arrayPontos[i] || 0;
        const fichas = arrayFichas[i] || 0;

        console.log(`   #${i + 1} ${user.nome}: +${pts}pts / +${fichas}fichas`);
        const updates = { pontosCampeao: admin.firestore.FieldValue.increment(pts) };
        
        if (fichas > 0) {
            updates.fichas = admin.firestore.FieldValue.increment(fichas);
            await gerarExtrato(user.id, fichas, `Prêmio ${nomeRanking} (#${i+1})`);
        }
        await db.collection('users').doc(user.id).update(updates);
        let txtFichas = fichas > 0 ? ` e <strong>${fichas} Fichas</strong>` : ``;
        await enviarNotificacao(user.id, `🏆 Top ${i+1} ${nomeRanking}!`, `Parabéns! Venceu com ${user[campoScore]} pontos.<br>Ganhou: ⭐ +${pts}${txtFichas}.`);
    }

    console.log(`   🧹 Resetando ${campoScore}...`);
    const batchSize = 500;
    let batch = db.batch();
    let count = 0;
    for (const user of classificados) {
        batch.update(db.collection('users').doc(user.id), { [campoScore]: 0 });
        count++;
        if (count >= batchSize) { await batch.commit(); batch = db.batch(); count = 0; }
    }
    if (count > 0) await batch.commit();
}

async function lixeiro() {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 3);
    const snapshot = await db.collectionGroup('mensagens').where('lida', '==', true).where('lidaEm', '<', dataLimite).get();
    // (Lógica simplificada de limpeza se necessário, mas o foco é auditoria agora)
}

// --- START ---
async function startJuiz() {
    console.log("⚖️ Juiz v5.1 (Correção Reset Sem Extrato) Iniciado...");
    const snapshot = await db.collection('users').get();
    if (snapshot.empty) return;

    let usuarios = [];
    snapshot.forEach(doc => usuarios.push({ id: doc.id, ...doc.data() }));

    const agora = new Date();
    agora.setHours(agora.getHours() - 3); 
    const diaSemana = agora.getDay();
    const diaMes = agora.getDate();

    // 1. Auditoria e Limpeza (Agora corrige TODOS os casos)
    await auditoriaConsolidada(usuarios);

    // 2. Rankings
    await processarRanking([...usuarios], 'scoreDiario', PONTOS_DIARIO, FICHAS_DIARIO, 'Diário');
    if (diaSemana === 5) await processarRanking([...usuarios], 'scoreSemanal', PONTOS_SEMANAL, FICHAS_SEMANAL, 'Semanal');
    if (diaMes === 1) await processarRanking([...usuarios], 'scoreMensal', PONTOS_MENSAL, FICHAS_MENSAL, 'Mensal');

    console.log("\n🏁 Fim da execução.");
}

startJuiz().catch(err => { console.error("❌ Erro fatal:", err); process.exit(1); });
