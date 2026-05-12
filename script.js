/**
 * EduAgent · Frontend Controller
 * Comunica com o backend que executa um agente real com function calling.
 * Exibe o raciocínio passo a passo e os tool calls usados.
 */

const API_URL = "http://localhost:8080/educacao/analisar";

// ─── ESTADO DA UI ───────────────────────────────────────────────────────────

let currentLoadingBox = null;
let stepTimers = [];

function limparTimers() {
  stepTimers.forEach((t) => clearTimeout(t));
  stepTimers = [];
}

// ─── PARSING DA RESPOSTA DO AGENTE ──────────────────────────────────────────

/**
 * O backend retorna JSON com a estrutura do agente.
 * Fallback: tenta parsear texto simples se o JSON falhar.
 */
function parsearRespostaAgente(raw) {
  // Tenta JSON primeiro (resposta do agente estruturado)
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      classificacao: data.classificacao || "LACUNAS",
      prontidao:
        data.prontidao != null
          ? Math.min(100, Math.max(0, parseInt(data.prontidao)))
          : 60,
      diagnostico: data.diagnostico || "",
      analise: data.analise || "",
      plano: data.plano || "",
      ferramentasUsadas: data.ferramentasUsadas || [],
      iteracoes: data.iteracoes || 1,
      raciocinio: data.raciocinio || "",
    };
  } catch (_) {
    // Fallback: resposta texto puro (compatibilidade com backend simples)
    return parsearTextoLegado(raw);
  }
}

function parsearTextoLegado(texto) {
  const pct = extrairPorcentagemTexto(texto);
  const cls = detectarClassificacaoTexto(texto);

  const partes = { diagnostico: "", analise: "", plano: "" };
  const diagMatch = texto.match(
    /DIAGN[ÓO]STICO[\s\S]*?(?=AN[ÁA]LISE|PLANO|PR[ÓO]XIMO|$)/i,
  );
  const analMatch = texto.match(/AN[ÁA]LISE[\s\S]*?(?=PLANO|PR[ÓO]XIMO|$)/i);
  const planoMatch = texto.match(/(PLANO|PR[ÓO]XIMO PASSO)[\s\S]*$/i);

  if (diagMatch) partes.diagnostico = limparSecao(diagMatch[0]);
  if (analMatch) partes.analise = limparSecao(analMatch[0]);
  if (planoMatch) partes.plano = limparSecao(planoMatch[0]);

  if (!partes.diagnostico && !partes.analise && !partes.plano) {
    partes.analise = texto.trim();
  }

  return {
    classificacao: cls,
    prontidao: pct,
    ...partes,
    ferramentasUsadas: [],
    iteracoes: 1,
    raciocinio: "",
  };
}

function limparSecao(txt) {
  return txt
    .replace(/^(DIAGN[ÓO]STICO|AN[ÁA]LISE|PLANO|PR[ÓO]XIMO PASSO)[:\s-]*/i, "")
    .replace(/\[(PRONTO|LACUNAS|RECONSTRUIR)\]/g, "")
    .replace(/CLASSIFICA[ÇC][ÃA]O[:\s]+\S+[^\n]*/gi, "")
    .trim();
}

function detectarClassificacaoTexto(texto) {
  if (texto.includes("[PRONTO]") || /classificac[aã]o[:\s]+pronto/i.test(texto))
    return "PRONTO";
  if (texto.includes("[RECONSTRUIR]") || /reconstruir/i.test(texto))
    return "RECONSTRUIR";
  return "LACUNAS";
}

function extrairPorcentagemTexto(texto) {
  const m =
    texto.match(/PRONTID[AÃ]O[:\s]+(\d{1,3})/i) ||
    texto.match(/READINESS[:\s]+(\d{1,3})/i) ||
    texto.match(/(\d{1,3})\s*%/);
  if (m) return Math.min(100, Math.max(0, parseInt(m[1])));
  const cls = detectarClassificacaoTexto(texto);
  return cls === "PRONTO" ? 82 : cls === "LACUNAS" ? 52 : 22;
}

// ─── CORES E VEREDITO ────────────────────────────────────────────────────────

function resolverCor(pct) {
  if (pct >= 75)
    return { color: "#00e5a0", verdict: "Bem Preparado", badge: "bg-green" };
  if (pct >= 45)
    return {
      color: "#ffb800",
      verdict: "Parcialmente Preparado",
      badge: "bg-amber",
    };
  return {
    color: "#ff4d6a",
    verdict: "Requer Reestruturação",
    badge: "bg-red",
  };
}

// ─── LOADING / AGENTE STEPS ──────────────────────────────────────────────────

