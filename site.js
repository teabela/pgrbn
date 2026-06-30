const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

if (navToggle && mainNav) {
  // Mobile/tablet slide-in drawer: inject a dimming scrim + a top-left X close button, then wire
  // open/close (hamburger toggles; X, scrim-click and Escape all close). The drawer/scrim styling
  // lives in the <=1023.98px media queries; both are hidden on desktop.
  const scrim = document.createElement("div");
  scrim.className = "nav-scrim";
  document.body.appendChild(scrim);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "nav-close";
  closeBtn.setAttribute("aria-label", "Zatvori meni");
  closeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  mainNav.prepend(closeBtn);

  const setNav = (open) => {
    navToggle.setAttribute("aria-expanded", String(open));
    mainNav.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
    document.body.classList.toggle("no-scroll", open);
  };

  navToggle.addEventListener("click", () => setNav(!mainNav.classList.contains("is-open")));
  closeBtn.addEventListener("click", () => setNav(false));
  scrim.addEventListener("click", () => setNav(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mainNav.classList.contains("is-open")) setNav(false);
  });
}

// Services dropdown opens on CLICK (desktop), closing on outside-click or Escape. On mobile the
// "Usluge" trigger is hidden and its links are shown flat in the drawer (CSS), so the toggle is
// skipped there. `mobileNav` is reused by the drawer and the nav width-lock below.
const mobileNav = window.matchMedia("(max-width: 1023.98px)");
document.querySelectorAll(".services-menu").forEach((menu) => {
  const button = menu.querySelector("button");
  if (!button) return;
  const setOpen = (open) => button.setAttribute("aria-expanded", String(open));

  button.addEventListener("click", (event) => {
    if (mobileNav.matches) return;
    event.stopPropagation();
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });

  document.addEventListener("click", (event) => {
    if (!mobileNav.matches && !menu.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      button.focus();
    }
  });
});

// Keep the nav from reflowing when an item bolds on hover: reserve each item's BOLD width up front
// (via min-width) so its box never changes size — the | dividers stay fixed. The same trick pins
// each dropdown panel to the width it needs when ALL its items are bold, so hovering one item can't
// resize the panel. Re-measured after the web font loads and on resize; cleared on the mobile
// stacked menu (items are full-width there).
const navItems = [...document.querySelectorAll(".main-nav > a, .services-menu > button")];
const dropdowns = [...document.querySelectorAll(".dropdown")];
const lockNavWidths = () => {
  navItems.forEach((el) => { el.style.minWidth = ""; });
  dropdowns.forEach((el) => { el.style.minWidth = ""; });
  if (mobileNav.matches) return;
  const widths = navItems.map((el) => {
    el.style.fontWeight = "600";
    const w = el.getBoundingClientRect().width;
    el.style.fontWeight = "";
    return w;
  });
  navItems.forEach((el, i) => { el.style.minWidth = Math.ceil(widths[i]) + "px"; });
  dropdowns.forEach((panel) => {
    const links = [...panel.querySelectorAll("a")];
    links.forEach((a) => { a.style.fontWeight = "600"; });
    const w = panel.getBoundingClientRect().width;
    links.forEach((a) => { a.style.fontWeight = ""; });
    panel.style.minWidth = Math.ceil(w) + "px";
  });
};
let navLockTimer;
window.addEventListener("resize", () => {
  clearTimeout(navLockTimer);
  navLockTimer = setTimeout(lockNavWidths, 150);
});
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(lockNavWidths);

