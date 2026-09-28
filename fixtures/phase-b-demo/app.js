(() => {
  const menuButton = document.querySelector('[data-testid="menu-toggle"]');
  const menu = document.querySelector('[data-testid="menu-panel"]');
  const form = document.querySelector('[data-testid="note-form"]');
  const noteInput = document.querySelector('[data-testid="note-input"]');
  const error = document.querySelector('[data-testid="form-error"]');
  const characterCount = document.querySelector('[data-testid="character-count"]');

  function closeMenu({ restoreFocus = false } = {}) {
    menuButton.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    if (restoreFocus) menuButton.focus();
  }

  menuButton.addEventListener("click", () => {
    const willOpen = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(willOpen));
    menu.hidden = !willOpen;
    if (willOpen) menu.querySelector("a").focus();
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      closeMenu({ restoreFocus: true });
    }
  });

  noteInput.addEventListener("input", () => {
    characterCount.textContent = String(noteInput.value.length);
    if (noteInput.value.trim()) {
      noteInput.removeAttribute("aria-invalid");
      error.hidden = true;
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = noteInput.value.trim();

    if (!text) {
      noteInput.setAttribute("aria-invalid", "true");
      error.hidden = false;
      noteInput.focus();
      return;
    }

    const list = document.querySelector(".handoff-card .card-body");
    const savedNote = document.createElement("p");
    savedNote.className = "new-note-confirmation";
    savedNote.setAttribute("role", "status");
    savedNote.textContent = `Handoff note added: ${text}`;
    list.append(savedNote);

    noteInput.value = "";
    characterCount.textContent = "0";
    noteInput.removeAttribute("aria-invalid");
    error.hidden = true;
    noteInput.focus();
  });
})();
