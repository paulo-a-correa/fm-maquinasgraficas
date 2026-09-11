/**
 * Catálogo público — Google Sheets + Apps Script
 * Felipe Mariano Máquinas Gráficas
 */

const FM_CATALOGO = {
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbyme_nFsqIEZrXka7jEUj1JZrDUe3-_mfnILK41SJnSuvhd5ASoW6awbN9HLpXbK8c4hw/exec"
};

let fmMaquinasPublicas = [];

function carregarCatalogoGoogleSheets() {
  const url = String(FM_CATALOGO.WEB_APP_URL || "").trim();
  if (!url || url.includes("COLE_AQUI")) return;

  const callbackName = "__fmCatalogoCallback_" + Date.now();
  const tag = document.createElement("script");

  window[callbackName] = (payload) => {
    try {
      if (!payload || !payload.success) {
        throw new Error(payload?.message || "Falha ao carregar catálogo.");
      }

      fmMaquinasPublicas = Array.isArray(payload.maquinas) ? payload.maquinas : [];
      renderizarMaquinasPublicas(fmMaquinasPublicas);
      renderizarFiltrosPublicos(payload.categorias || []);
    } catch (err) {
      console.error("Catálogo:", err);

      const loading = document.getElementById("catalogLoading");
      const emptyState = document.getElementById("emptyState");

      if (loading) loading.hidden = true;

      if (emptyState) {
        emptyState.hidden = false;
        const title = emptyState.querySelector("strong");
        const text = emptyState.querySelector("p");

        if (title) title.textContent = "Não foi possível carregar os equipamentos.";
        if (text) text.textContent = "Atualize a página ou tente novamente em alguns instantes.";
      }
    } finally {
      delete window[callbackName];
      tag.remove();
    }
  };

  tag.src =
    `${url}?api=1&action=maquinas&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;

  tag.onerror = () => {
    console.error("Não foi possível acessar o catálogo.");

    const loading = document.getElementById("catalogLoading");
    const emptyState = document.getElementById("emptyState");

    if (loading) loading.hidden = true;

    if (emptyState) {
      emptyState.hidden = false;
      const title = emptyState.querySelector("strong");
      const text = emptyState.querySelector("p");

      if (title) title.textContent = "Não foi possível carregar os equipamentos.";
      if (text) text.textContent = "Atualize a página ou tente novamente em alguns instantes.";
    }

    delete window[callbackName];
    tag.remove();
  };

  document.head.appendChild(tag);
}

function extractDriveResourceKey(url) {
  try {
    const parsed = new URL(String(url || ""), window.location.href);
    return parsed.searchParams.get("resourcekey") || "";
  } catch (_) {
    const match = String(url || "").match(/[?&]resourcekey=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  }
}

function driveImageCandidates(fileId, fallbackUrl = "", width = 1600) {
  fileId = String(fileId || "").trim();
  fallbackUrl = String(fallbackUrl || "").trim();

  const urls = [];
  const push = (url) => {
    url = String(url || "").trim();
    if (url && !urls.includes(url)) urls.push(url);
  };

  // A URL gravada pelo Apps Script vem primeiro e pode conter resourcekey.
  push(fallbackUrl);

  if (!fileId && fallbackUrl) {
    const byId = fallbackUrl.match(/[?&]id=([^&]+)/i);
    const byD = fallbackUrl.match(/\/d\/([^/]+)/i);
    fileId = decodeURIComponent((byId && byId[1]) || (byD && byD[1]) || "");
  }

  if (!fileId) return urls;

  const resourceKey = extractDriveResourceKey(fallbackUrl);
  const rk = resourceKey
    ? `&resourcekey=${encodeURIComponent(resourceKey)}`
    : "";

  push(
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}` +
    `&sz=w${width}${rk}`
  );

  push(
    `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}${rk}`
  );

  // Último fallback para navegadores que tratam o endpoint do Drive de forma diferente.
  push(`https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w${width}`);

  return urls;
}

