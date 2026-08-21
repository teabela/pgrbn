const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

if (navToggle && mainNav) {
  // Mobile/tablet slide-in drawer: inject a dimming scrim + a top-left X close button, then wire
  // open/close (hamburger toggles; X, scrim-click and Escape all close). The drawer/scrim styling
  // lives in the <=1023.98px media queries; both are hidden on desktop.
  const scrim = document.createElement("div");
  scrim.className = "nav-scrim";
  // Insert the scrim INTO the header, right before the drawer — both then share the header's stacking
  // context, so the drawer (z 60) sits above the scrim (z 55). At body level the scrim would instead
  // cover the drawer, since the header's z-index traps the drawer below a body-level scrim.
  mainNav.parentNode.insertBefore(scrim, mainNav);

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

// --- Lightbox: opens images full-size over the page. Close ONLY via the X or Escape — the scrim is
//     locked (a backdrop click does nothing) so images aren't dismissed by accident. Step through with
//     the on-scrim prev/next arrows, the ← → keys, or by CLICKING the image (advances to the next one).
//     openLightbox(items, start) takes an array of {src, alt} + a start index. Created on first use so
//     gallery pages need no extra markup. ---
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
  // The arrows + "1/12" counter live in a .lightbox-controls wrapper: on desktop it's
  // display:contents (arrows keep their absolute scrim positions, counter hidden); on phones
  // it becomes a [prev 1/12 next] row BELOW the image, where the arrows can't cover it.
  el.innerHTML =
    '<button type="button" class="lightbox-close" data-lightbox-close aria-label="Zatvori">×</button>' +
    // Figure wrapper shrink-wraps to the image, so the title (left-aligned per client)
    // starts exactly at the image's left edge at every breakpoint.
    '<div class="lightbox-figure">' +
    '<div class="lightbox-title" data-lightbox-title></div>' +
    '<img alt="">' +
    "</div>" +
    '<div class="lightbox-controls">' +
    `<button type="button" class="lightbox-nav lightbox-prev" data-lightbox-prev aria-label="Prethodna slika">${lbArrow("m15 6-6 6 6 6")}</button>` +
    '<span class="lightbox-counter" data-lightbox-counter></span>' +
    `<button type="button" class="lightbox-nav lightbox-next" data-lightbox-next aria-label="Sledeća slika">${lbArrow("m9 6 6 6-6 6")}</button>` +
    "</div>";
  const image = el.querySelector("img");
  const closeButton = el.querySelector("[data-lightbox-close]");
  const prevButton = el.querySelector("[data-lightbox-prev]");
  const nextButton = el.querySelector("[data-lightbox-next]");
  const controls = el.querySelector(".lightbox-controls");
  const counter = el.querySelector("[data-lightbox-counter]");
  const title = el.querySelector("[data-lightbox-title]");
  let group = [];
  let idx = 0;
  const render = () => {
    const item = group[idx] || {};
    image.src = item.src || "";
    image.alt = item.alt || "";
    const multi = group.length > 1;
    controls.hidden = !multi;
    counter.textContent = `${idx + 1}/${group.length}`;
    // Image name above the photo — only galleries opting in via data-lightbox-titles
    // (oprema) pass a title; everywhere else the element stays hidden.
    title.textContent = item.title || "";
    title.hidden = !item.title;
  };
  const step = (delta) => {
    const n = group.length;
    if (n < 2) return;
    idx = (idx + delta + n) % n; // wrap-around: past the last loops back to the first, and vice versa
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
  // Click the image itself to advance to the next one (in addition to the arrows). The scrim is
  // deliberately NOT click-to-close — only the X or Escape closes — so it's never dismissed by accident.
  image.addEventListener("click", () => step(1));
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

// Umrlice: reveal the older-years archive on demand (keeps the initial page light). Only umrlice has
// this button; the archived [data-lightbox] links were already grouped above, so the lightbox steps
// through every year regardless of whether the archive is expanded yet.
document.querySelectorAll("[data-show-older]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".obituary-archive").forEach((el) => { el.hidden = false; });
    button.remove();
  });
});

