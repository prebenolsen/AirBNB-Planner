// =====================================================================
// AirBNB Planlegger - app.js
// Ren JavaScript uten byggesteg.
// =====================================================================

const STORAGE_KEY = "airbnbPlannerState_v2_no";
const PROJECTS_KEY = "airbnbPlannerProjects_v1";
const ACTIVE_PROJECT_KEY = "airbnbPlannerActiveProject_v1";
const UDEFINERT_ROM = "Alle rom";
const UDEFINERT_DAG = "Uten dag";

let state = {
  categories: DEFAULT_DATA.categories.slice(),
  days: DEFAULT_DATA.days.slice(),
  priorities: DEFAULT_DATA.priorities.slice(),
  tasks: [],
  deadlineDate: "",
  view: "category",
  layoutMode: "horizontal",
  showDateMetadata: true,
  filters: { search: "", priority: "all", showCompleted: false, showMeg: false },
};

let editingTaskId = null;
let draggedTaskId = null;
let projects = [];
let activeProjectId = "";

function loadProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    projects = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(projects)) projects = [];
  } catch (e) {
    projects = [];
    console.warn("Kunne ikke lese prosjekter.", e);
  }

  try {
    activeProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY) || "";
  } catch (e) {
    activeProjectId = "";
  }
}

function saveProjects() {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId || "");
}

function projectLabel(project) {
  if (project.name && project.name.trim()) return project.name;
  if (project.deadlineDate) return `Ankomst ${project.deadlineDate}`;
  return `Prosjekt ${project.id}`;
}

function updateProjectSelectUI() {
  const select = document.getElementById("project-select");
  if (!select) return;

  const sorted = [...projects].sort((a, b) => {
    const ta = a.savedAt || "";
    const tb = b.savedAt || "";
    return tb.localeCompare(ta);
  });

  select.innerHTML = `<option value="">Velg prosjekt...</option>`;
  sorted.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = projectLabel(p);
    select.appendChild(option);
  });

  if (activeProjectId && sorted.some((p) => p.id === activeProjectId)) {
    select.value = activeProjectId;
  } else {
    select.value = "";
  }
}

function currentStateForProject() {
  return {
    tasks: JSON.parse(JSON.stringify(state.tasks)),
    deadlineDate: state.deadlineDate,
    view: state.view,
    layoutMode: state.layoutMode,
    showDateMetadata: state.showDateMetadata,
  };
}

function saveCurrentProject() {
  const select = document.getElementById("project-select");
  const selected = select ? select.value : "";
  const now = new Date().toISOString();

  let project = selected ? projects.find((p) => p.id === selected) : null;
  if (!project) {
    const id = `p-${Date.now().toString(36)}`;
    const autoName = state.deadlineDate ? `Ankomst ${state.deadlineDate}` : `Prosjekt ${new Date().toLocaleDateString("nb-NO")}`;
    project = { id, name: autoName };
    projects.push(project);
  }

  Object.assign(project, currentStateForProject(), {
    name: state.deadlineDate ? `Ankomst ${state.deadlineDate}` : project.name,
    savedAt: now,
  });

  activeProjectId = project.id;
  saveProjects();
  updateProjectSelectUI();
  window.alert("Prosjekt lagret.");
}

function loadSelectedProject() {
  const select = document.getElementById("project-select");
  const selected = select ? select.value : "";
  if (!selected) {
    window.alert("Velg et prosjekt først.");
    return;
  }

  const project = projects.find((p) => p.id === selected);
  if (!project) {
    window.alert("Prosjektet ble ikke funnet.");
    return;
  }

  state.tasks = JSON.parse(JSON.stringify(project.tasks || []));
  state.tasks = state.tasks.map((t) => ({ ...t, assignee: t.assignee || "" }));
  state.deadlineDate = project.deadlineDate || "";
  state.view = project.view || "category";
  state.layoutMode = project.layoutMode === "vertical" ? "vertical" : "horizontal";
  state.showDateMetadata = project.showDateMetadata !== false;
  editingTaskId = null;

  activeProjectId = project.id;
  saveState();
  saveProjects();

  document.getElementById("deadline-date").value = state.deadlineDate || "";
  document.getElementById("required-date-input").value = state.deadlineDate || "";

  document.querySelectorAll(".viewtabs__btn").forEach((b) => {
    const active = b.dataset.view === state.view;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });

  updateLayoutModeUI();
  updateShowDateToggleUI();
  ensureDateGate();
  renderBoard();
}

