import { dictionaryAdmin } from "./api.js";

const loginForm = document.querySelector("#login-form");
const dictionary = document.querySelector("#dictionary");
const status = document.querySelector("#admin-status");
const list = document.querySelector("#entity-list");
const evidence = document.querySelector("#evidence");
let accessToken = sessionStorage.getItem("dictionary-admin-token");
let entities = [];

function config() { return window.APP_CONFIG; }
function setStatus(message, isError = false) { status.textContent = message; status.className = isError ? "status error" : "status"; }
function button(label, action, entity) { const item = document.createElement("button"); item.type = "button"; item.className = "compact"; item.textContent = label; item.dataset.action = action; item.dataset.entity = entity.id; return item; }

async function load() {
  if (!accessToken) return;
  setStatus("Carregando conceitos…");
  try {
    const data = await dictionaryAdmin("list", accessToken); entities = data.entities || []; list.replaceChildren();
    entities.forEach((entity) => {
      const row = document.createElement("tr");
      [entity.canonical_name, entity.entity_type, entity.governance_status, String(entity.evidence_count)].forEach((value) => { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); });
      const actions = document.createElement("td"); actions.className = "row-actions"; actions.append(button("Origem", "detail", entity));
      if (entity.governance_status === "candidate") { actions.append(button("Homologar", "homologate", entity), button("Rejeitar", "reject", entity)); }
      if (entity.governance_status !== "consolidated" && entity.governance_status !== "rejected") actions.append(button("Sinônimo", "alias", entity), button("Consolidar", "consolidate", entity));
      row.append(actions); list.append(row);
    });
    setStatus(`${entities.length} conceitos disponíveis para revisão.`);
  } catch (error) { setStatus(error.message, true); }
}
async function action(event) {
  const target = event.target.closest("button[data-action]"); if (!target) return;
  const entity = entities.find((item) => item.id === target.dataset.entity); if (!entity) return;
  let operation = target.dataset.action; const details = { entity_id: entity.id };
  if (operation === "detail") {
    try {
      const data = await dictionaryAdmin("detail", accessToken, details); evidence.hidden = false; evidence.replaceChildren();
      const title = document.createElement("h2"); title.textContent = `Origem: ${data.entity.canonical_name}`; evidence.append(title);
      const aliases = document.createElement("p"); aliases.textContent = `Sinônimos: ${(data.aliases || []).map((item) => item.alias).join(", ") || "nenhum"}`; evidence.append(aliases);
      (data.evidence || []).forEach((item) => { const itemEl = document.createElement("p"); itemEl.textContent = `${item.evidence_state}: ${item.perceptions?.original_text || item.extracted_value}`; evidence.append(itemEl); });
    } catch (error) { setStatus(error.message, true); }
    return;
  }
  if (operation === "alias") { const alias = window.prompt(`Sinônimo para ${entity.canonical_name}:`); if (!alias) return; details.alias = alias; operation = "add_alias"; }
  if (operation === "consolidate") {
    const choices = entities.filter((item) => item.id !== entity.id && item.entity_type === entity.entity_type && item.governance_status !== "consolidated");
    const name = window.prompt(`Consolidar em qual conceito? ${choices.map((item) => item.canonical_name).join(", ")}`); const targetEntity = choices.find((item) => item.canonical_name.toLowerCase() === name?.trim().toLowerCase());
    if (!targetEntity) { setStatus("Selecione um conceito do mesmo tipo pelo nome exato.", true); return; } details.target_entity_id = targetEntity.id;
  }
  try { await dictionaryAdmin(operation, accessToken, details); evidence.hidden = true; await load(); } catch (error) { setStatus(error.message, true); }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const { supabaseUrl, supabaseAnonKey } = config();
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, { method: "POST", headers: { "Content-Type": "application/json", apikey: supabaseAnonKey }, body: JSON.stringify({ email: document.querySelector("#email").value, password: document.querySelector("#password").value }) });
    const data = await response.json(); if (!response.ok || !data.access_token) throw new Error(data.error_description || "Não foi possível entrar.");
    accessToken = data.access_token; sessionStorage.setItem("dictionary-admin-token", accessToken); loginForm.hidden = true; dictionary.hidden = false; await load();
  } catch (error) { window.alert(error.message); }
});
document.querySelector("#refresh").addEventListener("click", load);
document.querySelector("#logout").addEventListener("click", () => { sessionStorage.removeItem("dictionary-admin-token"); accessToken = null; dictionary.hidden = true; loginForm.hidden = false; evidence.hidden = true; });
list.addEventListener("click", action);
if (accessToken) { loginForm.hidden = true; dictionary.hidden = false; load(); }