const STEPS_AGENTE = [
  {
    name: "Classificando perfil do usuário",
    detail: "Avaliando objetivo, nível declarado e tecnologias...",
    tool: null,
  },
  {
    name: "Executando ferramentas de análise",
    detail: "Chamando: avaliar_tecnologias, calcular_prontidao...",
    tool: "avaliar_tecnologias · calcular_prontidao",
  },
  {
    name: "Detectando lacunas de conhecimento",
    detail: "Cruzando stack com requisitos do projeto...",
    tool: "detectar_lacunas · estimar_esforco",
  },
  {
    name: "Gerando plano de ação personalizado",
    detail: "Sintetizando resultado e próximos passos...",
    tool: null,
  },
];

function mostrarLoading() {
  const outputArea = document.getElementById("outputArea");
  outputArea.innerHTML = "";

  const box = document.createElement("div");
  box.className = "loading-screen fade-in";
  box.id = "loadingBox";

  box.innerHTML = `
    <div class="loading-header">
      <div class="loading-spinner"></div>
      <span class="loading-title">// agente raciocínando</span>
    </div>
    <div class="agent-steps" id="agentSteps"></div>
  `;

  outputArea.appendChild(box);
  currentLoadingBox = box;

  const stepsEl = box.querySelector("#agentSteps");
  STEPS_AGENTE.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "agent-step st-wait";
    div.id = `ast-${i}`;
    div.innerHTML = `
      <div class="step-num">${String(i + 1).padStart(2, "0")}</div>
      <div class="step-content">
        <div class="step-name">${s.name}</div>
        <div class="step-detail">${s.detail}</div>
        ${s.tool ? `<div class="tool-call">${s.tool}</div>` : ""}
      </div>
      <div class="step-badge">${i === 0 ? "próximo" : "aguardando"}</div>
    `;
    stepsEl.appendChild(div);
  });

  // Animação progressiva dos steps
  ativarStep(0);
}

function ativarStep(i) {
  if (i > 0) finalizarStep(i - 1);

  const el = document.getElementById(`ast-${i}`);
  if (!el) return;

  el.className = "agent-step st-active";
  el.querySelector(".step-badge").textContent = "processando";

  const detail = el.querySelector(".step-detail");
  detail.innerHTML += `
    <div class="thinking-lines">
      <div class="t-line"></div>
      <div class="t-line"></div>
      <div class="t-line"></div>
    </div>
  `;

  if (i < STEPS_AGENTE.length - 1) {
    const t = setTimeout(() => ativarStep(i + 1), 2200 + i * 300);
    stepTimers.push(t);
  }
}

function finalizarStep(i) {
  const el = document.getElementById(`ast-${i}`);
  if (!el) return;
  el.className = "agent-step st-done";
  el.querySelector(".step-badge").textContent = "✓ concluído";
  const lines = el.querySelector(".thinking-lines");
  if (lines) lines.remove();
}

function removerLoading() {
  limparTimers();
  // Finaliza todos os steps visualmente
  STEPS_AGENTE.forEach((_, i) => finalizarStep(i));

  const t = setTimeout(() => {
    const box = document.getElementById("loadingBox");
    if (box) box.remove();
  }, 400);
  stepTimers.push(t);
}

// ─── RENDERIZAÇÃO DO RESULTADO ───────────────────────────────────────────────

