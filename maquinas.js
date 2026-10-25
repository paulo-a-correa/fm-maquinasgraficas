(() => {
  "use strict";

  const root = document.documentElement;
  const themeToggle = document.getElementById("machinePageThemeToggle");

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("fm-theme", theme);

    if (themeToggle) {
      themeToggle.textContent = theme === "dark" ? "☀" : "☾";
      themeToggle.setAttribute(
        "aria-label",
        theme === "dark"
          ? "Ativar tema claro"
          : "Ativar tema escuro"
      );
    }

    const metaTheme =
      document.querySelector('meta[name="theme-color"]');

    if (metaTheme) {
      metaTheme.setAttribute(
        "content",
        theme === "dark" ? "#071126" : "#f3f1ef"
      );
    }
  }

  setTheme(
    localStorage.getItem("fm-theme") === "dark"
      ? "dark"
      : "light"
  );

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      setTheme(
        root.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark"
      );
    });
  }

  const mainImage = document.getElementById("machinePageMainImage");
  const thumbs = [
    ...document.querySelectorAll(".machine-page-thumb")
  ];

  thumbs.forEach((button) => {
    button.addEventListener("click", () => {
      const src = button.dataset.src;
      const alt = button.dataset.alt || "Equipamento";

      if (!src || !mainImage) return;

      mainImage.src = src;
      mainImage.alt = alt;

      thumbs.forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
    });
  });

  const shareButton = document.getElementById("machinePageShare");
  const shareStatus = document.getElementById("machinePageShareStatus");

  if (shareButton) {
    shareButton.addEventListener("click", async () => {
      const data = {
        title:
          document.querySelector('meta[property="og:title"]')
            ?.getAttribute("content") || document.title,

        text:
          document.querySelector('meta[property="og:description"]')
            ?.getAttribute("content") || "",

        url: window.location.href
      };

      try {
        if (navigator.share) {
          await navigator.share(data);
          return;
        }

        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(data.url);

          if (shareStatus) {
            shareStatus.textContent = "Link copiado.";
          }

          return;
        }

        window.prompt("Copie o link:", data.url);
      } catch (error) {
        if (error && error.name === "AbortError") return;

        console.error(error);
        window.prompt("Copie o link:", data.url);
      }
    });
  }
})();
