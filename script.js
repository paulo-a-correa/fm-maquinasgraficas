const CONFIG = {
  // WhatsApp: somente DDI + DDD + número.
  whatsappNumber: "5516997454168",

  // FormSubmit:
  // Troque apenas o texto abaixo pelo e-mail que receberá os contatos.
  formSubmitEmail: "paulo.cartaodigital@gmail.com"
};

const root = document.documentElement;
const header = document.querySelector(".site-header");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = themeToggle.querySelector(".theme-icon");
const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");
const machineSearch = document.getElementById("machineSearch");
const filterChips = [...document.querySelectorAll(".filter-chip")];
/* let machineCards = [...document.querySelectorAll(".machine-card")]; */

let machineCards = [...document.querySelectorAll(".machine-card")];

const emptyState = document.getElementById("emptyState");
const contactForm = document.getElementById("contactForm");
const contactSubmitButton = document.getElementById("contactSubmitButton");
const contactFormStatus = document.getElementById("contactFormStatus");
const contactFormFrame = document.getElementById("contactFormFrame");
const contactSuccessModal = document.getElementById("contactSuccessModal");
const whatsappFloat = document.getElementById("whatsappFloat");

let activeFilter = "todos";

function setTheme(theme) {
  root.setAttribute("data-theme", theme);
  localStorage.setItem("fm-theme", theme);

  const isDark = theme === "dark";
  themeIcon.textContent = isDark ? "☀" : "☾";
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Ativar tema claro" : "Ativar tema escuro"
  );

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", isDark ? "#071126" : "#f3f1ef");
  }
}

// Padrão solicitado: tema claro.
// Só usa o escuro quando o próprio visitante já o escolheu anteriormente.
const savedTheme = localStorage.getItem("fm-theme");
setTheme(savedTheme === "dark" ? "dark" : "light");

themeToggle.addEventListener("click", () => {
  const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  setTheme(nextTheme);
});

function closeMobileMenu() {
  mobileMenu.classList.remove("open");
  menuToggle.classList.remove("active");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

menuToggle.addEventListener("click", () => {
  const willOpen = !mobileMenu.classList.contains("open");
  mobileMenu.classList.toggle("open", willOpen);
  menuToggle.classList.toggle("active", willOpen);
  menuToggle.setAttribute("aria-expanded", String(willOpen));
  document.body.classList.toggle("menu-open", willOpen);
});

mobileMenu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMobileMenu);
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 1020) closeMobileMenu();
});

function updateHeader() {
  header.classList.toggle("scrolled", window.scrollY > 12);
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((element) => {
  revealObserver.observe(element);
});


// =========================================================
// ESMAECIMENTO LENTO DE CADA SEÇÃO
// Velocidade no style.css:
// --section-fade-duration: 1800ms;
// =========================================================
const sectionFadeElements = [...document.querySelectorAll("main > section")];

sectionFadeElements.forEach((section) => {
  section.classList.add("section-fade");
});

if ("IntersectionObserver" in window) {
  const sectionFadeObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("section-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      // Quanto da seção precisa entrar na tela para iniciar.
      threshold: 0.08,
      rootMargin: "0px 0px -4% 0px"
    }
  );

  /*
    Dois requestAnimationFrame garantem que o navegador primeiro
    desenhe a seção com opacity: 0 e só depois ative a transição.
    Isso torna o fade visível inclusive na primeira dobra.
  */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      sectionFadeElements.forEach((section) => {
        sectionFadeObserver.observe(section);
      });
    });
  });
} else {
  // Compatibilidade com navegadores antigos.
  sectionFadeElements.forEach((section) => {
    section.classList.add("section-visible");
  });
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filterMachines() {
  const term = normalizeText(machineSearch.value.trim());
  let visibleCount = 0;

  machineCards.forEach((card) => {
    const category = card.dataset.category;
    const searchable = normalizeText(card.dataset.search || "");
    const categoryMatches = activeFilter === "todos" || category === activeFilter;
    const searchMatches = !term || searchable.includes(term);
    const visible = categoryMatches && searchMatches;

    card.classList.toggle("is-hidden", !visible);
    if (visible) visibleCount += 1;
  });

  emptyState.hidden = visibleCount !== 0;
}

machineSearch.addEventListener("input", filterMachines);

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    activeFilter = chip.dataset.filter;
    filterChips.forEach((item) => item.classList.toggle("active", item === chip));
    filterMachines();
  });
});

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

