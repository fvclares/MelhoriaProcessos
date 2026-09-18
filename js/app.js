import { analyzePerception } from "./api.js";

const form = document.querySelector("#perception-form");
const input = document.querySelector("#perception");
const button = document.querySelector("#submit-button");
const count = document.querySelector("#character-count");
const status = document.querySelector("#status");
const result = document.querySelector("#result");

input.addEventListener("input", () => {
  count.textContent = `${input.value.length} / 2000`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  button.disabled = true;
  result.hidden = true;
  status.className = "status";
  status.textContent = "Interpretando a percepção…";

  try {
    const data = await analyzePerception(message);
    status.textContent = data.clarification_required
      ? `A IA precisa de um esclarecimento: ${data.clarification_question}`
      : `Interpretação recebida em ${data.latency_ms} ms. Revise os dados antes de qualquer registro.`;
    result.textContent = JSON.stringify(data, null, 2);
    result.hidden = false;
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