function adicionarResposta(rawData) {
  const d = parsearRespostaAgente(rawData);
  const cor = resolverCor(d.prontidao);
  const outputArea = document.getElementById("outputArea");

  const radius = 40;
  const circ = 2 * Math.PI * radius;

  // Monta HTML das seções
  const secoes = [
    {
      key: "diagnostico",
      title: "Diagnóstico",
      color: cor.color,
      open: true,
      tag: "classificação",
    },
    {
      key: "analise",
      title: "Análise Detalhada",
      color: "#a78bfa",
      open: true,
      tag: "lacunas",
    },
    {
      key: "plano",
      title: "Plano de Ação",
      color: "#00d4ff",
      open: true,
      tag: "próximos passos",
    },
  ];

  let secoesHTML = "";
  secoes.forEach((s) => {
    const conteudo = d[s.key];
    if (!conteudo) return;
    const paragrafos = conteudo
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
    secoesHTML += `
      <div class="section-block">
        <div class="section-head open" onclick="toggleSecao(this)">
          <div class="section-indicator" style="background:${s.color}"></div>
          <div class="section-head-title">${s.title}</div>
          <div class="section-head-tag">${s.tag}</div>
          <div class="section-chevron">▼</div>
        </div>
        <div class="section-body open">${paragrafos || conteudo}</div>
      </div>
    `;
  });

  // Ferramentas usadas
  const ferramentasHTML =
    d.ferramentasUsadas.length > 0
      ? `
    <div class="tools-used">
      <span class="tools-label">ferramentas chamadas:</span>
      ${d.ferramentasUsadas.map((f) => `<span class="tool-badge">${f}</span>`).join("")}
    </div>
  `
      : "";

  const wrap = document.createElement("div");
  wrap.className = "result-wrap fade-in";
  wrap.innerHTML = `
    <div class="result-header">
      <span class="result-tag">Análise concluída</span>
      <span class="agent-trace">${d.iteracoes} iteração${d.iteracoes !== 1 ? "ões" : ""} · agente autônomo</span>
    </div>

    <div class="score-card">
      <div class="gauge-wrap">
        <svg viewBox="0 0 90 90">
          <circle class="gauge-bg" cx="45" cy="45" r="${radius}" />
          <circle class="gauge-fill" id="gaugeFill" cx="45" cy="45" r="${radius}"
            stroke="${cor.color}" stroke-dasharray="${circ}" stroke-dashoffset="${circ}" />
        </svg>
        <div class="gauge-center">
          <span class="gauge-pct" id="gaugePct" style="color:${cor.color}">0%</span>
          <span class="gauge-lbl">pronto</span>
        </div>
      </div>
      <div class="score-info">
        <div class="score-label">// INDICADOR DE PRONTIDÃO</div>
        <div class="score-verdict" style="color:${cor.color}">${cor.verdict}</div>
        <div class="score-desc">
          Classificação: <strong style="color:${cor.color}">${d.classificacao}</strong>.
          Estimativa calculada com base no objetivo e nas tecnologias fornecidas.
        </div>
        <div class="score-bar-track">
          <div class="score-bar-fill" id="scoreBar" style="background:${cor.color}"></div>
        </div>
      </div>
    </div>

    ${ferramentasHTML}
    ${secoesHTML}

    <div class="result-actions">
      <button class="btn-new" onclick="novaConsulta()">↺ Nova Consulta</button>
      <span class="iterations-info">Agente executou ${d.iteracoes} ciclo${d.iteracoes !== 1 ? "s" : ""} de raciocínio</span>
    </div>
  `;

  outputArea.appendChild(wrap);

  // Anima gauge
  setTimeout(() => {
    const fill = document.getElementById("gaugeFill");
    const bar = document.getElementById("scoreBar");
    const pctEl = document.getElementById("gaugePct");

    if (fill) fill.style.strokeDashoffset = circ - (d.prontidao / 100) * circ;
    if (bar) bar.style.width = d.prontidao + "%";

    let val = 0;
    const step = Math.max(1, Math.floor(d.prontidao / 60));
    const interval = setInterval(() => {
      val = Math.min(val + step, d.prontidao);
      if (pctEl) pctEl.textContent = val + "%";
      if (val >= d.prontidao) clearInterval(interval);
    }, 18);
  }, 150);
}

function toggleSecao(headEl) {
  headEl.classList.toggle("open");
  const body = headEl.nextElementSibling;
  if (body) body.classList.toggle("open");
}

function adicionarErro(msg) {
  const outputArea = document.getElementById("outputArea");
  const div = document.createElement("div");
  div.className = "error-block fade-in";
  div.innerHTML = `<strong>// Erro do agente:</strong><br>${msg}<br><br>Verifique se o backend está rodando em <code>localhost:8080</code>.`;
  outputArea.appendChild(div);
}

// ─── FLUXO PRINCIPAL ─────────────────────────────────────────────────────────

async function gerarAnalise() {
  const objetivo = document.getElementById("objetivo").value.trim();
  const nivel = document.getElementById("nivel").value;
  const tempo = document.getElementById("tempo").value;
  const tecnologias = document.getElementById("tecnologias").value.trim();

  if (!objetivo || !tecnologias) {
    // Highlight campos vazios
    if (!objetivo)
      document.getElementById("objetivo").style.borderColor =
        "rgba(255,77,106,0.6)";
    if (!tecnologias)
      document.getElementById("tecnologias").style.borderColor =
        "rgba(255,77,106,0.6)";
    setTimeout(() => {
      document.getElementById("objetivo").style.borderColor = "";
      document.getElementById("tecnologias").style.borderColor = "";
    }, 2000);
    return;
  }

  const botao = document.getElementById("botaoGerar");
  botao.disabled = true;

  // Esconde welcome, mostra loading
  document.getElementById("welcomeScreen").style.display = "none";
  mostrarLoading();

  try {
    const payload = {
      objetivo,
      nivel,
      tempoDisponivel: tempo,
      tecnologias,
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `HTTP ${response.status}: ${errText || "Erro no servidor"}`,
      );
    }

    const data = await response.text();
    removerLoading();

    // Pequena pausa para a animação de remoção do loading
    setTimeout(() => adicionarResposta(data), 500);
  } catch (error) {
    removerLoading();
    setTimeout(() => adicionarErro(error.message), 500);
  } finally {
    botao.disabled = false;
  }
}

function novaConsulta() {
  document.getElementById("outputArea").innerHTML = "";
  document.getElementById("welcomeScreen").style.display = "";
  document.getElementById("objetivo").value = "";
  document.getElementById("tecnologias").value = "";
  document.getElementById("botaoGerar").disabled = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
