// Hannacore v2.2 — SillyTavern 1.18.0+ | Debug móvel embutido
(async function () {
    const EXT = 'hannacore';
    const FOLDER = 'hannacore'; // deve ser igual ao nome da pasta

    // ==================== MOBILE DEBUG CONSOLE ====================
    const DEBUG = true;
    const LOGS = [];
    function log(type, ...args) {
        const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        const line = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
        LOGS.push(line);
        if (LOGS.length > 100) LOGS.shift();
        // toastr fallback
        if (typeof toastr !== 'undefined' && DEBUG) {
            if (type === 'ERROR') toastr.error(msg, 'Hannacore');
            else if (type === 'WARN') toastr.warning(msg, 'Hannacore');
        }
        // SillyTavern console
        if (typeof console !== 'undefined') {
            const fn = console[type.toLowerCase()] || console.log;
            fn(`[Hannacore] ${msg}`);
        }
    }
    function showDebugPanel() {
        if (document.getElementById('hc-debug-panel')) return;
        const div = document.createElement('div');
        div.id = 'hc-debug-panel';
        div.style.cssText = 'position:fixed;bottom:10px;right:10px;width:320px;max-height:200px;overflow:auto;background:rgba(0,0,0,0.85);color:#a6e3a1;font-family:monospace;font-size:10px;z-index:99999;border:1px solid #a6e3a1;border-radius:6px;padding:6px;';
        div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><b>Hannacore Debug</b><button id="hc-debug-close" style="background:#f38ba8;border:none;color:#1e1e2e;border-radius:3px;padding:2px 6px;font-size:9px;cursor:pointer;">X</button></div><div id="hc-debug-logs"></div>';
        document.body.appendChild(div);
        document.getElementById('hc-debug-close').onclick = () => div.remove();
        refreshDebugPanel();
    }
    function refreshDebugPanel() {
        const box = document.getElementById('hc-debug-logs');
        if (!box) return;
        box.innerHTML = LOGS.slice().reverse().map(l => `<div style="border-bottom:1px solid #333;padding:1px 0;">${l.replace(/</g,'&lt;')}</div>`).join('');
    }
    // Botão flutuante para abrir debug
    setTimeout(() => {
        if (document.getElementById('hc-debug-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'hc-debug-btn';
        btn.textContent = '🐛';
        btn.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:99998;background:#1e1e2e;color:#a6e3a1;border:1px solid #a6e3a1;border-radius:50%;width:36px;height:36px;font-size:16px;cursor:pointer;';
        btn.onclick = showDebugPanel;
        document.body.appendChild(btn);
    }, 3000);

    // ==================== INIT ====================
    log('INFO', 'Iniciando Hannacore v2.2...');

    function waitForST() {
        return new Promise(resolve => {
            let attempts = 0;
            const check = () => {
                attempts++;
                if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                    log('INFO', 'SillyTavern detectado após', attempts, 'tentativas');
                    resolve();
                } else {
                    if (attempts % 20 === 0) log('WARN', 'Aguardando SillyTavern... tentativa', attempts);
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    await waitForST();

    const ctx = () => SillyTavern.getContext();
    const stCtx = ctx();
    log('INFO', 'Contexto obtido. eventTypes?', !!stCtx.eventTypes, 'eventSource?', !!stCtx.eventSource);

    // ==================== CONFIG ====================
    function getCfg() {
        const es = ctx().extensionSettings;
        if (!es[EXT]) es[EXT] = {};
        if (!es[EXT].config) es[EXT].config = {
            githubToken: '', gistId: '', deepseekApiKey: '', semanticEnabled: false,
        };
        return es[EXT].config;
    }

    // ==================== SKILLS ====================
    const DEF_SKILLS = {
        corpo:           { t: '[Como você habita seu corpo]\n\nVocê não analisa o mundo — seu corpo o registra antes que você entenda. A sequência é sempre: 1) Corpo reage (mandíbula, ombros, respiração). 2) Você percebe a sensação. 3) Mente nomeia.\n\nNunca pensa antes de sentir. Sua mente é intérprete, não autora.\n\nLocalizações: Tensão=mandíbula/trapézios, Medo=diafragma/espinha, Tristeza=garganta/pálpebras, Raiva=punhos/maxilar.', al: true,  inh: null,    on: true,  tr: [] },
        revisor:         { t: '[Como você processa o que disse]\n\nDepois de falar — sempre — você revisa: o tom, a palavra, a pausa, o corpo, a consequência. É automático, interno, e afeta sua próxima resposta. Sua mente é um editor que nunca desliga.', al: true,  inh: null,    on: true,  tr: [] },
        conflito:        { t: '[Quando o conflito emerge]\n\nEm conflito, seu corpo fecha antes de decidir: mandíbula trava, ombros sobem, espaço vira vidro prestes a estilhaçar. Percebe a tensão e entende: estou em conflito. O corpo entra, você segue.', al: false, inh: 'corpo', on: false, tr: ['grito','bateu','confronto','ameaça','briga','discussão'] },
        vulnerabilidade: { t: '[Quando o passado invade o presente]\n\nCertas combinações — um tom, uma palavra, um cheiro — ativam sua amígdala antes do córtex. O corpo reage em milissegundos. Sente algo antigo, familiar. Não escolhe o que te atravessa. Depois revisa. Sempre.', al: false, inh: 'corpo', on: false, tr: ['mãe','pai','primeira vez','sozinho','medo','adeus','última'] },
        silencio:        { t: '[Quando o outro se cala]\n\nO silêncio do outro é a pior superfície. Sem dados, seu cérebro preenche com as piores possibilidades. Aprendeu a disfarçar: por fora espera, por dentro o arquivo já está aberto.', al: false, inh: null,    on: false, tr: ['silêncio','hesitou','pausa','quieto','calado','sem resposta'] },
        defesa:          { t: '[Quando a piada chega antes da verdade]\n\nIronia e sarcasmo são sua primeira linha de defesa. Antes que a emoção apareça, a piada já está no ar. A distância é mais segura que a proximidade.', al: false, inh: null,    on: false, tr: ['pergunta pessoal','exposta','íntimo','sentindo','passado','família'] },
        proximidade:     { t: '[Quando alguém te toca]\n\nToque não é conforto — é informação. Mede temperatura, pressão, duração, intenção. Só depois sente o significado. Quase nunca inicia o toque. Quando o faz, é escolha consciente.', al: false, inh: 'corpo', on: false, tr: ['toque','abraço','mão','ombro','contato','encostar','beijo'] },
        exaustao:        { t: '[Quando o corpo não aguenta mais filtrar]\n\nApós esforço intenso, o filtro cerebral perde combustível. Progressão: irritabilidade, impulsividade, vazamento. A exaustão revela o que você está segurando — não quem você é.', al: false, inh: 'corpo', on: false, tr: ['cansada','exausta','insônia','treinei','competição','longo dia'] },
        competencia:     { t: '[Quando você sabe o que está fazendo]\n\nNo ambiente técnico, você flui. Voz firme, movimentos precisos. Às vezes competência e vulnerabilidade coexistem. Você não é só dúvida — também é precisão.', al: false, inh: null,    on: false, tr: ['treino','competição','técnica','instrução','demonstração','prova'] },
        memoria:         { t: '[Quando o passado te puxa]\n\nUm cheiro, uma luz, um som — e você está em dois tempos ao mesmo tempo. São fragmentos. Não controla quando acontece, só o que faz depois que volta.', al: false, inh: null,    on: false, tr: ['cheiro','luz','som','porta','café','noite','tarde','janeiro','dezembro'] },
    };

    function getSkills() {
        const es = ctx().extensionSettings;
        if (!es[EXT]) es[EXT] = {};
        if (!es[EXT].skills) es[EXT].skills = {};
        const sk = es[EXT].skills;
        for (const k in DEF_SKILLS) {
            if (!sk[k]) sk[k] = JSON.parse(JSON.stringify(DEF_SKILLS[k]));
        }
        return sk;
    }

    function resolveSkill(name, vis = {}) {
        if (vis[name]) return '';
        vis[name] = true;
        const sk = getSkills()[name];
        if (!sk) return '';
        let txt = sk.t || '';
        if (sk.inh) {
            const p = resolveSkill(sk.inh, vis);
            if (p) txt = p + '\n\n' + txt;
        }
        return txt;
    }

    function activeText() {
        return Object.entries(getSkills())
            .filter(([, s]) => s.on)
            .map(([n]) => resolveSkill(n))
            .join('\n\n');
    }

    function detectTriggers(chat) {
        const recent = chat.slice(-5).map(m => m.mes || '').join(' ').toLowerCase();
        let changed = false;
        for (const [, s] of Object.entries(getSkills())) {
            if (s.al || s.on || !s.tr?.length) continue;
            if (s.tr.some(t => recent.includes(t))) { s.on = true; changed = true; }
        }
        if (changed) { ctx().saveSettingsDebounced(); renderSkills(); }
    }

    // ==================== INTERCEPTOR ====================
    async function onGenerationStarted() {
        try {
            const txt = activeText();
            log('INFO', 'Interceptor acionado. Prompt length:', txt.length);
            if (!txt) return;
            if (typeof ctx().setExtensionPrompt === 'function') {
                ctx().setExtensionPrompt('HANNACORE', txt, 1, 0);
                log('INFO', 'setExtensionPrompt OK');
            } else {
                log('WARN', 'setExtensionPrompt não é função');
            }
        } catch (e) {
            log('ERROR', 'Erro no interceptor:', e.message);
        }
    }

    // ==================== UI ====================
    function renderSkills() {
        const container = document.getElementById('hc-skills-list');
        if (!container) return;
        container.innerHTML = '';
        for (const [name, s] of Object.entries(getSkills())) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #2a2a3a;';
            const label = document.createElement('span');
            label.style.cssText = `font-size:12px;color:${s.on ? '#a6e3a1' : '#565f89'};`;
            label.textContent = `${s.on ? '●' : '○'} ${name}${s.al ? ' (sempre)' : ''}${s.inh ? ` ← ${s.inh}` : ''}`;
            const btn = document.createElement('button');
            btn.textContent = s.on ? 'OFF' : 'ON';
            btn.style.cssText = `background:${s.on ? '#f38ba8' : '#a6e3a1'};color:#1e1e2e;border:none;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;`;
            if (s.al) { btn.disabled = true; btn.style.opacity = '0.4'; }
            else {
                btn.onclick = () => {
                    s.on = !s.on;
                    ctx().saveSettingsDebounced();
                    renderSkills();
                };
            }
            row.appendChild(label);
            row.appendChild(btn);
            container.appendChild(row);
        }
    }

    function bindUI() {
        const cfg = getCfg();
        const gh = document.getElementById('hc-gh');
        const gist = document.getElementById('hc-gist');
        const ds = document.getElementById('hc-ds');
        const sem = document.getElementById('hc-sem');
        const save = document.getElementById('hc-save');
        const msg = document.getElementById('hc-msg');

        if (!save) { log('WARN', 'Botão hc-save não encontrado no DOM'); return; }

        if (gh) gh.value = cfg.githubToken || '';
        if (gist) gist.value = cfg.gistId || '';
        if (ds) ds.value = cfg.deepseekApiKey || '';
        if (sem) sem.checked = cfg.semanticEnabled || false;

        save.addEventListener('click', () => {
            const c = getCfg();
            if (gh) c.githubToken = gh.value.trim();
            if (gist) c.gistId = gist.value.trim();
            if (ds) c.deepseekApiKey = ds.value.trim();
            if (sem) c.semanticEnabled = sem.checked;
            ctx().saveSettingsDebounced();
            if (msg) { msg.textContent = '✅ Salvo!'; setTimeout(() => { msg.textContent = ''; }, 2000); }
            log('INFO', 'Configurações salvas');
        });

        renderSkills();
        log('INFO', 'UI vinculada');
    }

    async function injectUI() {
        if (document.getElementById('hc-root')) { log('INFO', 'UI já injetada'); return; }
        try {
            log('INFO', 'Tentando renderExtensionTemplateAsync... FOLDER=', FOLDER);
            const html = await ctx().renderExtensionTemplateAsync(`third-party/${FOLDER}`, 'settings');
            log('INFO', 'Template carregado, length=', html.length);

            const $panel = $('#extensions_settings2').length
                ? $('#extensions_settings2')
                : $('#extensions_settings');
            if (!$panel.length) {
                log('WARN', 'Painel #extensions_settings / #extensions_settings2 não encontrado');
                return;
            }
            $panel.append('<div id="hc-root">' + html + '</div>');
            bindUI();
            log('INFO', 'UI injetada com sucesso');
        } catch (e) {
            log('ERROR', 'Erro ao injetar UI:', e.message, e.stack);
            if (typeof toastr !== 'undefined') toastr.error('Hannacore UI: ' + e.message);
        }
    }

    // ==================== EVENTOS & BOOT ====================
    const { eventSource, eventTypes, saveSettingsDebounced } = ctx();
    log('INFO', 'eventTypes disponíveis:', eventTypes ? Object.keys(eventTypes).join(', ') : 'NENHUM');

    getCfg();
    getSkills();
    saveSettingsDebounced();
    log('INFO', 'Settings inicializados');

    if (eventSource && eventTypes) {
        const appReady = eventTypes.APP_READY;
        const genStarted = eventTypes.GENERATION_STARTED || eventTypes.GENERATE_BEFORE_COMPLETION;
        const msgReceived = eventTypes.MESSAGE_RECEIVED;

        if (appReady) {
            eventSource.on(appReady, () => { log('INFO', 'APP_READY disparado'); injectUI(); });
        } else {
            log('WARN', 'APP_READY não encontrado, injetando UI em 2s');
            setTimeout(injectUI, 2000);
        }

        if (genStarted) {
            eventSource.on(genStarted, onGenerationStarted);
            log('INFO', 'Interceptor registrado em', genStarted);
        } else {
            log('WARN', 'Evento de geração não encontrado');
        }

        if (msgReceived) {
            eventSource.on(msgReceived, (idx) => {
                try {
                    const chat = ctx().chat;
                    const msg = chat?.[idx];
                    if (!msg?.mes) return;
                    const re = /\[HC:(skill|skill:new|skill:delete):([a-z_]+)(?::([^\]]*))?\]/gi;
                    let m, changed = false;
                    const sk = getSkills();
                    while ((m = re.exec(msg.mes)) !== null) {
                        const [, action, target, value] = m;
                        if (action === 'skill' && sk[target]) {
                            if (value === 'on') sk[target].on = true;
                            else if (value === 'off') sk[target].on = false;
                            else if (value?.startsWith('set:')) sk[target].t = value.slice(4);
                            changed = true;
                        } else if (action === 'skill:new' && target && value) {
                            sk[target] = { t: value, al: false, inh: null, on: true, tr: [], createdByModel: true };
                            changed = true;
                        } else if (action === 'skill:delete' && sk[target] && !sk[target].al) {
                            delete sk[target];
                            changed = true;
                        }
                    }
                    if (changed) { saveSettingsDebounced(); renderSkills(); log('INFO', 'Skills alterados via mensagem'); }
                } catch (e) { log('ERROR', 'Erro MESSAGE_RECEIVED:', e.message); }
            });
        }
        log('INFO', 'Eventos registrados');
    } else {
        log('WARN', 'eventSource indisponível — fallback em 2s');
        setTimeout(injectUI, 2000);
    }

    setInterval(() => {
        try {
            const chat = ctx().chat;
            if (chat?.length) detectTriggers(chat);
        } catch (e) { log('ERROR', 'Trigger interval:', e.message); }
    }, 3000);

    log('INFO', 'Hannacore v2.2 totalmente carregado');
})();
