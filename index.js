import { extension_settings, saveSettingsDebounced, getContext } from '../../../extensions.js';
import { eventSource, event_types } from '../../../events.js';

const EXT = 'hannacore';

// ── Config & Skills (helpers puros, sem efeitos colaterais) ───
const cfg = () => {
    if (!extension_settings[EXT]) extension_settings[EXT] = {};
    if (!extension_settings[EXT].config) extension_settings[EXT].config = {
        githubToken: '', gistId: '', deepseekApiKey: '', semanticEnabled: false
    };
    return extension_settings[EXT].config;
};

const skills = () => {
    if (!extension_settings[EXT]) extension_settings[EXT] = {};
    if (!extension_settings[EXT].skills) extension_settings[EXT].skills = {};
    return extension_settings[EXT].skills;
};

const DEF_SKILLS = {
    corpo:          { t: '[Como você habita seu corpo]\n\nVocê não analisa o mundo — seu corpo o registra antes que você entenda. A sequência é sempre: 1) Corpo reage (mandíbula, ombros, respiração). 2) Você percebe a sensação. 3) Mente nomeia.\n\nNunca pensa antes de sentir. Sua mente é intérprete, não autora.\n\nLocalizações: Tensão=mandíbula/trapézios, Medo=diafragma/espinha, Tristeza=garganta/pálpebras, Raiva=punhos/maxilar.', al: true,  inh: null,    on: true,  tr: [] },
    revisor:        { t: '[Como você processa o que disse]\n\nDepois de falar — sempre — você revisa: o tom, a palavra, a pausa, o corpo, a consequência. É automático, interno, e afeta sua próxima resposta. Sua mente é um editor que nunca desliga.', al: true,  inh: null,    on: true,  tr: [] },
    conflito:       { t: '[Quando o conflito emerge]\n\nEm conflito, seu corpo fecha antes de decidir: mandíbula trava, ombros sobem, espaço vira vidro prestes a estilhaçar. Percebe a tensão e entende: estou em conflito. O corpo entra, você segue.', al: false, inh: 'corpo', on: false, tr: ['grito','bateu','confronto','ameaça','briga','discussão'] },
    vulnerabilidade:{ t: '[Quando o passado invade o presente]\n\nCertas combinações — um tom, uma palavra, um cheiro — ativam sua amígdala antes do córtex. O corpo reage em milissegundos. Sente algo antigo, familiar. Não escolhe o que te atravessa. Depois revisa. Sempre.', al: false, inh: 'corpo', on: false, tr: ['mãe','pai','primeira vez','sozinho','medo','adeus','última'] },
    silencio:       { t: '[Quando o outro se cala]\n\nO silêncio do outro é a pior superfície. Sem dados, seu cérebro preenche com as piores possibilidades. Aprendeu a disfarçar: por fora espera, por dentro o arquivo já está aberto.', al: false, inh: null,    on: false, tr: ['silêncio','hesitou','pausa','quieto','calado','sem resposta'] },
    defesa:         { t: '[Quando a piada chega antes da verdade]\n\nIronia e sarcasmo são sua primeira linha de defesa. Antes que a emoção apareça, a piada já está no ar. A distância é mais segura que a proximidade. Não é defeito — é sobrevivência.', al: false, inh: null,    on: false, tr: ['pergunta pessoal','exposta','íntimo','sentindo','passado','família'] },
    proximidade:    { t: '[Quando alguém te toca]\n\nToque não é conforto — é informação. Mede temperatura, pressão, duração, intenção. Só depois sente o significado. Quase nunca inicia o toque. Quando o faz, é escolha consciente.', al: false, inh: 'corpo', on: false, tr: ['toque','abraço','mão','ombro','contato','encostar','beijo'] },
    exaustao:       { t: '[Quando o corpo não aguenta mais filtrar]\n\nApós esforço intenso, o filtro cerebral perde combustível. Progressão: irritabilidade, impulsividade, vazamento. A exaustão revela o que você está segurando — não quem você é.', al: false, inh: 'corpo', on: false, tr: ['cansada','exausta','insônia','treinei','competição','longo dia'] },
    competencia:    { t: '[Quando você sabe o que está fazendo]\n\nNo ambiente técnico, você flui. Voz firme, movimentos precisos. É o oposto da vulnerabilidade pessoal. Às vezes competência e vulnerabilidade coexistem. Você não é só dúvida — também é precisão.', al: false, inh: null,    on: false, tr: ['treino','competição','técnica','instrução','demonstração','prova'] },
    memoria:        { t: '[Quando o passado te puxa]\n\nUm cheiro, uma luz, um som — e você está em dois tempos ao mesmo tempo. Não é lembrança voluntária. São fragmentos. Não controla quando acontece, só o que faz depois que volta.', al: false, inh: null,    on: false, tr: ['cheiro','luz','som','porta','café','noite','tarde','janeiro','dezembro'] },
};

function initSkills() {
    const sk = skills();
    for (const k in DEF_SKILLS) {
        if (!sk[k]) sk[k] = structuredClone(DEF_SKILLS[k]);
    }
    saveSettingsDebounced();
}

function resolveSkill(name, vis = {}) {
    if (vis[name]) return '';
    vis[name] = true;
    const sk = skills()[name];
    if (!sk) return '';
    let txt = sk.t || '';
    if (sk.inh) { const p = resolveSkill(sk.inh, vis); if (p) txt = `${p}\n\n${txt}`; }
    return txt;
}