const phoneGallery = window.matchMedia("(max-width: 767px)");
// How many thumbnails the slider shows at once. Driven by the CSS custom property --thumb-n (set per
// breakpoint in styles.css) so the slide window always matches the number of boxes CSS actually shows.
const thumbWindow = () => {
  const n = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--thumb-n"), 10);
  return n > 0 ? n : 5;
};

document.querySelectorAll(".gallery-module").forEach((gallery) => {
  const mainWrap = gallery.querySelector(".gallery-main");
  const mainImage = gallery.querySelector(".gallery-main img");
  const label = gallery.querySelector(".image-label");
  const items = [...gallery.querySelectorAll("[data-gallery-item]")];
  const filters = [...gallery.querySelectorAll("[data-filter]")];
  const prev = gallery.querySelector("[data-prev]");
  const next = gallery.querySelector("[data-next]");

  // Wrap the thumbnails in a sliding track inside the (now overflow-clipped) strip: the strip shows
  // 5 at a time; the track holds them all in one row and is translated to bring a window into view.
  const strip = gallery.querySelector(".thumb-strip");
  let track = null;
  if (strip) {
    track = document.createElement("div");
    track.className = "thumb-track";
    while (strip.firstChild) track.appendChild(strip.firstChild);
    strip.appendChild(track);
  }

  let visible = items; // items matching the active filter (all of them, unless a chip narrows it)
  let current = 0;     // the selected image shown in the main preview — index within `visible`
  let winStart = 0;    // index within `visible` of the left-most thumbnail on screen
  let prevWinStart = 0;

  // The images currently in play, in the shape the lightbox expects. Only galleries marked
  // data-lightbox-titles (oprema, per client) send their data-title along — the lightbox then
  // shows it above the photo; every other gallery stays title-less.
  const showTitles = gallery.hasAttribute("data-lightbox-titles");
  const groupItems = () =>
    visible.map((it) => ({ src: it.dataset.src, alt: it.dataset.alt || "", title: showTitles ? it.dataset.title || "" : "" }));

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

  // Slide the track to the current window. `animate` runs the CSS transition; suppress it for jumps
  // (wrap-around, filter switches) so the strip cuts instead of rewinding through every image.
  const positionTrack = (animate) => {
    if (!track) return;
    if (phoneGallery.matches) { track.style.transition = ""; track.style.transform = ""; return; }
    const firstVisible = visible[0];
    if (!firstVisible) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const pitch = firstVisible.offsetWidth + gap;
    if (!animate) track.style.transition = "none";
    track.style.transform = `translateX(${-(winStart * pitch)}px)`;
    if (!animate) { void track.offsetWidth; track.style.transition = ""; } // flush, then re-arm the CSS transition
  };

  // Repaint the selection (main preview + active thumb) and slide the strip to match.
  const render = (instant) => {
    const count = visible.length;
    items.forEach((it) => it.classList.toggle("active", count > 0 && it === visible[current]));
    if (mainImage && count) {
      const sel = visible[current];
      mainImage.src = sel.dataset.src;
      mainImage.alt = sel.dataset.alt || "";
    }
    if (label) label.textContent = count ? visible[current].dataset.title || "" : "";
    // Animate only single-step slides; wrap-around and filter resets jump instantly.
    const animate = !instant && Math.abs(winStart - prevWinStart) <= 1;
    positionTrack(animate);
    prevWinStart = winStart;
  };

  // Select image `i` — wraps around, so past-the-last loops to the first (and before-first to last).
  // `recenter` (arrow presses) re-centres the window on the selection so the strip slides a step;
  // thumbnail clicks pass recenter=false and leave the window where it is (the thumb is already shown).
  // The window size (`win`) is read live from --thumb-n, so it adapts to the current breakpoint.
  const select = (i, recenter) => {
    const n = visible.length;
    if (!n) return;
    current = ((i % n) + n) % n;
    if (!phoneGallery.matches) {
      const win = thumbWindow();
      const maxStart = Math.max(0, n - win);
      if (recenter) winStart = current - Math.floor(win / 2);
      else if (current < winStart) winStart = current;
      else if (current > winStart + win - 1) winStart = current - win + 1;
      winStart = Math.min(Math.max(winStart, 0), maxStart);
    }
    render();
  };

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      filters.forEach((chip) => chip.classList.toggle("active", chip === button));
      visible = items.filter((it) => filter === "all" || it.dataset.category === filter);
      items.forEach((it) => { it.hidden = !visible.includes(it); }); // hide out-of-category thumbs
      current = 0;
      winStart = 0;
      render(true); // reset instantly — no rewind slide
    });
  });

  items.forEach((item) => {
    item.addEventListener("click", () => {
      const i = visible.indexOf(item);
      if (i < 0) return;
      // On phones a tap opens the image straight in the lightbox; on the slider it drives the preview.
      if (phoneGallery.matches) openLightbox(groupItems(), i);
      else select(i, false);
    });
  });

  // Click the big preview to open the current image full-size in the lightbox.
  mainWrap?.addEventListener("click", () => {
    if (visible.length) openLightbox(groupItems(), current);
  });

  prev?.addEventListener("click", () => select(current - 1, true));
  next?.addEventListener("click", () => select(current + 1, true));

  // Keep the slide aligned when the column width changes; reshape when crossing the phone breakpoint.
  let resizeRAF = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(() => {
      // The visible count (--thumb-n) can change with width; re-clamp the window to the new size so
      // the selection stays in view and the strip never slides past the last full window.
      if (!phoneGallery.matches) {
        const win = thumbWindow();
        const maxStart = Math.max(0, visible.length - win);
        if (current > winStart + win - 1) winStart = current - win + 1;
        winStart = Math.min(Math.max(winStart, 0), maxStart);
      }
      prevWinStart = winStart;
      positionTrack(false);
    });
  });
  phoneGallery.addEventListener("change", () => { winStart = 0; prevWinStart = 0; render(true); });

  if (smartFit) {
    items.forEach((btn) => {
      const img = btn.querySelector("img");
      if (img) onImgReady(img, () => fitThumb(img));
    });
  }

  render(true);
});

