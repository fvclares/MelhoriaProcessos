import { analyzeConversation, recordPerception } from "./api.js";
import { hasSession, signIn, signOut } from "./auth.js";

const loginForm = document.querySelector("#login-form");
const sessionInfo = document.querySelector("#session-info");
const sessionStatus = document.querySelector("#session-status");
const logoutBtn = document.querySelector("#logout");
const conversation = document.querySelector("#conversation");
const form = document.querySelector("#perception-form");
const input = document.querySelector("#perception");
const button = document.querySelector("#submit-button");
const count = document.querySelector("#character-count");
const status = document.querySelector("#status");
const types = ["reclamacao", "sugestao", "duvida", "elogio", "outro"];
const categories = ["erro", "lentidao", "acesso", "usabilidade", "integracao", "processo", "informacao", "outro"];
const labels = { tipo: "Tipo", processo: "Processo", subprocesso: "Subprocesso", sistema: "Sistema", categoria_problema: "Natureza da situação" };
const humanLabels = { reclamacao: "Reclamação", sugestao: "Sugestão", duvida: "Dúvida", elogio: "Elogio", outro: "Outro", erro: "Erro", lentidao: "Lentidão", acesso: "Acesso", usabilidade: "Usabilidade", integracao: "Integração", processo: "Processo", informacao: "Informação" };
let authenticated = hasSession();
let history = [];

function setStatus(message, isError = false) {
  status.textContent = message;
  status.className = isError ? "status chat-status error" : "status chat-status";
}
function setSessionUI() {
  loginForm.hidden = authenticated;
  sessionInfo.hidden = !authenticated;
  conversation.hidden = !authenticated;
  form.hidden = !authenticated;
  sessionStatus.textContent = authenticated ? "Você está conectado." : "";
  if (authenticated) setStatus("Escreva como falaria com uma pessoa da equipe.");
}
function addMessage(author, text, extraClass = "") {
  const message = document.createElement("article");
  message.className = `chat-message ${author} ${extraClass}`.trim();
  const speaker = document.createElement("p"); speaker.className = "chat-speaker"; speaker.textContent = author === "user" ? "Você" : "Assistente";
  const bubble = document.createElement("p"); bubble.className = "chat-bubble"; bubble.textContent = text;
  message.append(speaker, bubble); conversation.append(message);
  message.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return message;
}
function readable(value) { return value ? (humanLabels[value] || value) : "Não informado"; }
function option(value, label, selected) {
  const item = document.createElement("option"); item.value = value; item.textContent = label; item.selected = selected; return item;
}
function fieldControl(name, value) {
  const choices = name === "tipo" ? types : name === "categoria_problema" ? categories : null;
  if (choices) {
    const select = document.createElement("select"); select.name = name; select.required = true;
    select.append(option("", "Selecione…", !value)); choices.forEach((item) => select.append(option(item, readable(item), item === value)));
    return select;
  }
  const control = document.createElement("input"); control.name = name; control.type = "text"; control.maxLength = 160; control.value = value ?? ""; return control;
}
function register(data, values, card) {
  const actions = card.querySelector(".chat-actions");
  card.querySelectorAll("button").forEach((item) => { item.disabled = true; });
  setStatus("Registrando o que você confirmou…");
  ["processo", "subprocesso", "sistema"].forEach((name) => { values[name] = typeof values[name] === "string" ? values[name].trim() || null : null; });
  recordPerception(data.analysis_id, values).then(() => {
    addMessage("assistant", "Pronto. Registrei sua percepção para apoiar a melhoria do processo.");
    history = []; setStatus("Você pode compartilhar outra situação quando quiser."); input.focus();
  }).catch((error) => {
    setStatus(error.message, true);
    card.querySelectorAll("button").forEach((item) => { item.disabled = false; });
  });
}
function renderInterpretation(data) {
  const card = document.createElement("article"); card.className = "chat-review";
  const title = document.createElement("p"); title.className = "review-question"; title.textContent = "Confira o resumo antes de registrar.";
  const summary = document.createElement("p"); summary.className = "review-summary"; summary.textContent = data.summary;
  const facts = document.createElement("dl"); facts.className = "interpretation-facts";
  Object.entries(labels).forEach(([name, label]) => {
    const term = document.createElement("dt"); term.textContent = label;
    const value = document.createElement("dd"); value.textContent = readable(data.draft[name]?.value);
    facts.append(term, value);
  });
  const actions = document.createElement("div"); actions.className = "chat-actions";
  const confirm = document.createElement("button"); confirm.type = "button"; confirm.textContent = "Sim, pode registrar";
  const adjust = document.createElement("button"); adjust.type = "button"; adjust.className = "secondary"; adjust.textContent = "Ajustar informações";
  actions.append(confirm, adjust); card.append(title, summary, facts, actions); conversation.append(card);
  const values = Object.fromEntries(Object.keys(labels).map((name) => [name, data.draft[name]?.value ?? (name === "tipo" || name === "categoria_problema" ? "" : null)]));
  confirm.addEventListener("click", () => register(data, { ...values }, card));
  adjust.addEventListener("click", () => {
    if (card.querySelector("form")) return;
    const editor = document.createElement("form"); editor.className = "conversation-editor";
    const hint = document.createElement("p"); hint.textContent = "Altere apenas o que não representa bem a situação."; editor.append(hint);
    Object.entries(labels).forEach(([name, label]) => {
      const field = document.createElement("label"); field.textContent = label; field.append(fieldControl(name, values[name])); editor.append(field);
    });
    const save = document.createElement("button"); save.type = "submit"; save.textContent = "Confirmar ajustes"; editor.append(save);
    editor.addEventListener("submit", (event) => { event.preventDefault(); register(data, Object.fromEntries(new FormData(editor)), card); });
    actions.hidden = true; card.append(editor);
  });
  if (!values.tipo || !values.categoria_problema) {
    title.textContent = "Preciso completar dois detalhes antes de registrar.";
    confirm.hidden = true; adjust.textContent = "Completar informações"; adjust.click();
  }
  card.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

setSessionUI();
input.addEventListener("input", () => { count.textContent = `${input.value.length} / 2000`; });
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try { await signIn(document.querySelector("#email").value, document.querySelector("#password").value); authenticated = true; setSessionUI(); input.focus(); }
  catch (error) { window.alert(error.message); }
});
logoutBtn.addEventListener("click", () => { signOut(); authenticated = false; setSessionUI(); });
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim(); if (!message) return;
  button.disabled = true; input.disabled = true; addMessage("user", message); input.value = ""; count.textContent = "0 / 2000"; setStatus("Estou organizando o que você contou…");
  try {
    const userChars = history.filter((item) => item.role === "user").reduce((total, item) => total + item.text.length, 0) + message.length;
    if (userChars > 2000) throw new Error("Esta conversa já reuniu muitos detalhes. Registre ou inicie uma nova situação.");
    history.push({ role: "user", text: message });
    const data = await analyzeConversation(history);
    addMessage("assistant", data.assistant_message, data.ready_for_validation ? "validation-message" : "clarification-message");
    history.push({ role: "assistant", text: data.assistant_message });
    if (data.ready_for_validation) { renderInterpretation(data); setStatus("Confira o resumo antes de registrar."); }
    else setStatus("Responda à pergunta do assistente para continuar.");
  } catch (error) { addMessage("assistant", "Não consegui interpretar essa mensagem agora. Você pode tentar novamente?", "error-message"); setStatus(error.message, true); }
  finally { button.disabled = false; input.disabled = false; input.focus(); }
});