function loadState() {
  let saved = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {
    console.warn("Kunne ikke lese lagret data.", e);
  }

  if (saved && Array.isArray(saved.tasks) && saved.tasks.length) {
    state.tasks = saved.tasks;
    state.deadlineDate = saved.deadlineDate || "";
    state.layoutMode = saved.layoutMode === "vertical" ? "vertical" : "horizontal";
    state.showDateMetadata = saved.showDateMetadata !== false;
  } else {
    state.tasks = JSON.parse(JSON.stringify(DEFAULT_DATA.tasks));
  }

  // Backward compatibility for tasks that were created before assignee existed.
  state.tasks = state.tasks.map((t) => ({ ...t, assignee: t.assignee || "" }));
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: state.tasks,
        deadlineDate: state.deadlineDate,
        layoutMode: state.layoutMode,
        showDateMetadata: state.showDateMetadata,
      })
    );
  } catch (e) {
    console.warn("Kunne ikke lagre data.", e);
  }
}

function resetToDefaults() {
  if (!window.confirm("Tilbakestille alle oppgaver til standard fra data.py?")) return;
  state.tasks = JSON.parse(JSON.stringify(DEFAULT_DATA.tasks));
  editingTaskId = null;
  saveState();
  renderBoard();
  updateFooterSummary();
}

function uid() {
  return "task-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function dagOffset(dayLabel) {
  if (dayLabel === "Ankomstdag") return 0;
  const m = String(dayLabel || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function formatDateForDay(dayLabel) {
  if (!state.deadlineDate) return "";
  const offset = dagOffset(dayLabel);
  if (offset === null) return "";
  const d = new Date(state.deadlineDate + "T00:00:00");
  d.setDate(d.getDate() - offset);
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
  });
}

function shortDayLabel(dayLabel) {
  const m = String(dayLabel || "").match(/^(\d+)\s+dag(?:er)?\s+før/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return `${n} ${n === 1 ? "dag" : "dager"} før`;
  }
  return dayLabel || "";
}

function labelWithDate(dayLabel) {
  const dateStr = formatDateForDay(dayLabel);
  const base = shortDayLabel(dayLabel);
  return dateStr ? `${base} (${dateStr})` : base;
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayTitleForCurrentView(task) {
  const original = String(task.title || "").trim();
  if (state.view !== "category") return original;

  const room = String(task.category || "").trim();
  if (!room || room === UDEFINERT_ROM) return original;

  const roomPattern = escapeRegex(room);
  let result = original;

  // Remove common leading room prefixes, e.g. "Bad: ..." or "Bad - ...".
  result = result.replace(new RegExp(`^\\s*${roomPattern}\\s*[:\\-–]\\s*`, "i"), "");

  // Remove standalone room name if still present in the title.
  result = result.replace(new RegExp(`\\b${roomPattern}\\b`, "ig"), "");

  // Cleanup leftover punctuation and spacing.
  result = result
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[-:,;]+\s*/, "")
    .replace(/\s*[-:,;]+\s*$/, "")
    .trim();

  return result || original;
}

function columnKeysForView() {
  if (state.view === "category") return state.categories.slice();
  return state.days.concat([UDEFINERT_DAG]);
}

function taskMatchesColumn(task, key) {
  if (state.view === "category") {
    return task.category === key || (!task.category && key === UDEFINERT_ROM);
  }
  return key === UDEFINERT_DAG ? !task.day : task.day === key;
}

function taskPassesFilters(task) {
  const f = state.filters;
  if (!f.showCompleted && task.completed) return false;
  if (!f.showMeg && task.assignee === "Meg") return false;
  if (f.priority !== "all" && task.priority !== f.priority) return false;
  if (f.search) {
    const hay = (task.title + " " + (task.notes || "")).toLowerCase();
    if (!hay.includes(f.search.toLowerCase())) return false;
  }
  return true;
}