// --- Lightbox: opens images full-size over the page with a close X, on-scrim prev/next arrows and
//     ← → keyboard navigation. openLightbox(items, start) takes an array of {src, alt} + a start
//     index. Created on first use so gallery pages need no extra markup. ---
const lbArrow = (d) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
let lightboxRef = null;
const getLightbox = () => {
  if (lightboxRef) return lightboxRef;
  let el = document.querySelector(".lightbox");
  if (!el) {
    el = document.createElement("div");
    el.className = "lightbox";
    el.hidden = true;
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<button type="button" class="lightbox-close" data-lightbox-close aria-label="Zatvori">×</button>' +
    `<button type="button" class="lightbox-nav lightbox-prev" data-lightbox-prev aria-label="Prethodna slika">${lbArrow("m15 6-6 6 6 6")}</button>` +
    '<img alt="">' +
    `<button type="button" class="lightbox-nav lightbox-next" data-lightbox-next aria-label="Sledeća slika">${lbArrow("m9 6 6 6-6 6")}</button>`;
  const image = el.querySelector("img");
  const closeButton = el.querySelector("[data-lightbox-close]");
  const prevButton = el.querySelector("[data-lightbox-prev]");
  const nextButton = el.querySelector("[data-lightbox-next]");
  let group = [];
  let idx = 0;
  const render = () => {
    const item = group[idx] || {};
    image.src = item.src || "";
    image.alt = item.alt || "";
    const multi = group.length > 1;
    prevButton.hidden = nextButton.hidden = !multi;
  };
  const step = (delta) => {
    if (group.length < 2) return;
    idx = (idx + delta + group.length) % group.length;
    render();
  };
  const close = () => {
    el.hidden = true;
    image.removeAttribute("src");
    document.body.classList.remove("no-scroll");
  };
  const open = (items, start) => {
    group = Array.isArray(items) ? items : [items];
    idx = Math.min(Math.max(start || 0, 0), group.length - 1);
    el.hidden = false;
    document.body.classList.add("no-scroll");
    render();
    closeButton.focus();
  };
  closeButton.addEventListener("click", close);
  prevButton.addEventListener("click", () => step(-1));
  nextButton.addEventListener("click", () => step(1));
  el.addEventListener("click", (event) => {
    if (event.target === el) close();
  });
  document.addEventListener("keydown", (event) => {
    if (el.hidden) return;
    if (event.key === "Escape") close();
    else if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
  });
  lightboxRef = { open };
  return lightboxRef;
};
const openLightbox = (items, start) => getLightbox().open(items, start);

// Explicit lightbox triggers (e.g. obituary images) — grouped so ← → steps through the whole set.
const lightboxLinks = [...document.querySelectorAll("[data-lightbox]")];
const lightboxGroup = lightboxLinks.map((link) => ({
  src: link.getAttribute("href"),
  alt: link.querySelector("img")?.alt || "",
}));
lightboxLinks.forEach((link, i) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    openLightbox(lightboxGroup, i);
  });
});

const phoneGallery = window.matchMedia("(max-width: 767px)");

document.querySelectorAll(".gallery-module").forEach((gallery) => {
  const mainWrap = gallery.querySelector(".gallery-main");
  const mainImage = gallery.querySelector(".gallery-main img");
  const label = gallery.querySelector(".image-label");
  const items = [...gallery.querySelectorAll("[data-gallery-item]")];
  const filters = [...gallery.querySelectorAll("[data-filter]")];
  const prev = gallery.querySelector("[data-prev]");
  const next = gallery.querySelector("[data-next]");
  let visible = items;
  let index = 0;

  // The images currently in play, in the shape the lightbox expects.
  const groupItems = () => visible.map((it) => ({ src: it.dataset.src, alt: it.dataset.alt || "" }));

  // Smart fit on .gallery-module--fit thumbnails (cvecara): LANDSCAPE photos fill the box (cover —
  // otherwise they leave a thin gap that reads as a flaw), while PORTRAIT photos show the WHOLE image
  // (contain) and keep their side stripes. The big main preview always stays contain (nothing there
  // is cropped). Based on the image's own shape, so it's stable across viewports.
  const smartFit = gallery.classList.contains("gallery-module--fit");
  const fitThumb = (img) => {
    if (!img || !img.naturalWidth) return;
    img.style.objectFit = img.naturalWidth >= img.naturalHeight ? "cover" : "contain";
  };
  const onImgReady = (img, fn) => {
    if (img.complete && img.naturalWidth) fn();
    else img.addEventListener("load", fn, { once: true });
  };

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
      // On phones the gallery is a thumbnail grid (no slider main image), so a tap opens the
      // image straight in the lightbox; on desktop it drives the main viewer.
      if (phoneGallery.matches) {
        openLightbox(groupItems(), Math.max(0, visible.indexOf(item)));
        return;
      }
      visible = items.filter((candidate) => !candidate.hidden);
      show(visible.indexOf(item) >= 0 ? visible.indexOf(item) : itemIndex);
    });
  });

  // Click the big preview to open the current image full-size in the lightbox.
  mainWrap?.addEventListener("click", () => {
    if (visible.length) openLightbox(groupItems(), index);
  });

  prev?.addEventListener("click", () => show(index - 1));
  next?.addEventListener("click", () => show(index + 1));
  show(0);

  if (smartFit) {
    items.forEach((btn) => {
      const img = btn.querySelector("img");
      if (img) onImgReady(img, () => fitThumb(img));
    });
  }
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
