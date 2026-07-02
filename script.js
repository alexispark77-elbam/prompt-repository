const state = {
  cards: [],
  filter: "ALL",
  query: "",
};

const els = {
  grid: document.getElementById("cardsGrid"),
  search: document.getElementById("searchInput"),
  filters: document.getElementById("filterGroup"),
  count: document.getElementById("countPill"),
  status: document.getElementById("sheetStatus"),
  refresh: document.getElementById("refreshButton"),
  empty: document.getElementById("emptyState"),
  toast: document.getElementById("toast"),
};

const columnAliases = {
  name: ["name", "title", "card", "카드명", "이름", "제목"],
  category: ["category", "type", "kind", "분류", "유형", "카테고리"],
  thumbnail: ["thumbnail", "thumb", "image", "image_url", "thumbnail_url", "이미지", "썸네일"],
  prompt: ["prompt", "copy", "text", "content", "프롬프트", "내용", "본문"],
  tags: ["tags", "tag", "keyword", "keywords", "태그", "키워드"],
};

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function pick(row, aliases) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
  );

  for (const alias of aliases) {
    const key = normalizeKey(alias);
    if (normalizedRow[key] !== undefined && String(normalizedRow[key]).trim() !== "") {
      return String(normalizedRow[key]).trim();
    }
  }

  return "";
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);

  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => String(header || "").trim());

  return rows.slice(1).map((values) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index] || "";
    });
    return item;
  });
}

function convertRowsToCards(rows) {
  return rows
    .filter((row) => {
      const published = String(row.published ?? row.PUBLISHED ?? "true").trim().toLowerCase();
      return !["false", "0", "no", "n", "미게시"].includes(published);
    })
    .map((row, index) => {
      const name = pick(row, columnAliases.name) || `Untitled ${index + 1}`;
      const category = (pick(row, columnAliases.category) || "PROMPT").toUpperCase();
      const thumbnail = pick(row, columnAliases.thumbnail);
      const prompt = pick(row, columnAliases.prompt);
      const tags = pick(row, columnAliases.tags);

      return {
        id: `${index}-${name}`,
        name,
        category,
        thumbnail: resolveImageUrl(thumbnail),
        prompt,
        tags,
        searchText: [name, category, prompt, tags].join(" ").toLowerCase(),
      };
    })
    .filter((card) => card.name || card.prompt || card.thumbnail);
}

function resolveImageUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) return raw;

  const cleanBase = String(window.IMAGE_BASE_URL || "").trim().replace(/\/$/, "");
  const cleanPath = raw.replace(/^\.\//, "").replace(/^\//, "");

  if (cleanBase) return `${cleanBase}/${cleanPath}`;
  return `/${cleanPath}`;
}

function cacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