function tasksInColumn(key) {
  return state.tasks
    .filter((t) => taskMatchesColumn(t, key) && taskPassesFilters(t))
    .sort((a, b) => a.order - b.order);
}

function renumberColumn(key) {
  const inCol = state.tasks
    .filter((t) => taskMatchesColumn(t, key))
    .sort((a, b) => a.order - b.order);
  inCol.forEach((t, i) => {
    t.order = i + 1;
  });
}

function ensureDateGate() {
  const gate = document.getElementById("date-gate");
  if (!state.deadlineDate) {
    gate.classList.add("is-open");
    gate.setAttribute("aria-hidden", "false");
  } else {
    gate.classList.remove("is-open");
    gate.setAttribute("aria-hidden", "true");
  }
}

function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";
  board.classList.remove("board--layout-horizontal", "board--layout-vertical", "board--view-category", "board--view-timeline", "board--dragging");
  board.classList.add(state.layoutMode === "vertical" ? "board--layout-vertical" : "board--layout-horizontal");
  board.classList.add(state.view === "timeline" ? "board--view-timeline" : "board--view-category");
  if (draggedTaskId) board.classList.add("board--dragging");

  columnKeysForView().forEach((key) => {
    board.appendChild(renderColumn(key));
  });

  updateFooterSummary();
}

function updateLayoutModeUI() {
  const horizontalBtn = document.getElementById("layout-horizontal-btn");
  const verticalBtn = document.getElementById("layout-vertical-btn");

  horizontalBtn.classList.toggle("is-active", state.layoutMode === "horizontal");
  verticalBtn.classList.toggle("is-active", state.layoutMode === "vertical");
}

function updateShowDateToggleUI() {
  const toggle = document.getElementById("show-date-toggle");
  const isRoomView = state.view === "category";
  toggle.checked = state.showDateMetadata;
  toggle.disabled = !isRoomView;
}

function renderColumn(key) {
  const col = document.createElement("section");
  col.className = "column";
  col.dataset.key = key;

  const visibleTasks = tasksInColumn(key);
  const totalInColumn = state.tasks.filter((t) => taskMatchesColumn(t, key)).length;
  if (state.view === "timeline" && totalInColumn === 0) {
    col.classList.add("column--unused");
  }

  const title = state.view === "timeline" && key !== UDEFINERT_DAG ? labelWithDate(key) : key;

  col.innerHTML = `
    <div class="column__header">
      <span class="column__title">${escapeHtml(title)}</span>
      <span class="column__count">${visibleTasks.length}/${totalInColumn}</span>
    </div>
    <div class="column__list" data-key="${escapeHtml(key)}"></div>
  `;

  const list = col.querySelector(".column__list");
  if (visibleTasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "column__empty";
    empty.textContent = totalInColumn === 0
      ? (state.view === "timeline" && draggedTaskId ? "Tom dag - slipp oppgaven her." : "Ingen oppgaver her ennå.")
      : "Ingen treff med nåværende filter.";
    list.appendChild(empty);
  } else {
    visibleTasks.forEach((task) => list.appendChild(renderTaskCard(task)));
  }

  attachColumnDnd(list, key);
  return col;
}