document.querySelectorAll("form.js-contact-form").forEach((form) => {
  const status = form.querySelector(".form-status");
  const submitButton = form.querySelector('button[type="submit"]');
  const submitLabel = submitButton.textContent;
  const trimmedFields = [
    { field: form.elements.namedItem("name"), message: "Molimo unesite vaše ime." },
    { field: form.elements.namedItem("message"), message: "Molimo unesite poruku." },
  ];
  let submitting = false;

  const setStatus = (message, state = "") => {
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  };

  trimmedFields.forEach(({ field }) => {
    field.addEventListener("input", () => field.setCustomValidity(""));
  });

  form.addEventListener("invalid", () => {
    form.classList.add("was-validated");
    setStatus("Molimo proverite označena polja.", "error");
  }, true);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitting) return;

    trimmedFields.forEach(({ field, message }) => {
      field.setCustomValidity(field.value.trim() ? "" : message);
    });

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      setStatus("Molimo proverite označena polja.", "error");
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    ["name", "email", "Naslov", "message"].forEach((name) => {
      const value = data.get(name);
      if (typeof value === "string") data.set(name, value.trim());
    });

    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Šaljem…";
    form.setAttribute("aria-busy", "true");
    setStatus("Šaljem poruku…", "sending");

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`Formspree returned HTTP ${response.status}`);

      form.reset();
      trimmedFields.forEach(({ field }) => field.setCustomValidity(""));
      form.classList.remove("was-validated");
      setStatus("Hvala. Vaša poruka je uspešno poslata.", "success");
    } catch (error) {
      console.error("Contact form submission failed.", error);
      setStatus("Poruka nije poslata. Pokušajte ponovo ili nas kontaktirajte telefonom.", "error");
    } finally {
      submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
      form.removeAttribute("aria-busy");
    }
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
