/**
 * Integração do catálogo público com Google Sheets + Apps Script.
 * Cole a URL /exec do seu Web App abaixo.
 */
const FM_CATALOGO = {
  WEB_APP_URL: "COLE_AQUI_A_URL_DO_APPS_SCRIPT_TERMINADA_EM_/exec"
};

function carregarCatalogoGoogleSheets() {
  const url = String(FM_CATALOGO.WEB_APP_URL || "").trim();
  if (!url || url.includes("COLE_AQUI")) {
    console.info("Catálogo Google Sheets ainda não configurado.");
    return;
  }

  const callbackName = "__fmCatalogoCallback_" + Date.now();
  const tag = document.createElement("script");

  window[callbackName] = (payload) => {
    try {
      if (!payload || !payload.success) throw new Error(payload?.message || "Falha ao carregar catálogo.");
      renderizarMaquinasPublicas(payload.maquinas || []);
      renderizarFiltrosPublicos(payload.categorias || []);
    } catch (err) {
      console.error("Catálogo:", err);
    } finally {
      delete window[callbackName];
      tag.remove();
    }
  };

  tag.src = `${url}?api=1&action=maquinas&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
  tag.onerror = () => {
    console.error("Não foi possível acessar o catálogo.");
    delete window[callbackName];
    tag.remove();
  };

  document.head.appendChild(tag);
}

function renderizarMaquinasPublicas(maquinas) {
  const grid = document.getElementById("machinesGrid");
  const emptyState = document.getElementById("emptyState");
  if (!grid) return;

  if (!maquinas.length) {
    grid.innerHTML = "";
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;

  grid.innerHTML = maquinas.map((machine) => {
    const categoriaSlug = slugCatalogo(machine.categoria || "outros");
    const search = [machine.titulo, machine.marca, machine.modelo, machine.categoria, machine.condicao, machine.localizacao].filter(Boolean).join(" ");

    const image = machine.fotoCapaUrl
      ? `<img src="${escapeCatalogo(machine.fotoCapaUrl)}" alt="${escapeCatalogo(machine.titulo)}" loading="lazy">`
      : `<div class="machine-placeholder"><span>FM</span><strong>${escapeCatalogo(machine.marca || "Máquina Gráfica")}</strong></div>`;

    const price = machine.mostrarPreco && machine.preco
      ? `<strong class="machine-price">${escapeCatalogo(machine.preco)}</strong>`
      : "";

    return `
      <article class="machine-card reveal visible" data-category="${escapeCatalogo(categoriaSlug)}" data-search="${escapeCatalogo(search)}" data-machine-id="${escapeCatalogo(machine.id)}">
        <div class="machine-media">
          ${image}
          <span class="machine-tag">${escapeCatalogo(machine.categoria)}</span>
        </div>
        <div class="machine-body">
          <div class="machine-meta">
            <span>${escapeCatalogo(machine.condicao || "Sob consulta")}</span>
            <span>${escapeCatalogo(machine.disponibilidade || "Sob consulta")}</span>
          </div>
          <h3>${escapeCatalogo(machine.titulo)}</h3>
          <p>${escapeCatalogo(machine.descricaoCurta || [machine.marca, machine.modelo, machine.ano].filter(Boolean).join(" • "))}</p>
          ${price}
          <a href="#contato" class="machine-link">Consultar equipamento <span>↗</span></a>
        </div>
      </article>`;
  }).join("");

  if (typeof machineCards !== "undefined") {
    try { machineCards = [...document.querySelectorAll(".machine-card")]; } catch (_) {}
  }
}

function renderizarFiltrosPublicos(categorias) {
  const root = document.getElementById("filterChips");
  if (!root || !categorias.length) return;

  root.innerHTML = `<button class="filter-chip active" data-filter="todos" type="button">Todas</button>` +
    categorias.map((category) => `
      <button class="filter-chip" data-filter="${escapeCatalogo(category.slug)}" type="button">
        ${escapeCatalogo(category.nome)}
      </button>`).join("");

  [...root.querySelectorAll(".filter-chip")].forEach((chip) => {
    chip.addEventListener("click", () => {
      const filter = chip.dataset.filter;
      [...root.querySelectorAll(".filter-chip")].forEach((item) => item.classList.toggle("active", item === chip));
      document.querySelectorAll(".machine-card").forEach((card) => {
        card.classList.toggle("is-hidden", !(filter === "todos" || card.dataset.category === filter));
      });
    });
  });
}

function slugCatalogo(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeCatalogo(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

carregarCatalogoGoogleSheets();