function renderTaskCard(task) {
  const card = document.createElement("div");
  card.className = "task-card" + (task.completed ? " is-completed" : "");
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;
  card.draggable = true;

  if (task.id === editingTaskId) {
    card.classList.add("is-editing");
    card.appendChild(renderEditForm(task));
  } else {
    const displayTitle = displayTitleForCurrentView(task);
    const dayBadge = task.day
      ? (state.view === "category" && !state.showDateMetadata ? shortDayLabel(task.day) : labelWithDate(task.day))
      : UDEFINERT_DAG;
    const showDayBadge = state.view !== "timeline";
    const showCategoryBadge = state.view !== "category";
    const priorityBadge = task.priority === "Kritisk"
      ? `<span class="badge badge--priority" data-p="${escapeHtml(task.priority)}" title="Kritisk">🔥</span>`
      : (task.priority === "Normal"
        ? ""
        : `<span class="badge badge--priority" data-p="${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>`);
    card.innerHTML = `
      <input type="checkbox" class="task-card__check" ${task.completed ? "checked" : ""} aria-label="Marker som fullført">
      <div class="task-card__body">
        <div class="task-card__title">${escapeHtml(displayTitle)}</div>
        <div class="task-card__badges">
          ${priorityBadge}
          ${showCategoryBadge ? `<span class="badge badge--category">${escapeHtml(task.category || UDEFINERT_ROM)}</span>` : ""}
          ${showDayBadge ? `<span class="badge badge--day">${escapeHtml(dayBadge)}</span>` : ""}
        </div>
        ${task.notes ? `<div class="task-card__notes-preview">${escapeHtml(task.notes)}</div>` : ""}
      </div>
      <button class="btn--icon task-card__delete" title="Slett oppgave" aria-label="Slett oppgave">&times;</button>
    `;

    card.querySelector(".task-card__check").addEventListener("change", (e) => {
      task.completed = e.target.checked;
      saveState();
      renderBoard();
    });
    card.querySelector(".task-card__title").addEventListener("click", () => {
      editingTaskId = task.id;
      renderBoard();
    });
    card.querySelector(".task-card__delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    card.addEventListener("dragstart", (e) => {
      draggedTaskId = task.id;
      card.classList.add("is-dragging");
      document.getElementById("board")?.classList.add("board--dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      draggedTaskId = null;
      document.getElementById("board")?.classList.remove("board--dragging");
    });
  }

  return card;
}

function renderEditForm(task) {
  const wrap = document.createElement("div");
  wrap.className = "task-edit";

  const catOptions = state.categories
    .map((c) => `<option value="${escapeHtml(c)}" ${task.category === c ? "selected" : ""}>${c}</option>`)
    .join("");

  const dayOptions = ["", ...state.days]
    .map((d) => {
      const label = d ? labelWithDate(d) : UDEFINERT_DAG;
      return `<option value="${escapeHtml(d)}" ${task.day === d ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");

  const prioOptions = state.priorities
    .map((p) => `<option value="${escapeHtml(p)}" ${task.priority === p ? "selected" : ""}>${p}</option>`)
    .join("");
  const assigneeOptions = ["", "Meg", "Vasker"]
    .map((a) => `<option value="${escapeHtml(a)}" ${task.assignee === a ? "selected" : ""}>${a || "Ikke satt"}</option>`)
    .join("");

  wrap.innerHTML = `
    <input type="text" class="edit-title" value="${escapeHtml(task.title)}" placeholder="Oppgavetittel">
    <div class="task-edit__row">
      <select class="edit-category">${catOptions}</select>
      <select class="edit-day">${dayOptions}</select>
      <select class="edit-priority">${prioOptions}</select>
      <select class="edit-assignee">${assigneeOptions}</select>
    </div>
    <textarea class="edit-notes" placeholder="Notater (valgfritt)">${escapeHtml(task.notes)}</textarea>
    <div class="task-edit__actions">
      <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink-soft);margin-right:auto;">
        <input type="checkbox" class="edit-completed" ${task.completed ? "checked" : ""}> Fullført
      </label>
      <button type="button" class="btn--icon edit-delete" title="Slett oppgave">Slett</button>
      <button type="button" class="btn btn--small edit-done">Ferdig</button>
    </div>
  `;

  wrap.querySelector(".edit-title").addEventListener("input", (e) => {
    task.title = e.target.value;
    saveState();
  });
  wrap.querySelector(".edit-notes").addEventListener("input", (e) => {
    task.notes = e.target.value;
    saveState();
  });
  wrap.querySelector(".edit-category").addEventListener("change", (e) => {
    task.category = e.target.value || UDEFINERT_ROM;
    saveState();
  });
  wrap.querySelector(".edit-day").addEventListener("change", (e) => {
    task.day = e.target.value;
    saveState();
  });
  wrap.querySelector(".edit-priority").addEventListener("change", (e) => {
    task.priority = e.target.value;
    saveState();
  });
  wrap.querySelector(".edit-assignee").addEventListener("change", (e) => {
    task.assignee = e.target.value;
    saveState();
    renderBoard();
  });
  wrap.querySelector(".edit-completed").addEventListener("change", (e) => {
    task.completed = e.target.checked;
    saveState();
  });
  wrap.querySelector(".edit-delete").addEventListener("click", () => deleteTask(task.id));
  wrap.querySelector(".edit-done").addEventListener("click", () => {
    editingTaskId = null;
    renderBoard();
  });

  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      editingTaskId = null;
      renderBoard();
    }
  });

  return wrap;
}

function openTaskModal() {
  const modal = document.getElementById("task-modal");
  const nameInput = document.getElementById("new-task-name");
  const categorySelect = document.getElementById("new-task-category");
  const daySelect = document.getElementById("new-task-day");
  const assigneeSelect = document.getElementById("new-task-assignee");
  const permanentToggle = document.getElementById("new-task-permanent");

  categorySelect.innerHTML = state.categories
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");

  daySelect.innerHTML = [`<option value="">Ikke satt</option>`]
    .concat(state.days.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`))
    .join("");

  const suggestedDay = state.view === "timeline" ? (columnKeysForView()[0] || "") : "";
  if (suggestedDay && suggestedDay !== UDEFINERT_DAG) {
    daySelect.value = suggestedDay;
  }

  if (state.view === "category") {
    categorySelect.value = state.categories[0] || UDEFINERT_ROM;
  }

  nameInput.value = "";
  assigneeSelect.value = "";
  permanentToggle.checked = false;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  nameInput.focus();
}