async function fetchText(url) {
  const response = await fetch(cacheBust(url), { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function extractGoogleSheetInfo(url) {
  try {
    const parsed = new URL(url);
    const idMatch = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!idMatch || idMatch[1] === "e") return null;
    return {
      id: idMatch[1],
      gid: parsed.searchParams.get("gid") || "0",
    };
  } catch (error) {
    return null;
  }
}

function googleValueToString(cell) {
  if (!cell) return "";
  if (cell.f !== undefined && cell.f !== null) return String(cell.f);
  if (cell.v !== undefined && cell.v !== null) return String(cell.v);
  return "";
}

function fetchGoogleSheetRowsByJsonp(sheetUrl) {
  const info = extractGoogleSheetInfo(sheetUrl);
  if (!info) return Promise.reject(new Error("Not a normal Google Sheets gviz URL"));

  return new Promise((resolve, reject) => {
    const callbackName = `__sheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let done = false;

    function cleanup() {
      done = true;
      delete window[callbackName];
      script.remove();
    }

    const timer = setTimeout(() => {
      if (done) return;
      cleanup();
      reject(new Error("Google Sheets JSONP timeout"));
    }, 12000);

    window[callbackName] = (response) => {
      clearTimeout(timer);
      if (!response || response.status !== "ok" || !response.table) {
        cleanup();
        reject(new Error("Google Sheets JSONP error"));
        return;
      }

      const columns = response.table.cols.map((col) => String(col.label || col.id || "").trim());
      const rows = response.table.rows.map((googleRow) => {
        const item = {};
        columns.forEach((header, index) => {
          if (!header) return;
          item[header] = googleValueToString(googleRow.c[index]);
        });
        return item;
      });

      cleanup();
      resolve(rows);
    };

    const gvizUrl = new URL(`https://docs.google.com/spreadsheets/d/${info.id}/gviz/tq`);
    gvizUrl.searchParams.set("gid", info.gid);
    gvizUrl.searchParams.set("tqx", `responseHandler:${callbackName};out:json`);
    gvizUrl.searchParams.set("v", String(Date.now()));

    script.src = gvizUrl.toString();
    script.onerror = () => {
      clearTimeout(timer);
      if (done) return;
      cleanup();
      reject(new Error("Google Sheets JSONP script error"));
    };
    document.head.appendChild(script);
  });
}

async function loadRowsFromSheet(sheetUrl) {
  try {
    const csvText = await fetchText(sheetUrl);
    return { rows: parseCSV(csvText), method: "csv" };
  } catch (csvError) {
    console.warn("CSV fetch failed. Trying Google Sheets JSONP fallback.", csvError);
    const rows = await fetchGoogleSheetRowsByJsonp(sheetUrl);
    return { rows, method: "google" };
  }
}

async function loadCards() {
  els.refresh.disabled = true;
  els.status.classList.remove("error");
  els.status.textContent = "Loading sheet…";

  const sheetUrl = String(window.SHEET_CSV_URL || "").trim();
  const fallbackUrl = String(window.LOCAL_FALLBACK_CSV || "./google_sheet_template.csv").trim();

  try {
    let rows;
    let method;

    if (sheetUrl) {
      const result = await loadRowsFromSheet(sheetUrl);
      rows = result.rows;
      method = result.method;
    } else {
      const fallbackText = await fetchText(fallbackUrl);
      rows = parseCSV(fallbackText);
      method = "sample";
    }

    state.cards = convertRowsToCards(rows);
    els.status.textContent = method === "sample"
      ? `Sample data · ${state.cards.length} cards`
      : `Sheet connected · ${state.cards.length} cards`;
    render();
  } catch (error) {
    console.error(error);

    try {
      const fallbackText = await fetchText(fallbackUrl);
      state.cards = convertRowsToCards(parseCSV(fallbackText));
      els.status.classList.add("error");
      els.status.textContent = `Sheet error · sample ${state.cards.length} cards`;
      render();
    } catch (fallbackError) {
      console.error(fallbackError);
      state.cards = [];
      els.status.classList.add("error");
      els.status.textContent = "Sheet error";
      render();
    }
  } finally {
    els.refresh.disabled = false;
  }
}

function getVisibleCards() {
  const keyword = state.query.trim().toLowerCase();

  return state.cards.filter((card) => {
    const matchesFilter = state.filter === "ALL" || card.category === state.filter;
    const matchesSearch = !keyword || card.searchText.includes(keyword);
    return matchesFilter && matchesSearch;
  });
}

function render() {
  const visible = getVisibleCards();
  if (els.count) els.count.textContent = `${visible.length} CARDS`;
  els.grid.innerHTML = "";

  if (visible.length === 0) {
    els.empty.classList.remove("hidden");
    return;
  }

  els.empty.classList.add("hidden");

  const fragment = document.createDocumentFragment();
  visible.forEach((card) => fragment.appendChild(createCard(card)));
  els.grid.appendChild(fragment);
}

function createCard(card) {
  const article = document.createElement("article");
  article.className = "card";

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "thumb-wrap";

  const img = document.createElement("img");
  img.className = card.thumbnail ? "thumb" : "thumb placeholder";
  img.alt = card.name;
  img.loading = "lazy";
  if (card.thumbnail) img.src = card.thumbnail;
  img.onerror = () => {
    img.className = "thumb placeholder";
    img.removeAttribute("src");
  };

  const favorite = document.createElement("span");
  favorite.className = "favorite-badge";
  favorite.setAttribute("aria-hidden", "true");
  favorite.textContent = "♡";

  thumbWrap.append(img, favorite);

  const body = document.createElement("div");
  body.className = "card-body";

  const category = document.createElement("div");
  category.className = "card-category";
  category.textContent = card.category || "ETC";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = card.name;
  title.title = card.name;

  const copyButton = document.createElement("button");
  copyButton.className = "copy-button";
  copyButton.type = "button";
  copyButton.innerHTML = '<span class="copy-icon" aria-hidden="true">▱</span><span>PROMPT COPY</span>';
  copyButton.addEventListener("click", () => copyPrompt(card.prompt));

  body.append(category, title, copyButton);
  article.append(thumbWrap, body);

  return article;
}

function displayCategory(category) {
  const map = {
    SLIDE: "SLIDE",
    PHOTO: "PHOTO",
    TRAVEL: "TRAVEL",
    FOOD: "FOOD",
    LIFE: "LIFE",
    ETC: "ETC",
  };
  return map[category] || category || "ETC";
}

async function copyPrompt(text) {
  const prompt = String(text || "").trim();

  if (!prompt) {
    showToast("EMPTY PROMPT");
    return;
  }

  try {
    await navigator.clipboard.writeText(prompt);
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = prompt;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  showToast("PROMPT COPIED");
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1300);
}

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.filters.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-button");
  if (!button) return;

  state.filter = button.dataset.filter;
  document.querySelectorAll(".filter-button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  render();
});

els.refresh.addEventListener("click", loadCards);

loadCards();
