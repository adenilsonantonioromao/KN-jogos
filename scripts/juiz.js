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

// --- AUDITORIA GERAL (FICHAS + PONTOS) ---
async function auditoriaConsolidada(usuarios) {
    console.log("\n🕵️‍♂️ INICIANDO AUDITORIA DUPLA...");
    let suspeitos = 0;
    let logsApagados = 0;

    for (const user of usuarios) {
        try {
            // Saldos Seguros Anteriores
            let saldoSeguroFichas = user.saldo_auditado !== undefined ? user.saldo_auditado : 5;
            let saldoSeguroPontos = user.pontos_auditados !== undefined ? user.pontos_auditados : 0;

            const extratosRef = db.collection('users').doc(user.id).collection('extrato');
            const snapshot = await extratosRef.get();

            let somaNovasFichas = 0;
            let somaNovosPontos = 0;
            const batch = db.batch();

            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const valor = data.valor || 0;
                    
                    if (data.tipo === 'PONTO') {
                        somaNovosPontos += valor;
                    } else {
                        // Assume FICHA se não tiver tipo ou for FICHA
                        somaNovasFichas += valor;
                    }
                    batch.delete(doc.ref); // Marca para deletar
                });
            }

            // Calculando novos totais seguros
            const novoSeguroFichas = saldoSeguroFichas + somaNovasFichas;
            const novoSeguroPontos = saldoSeguroPontos + somaNovosPontos;

            // --- VALIDAÇÃO 1: FICHAS ---
            if (Math.abs(user.fichas - novoSeguroFichas) > 5) {
                console.warn(`🚨 SUSPEITO FICHAS: ${user.id} | Real: ${user.fichas} vs Seguro: ${novoSeguroFichas}`);
                batch.update(db.collection('users').doc(user.id), { 
                    fichas: novoSeguroFichas,
                    saldo_auditado: novoSeguroFichas 
                });
                await reportarSuspeito(user, novoSeguroFichas, user.fichas, "Fichas alteradas sem log");
                suspeitos++;
            } else {
                batch.update(db.collection('users').doc(user.id), { saldo_auditado: novoSeguroFichas });
            }

            // --- VALIDAÇÃO 2: PONTOS TOTAIS (Lifetime) ---
            // Nota: Pontos totais nunca diminuem. Se diminuir, é bug ou reset manual, ignoramos.
            if (Math.abs(user.pontuacaoTotal - novoSeguroPontos) > 200) { // Margem maior para pontos
                console.warn(`🚨 SUSPEITO PONTOS: ${user.id} | Real: ${user.pontuacaoTotal} vs Seguro: ${novoSeguroPontos}`);
                batch.update(db.collection('users').doc(user.id), { 
                    pontuacaoTotal: novoSeguroPontos,
                    pontos_auditados: novoSeguroPontos 
                });
                await reportarSuspeito(user, novoSeguroPontos, user.pontuacaoTotal, "Pontos alterados sem log");
                suspeitos++;
            } else {
                batch.update(db.collection('users').doc(user.id), { pontos_auditados: novoSeguroPontos });
            }

            // Executa tudo (Limpeza + Correções + Atualização de Saldos Seguros)
            await batch.commit();
            logsApagados += snapshot.size;

        } catch (error) {
            console.error(`Erro ao auditar ${user.id}:`, error.message);
        }
    }
    console.log(`✅ Auditoria finalizada. ${suspeitos} correções. ${logsApagados} logs arquivados.`);
}

async function reportarSuspeito(user, real, falso, motivo) {
    await db.collection('admin_auditoria').add({
        userId: user.id,
        nome: user.nome || "Desconhecido",
        data: admin.firestore.FieldValue.serverTimestamp(),
        saldoFalso: falso,
        saldoReal: real,
        motivo: motivo
    });
}

// ... (Resto do código de premiação: gerarExtrato, processarRanking, startJuiz... MANTENHA IGUAL AO ANTERIOR) ...
// IMPORTANTE: Ao premiar, use tipo: 'FICHA' no gerarExtrato para o auditor saber somar certo.

async function gerarExtrato(userId, valor, motivo) {
    try {
        const serial = `JUIZ-${Date.now()}`;
        await db.collection('users').doc(userId).collection('extrato').add({
            data: admin.firestore.FieldValue.serverTimestamp(),
            valor: valor,
            motivo: motivo,
            tipo: 'FICHA', // Juiz sempre dá fichas (Pontos de campeão não somam no pontuacaoTotal, são separados)
            serial: serial,
            origem: "SISTEMA"
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
        const u = top5[i];
        const pts = arrayPontos[i] || 0;
        const fichas = arrayFichas[i] || 0;

        const updates = { pontosCampeao: admin.firestore.FieldValue.increment(pts) };
        if(fichas > 0) {
            updates.fichas = admin.firestore.FieldValue.increment(fichas);
            await gerarExtrato(u.id, fichas, `Prêmio ${nomeRanking}`);
        }
        await db.collection('users').doc(u.id).update(updates);
        let txt = fichas > 0 ? ` e <strong>${fichas} Fichas</strong>` : ``;
        await enviarNotificacao(u.id, `🏆 Top ${i+1} ${nomeRanking}!`, `Ganhou: ⭐ +${pts}${txt}.`);
    }

    // Reset
    let batch = db.batch();
    classificados.forEach(u => batch.update(db.collection('users').doc(u.id), { [campoScore]: 0 }));
    await batch.commit();
}

async function startJuiz() {
    console.log("⚖️ Juiz v6.0 (Auditoria Dupla) Iniciado...");
    const snapshot = await db.collection('users').get();
    let usuarios = [];
    snapshot.forEach(doc => usuarios.push({ id: doc.id, ...doc.data() }));

    // 1. Auditoria
    await auditoriaConsolidada(usuarios);

    // 2. Rankings
    const agora = new Date(); agora.setHours(agora.getHours() - 3);
    const diaSemana = agora.getDay(); const diaMes = agora.getDate();

    await processarRanking([...usuarios], 'scoreDiario', PONTOS_DIARIO, FICHAS_DIARIO, 'Diário');
    if (diaSemana === 5) await processarRanking([...usuarios], 'scoreSemanal', PONTOS_SEMANAL, FICHAS_SEMANAL, 'Semanal');
    if (diaMes === 1) await processarRanking([...usuarios], 'scoreMensal', PONTOS_MENSAL, FICHAS_MENSAL, 'Mensal');

    console.log("🏁 Fim.");
}

startJuiz().catch(err => { console.error(err); process.exit(1); });