function closeTaskModal() {
  const modal = document.getElementById("task-modal");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

async function createTaskFromModal() {
  const nameInput = document.getElementById("new-task-name");
  const categorySelect = document.getElementById("new-task-category");
  const daySelect = document.getElementById("new-task-day");
  const assigneeSelect = document.getElementById("new-task-assignee");
  const permanentToggle = document.getElementById("new-task-permanent");

  const title = nameInput.value.trim();
  if (!title) {
    window.alert("Oppgaven må ha en tittel.");
    nameInput.focus();
    return;
  }

  const basePayload = {
    title,
    category: categorySelect.value || UDEFINERT_ROM,
    day: daySelect.value || "",
    assignee: assigneeSelect.value || "",
    priority: "Normal",
    notes: "",
  };

  if (permanentToggle.checked) {
    const createdTask = await savePermanentTask(basePayload);
    if (!createdTask) return;
    state.tasks.push(createdTask);
  } else {
    state.tasks.push({
      id: uid(),
      title: basePayload.title,
      category: basePayload.category,
      day: basePayload.day,
      priority: basePayload.priority,
      completed: false,
      notes: basePayload.notes,
      assignee: basePayload.assignee,
      order: state.tasks.length + 1,
    });
  }

  closeTaskModal();
  saveState();
  renderBoard();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  if (editingTaskId === id) editingTaskId = null;
  saveState();
  renderBoard();
}

async function savePermanentTask(task) {
  if (!window.location.protocol.startsWith("http")) {
    window.alert("For permanente oppgaver må appen kjøres via lokal server (python server.py).");
    return null;
  }

  const payload = {
    title: (task.title || "").trim(),
    category: task.category || UDEFINERT_ROM,
    day: task.day || "",
    assignee: task.assignee || "",
    priority: task.priority || "Normal",
    notes: task.notes || "",
  };

  if (!payload.title) {
    window.alert("Oppgaven må ha en tittel.");
    return null;
  }

  try {
    const resp = await fetch("/api/permanent-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(errText || "Ukjent feil fra server.");
    }

    const data = await resp.json();
    DEFAULT_DATA.tasks.push(data.task);
    return data.task;
  } catch (err) {
    console.error(err);
    window.alert("Klarte ikke lagre permanent oppgave. Sjekk at server.py kjører.");
    return null;
  }
}

function attachColumnDnd(listEl, columnKey) {
  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    listEl.closest(".column").classList.add("is-dragover");
  });
  listEl.addEventListener("dragleave", () => {
    listEl.closest(".column").classList.remove("is-dragover");
  });
  listEl.addEventListener("drop", (e) => {
    e.preventDefault();
    listEl.closest(".column").classList.remove("is-dragover");
    document.getElementById("board")?.classList.remove("board--dragging");
    if (!draggedTaskId) return;

    const task = state.tasks.find((t) => t.id === draggedTaskId);
    if (!task) return;

    const cards = Array.from(listEl.querySelectorAll(".task-card"));
    let insertBeforeId = null;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        insertBeforeId = card.dataset.id;
        break;
      }
    }

    if (state.view === "category") {
      task.category = columnKey;
    } else {
      task.day = columnKey === UDEFINERT_DAG ? "" : columnKey;
    }

    let colTasks = state.tasks
      .filter((t) => taskMatchesColumn(t, columnKey) && t.id !== task.id)
      .sort((a, b) => a.order - b.order);

    let insertAt = colTasks.length;
    if (insertBeforeId) {
      const idx = colTasks.findIndex((t) => t.id === insertBeforeId);
      if (idx !== -1) insertAt = idx;
    }
    colTasks.splice(insertAt, 0, task);
    colTasks.forEach((t, i) => {
      t.order = i + 1;
    });

    saveState();
    renderBoard();
  });
}