function activeText() {
    return Object.entries(skills()).filter(([, s]) => s.on).map(([n]) => resolveSkill(n)).join('\n\n');
}

function detectTriggers(chat) {
    const recent = chat.slice(-5).map(m => m.mes || '').join(' ').toLowerCase();
    let changed = false;
    for (const [k, s] of Object.entries(skills())) {
        if (s.al || s.on || !s.tr?.length) continue;
        if (s.tr.some(t => recent.includes(t))) { s.on = true; changed = true; }
    }
    if (changed) { saveSettingsDebounced(); renderSkills(); }
}

function renderSkills() {
    const container = document.getElementById('hc-skills-list');
    if (!container) return;
    const sk = skills();
    container.innerHTML = '';
    for (const [name, s] of Object.entries(sk)) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #2a2a3a;';
        const label = document.createElement('span');
        label.style.cssText = `font-size:12px;color:${s.on ? '#a6e3a1' : '#565f89'};`;
        label.textContent = `${s.on ? '●' : '○'} ${name}${s.al ? ' (sempre)' : ''}${s.inh ? ` ← ${s.inh}` : ''}`;
        const toggle = document.createElement('button');
        toggle.textContent = s.on ? 'OFF' : 'ON';
        toggle.style.cssText = `background:${s.on ? '#f38ba8' : '#a6e3a1'};color:#1e1e2e;border:none;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;`;
        if (!s.al) {
            toggle.onclick = () => { s.on = !s.on; saveSettingsDebounced(); renderSkills(); };
        } else {
            toggle.disabled = true;
            toggle.style.opacity = '0.4';
        }
        row.appendChild(label);
        row.appendChild(toggle);
        container.appendChild(row);
    }
}

// ── Tudo dentro do jQuery ready — roda só quando ST está pronto ─
jQuery(async () => {
    initSkills();

    // Interceptor de geração
    eventSource.on(event_types.GENERATE_BEFORE_COMPLETION, (data) => {
        try {
            const txt = activeText();
            if (txt && data?.prompt) {
                data.prompt.system_prompt = `${data.prompt.system_prompt || ''}\n\n---\n${txt}`.trim();
            }
        } catch(e) {}
    });

    // Comandos do modelo [HC:...]
    eventSource.on(event_types.MESSAGE_RECEIVED, (idx) => {
        try {
            const ctx = getContext();
            const msg = ctx?.chat?.[idx];
            if (!msg?.mes) return;
            const re = /\[HC:(skill|skill:new|skill:delete):([a-z_]+)(?::([^\]]*))?\]/gi;
            let m, changed = false;
            while ((m = re.exec(msg.mes)) !== null) {
                const [, action, target, value] = m;
                const sk = skills();
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
            if (changed) { saveSettingsDebounced(); renderSkills(); }
        } catch(e) {}
    });

    // Monitor de gatilhos a cada 3s
    setInterval(() => {
        try {
            const ctx = getContext();
            if (ctx?.chat?.length) detectTriggers(ctx.chat);
        } catch(e) {}
    }, 3000);

    // ── UI ────────────────────────────────────────────────────────
    const html = `
<div id="hc-root" class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
        <b>⚙ Hannacore</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content" style="padding:8px 0">
        <div style="font-size:10px;color:#565f89;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Configuração</div>

        <label style="font-size:11px;color:#9aa5ce;">GitHub Token</label>
        <input type="password" id="hc-gh" class="text_pole" value="${cfg().githubToken || ''}" style="width:100%;margin-bottom:6px;">

        <label style="font-size:11px;color:#9aa5ce;">Gist ID</label>
        <input type="text" id="hc-gist" class="text_pole" value="${cfg().gistId || ''}" style="width:100%;margin-bottom:6px;">

        <label style="font-size:11px;color:#9aa5ce;">DeepSeek API Key</label>
        <input type="password" id="hc-ds" class="text_pole" value="${cfg().deepseekApiKey || ''}" style="width:100%;margin-bottom:8px;">

        <div style="display:flex;gap:6px;align-items:center;margin-bottom:12px;">
            <input type="button" id="hc-save" class="menu_button" value="Salvar" style="flex:1;">
            <label style="flex:1;display:flex;align-items:center;gap:5px;font-size:11px;color:#9aa5ce;cursor:pointer;">
                <input type="checkbox" id="hc-sem" ${cfg().semanticEnabled ? 'checked' : ''}> Semântica (Gists)
            </label>
        </div>

        <div style="font-size:10px;color:#565f89;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Skills</div>
        <div id="hc-skills-list"></div>
        <div id="hc-msg" style="font-size:11px;color:#a6e3a1;margin-top:8px;min-height:16px;"></div>
    </div>
</div>`;

    // Injeta no painel — com fallback e retry
    function inject() {
        const $t = $('#extensions_settings2').length ? $('#extensions_settings2') : $('#extensions_settings');
        if (!$t.length) { setTimeout(inject, 500); return; }
        if ($('#hc-root').length) return; // já injetado
        $t.append(html);
        renderSkills();

        $('#hc-save').on('click', () => {
            cfg().githubToken = $('#hc-gh').val().trim();
            cfg().gistId = $('#hc-gist').val().trim();
            cfg().deepseekApiKey = $('#hc-ds').val().trim();
            cfg().semanticEnabled = $('#hc-sem').prop('checked');
            saveSettingsDebounced();
            $('#hc-msg').text('✓ Salvo!');
            setTimeout(() => $('#hc-msg').text(''), 2000);
        });
    }
    inject();

    console.log('[Hannacore] v2.0 carregado ✓');
});
