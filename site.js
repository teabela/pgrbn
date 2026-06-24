const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    mainNav.classList.toggle("is-open", !open);
  });
}

// --- Lightbox (shared, created on first use so gallery pages need no extra markup) ---
let lightboxRef = null;
const getLightbox = () => {
  if (lightboxRef) return lightboxRef;
  let el = document.querySelector(".lightbox");
  if (!el) {
    el = document.createElement("div");
    el.className = "lightbox";
    el.hidden = true;
    el.innerHTML = '<button type="button" data-lightbox-close aria-label="Zatvori">×</button><img alt="">';
    document.body.appendChild(el);
  }
  const image = el.querySelector("img");
  const closeButton = el.querySelector("[data-lightbox-close]");
  const close = () => {
    el.hidden = true;
    image.removeAttribute("src");
    document.body.classList.remove("no-scroll");
  };
  closeButton.addEventListener("click", close);
  el.addEventListener("click", (event) => {
    if (event.target === el) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.hidden) close();
  });
  lightboxRef = { el, image, closeButton };
  return lightboxRef;
};
const openLightbox = (src, alt) => {
  const { el, image, closeButton } = getLightbox();
  image.src = src;
  image.alt = alt || "";
  el.hidden = false;
  document.body.classList.add("no-scroll");
  closeButton.focus();
};

// Explicit lightbox triggers (e.g. obituary thumbnails).
document.querySelectorAll("[data-lightbox]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    openLightbox(link.href, link.querySelector("img")?.alt);
  });
});

const phoneGallery = window.matchMedia("(max-width: 767px)");

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
      // On phones the gallery is a thumbnail grid (no slider main image), so a tap
      // enlarges the image in the lightbox; on desktop it drives the main viewer.
      if (phoneGallery.matches) {
        openLightbox(item.dataset.src, item.dataset.alt);
        return;
      }
      visible = items.filter((candidate) => !candidate.hidden);
      show(visible.indexOf(item) >= 0 ? visible.indexOf(item) : itemIndex);
    });
  });

  prev?.addEventListener("click", () => show(index - 1));
  next?.addEventListener("click", () => show(index + 1));
  show(0);
});

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

// "Scroll down" cue: smooth-scroll to the section immediately after the hero.
document.querySelectorAll(".scroll-cue").forEach((cue) => {
  cue.addEventListener("click", () => {
    const hero = cue.closest(".hero, .page-hero");
    const target = hero && hero.nextElementSibling;
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