function setupToolbar() {
  document.querySelectorAll(".viewtabs__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      editingTaskId = null;
      document.querySelectorAll(".viewtabs__btn").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      updateLayoutModeUI();
      updateShowDateToggleUI();
      renderBoard();
    });
  });

  document.getElementById("show-date-toggle").addEventListener("change", (e) => {
    state.showDateMetadata = e.target.checked;
    saveState();
    renderBoard();
  });

  document.getElementById("layout-horizontal-btn").addEventListener("click", () => {
    state.layoutMode = "horizontal";
    saveState();
    updateLayoutModeUI();
    renderBoard();
  });

  document.getElementById("layout-vertical-btn").addEventListener("click", () => {
    state.layoutMode = "vertical";
    saveState();
    updateLayoutModeUI();
    renderBoard();
  });

  document.getElementById("search-input").addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    renderBoard();
  });

  document.getElementById("priority-filter").addEventListener("change", (e) => {
    state.filters.priority = e.target.value;
    renderBoard();
  });

  document.getElementById("show-completed-toggle").addEventListener("change", (e) => {
    state.filters.showCompleted = e.target.checked;
    renderBoard();
  });

  document.getElementById("show-meg-toggle").addEventListener("change", (e) => {
    state.filters.showMeg = e.target.checked;
    renderBoard();
  });

  document.getElementById("save-project-btn").addEventListener("click", () => {
    saveCurrentProject();
  });

  document.getElementById("load-project-btn").addEventListener("click", () => {
    loadSelectedProject();
  });

  document.getElementById("project-select").addEventListener("change", (e) => {
    activeProjectId = e.target.value || "";
    saveProjects();
  });

  document.getElementById("deadline-date").addEventListener("change", (e) => {
    if (!e.target.value) {
      window.alert("Ankomstdato er obligatorisk.");
      e.target.value = state.deadlineDate;
      return;
    }
    state.deadlineDate = e.target.value;
    document.getElementById("required-date-input").value = state.deadlineDate;
    saveState();
    ensureDateGate();
    renderBoard();
  });

  document.getElementById("required-date-save").addEventListener("click", () => {
    const input = document.getElementById("required-date-input");
    if (!input.value) {
      window.alert("Velg en gyldig ankomstdato.");
      return;
    }
    state.deadlineDate = input.value;
    document.getElementById("deadline-date").value = state.deadlineDate;
    saveState();
    ensureDateGate();
    renderBoard();
  });

  document.getElementById("add-task-btn").addEventListener("click", () => {
    openTaskModal();
  });

  document.getElementById("new-task-cancel").addEventListener("click", () => {
    closeTaskModal();
  });

  document.getElementById("new-task-save").addEventListener("click", async () => {
    await createTaskFromModal();
  });

  document.getElementById("task-modal").addEventListener("click", (e) => {
    if (e.target.id === "task-modal") {
      closeTaskModal();
    }
  });

  document.getElementById("reset-btn").addEventListener("click", resetToDefaults);
  document.getElementById("print-category-btn").addEventListener("click", () => printView("category"));
  document.getElementById("print-timeline-btn").addEventListener("click", () => printView("timeline"));
}

