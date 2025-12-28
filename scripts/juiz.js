const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("❌ Erro: Chave não encontrada.");
    process.exit(1);
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Configurações de Prêmios (Mantido igual)
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
            // Se não existir, assume 5 (saldo inicial padrão)
            let saldoSeguro = user.saldo_auditado !== undefined ? user.saldo_auditado : 5;

            // 2. Busca os novos extratos (papéis soltos)
            const extratosRef = db.collection('users').doc(user.id).collection('extrato');
            const snapshot = await extratosRef.get();

            if (snapshot.empty) {
                // Se não tem extrato novo, só confere se o saldo bate
                if (user.fichas !== saldoSeguro) {
                    // Diferença pequena pode ser delay, grande é hack
                    if (Math.abs(user.fichas - saldoSeguro) > 5) {
                        console.warn(`🚨 SUSPEITO SEM EXTRATO: ${user.id} | Real: ${user.fichas} vs Seguro: ${saldoSeguro}`);
                        reportarSuspeito(user, saldoSeguro, "Saldo alterado sem extrato");
                        suspeitos++;
                    }
                }
                continue;
            }

            // 3. Soma os novos movimentos
            let somaNovos = 0;
            const batch = db.batch(); // Para deletar em lote

            snapshot.forEach(doc => {
                somaNovos += (doc.data().valor || 0);
                batch.delete(doc.ref); // Já marca para deletar o papel
            });

            // 4. Calcula o Novo Saldo Seguro
            const novoSaldoSeguro = saldoSeguro + somaNovos;

            // 5. O Grande Teste: O saldo que o usuário diz que tem BATE com a nossa conta?
            // Aceitamos margem de erro de 2 fichas (delays de internet)
            if (Math.abs(user.fichas - novoSaldoSeguro) > 5) {
                console.warn(`🚨 SUSPEITO: ${user.id}`);
                console.warn(`   Diz ter: ${user.fichas} | Calculamos: ${novoSaldoSeguro} (Antigo ${saldoSeguro} + Mov ${somaNovos})`);
                
                // Em vez de banir direto, resetamos o saldo dele para o valor correto calculado pelo Juiz
                // Isso "anula" o hack de fichas
                batch.update(db.collection('users').doc(user.id), { 
                    fichas: novoSaldoSeguro,
                    saldo_auditado: novoSaldoSeguro // Atualiza o saldo seguro
                });
                
                reportarSuspeito(user, novoSaldoSeguro, "Divergência Financeira Detectada");
                suspeitos++;
            } else {
                // Tudo certo! Atualiza o saldo seguro e apaga os extratos
                batch.update(db.collection('users').doc(user.id), { 
                    saldo_auditado: novoSaldoSeguro 
                });
            }

            // 6. Executa a Limpeza (Deleta extratos e atualiza saldo seguro)
            await batch.commit();
            totalExtratosApagados += snapshot.size;

        } catch (error) {
            console.error(`Erro ao auditar ${user.id}:`, error.message);
        }
    }
    console.log(`✅ Auditoria finalizada. ${suspeitos} suspeitos corrigidos. ${totalExtratosApagados} extratos arquivados.`);
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

// ... (Funções de Premiação: processarRanking, enviarNotificacao, etc... MANTENHA IGUAL AO ANTERIOR) ...
// Vou resumir a parte de premiação aqui para caber, mas você deve manter a lógica de reset e premiação do script anterior.

async function processarRanking(listaUsuarios, campoScore, arrayPontos, arrayFichas, nomeRanking) {
    // ... (Use a mesma lógica do script anterior v4.0) ...
    // Importante: Quando premiar, use db.collection(...).add() no extrato.
    // O próximo ciclo do auditor vai ler esse prêmio, somar ao saldo seguro e apagar o registro.
    
    // CÓDIGO RESUMIDO DA PREMIAÇÃO (Copie o miolo da resposta anterior se precisar)
    const classificados = listaUsuarios.filter(u => (u[campoScore] || 0) > 0).sort((a, b) => b[campoScore] - a[campoScore]);
    const top5 = classificados.slice(0, 5);
    for (let i = 0; i < top5.length; i++) {
        const u = top5[i];
        const pts = arrayPontos[i] || 0;
        const fichas = arrayFichas[i] || 0;
        
        let updates = { pontosCampeao: admin.firestore.FieldValue.increment(pts) };
        if(fichas > 0) {
            updates.fichas = admin.firestore.FieldValue.increment(fichas);
            // Cria o extrato (que será auditado e apagado amanhã)
            await db.collection('users').doc(u.id).collection('extrato').add({
                valor: fichas,
                motivo: `Prêmio ${nomeRanking}`,
                data: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        await db.collection('users').doc(u.id).update(updates);
    }
    // Reset dos scores
    let batch = db.batch();
    classificados.forEach(u => batch.update(db.collection('users').doc(u.id), { [campoScore]: 0 }));
    await batch.commit();
}

// --- START ---
async function startJuiz() {
    console.log("⚖️ Juiz v5.0 (Auditor Consolidado) Iniciado...");
    const snapshot = await db.collection('users').get();
    let usuarios = [];
    snapshot.forEach(doc => usuarios.push({ id: doc.id, ...doc.data() }));

    // 1. Auditoria ANTES de premiar (Limpa o passado e valida o saldo atual)
    await auditoriaConsolidada(usuarios);

    // 2. Premiação (Gera novos extratos para serem validados amanhã)
    const agora = new Date(); agora.setHours(agora.getHours() - 3);
    const diaSemana = agora.getDay(); const diaMes = agora.getDate();

    await processarRanking([...usuarios], 'scoreDiario', PONTOS_DIARIO, FICHAS_DIARIO, 'Diário');
    if (diaSemana === 5) await processarRanking([...usuarios], 'scoreSemanal', PONTOS_SEMANAL, FICHAS_SEMANAL, 'Semanal');
    if (diaMes === 1) await processarRanking([...usuarios], 'scoreMensal', PONTOS_MENSAL, FICHAS_MENSAL, 'Mensal');

    console.log("🏁 Fim.");
}

startJuiz().catch(err => { console.error(err); process.exit(1); });