// =========================================================
// WHATSAPP — APLICATIVO PRIMEIRO + FALLBACK PARA NAVEGADOR
// =========================================================

const WHATSAPP_FALLBACK_DELAY = 2200;

function getWhatsAppWebUrl(message = "") {
  const number = onlyDigits(CONFIG.whatsappNumber);
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${number}${encodedMessage ? `?text=${encodedMessage}` : ""}`;
}

function getWhatsAppAppUrl(message = "") {
  const number = onlyDigits(CONFIG.whatsappNumber);
  const encodedMessage = encodeURIComponent(message);

  return `whatsapp://send?phone=${number}${encodedMessage ? `&text=${encodedMessage}` : ""}`;
}

function openWhatsApp(message = "") {
  const appUrl = getWhatsAppAppUrl(message);
  const webUrl = getWhatsAppWebUrl(message);

  let fallbackTimer = null;
  let appWasOpened = false;

  const cleanup = () => {
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }

    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pagehide", handlePageHide);
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      appWasOpened = true;
      cleanup();
    }
  };

  const handlePageHide = () => {
    appWasOpened = true;
    cleanup();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);

  /*
    Primeiro tenta abrir WhatsApp Mobile ou WhatsApp Desktop.
    Se o protocolo whatsapp:// não for atendido, usa wa.me.
  */
  try {
    window.location.href = appUrl;
  } catch (error) {
    cleanup();
    window.location.href = webUrl;
    return;
  }

  fallbackTimer = window.setTimeout(() => {
    cleanup();

    if (!appWasOpened && !document.hidden) {
      window.location.href = webUrl;
    }
  }, WHATSAPP_FALLBACK_DELAY);
}

// Mensagem usada pelo balão flutuante.
const whatsappFloatMessage =
  "Olá! Vim pelo site da Felipe Mariano Máquinas Gráficas e gostaria de mais informações.";

// Mantém um link web real como fallback caso o JavaScript seja interrompido.
whatsappFloat.href = getWhatsAppWebUrl(whatsappFloatMessage);

whatsappFloat.addEventListener("click", (event) => {
  event.preventDefault();
  openWhatsApp(whatsappFloatMessage);
});

// =========================================================
// FORMULÁRIO DE CONTATO — FORMSUBMIT EM IFRAME OCULTO
// Mantém o visitante na mesma página e mostra um modal próprio.
// =========================================================

let contactFormSending = false;
let contactFormTimer = null;

function setContactSubmitState(isSending) {
  const submitText =
    contactSubmitButton.querySelector(".contact-submit-text");

  contactSubmitButton.classList.toggle("is-sending", isSending);
  contactSubmitButton.disabled = isSending;

  if (isSending) {
    contactSubmitButton.setAttribute("aria-busy", "true");

    if (submitText) {
      submitText.textContent = "Enviando...";
    }

    contactFormStatus.textContent =
      "Enviando sua mensagem com segurança...";
    contactFormStatus.classList.remove("is-error", "is-success");
  } else {
    contactSubmitButton.removeAttribute("aria-busy");

    if (submitText) {
      submitText.textContent = "Enviar mensagem";
    }
  }
}

