import { tenantContext } from "./api.js";

export async function renderTenantSelector(container, accessToken, onChange) {
  if (!container || !accessToken) return;
  container.replaceChildren();
  const label = document.createElement("label");
  label.textContent = "Empresa ativa";
  const select = document.createElement("select");
  select.id = "tenant-select";
  const status = document.createElement("span");
  status.className = "status";
  status.textContent = "Carregando empresas...";
  label.append(select);
  container.append(label, status);
  try {
    const data = await tenantContext(accessToken, { operation: "list" });
    // tenant-context returns {companies, active_company_id} - adapt to both formats
    const companies = data.companies ?? [];
    const activeId = data.active_company_id ?? null;
    select.replaceChildren();
    if (!companies.length) {
      status.textContent = "Nenhuma empresa encontrada.";
      return;
    }
    companies.forEach((c) => {
      const opt = document.createElement("option");
      // tenant-context returns companies as {company_id, role, companies(name)} - handle both
      const id = c.company_id ?? c.id ?? c.company_id;
      const name = c.companies?.name ?? c.name ?? id;
      const role = c.role ? ` (${c.role})` : "";
      opt.value = id;
      opt.textContent = name + role;
      opt.selected = id === activeId;
      select.append(opt);
    });
    if (!activeId && companies.length > 1) {
      status.textContent = "Selecione uma empresa para continuar. A escolha será usada em todas as operações.";
    } else if (activeId) {
      status.textContent = "Empresa ativa: " + (select.options[select.selectedIndex]?.textContent ?? "");
    } else {
      status.textContent = "Empresa única resolvida automaticamente.";
    }
    select.addEventListener("change", async () => {
      const newId = select.value;
      status.textContent = "Alterando empresa...";
      try {
        await tenantContext(accessToken, { operation: "set", company_id: newId });
        status.textContent = "Empresa ativa alterada para: " + select.options[select.selectedIndex].textContent;
        if (onChange) onChange(newId);
      } catch (e) {
        status.textContent = e.message;
        status.className = "status error";
      }
    });
  } catch (e) {
    status.textContent = e.message;
    status.className = "status error";
  }
}
