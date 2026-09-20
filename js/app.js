import { analyzePerception, recordPerception } from "./api.js";
import { hasSession, signIn, signOut } from "./auth.js";

const loginForm = document.querySelector("#login-form");
const sessionInfo = document.querySelector("#session-info");
const sessionStatus = document.querySelector("#session-status");
const logoutBtn = document.querySelector("#logout");
const form = document.querySelector("#perception-form");
const input = document.querySelector("#perception");
const button = document.querySelector("#submit-button");
const count = document.querySelector("#character-count");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const review = document.querySelector("#review");
const types = ["reclamacao", "sugestao", "duvida", "elogio", "outro"];
const categories = ["erro", "lentidao", "acesso", "usabilidade", "integracao", "processo", "informacao", "outro"];
const labels = { tipo: "Tipo", processo: "Processo", subprocesso: "Subprocesso", sistema: "Sistema", categoria_problema: "Categoria do problema" };
let accessToken = hasSession();

async function setSessionUI() {
  const logged = !!accessToken;
  loginForm.hidden = logged;
  sessionInfo.hidden = !logged;
  form.hidden = !logged;
  if (logged) {
    sessionStatus.textContent = "Sessão ativa.";
  }
}
setSessionUI();
input.addEventListener("input", () => { count.textContent = `${input.value.length} / 2000`; });
loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await signIn(document.querySelector("#email").value, document.querySelector("#password").value);
    accessToken = true;
    setSessionUI();
  } catch (error) {
    window.alert(error.message);
  }
});
logoutBtn?.addEventListener("click", () => {
  signOut(); accessToken = false;
  setSessionUI();
});

function option(value, label, selected) {
  const item = document.createElement("option"); item.value = value; item.textContent = label; item.selected = selected; return item;
}
function fieldControl(name, value) {
  const values = name === "tipo" ? types : name === "categoria_problema" ? categories : null;
  if (values) {
    const select = document.createElement("select"); select.name = name; select.required = true;
    select.append(option("", "Selecione…", !value)); values.forEach((item) => select.append(option(item, item, item === value)));
    return select;
  }
  const control = document.createElement("input"); control.name = name; control.type = "text"; control.maxLength = 160; control.value = value ?? ""; return control;
}
function renderReview(data) {
  review.hidden = false; review.replaceChildren();
  const title = document.createElement("h2"); title.textContent = "Revise antes de registrar"; review.append(title);
  const interpretation = document.createElement("p"); interpretation.textContent = data.interpretation; review.append(interpretation);
  if (data.clarification_required) { const note = document.createElement("p"); note.className = "clarification"; note.textContent = data.clarification_question; review.append(note); }
  const reviewForm = document.createElement("form"); reviewForm.className = "review-form";
  Object.keys(labels).forEach((name) => {
    const label = document.createElement("label"); label.htmlFor = `review-${name}`; label.textContent = labels[name];
    const control = fieldControl(name, data.fields[name]?.value); control.id = `review-${name}`; label.append(control); reviewForm.append(label);
  });
  const confirm = document.createElement("button"); confirm.type = "submit"; confirm.textContent = "Confirmar e registrar"; reviewForm.append(confirm);
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault(); confirm.disabled = true; status.className = "status"; status.textContent = "Registrando a percepção validada…";
    const values = Object.fromEntries(new FormData(reviewForm));
    ["processo", "subprocesso", "sistema"].forEach((name) => { values[name] = values[name].trim() || null; });
    try {
      const saved = await recordPerception(data.analysis_id, values);
      status.textContent = `Percepção registrada com sucesso. Identificador: ${saved.perception_id}`;
      review.hidden = true; input.value = ""; count.textContent = "0 / 2000";
    } catch (error) { status.className = "status error"; status.textContent = error.message; confirm.disabled = false; }
  });
  review.append(reviewForm);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault(); if (!accessToken) { status.className = "status error"; status.textContent = "Faça login para enviar percepções."; return; } const message = input.value.trim(); if (!message) return;
  button.disabled = true; result.hidden = true; review.hidden = true; status.className = "status"; status.textContent = "Interpretando a percepção…";
  try {
    const data = await analyzePerception(message);
    if (!data.single_issue) status.textContent = data.clarification_question || "Descreva apenas um problema por vez para continuar.";
    else {
      status.textContent = data.clarification_required ? `Complete ou corrija os campos abaixo. ${data.clarification_question}` : `Interpretação recebida em ${data.latency_ms} ms. Revise antes de registrar.`;
      renderReview(data);
    }
    result.textContent = JSON.stringify(data, null, 2); result.hidden = false;
  } catch (error) { status.className = "status error"; status.textContent = error.message; }
  finally { button.disabled = false; }
});
