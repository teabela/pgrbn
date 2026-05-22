const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    mainNav.classList.toggle("is-open", !open);
  });
}

document.querySelectorAll(".gallery-module").forEach((gallery) => {
  const mainImage = gallery.querySelector(".gallery-main img");
  const label = gallery.querySelector(".image-label");
  const items = [...gallery.querySelectorAll("[data-gallery-item]")];
  const filters = [...gallery.querySelectorAll("[data-filter]")];
  const prev = gallery.querySelector("[data-prev]");
  const next = gallery.querySelector("[data-next]");
  let visible = items;
  let index = 0;

  const show = (nextIndex) => {
    if (!visible.length || !mainImage) return;
    index = (nextIndex + visible.length) % visible.length;
    const item = visible[index];
    mainImage.src = item.dataset.src;
    mainImage.alt = item.dataset.alt || "";
    if (label) label.textContent = item.dataset.title || "";
    items.forEach((button) => button.classList.toggle("active", button === item));
  };

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      filters.forEach((item) => item.classList.toggle("active", item === button));
      visible = items.filter((item) => filter === "all" || item.dataset.category === filter);
      items.forEach((item) => item.hidden = !visible.includes(item));
      show(0);
    });
  });

  items.forEach((item, itemIndex) => {
    item.addEventListener("click", () => {
      visible = items.filter((candidate) => !candidate.hidden);
      show(visible.indexOf(item) >= 0 ? visible.indexOf(item) : itemIndex);
    });
  });

  prev?.addEventListener("click", () => show(index - 1));
  next?.addEventListener("click", () => show(index + 1));
  show(0);
});

const lightbox = document.querySelector(".lightbox");
if (lightbox) {
  const lightboxImage = lightbox.querySelector("img");
  const closeButton = lightbox.querySelector("[data-lightbox-close]");

  document.querySelectorAll("[data-lightbox]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      lightboxImage.src = link.href;
      lightboxImage.alt = link.querySelector("img")?.alt || "";
      lightbox.hidden = false;
      closeButton.focus();
    });
  });

  const close = () => {
    lightbox.hidden = true;
    lightboxImage.removeAttribute("src");
  };

  closeButton.addEventListener("click", close);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) close();
  });
}

document.querySelectorAll("form.js-contact-form").forEach((form) => {
  const status = form.querySelector(".form-status");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      status.textContent = "Molimo popunite obavezna polja.";
      return;
    }
    form.reset();
    form.classList.remove("was-validated");
    status.textContent = "Hvala. Poruka je spremna za slanje.";
  });
});
