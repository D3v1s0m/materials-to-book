const searchEl = document.getElementById("search");
const itemListEl = document.getElementById("itemList");
const addedSectionEl = document.getElementById("addedSection");
const addedListEl = document.getElementById("addedList");
const statusEl = document.getElementById("status");
const closeBtn = document.getElementById("closeBtn");
const deleteBtn = document.getElementById("deleteBtn");
const addItemBtn = document.getElementById("addItemBtn");

let currentFile = null;

init();

async function init() {
  currentFile = await loadLastFile();

  if (!currentFile) {
    statusEl.textContent = "No file loaded.";
    return;
  }

  render();
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length === 0) return [];

  const header = parseCSVLine(lines[0]);
  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (!row.length) continue;

    const obj = {};

    for (let j = 0; j < header.length; j++)
      obj[header[j]] = row[j] ?? "";

    out.push(obj);
  }

  return out;
}

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  out.push(cur);

  return out;
}

function render() {
  const rows = parseCSV(currentFile.content);
  const filter = searchEl.value.trim().toLowerCase();

  itemListEl.innerHTML = "";

  rows.forEach((row, index) => {

    if (filter && !row.Item.toLowerCase().includes(filter))
      return;

    const ignored = currentFile.edits.ignored.original.includes(index);

    const div = document.createElement("div");
    div.className = "item-row";

    div.innerHTML = `
            <label class="ignore">
                <input type="checkbox" ${ignored ? "checked" : ""}>
            </label>

            <span class="item-name ${ignored ? "ignored" : ""}">${row.Item}</span>
        `;

    div.querySelector("input").addEventListener("change", async e => {

      const list = currentFile.edits.ignored.original;

      if (e.target.checked) {
        if (!list.includes(index))
          list.push(index);
      } else {
        currentFile.edits.ignored.original =
          list.filter(v => v !== index);
      }

      await saveCurrentFile();
    });

    itemListEl.appendChild(div);
  });

  addedSectionEl.hidden = true;
}

async function saveCurrentFile() {

  const db = await openDB();

  const tx = db.transaction("files", "readwrite");

  tx.objectStore("files").put(currentFile);

  statusEl.textContent = "Saved";

  localStorage.setItem(
    "csv-editor-updated",
    Date.now().toString()
  );
}

searchEl.addEventListener("input", render);

closeBtn.addEventListener("click", () => window.close());

deleteBtn.addEventListener("click", () => {
  alert("Coming soon.");
});

addItemBtn.addEventListener("click", () => {
  alert("Coming soon.");
});