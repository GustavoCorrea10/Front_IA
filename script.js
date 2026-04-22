const chatInner = document.getElementById("chatInner");
const boasVindas = document.getElementById("boasVindas");

function formatarResposta(texto) {
  return texto
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#/g, "")
    .replace(/\n/g, "<br><br>")
    .trim();
}

/* ✔️ VERIFICA SE É TECNOLOGIA */
function ehTecnologia(texto) {
  const palavrasChave = [
    "java",
    "javascript",
    "js",
    "react",
    "spring",
    "html",
    "css",
    "typescript",
    "node",
    "backend",
    "frontend",
    "api",
    "sql",
    "programação",
    "software",
    "sistema",
    "código",
    "programar",
  ];

  const textoMinusculo = texto.toLowerCase();

  return palavrasChave.some((palavra) => textoMinusculo.includes(palavra));
}

function adicionarMensagem(texto) {
  boasVindas.style.display = "none";

  const wrapper = document.createElement("div");
  wrapper.classList.add("mensagem");

  const balao = document.createElement("div");
  balao.classList.add("mensagem-balao");

  balao.innerHTML = formatarResposta(texto);

  const botao = document.createElement("button");
  botao.textContent = "Nova Consulta";
  botao.classList.add("botao-nova-consulta");

  botao.onclick = limparChat;

  wrapper.appendChild(balao);
  wrapper.appendChild(botao);

  chatInner.appendChild(wrapper);
}

function limparChat() {
  chatInner.innerHTML = "";
  boasVindas.style.display = "block";

  document.getElementById("objetivo").value = "";
  document.getElementById("tecnologias").value = "";
}

function adicionarLoading() {
  const wrapper = document.createElement("div");
  wrapper.id = "loadingMsg";

  const loading = document.createElement("div");
  loading.classList.add("loading-balao");

  loading.innerHTML = "<span></span><span></span><span></span>";

  wrapper.appendChild(loading);

  chatInner.appendChild(wrapper);
}

function removerLoading() {
  const loading = document.getElementById("loadingMsg");

  if (loading) loading.remove();
}

async function gerarTecnologias() {
  const objetivo = document.getElementById("objetivo").value;
  const nivel = document.getElementById("nivel").value;
  const tecnologias = document.getElementById("tecnologias").value;

  if (!objetivo || !tecnologias) {
    alert("Preencha todos campos");
    return;
  }

  const pergunta = `
Objetivo:
${objetivo}

Nivel:
${nivel}

Tecnologias:
${tecnologias}
`;

  /* ✔️ VALIDAÇÃO DE TECNOLOGIA */
  if (!ehTecnologia(pergunta)) {
    adicionarMensagem(
      "Essa IA foi treinada apenas para responder perguntas sobre tecnologia. Por favor, refaça o formulário com um tema relacionado a programação ou desenvolvimento.",
    );
    return;
  }

  adicionarLoading();

  try {
    const response = await fetch("http://localhost:8080/educacao/explicar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pergunta),
    });

    const data = await response.text();

    removerLoading();
    adicionarMensagem(data);
  } catch (error) {
    removerLoading();
    adicionarMensagem("Erro ao conectar com IA");
  }
}
