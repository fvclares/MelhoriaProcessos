import { operationalAnalytics } from "./api.js";
import { renderTenantSelector } from "./tenant.js";

const loginForm = document.querySelector("#login-form");
const dashboard = document.querySelector("#dashboard");
const status = document.querySelector("#analytics-status");
const tenantContainer = document.querySelector("#tenant-selector");
let accessToken = sessionStorage.getItem("dictionary-admin-token");

async function refreshTenant() {
  if (tenantContainer && accessToken) await renderTenantSelector(tenantContainer, accessToken, () => load());
}

function setStatus(message, error = false) { status.textContent = message; status.className = error ? "status error" : "status"; }
function config() { return window.APP_CONFIG; }
function bars(container, rows, label) {
  container.replaceChildren(); const max = Math.max(...rows.map((row) => Number(row.occurrences)), 1);
  if (!rows.length) { container.textContent = "Ainda não há dados suficientes."; return; }
  rows.slice(0, 10).forEach((row) => {
    const item = document.createElement("div"); item.className = "bar-item";
    const text = document.createElement("span"); text.textContent = label(row); const value = document.createElement("strong"); value.textContent = String(row.occurrences);
    const rail = document.createElement("div"); rail.className = "bar-rail"; const fill = document.createElement("div"); fill.className = "bar-fill"; fill.style.width = `${(Number(row.occurrences) / max) * 100}%`; rail.append(fill);
    item.append(text, value, rail); container.append(item);
  });
}
function metric(label, value) { const card = document.createElement("article"); card.className = "metric"; const title = document.createElement("span"); title.textContent = label; const number = document.createElement("strong"); number.textContent = String(value); card.append(title, number); return card; }
function render(data) {
  const metrics = document.querySelector("#metrics"); metrics.replaceChildren(metric("Percepções validadas", data.total_validated_perceptions), metric("Combinações recorrentes", data.recurring_combinations));
  bars(document.querySelector("#recurrences"), data.top_recurrences.filter((row) => row.occurrences > 1), (row) => [row.sistema, row.processo, row.subprocesso, row.categoria_problema].filter(Boolean).join(" › "));
  bars(document.querySelector("#systems"), data.by_system, (row) => row.name);
  bars(document.querySelector("#processes"), data.by_process, (row) => row.name);
  const daily = Object.entries(data.daily_evolution.reduce((acc, row) => { acc[row.occurrence_date] = (acc[row.occurrence_date] || 0) + Number(row.occurrences); return acc; }, {})).map(([name, occurrences]) => ({ name, occurrences }));
  bars(document.querySelector("#evolution"), daily, (row) => row.name);
  document.querySelector("#unit-coverage").textContent = data.unit_coverage.message;
}
async function load() { if (!accessToken) return; setStatus("Calculando indicadores…"); try { const data = await operationalAnalytics(accessToken); render(data); setStatus("Indicadores atualizados com dados validados."); } catch (error) { setStatus(error.message, true); } }
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const { supabaseUrl, supabaseAnonKey } = config();
  try { const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, { method: "POST", headers: { "Content-Type": "application/json", apikey: supabaseAnonKey }, body: JSON.stringify({ email: document.querySelector("#email").value, password: document.querySelector("#password").value }) }); const data = await response.json(); if (!response.ok || !data.access_token) throw new Error(data.error_description || "Não foi possível entrar."); accessToken = data.access_token; sessionStorage.setItem("dictionary-admin-token", accessToken); sessionStorage.setItem("auth-token", accessToken); loginForm.hidden = true; dashboard.hidden = false; await refreshTenant(); await load(); } catch (error) { window.alert(error.message); }
});
document.querySelector("#refresh").addEventListener("click", load);
document.querySelector("#logout").addEventListener("click", () => { sessionStorage.removeItem("dictionary-admin-token"); accessToken = null; dashboard.hidden = true; loginForm.hidden = false; });
if (accessToken) { loginForm.hidden = true; dashboard.hidden = false; refreshTenant(); load(); }