function openContactSuccessModal() {
  if (!contactSuccessModal) return;

  contactSuccessModal.classList.add("is-open");
  contactSuccessModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("contact-success-open");

  const closeButton =
    contactSuccessModal.querySelector("[data-contact-success-close]");

  if (closeButton) {
    window.setTimeout(() => closeButton.focus(), 60);
  }
}

function closeContactSuccessModal() {
  if (!contactSuccessModal) return;

  contactSuccessModal.classList.remove("is-open");
  contactSuccessModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("contact-success-open");
}

contactForm.addEventListener("submit", () => {
  contactFormSending = true;

  if (contactFormTimer) {
    window.clearTimeout(contactFormTimer);
  }

  setContactSubmitState(true);

  /*
    O formulário é enviado normalmente, porém para o iframe oculto
    definido no atributo target="contactFormFrame".
  */
  contactFormTimer = window.setTimeout(() => {
    if (!contactFormSending) return;

    contactFormSending = false;
    setContactSubmitState(false);

    contactFormStatus.textContent =
      "O envio está demorando mais que o esperado. Verifique sua conexão e tente novamente.";
    contactFormStatus.classList.add("is-error");
  }, 25000);
});

if (contactFormFrame) {
  contactFormFrame.addEventListener("load", () => {
    /*
      O iframe também dispara load ao iniciar em about:blank.
      Por isso só tratamos o evento depois que houve um envio real.
    */
    if (!contactFormSending) return;

    contactFormSending = false;

    if (contactFormTimer) {
      window.clearTimeout(contactFormTimer);
      contactFormTimer = null;
    }

    setContactSubmitState(false);
    contactForm.reset();

    contactFormStatus.textContent =
      "Mensagem enviada com sucesso!";
    contactFormStatus.classList.remove("is-error");
    contactFormStatus.classList.add("is-success");

    openContactSuccessModal();
  });
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-contact-success-close]")) {
    closeContactSuccessModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    contactSuccessModal?.classList.contains("is-open")
  ) {
    closeContactSuccessModal();
  }
});

document.getElementById("year").textContent = new Date().getFullYear();

// Movimento sutil no hero apenas em dispositivos com mouse.
const heroVisual = document.querySelector(".hero-image-wrap");

if (
  heroVisual &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  heroVisual.addEventListener("pointermove", (event) => {
    const rect = heroVisual.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    heroVisual.style.transform =
      `perspective(1200px) rotateY(${x * 2.4}deg) rotateX(${y * -2.4}deg)`;
  });

  heroVisual.addEventListener("pointerleave", () => {
    heroVisual.style.transform = "";
  });
}

// =========================================================
// TÍTULO DA HERO — "MÁQUINA CERTA." DIGITANDO EM LOOPING
// =========================================================
const heroTypewriter = document.getElementById("heroTypewriterText");

if (heroTypewriter) {
  const text = "máquina certa.";

  // Ajuste estes valores se quiser acelerar ou desacelerar.
  const typingSpeed = 105;       // tempo entre cada letra ao digitar
  const deletingSpeed = 55;     // tempo entre cada letra ao apagar
  const holdAfterTyping = 1800; // pausa com a frase completa
  const holdAfterDeleting = 500;// pausa antes de começar novamente

  let index = 0;
  let deleting = false;

  function typewriterLoop() {
    if (!deleting) {
      heroTypewriter.textContent = text.slice(0, index);

      if (index < text.length) {
        index += 1;
        window.setTimeout(typewriterLoop, typingSpeed);
        return;
      }

      deleting = true;
      window.setTimeout(typewriterLoop, holdAfterTyping);
      return;
    }

    heroTypewriter.textContent = text.slice(0, index);

    if (index > 0) {
      index -= 1;
      window.setTimeout(typewriterLoop, deletingSpeed);
      return;
    }

    deleting = false;
    window.setTimeout(typewriterLoop, holdAfterDeleting);
  }

  // Pequena pausa inicial para o visitante perceber o começo da digitação.
  window.setTimeout(typewriterLoop, 450);
}