function updateFooterSummary() {
  const total = state.tasks.length;
  const remaining = state.tasks.filter((t) => !t.completed).length;
  document.getElementById("task-count-summary").textContent =
    `${remaining} av ${total} oppgaver gjenstår`;
}

function printDateLabel() {
  if (!state.deadlineDate) return "Ingen ankomstdato valgt";
  const d = new Date(state.deadlineDate + "T00:00:00");
  return "Ankomst: " + d.toLocaleDateString("nb-NO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildPrintCategory() {
  document.getElementById("print-category-date").textContent = printDateLabel();
  const body = document.getElementById("print-category-body");
  body.innerHTML = "";

  const keys = state.categories;
  let anyGroup = false;

  keys.forEach((key) => {
    const items = state.tasks
      .filter((t) => t.category === key && !t.completed)
      .sort((a, b) => a.order - b.order);
    if (items.length === 0) return;
    anyGroup = true;

    const group = document.createElement("div");
    group.className = "print-group";
    group.innerHTML = `<div class="print-group__title">${escapeHtml(key)}</div>`;
    items.forEach((t) => group.appendChild(buildPrintRow(t, t.day ? labelWithDate(t.day) : "")));
    body.appendChild(group);
  });

  if (!anyGroup) {
    body.innerHTML = '<p class="print-empty-note">Alle oppgaver er fullført - ingenting å skrive ut.</p>';
  }
}

function buildPrintTimeline() {
  document.getElementById("print-timeline-date").textContent = printDateLabel();
  const body = document.getElementById("print-timeline-body");
  body.innerHTML = "";

  const keys = state.days.concat([UDEFINERT_DAG]);
  let anyGroup = false;

  keys.forEach((key) => {
    const items = state.tasks
      .filter((t) => (key === UDEFINERT_DAG ? !t.day : t.day === key) && !t.completed)
      .sort((a, b) => a.order - b.order);
    if (items.length === 0) return;
    anyGroup = true;

    const title = key === UDEFINERT_DAG ? UDEFINERT_DAG : labelWithDate(key);
    const group = document.createElement("div");
    group.className = "print-group";
    group.innerHTML = `<div class="print-group__title">${escapeHtml(title)}</div>`;
    items.forEach((t) => group.appendChild(buildPrintRow(t, t.category || UDEFINERT_ROM)));
    body.appendChild(group);
  });

  if (!anyGroup) {
    body.innerHTML = '<p class="print-empty-note">Alle oppgaver er fullført - ingenting å skrive ut.</p>';
  }
}

function buildPrintRow(task, sideLabel) {
  const priorityLabel = task.priority === "Kritisk" ? "🔥" : (task.priority === "Normal" ? "" : task.priority);
  const metaParts = [priorityLabel, sideLabel].filter(Boolean);
  const row = document.createElement("div");
  row.className = "print-row";
  row.innerHTML = `
    <div class="print-row__box"></div>
    <div class="print-row__main">
      <div class="print-row__title">${escapeHtml(task.title)}</div>
      <div class="print-row__meta">${metaParts.map((p) => escapeHtml(p)).join(" &middot; ")}</div>
      ${task.notes ? `<div class="print-row__notes">${escapeHtml(task.notes)}</div>` : ""}
    </div>
  `;
  return row;
}

function printView(which) {
  if (which === "category") {
    buildPrintCategory();
    document.body.classList.add("printing-category");
  } else {
    buildPrintTimeline();
    document.body.classList.add("printing-timeline");
  }
  window.print();
}

window.addEventListener("afterprint", () => {
  document.body.classList.remove("printing-category", "printing-timeline");
});

function init() {
  loadProjects();
  loadState();
  setupToolbar();
  updateProjectSelectUI();
  updateLayoutModeUI();
  updateShowDateToggleUI();

  if (state.deadlineDate) {
    document.getElementById("deadline-date").value = state.deadlineDate;
    document.getElementById("required-date-input").value = state.deadlineDate;
  }

  ensureDateGate();
  renderBoard();
}

document.addEventListener("DOMContentLoaded", init);