function loadDriveImage(img, fileId, fallbackUrl = "", width = 1600, onFail) {
  if (!img) return;

  const candidates = driveImageCandidates(fileId, fallbackUrl, width);
  let index = 0;

  img.referrerPolicy = "no-referrer";
  img.decoding = "async";

  const tryNext = () => {
    if (index >= candidates.length) {
      img.removeAttribute("src");
      img.classList.remove("is-loaded");
      if (typeof onFail === "function") onFail();
      return;
    }

    const url = candidates[index++];
    img.src = url;
  };

  img.addEventListener("load", () => {
    img.classList.add("is-loaded");
  });

  img.addEventListener("error", tryNext);

  tryNext();
}

function machinePlaceholder(machine) {
  return `
    <div class="machine-placeholder">
      <span>FM</span>
      <strong>${escapeCatalogo(machine.marca || "Máquina Gráfica")}</strong>
    </div>
  `;
}

function renderizarMaquinasPublicas(maquinas) {
  const grid = document.getElementById("machinesGrid");
  const emptyState = document.getElementById("emptyState");
  const loading = document.getElementById("catalogLoading");

  if (!grid) return;

  if (loading) loading.hidden = true;

  if (!maquinas.length) {
    grid.innerHTML = "";
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;

  grid.innerHTML = maquinas.map((machine) => {
    const categoriaSlug = slugCatalogo(machine.categoria || "outros");

    const search = [
      machine.titulo,
      machine.marca,
      machine.modelo,
      machine.categoria,
      machine.condicao,
      machine.localizacao,
      machine.ano
    ].filter(Boolean).join(" ");

    const hasPhoto =
      String(machine.fotoCapaId || "").trim() ||
      String(machine.fotoCapaUrl || "").trim();

    const image = hasPhoto
      ? `
        ${machinePlaceholder(machine)}
        <img
          class="machine-cover-image"
          data-drive-file-id="${escapeCatalogo(machine.fotoCapaId || "")}"
          data-drive-fallback-url="${escapeCatalogo(machine.fotoCapaUrl || "")}"
          alt="${escapeCatalogo(machine.titulo)}"
        >
      `
      : machinePlaceholder(machine);

    const price = machine.mostrarPreco && machine.preco
      ? `<strong class="machine-price">${escapeCatalogo(machine.preco)}</strong>`
      : "";

    return `
      <article
        class="machine-card reveal visible"
        data-category="${escapeCatalogo(categoriaSlug)}"
        data-search="${escapeCatalogo(search)}"
        data-machine-id="${escapeCatalogo(machine.id)}"
      >
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

          <p>
            ${escapeCatalogo(
              machine.descricaoCurta ||
              [machine.marca, machine.modelo, machine.ano].filter(Boolean).join(" • ")
            )}
          </p>

          ${price}

          <button
            type="button"
            class="machine-link machine-detail-trigger"
            data-machine-id="${escapeCatalogo(machine.id)}"
          >
            Consultar equipamento <span aria-hidden="true">↗</span>
          </button>
        </div>
      </article>
    `;
  }).join("");

  if (typeof machineCards !== "undefined") {
    machineCards = [...document.querySelectorAll(".machine-card")];
  }

  grid.querySelectorAll(".machine-cover-image").forEach((img) => {
    loadDriveImage(
      img,
      img.dataset.driveFileId,
      img.dataset.driveFallbackUrl,
      1200
    );
  });

  ligarBotoesDetalhes();

  if (typeof filterMachines === "function") {
    filterMachines();
  }
}

function ligarBotoesDetalhes() {
  document.querySelectorAll(".machine-detail-trigger").forEach((button) => {
    button.addEventListener("click", () => abrirFichaMaquina(button.dataset.machineId));
  });
}

function abrirFichaMaquina(machineId) {
  const machine = fmMaquinasPublicas.find(
    (item) => String(item.id) === String(machineId)
  );

  if (!machine) return;

  const modal = document.getElementById("machineDetailModal");
  if (!modal) return;

  document.getElementById("machineDetailTitle").textContent =
    machine.titulo || "Equipamento";

  document.getElementById("machineDetailCategory").textContent =
    machine.categoria || "Máquina gráfica";

  document.getElementById("machineDetailCondition").textContent =
    machine.condicao || "Sob consulta";

  document.getElementById("machineDetailDescription").textContent =
    machine.descricaoCompleta ||
    machine.descricaoCurta ||
    "Consulte nossa equipe para mais informações sobre este equipamento.";

  document.getElementById("machineDetailFacts").innerHTML =
    montarFatosMaquina(machine);

  renderizarEspecificacoes(machine);
  renderizarGaleriaMaquina(machine);
  renderizarPreco(machine);

  document.getElementById("machineDetailWhatsapp").onclick = () => {
    const message = montarMensagemWhatsAppMaquina(machine);

    if (typeof openWhatsApp === "function") {
      openWhatsApp(message);
    } else {
      window.location.href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    }
  };

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("machine-detail-open");
}

function montarFatosMaquina(machine) {
  const facts = [
    ["Marca", machine.marca],
    ["Modelo", machine.modelo],
    ["Ano", machine.ano],
    ["Localização", machine.localizacao],
    ["Disponibilidade", machine.disponibilidade]
  ].filter(([, value]) => String(value || "").trim());

  return facts.map(([label, value]) => `
    <div class="machine-detail-fact">
      <span>${escapeCatalogo(label)}</span>
      <strong>${escapeCatalogo(value)}</strong>
    </div>
  `).join("");
}

function renderizarEspecificacoes(machine) {
  const wrap = document.getElementById("machineDetailSpecsWrap");
  const root = document.getElementById("machineDetailSpecs");

  const items = Array.isArray(machine.especificacoes)
    ? machine.especificacoes.filter(
        (item) => String(item?.nome || "").trim() || String(item?.valor || "").trim()
      )
    : [];

  if (!items.length) {
    root.innerHTML = "";
    wrap.hidden = true;
    return;
  }

  root.innerHTML = items.map((item) => `
    <div class="machine-detail-spec-row">
      <dt>${escapeCatalogo(item.nome || "Informação")}</dt>
      <dd>${escapeCatalogo(item.valor || "—")}</dd>
    </div>
  `).join("");

  wrap.hidden = false;
}

function renderizarPreco(machine) {
  const root = document.getElementById("machineDetailPrice");

  if (machine.mostrarPreco && machine.preco) {
    root.innerHTML = `
      <span>Valor informado</span>
      <strong>${escapeCatalogo(machine.preco)}</strong>
    `;
    root.hidden = false;
  } else {
    root.innerHTML = "";
    root.hidden = true;
  }
}

function renderizarGaleriaMaquina(machine) {
  const main = document.getElementById("machineDetailMainImage");
  const thumbs = document.getElementById("machineDetailThumbs");

  const photos = [];
  const seen = new Set();

  function addPhoto(fileId, url) {
    fileId = String(fileId || "").trim();
    url = String(url || "").trim();

    const key = fileId || url;
    if (!key || seen.has(key)) return;

    seen.add(key);
    photos.push({ fileId, url });
  }

  addPhoto(machine.fotoCapaId, machine.fotoCapaUrl);

  if (Array.isArray(machine.fotos)) {
    [...machine.fotos]
      .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
      .forEach((photo) => addPhoto(photo.arquivoId, photo.url));
  }

  if (!photos.length) {
    main.innerHTML = machinePlaceholder(machine);
    thumbs.innerHTML = "";
    return;
  }

  thumbs.innerHTML = photos.map((photo, index) => `
    <button
      type="button"
      class="machine-detail-thumb${index === 0 ? " is-active" : ""}"
      aria-label="Ver foto ${index + 1}"
    >
      <span class="machine-detail-thumb-placeholder">FM</span>
      <img
        data-drive-file-id="${escapeCatalogo(photo.fileId)}"
        data-drive-fallback-url="${escapeCatalogo(photo.url)}"
        alt=""
      >
    </button>
  `).join("");

  thumbs.querySelectorAll(".machine-detail-thumb img").forEach((img) => {
    loadDriveImage(
      img,
      img.dataset.driveFileId,
      img.dataset.driveFallbackUrl,
      320,
      () => {
        const button = img.closest(".machine-detail-thumb");
        if (button) button.classList.add("image-failed");
      }
    );
  });

  function show(index) {
    const photo = photos[index] || photos[0];

    main.innerHTML = `
      <div class="machine-detail-main-loading">
        <span></span>
      </div>
      <img
        class="machine-detail-active-image"
        alt="${escapeCatalogo(machine.titulo || "Equipamento")}"
      >
    `;

    const img = main.querySelector(".machine-detail-active-image");

    loadDriveImage(
      img,
      photo.fileId,
      photo.url,
      1600,
      () => {
        main.innerHTML = machinePlaceholder(machine);
      }
    );

    thumbs.querySelectorAll(".machine-detail-thumb").forEach((button, i) => {
      button.classList.toggle("is-active", i === index);
    });
  }

  thumbs.querySelectorAll(".machine-detail-thumb").forEach((button, index) => {
    button.addEventListener("click", () => show(index));
  });

  show(0);
}

function montarMensagemWhatsAppMaquina(machine) {
  return [
    "Olá! Vim pelo site da Felipe Mariano Máquinas Gráficas.",
    "",
    "Gostaria de mais informações sobre este equipamento:",
    "",
    `Máquina: ${machine.titulo || "Equipamento"}`,
    machine.marca ? `Marca: ${machine.marca}` : null,
    machine.modelo ? `Modelo: ${machine.modelo}` : null,
    machine.ano ? `Ano: ${machine.ano}` : null,
    machine.categoria ? `Categoria: ${machine.categoria}` : null,
    machine.localizacao ? `Localização: ${machine.localizacao}` : null,
    machine.mostrarPreco && machine.preco
      ? `Preço anunciado: ${machine.preco}`
      : null,
    "",
    "Poderia me passar mais detalhes e condições?"
  ].filter(Boolean).join("\n");
}

function fecharFichaMaquina() {
  const modal = document.getElementById("machineDetailModal");
  if (!modal) return;

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("machine-detail-open");
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-machine-detail-close]")) {
    fecharFichaMaquina();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") fecharFichaMaquina();
});

function renderizarFiltrosPublicos(categorias) {
  const root = document.getElementById("filterChips");
  if (!root) return;

  root.innerHTML =
    `<button class="filter-chip active" data-filter="todos" type="button">Todas</button>` +
    categorias
      .filter((category) => category.ativa !== false)
      .map((category) => `
        <button
          class="filter-chip"
          data-filter="${escapeCatalogo(category.slug)}"
          type="button"
        >
          ${escapeCatalogo(category.nome)}
        </button>
      `)
      .join("");

  root.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const filter = chip.dataset.filter || "todos";

      if (typeof activeFilter !== "undefined") {
        activeFilter = filter;
      }

      root.querySelectorAll(".filter-chip").forEach((item) => {
        item.classList.toggle("active", item === chip);
      });

      if (typeof filterMachines === "function") {
        filterMachines();
      } else {
        document.querySelectorAll(".machine-card").forEach((card) => {
          card.classList.toggle(
            "is-hidden",
            !(filter === "todos" || card.dataset.category === filter)
          );
        });
      }
    });
  });
}

function slugCatalogo(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeCatalogo(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

carregarCatalogoGoogleSheets();
