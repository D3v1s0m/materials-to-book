(function(){
  const CHAR_WIDTHS = Object.assign({
    ' ':4,'!':2,'"':5,'#':6,'$':6,'%':6,'&':6,'\'':3,'(':5,')':5,'*':5,'+':6,',':2,'-':6,'.':2,'/':6,':':2,';':2,'<':5,'=':6,'>':5,'?':6,'@':7
  }, (function(){
    const m={};'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('').forEach(c=>m[c]=6);return m;})());
  const DEFAULT_WIDTH = 6;
  let BOOK_WIDTH = 114;
  let LINES_PER_PAGE = 14;

  function charWidth(c){return CHAR_WIDTHS[c]||DEFAULT_WIDTH}
  function textWidth(text){let w=0;for(let i=0;i<text.length;i++)w+=charWidth(text[i]);return w}

  function wrapMinecraftLine(text,maxWidth=BOOK_WIDTH){
    const result=[];
    text = String(text);
    if(text.length === 0){ return [''] }
    while(text.length){
      if(textWidth(text) <= maxWidth){ result.push(text); break }
      let width=0, splitPos=0, lastSpace=-1;
      for(let i=0;i<text.length;i++){
        const ch = text[i]; width += charWidth(ch);
        if(ch===' ') lastSpace = i;
        if(width>maxWidth){ splitPos = lastSpace !== -1 ? lastSpace : i; break }
      }
      if(splitPos<=0) splitPos = 1;
      let line = text.slice(0, splitPos);
      result.push(line);
      text = text.slice(splitPos);
      if(text.startsWith(' ')) text = text.slice(1);
    }
    return result;
  }

  function applyEdits(rows, edits) {
      const out = rows.filter((_, i) => !edits.ignored.original.includes(i));

      const added = (edits.added || []).filter((_, i) => !edits.ignored.added.includes(i));

      return [...out, ...added].sort((a, b) => {
          const totalA = Number(a.Total || a.total || 0);
          const totalB = Number(b.Total || b.total || 0);
          const countDiff = totalB - totalA;

          if (countDiff !== 0) {
              return countDiff;
          }

          const nameA = String(a.Item || '').trim().toLowerCase();
          const nameB = String(b.Item || '').trim().toLowerCase();
          return nameA.localeCompare(nameB);
      });
  }

  // DOM helpers
  const $ = sel => document.querySelector(sel);
  const state = {
    originalRows: [], rows: [], pages: [], currentPage: 0
  };

  // Elements
  const filenameEl = $('#filename');
  const totalItemsEl = $('#totalItems');
  const generatedPagesEl = $('#generatedPages');
  const dropzone = $('#dropzone');
  const fileInput = $('#fileInput');
  const browseBtn = $('#browseBtn');
  const authorEl = $('#author');
  const enableHeaderEl = $('#enableHeader');
  const headerTextEl = $('#headerText');
  const enableFooterEl = $('#enableFooter');
  const footerTextEl = $('#footerText');
  const includeSummaryEl = $('#includeSummary');
  const showListHeaderEl = $('#showListHeader');
  const repeatListHeaderEl = $('#repeatListHeader');
  const enableChecklistEl = $('#enableChecklist');
  const checklistStyleEl = $('#checklistStyle');
  const itemFormatEl = $('#itemFormat');
  const baseValueModeEl = $('#baseValueMode');
  const considerAvailableEl = $('#considerAvailable');
  const showStackEl = $('#showStack');
  const showShulkerEl = $('#showShulker');
  const shulkerThresholdEl = $('#shulkerThreshold');
  const pageWidthEl = $('#pageWidth');
  const linesPerPageEl = $('#linesPerPage');
  const previewModeEl = $('#previewMode');
  const blit = $('#blit');
  const bookTextLeft = $('#bookTextLeft');
  const bookTextRight = $('#bookTextRight');
  const labelLeft = $('#labelLeft');
  const labelRight = $('#labelRight');
  const statPages = $('#statPages');
  const statItems = $('#statItems');
  const statView = $('#statView');
  const bookCanvas = $('#bookCanvas');
  const bookCtx = bookCanvas.getContext && bookCanvas.getContext('2d');
  const texVanilla = new Image(); texVanilla.src = 'assets/book.png';
  const texTwo = new Image(); texTwo.src = 'assets/book_2.png';
  texVanilla.onload = () => renderAll();
  texTwo.onload = () => renderAll();
  const prevPageBtn = $('#prevPage');
  const nextPageBtn = $('#nextPage');
  const pageLabel = $('#pageLabel');
  const copyBtn = $('#copyBtn');
  const downloadBtn = $('#downloadBtn');
  const toggleJsonBtn = $('#toggleJson');
  const jsonBlock = $('#jsonBlock');
  const jsonPreview = $('#jsonPreview');

  const editorModal = $('#editorModal');
  const editorSearch = $('#editorSearch');
  const editorItemList = $('#editorItemList');
  const editorAddedSection = $('#editorAddedSection');
  const editorAddedList = $('#editorAddedList');
  const closeEditorBtn = $('#closeEditorBtn');
  const editorStatus = $('#editorStatus');
  const deleteCacheBtn = $('#deleteCacheBtn');
  const addItemBtn = $('#addItemBtn');
  const addItemPopup = $('#addItemPopup');
  const addItemName = $('#addItemName');
  const addItemTitle = $('#addItemTitle');
  const addItemTotal = $('#addItemTotal');
  const addItemShulkers = $('#addItemShulkers');
  const addItemStacks = $('#addItemStacks');
  const addItemItems = $('#addItemItems');
  const addItemAmountFields = [addItemTotal, addItemShulkers, addItemStacks, addItemItems];
  const addItemIcon = $('#addItemIcon');
  const addItemIconPlaceholder = $('#addItemIconPlaceholder');
  const addItemSuggestions = $('#addItemSuggestions');
  const addItemAmountHint = $('#addItemAmountHint');
  const confirmAddItemBtn = $('#confirmAddItemBtn');
  const cancelAddItemBtn = $('#cancelAddItemBtn');

  let stackSizes = {};
  let itemCatalog = [];
  let selectedAddItem = null;
  let editingAddedIndex = null;

  function sanitizeSpriteName(name) {
      return String(name || '').trim().replace(/[\\/:*?"<>|]/g, '');
  }

  function getItemIconUrl(itemName) {
      const entry = itemCatalog.find(item => String(item.name || '').toLowerCase() === String(itemName || '').trim().toLowerCase());

      if (!entry || !entry.id) {
          return '';
      }

      const id = entry.id.replace("minecraft:", "");

      const safeName = encodeURIComponent(sanitizeSpriteName(itemName || entry.name || ''));
      return `https://ofekn-mods.github.io/sprites/items/${id}-${safeName}.png`;
  }

  function getItemDisplayMarkup(itemName) {
      const iconUrl = getItemIconUrl(itemName);
      return `
        <span class="item-inline">
          ${iconUrl ? `<img class="editor-item-icon" src="${iconUrl}" alt="${itemName}" onerror="this.style.display='none'">` : ''}
          <span>${itemName || ''}</span>
        </span>
      `;
  }

  function getSuggestionMarkup(itemName) {
      const iconUrl = getItemIconUrl(itemName);
      return `
        <span class="item-inline">
          ${iconUrl ? `<img class="editor-item-icon" src="${iconUrl}" alt="${itemName}" onerror="this.style.display='none'">` : ''}
          <span>${itemName || ''}</span>
        </span>
      `;
  }

  async function cacheStackSizes() {
      const response = await fetch('./assets/stack_sizes.json');
      const items = await response.json();

      itemCatalog = Array.isArray(items) ? items : [];
      stackSizes = Object.fromEntries(
          items.map(item => [item.name, item.stackSize])
      );
  }

  (async () => {
    await cacheStackSizes();

    const settings = await loadSettings();
    applySettings(settings);
    
    try {
      const saved = await loadLastFile();

      if (!saved) {
        editBtn.disabled = true;
        nextPageBtn.disabled = true;
        prevPageBtn.disabled = true;
        return;
      }

      editBtn.disabled = false;
      nextPageBtn.disabled = false;
      prevPageBtn.disabled = false;
    
      filenameEl.textContent = saved.filename;
      state.originalRows = parseCSV(saved.content);
      state.rows = applyEdits(state.originalRows, saved.edits);
      totalItemsEl.textContent = state.rows.length;
      renderAll();
    } catch (err) {
      console.error('Failed to restore saved CSV', err);
    }
  })();

  function getSettings() {
    return {
      author: authorEl.value,

      enableHeader: enableHeaderEl.checked,
      headerText: headerTextEl.value,

      enableFooter: enableFooterEl.checked,
      footerText: footerTextEl.value,

      includeSummary: includeSummaryEl.checked,
      showListHeader: showListHeaderEl.checked,
      repeatListHeader: repeatListHeaderEl.checked,

      enableChecklist: enableChecklistEl.checked,
      checklistStyle: checklistStyleEl.value,

      itemFormat: itemFormatEl.value,

      baseValueMode: baseValueModeEl.value,
      considerAvailable: considerAvailableEl.checked,

      showStack: showStackEl.checked,
      showShulker: showShulkerEl.checked,
      shulkerThreshold: shulkerThresholdEl.value,

      pageWidth: pageWidthEl.value,
      linesPerPage: linesPerPageEl.value,

      previewMode: previewModeEl.value
    };
  }

  function applySettings(settings) {
    if (!settings) return;

    authorEl.value = settings.author ?? 'D3v1s0m';

    enableHeaderEl.checked = settings.enableHeader ?? false;
    headerTextEl.disabled = !settings.enableHeader ?? true;
    headerTextEl.value = settings.headerText ?? '';

    enableFooterEl.checked = settings.enableFooter ?? false;
    footerTextEl.disabled = !settings.enableFooter ?? true;
    footerTextEl.value = settings.footerText ?? '';

    includeSummaryEl.checked = settings.includeSummary ?? true;
    showListHeaderEl.checked = settings.showListHeader ?? true;
    repeatListHeaderEl.checked = settings.repeatListHeader ?? false;

    enableChecklistEl.checked = settings.enableChecklist ?? false;
    checklistStyleEl.value = settings.checklistStyle ?? 'unicode';

    itemFormatEl.value = settings.itemFormat ?? '{check} {item}: {total}';

    baseValueModeEl.value = settings.baseValueMode ?? 'total';
    considerAvailableEl.checked = settings.considerAvailable ?? false;

    showStackEl.checked = settings.showStack ?? true;
    showShulkerEl.disabled = !showStackEl.checked
    showShulkerEl.checked = settings.showShulker ?? true;
    shulkerThresholdEl.disabled = !(showStackEl.checked && showShulkerEl.checked)
    shulkerThresholdEl.value = settings.shulkerThreshold ?? 27;

    pageWidthEl.value = settings.pageWidth ?? 114;
    linesPerPageEl.value = settings.linesPerPage ?? 14;

    previewModeEl.value = settings.previewMode ?? 'book';
  }

  async function saveSettings() {
    const db = await openDB();

    const tx = db.transaction('settings', 'readwrite');

    tx.objectStore('settings').put(
      getSettings(),
      'ui'
    );
  }

  async function loadSettings() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const req = db
        .transaction('settings', 'readonly')
        .objectStore('settings')
        .get('ui');

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  [
    authorEl,
    enableHeaderEl,
    headerTextEl,
    enableFooterEl,
    footerTextEl,
    includeSummaryEl,
    showListHeaderEl,
    repeatListHeaderEl,
    enableChecklistEl,
    checklistStyleEl,
    itemFormatEl,
    baseValueModeEl,
    considerAvailableEl,
    showStackEl,
    showShulkerEl,
    shulkerThresholdEl,
    pageWidthEl,
    linesPerPageEl,
    previewModeEl
  ].forEach(el => {
    el.addEventListener('change', saveSettings);
    el.addEventListener('input', saveSettings);
  });

  // Wire up file input
  browseBtn.addEventListener('click', ()=>fileInput.click());
  fileInput.addEventListener('change',e=>{
    const f = e.target.files[0]; if(!f) return; handleFile(f);
  });

  let dragCounter = 0;
  dropzone.addEventListener("dragenter",e=>{e.preventDefault();dragCounter++;dropzone.classList.add("hover");});
  dropzone.addEventListener("dragover",e=>e.preventDefault());
  dropzone.addEventListener("dragleave",e=>{e.preventDefault();if(--dragCounter<=0){dragCounter=0;dropzone.classList.remove("hover");}});
  dropzone.addEventListener("drop",e=>{e.preventDefault();dragCounter=0;dropzone.classList.remove("hover");const f=e.dataTransfer.files[0];if(f)handleFile(f);});

  function handleFile(file){
    filenameEl.textContent = file.name;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result;

        await saveFile(file.name, text);

        state.originalRows = parseCSV(text);
        state.rows = state.originalRows;
        editBtn.disabled = false;
        nextPageBtn.disabled = false;
        prevPageBtn.disabled = false;
        totalItemsEl.textContent = state.rows.length;
        renderAll();
      } catch(err) {
        alert('Invalid CSV: ' + err.message);
      }
    };
    reader.readAsText(file,'utf-8');
  }

  // Editor
  editBtn.addEventListener("click", openEditor);

  let editorFile = null;

  async function openEditor() {
    editorFile = await loadLastFile();

    if (!editorFile)
      return;

    editorFile.edits = editorFile.edits || { ignored: { original: [], added: [] }, added: [] };
    editorFile.edits.ignored = editorFile.edits.ignored || { original: [], added: [] };
    editorFile.edits.added = editorFile.edits.added || [];
    addItemBtn.disabled = false;
    editorModal.hidden = false;
    renderEditor();
  }

  editorSearch.addEventListener("input", renderEditor);

  closeEditorBtn.addEventListener("click", () => {
    editorModal.hidden = true;
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !editorModal.hidden)
      editorModal.hidden = true;
  });

  editorModal.addEventListener("click", e => {
      if (e.target === editorModal)
        editorModal.hidden = true;
  });

  deleteCacheBtn.addEventListener("click", deleteCachedFile);

  async function deleteCachedFile() {
      if (!editorFile)
        return;

      if (!confirm(`Delete "${editorFile.filename}" from the cache?`))
        return;

      const db = await openDB();

      await new Promise((resolve, reject) => {
        const tx = db.transaction(["files", "meta"], "readwrite");

        editorFile.deletedAt = Date.now();

        tx.objectStore("files").put(editorFile);
        tx.objectStore("meta").delete("lastOpened");

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });

    editorModal.hidden = true;

    editorFile = null;
    state.rows = [];

    filenameEl.textContent = "—";
    totalItemsEl.textContent = "0";
    generatedPagesEl.textContent = "0";

    editBtn.disabled = true;

    renderAll();
  }

  let editorRows = [];

  function renderAddedItems(filter) {
    const addedRows = Array.isArray(editorFile.edits.added) ? editorFile.edits.added : [];
    editorAddedList.innerHTML = "";

    if (addedRows.length === 0) {
      editorAddedSection.hidden = true;
      return;
    }

    editorAddedSection.hidden = false;

    addedRows.forEach((row, index) => {
      if (filter && !String(row.Item || '').toLowerCase().includes(filter)) {
        return;
      }

      const ignored = editorFile.edits.ignored.added.includes(index);

      const div = document.createElement("div");
      div.className = "editor-row added";

      div.innerHTML = `
        <input type="checkbox" ${ignored ? "checked" : ""}>
        <span class="editor-item ${ignored ? "ignored" : ""}">${getItemDisplayMarkup(row.Item)}</span>
        <span class="editor-total ${ignored ? "ignored" : ""}">${Number(row.Total || 0).toLocaleString()}</span>
        <button type="button" class="editor-edit-btn">Edit</button>
        <button type="button" class="editor-remove-btn">Remove</button>
      `;

      const checkbox = div.querySelector("input");
      const item = div.querySelector(".editor-item");
      const total = div.querySelector(".editor-total");
      const editBtn = div.querySelector(".editor-edit-btn");
      const removeBtn = div.querySelector(".editor-remove-btn");

      checkbox.addEventListener("change", async e => {
        const list = editorFile.edits.ignored.added;

        if (e.target.checked) {
          if (!list.includes(index)) {
            list.push(index);
            list.sort((a,b)=>a-b);
          }
        } else {
          editorFile.edits.ignored.added = list.filter(v => v !== index);
        }

        item.classList.toggle("ignored", e.target.checked);
        total.classList.toggle("ignored", e.target.checked);

        await saveEditorFile();
      });

      editBtn.addEventListener("click", (e) => {
        openAddItemPopup(e, index);
      });

      removeBtn.addEventListener("click", async () => {
        editorFile.edits.added.splice(index, 1);
        editorFile.edits.ignored.added = (editorFile.edits.ignored.added || [])
          .filter(v => v !== index)
          .map(v => (v > index ? v - 1 : v));

        editorStatus.textContent = `Removed ${row.Item}`;
        await saveEditorFile();
        renderEditor();
      });

      editorAddedList.appendChild(div);
    });
  }

  function renderEditor() {

    editorRows = parseCSV(editorFile.content);
    const filter = editorSearch.value.trim().toLowerCase();

    editorItemList.innerHTML = "";

    editorRows.forEach((row, index) => {

      if (filter && !String(row.Item || '').toLowerCase().includes(filter))
        return;

      const ignored = editorFile.edits.ignored.original.includes(index);

      const div = document.createElement("div");
      div.className = "editor-row";

      div.innerHTML = `
        <input type="checkbox" ${ignored ? "checked" : ""}>
        <span class="editor-item ${ignored ? "ignored" : ""}">${getItemDisplayMarkup(row.Item)}</span>
        <span class="editor-total ${ignored ? "ignored" : ""}">${Number(row.Total).toLocaleString()}</span>
      `;

      const checkbox = div.querySelector("input");
      const item = div.querySelector(".editor-item");
      const total = div.querySelector(".editor-total");

      checkbox.addEventListener("change", async e => {

        const list = editorFile.edits.ignored.original;

        if (e.target.checked) {
          if (!list.includes(index)) {
            list.push(index);
            list.sort((a,b)=>a-b);
          }
        } else {
          editorFile.edits.ignored.original = list.filter(v => v !== index);
        }

        item.classList.toggle("ignored", e.target.checked);
        total.classList.toggle("ignored", e.target.checked);

        await saveEditorFile();

      });

      editorItemList.appendChild(div);

    });

    renderAddedItems(filter);

  }

  async function saveEditorFile() {

    const db = await openDB();

    await new Promise((resolve, reject) => {

      const tx = db.transaction("files", "readwrite");

      tx.objectStore("files").put(editorFile);

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);

    });

    editorStatus.textContent = "Saved";

    state.rows = applyEdits(
      editorRows,
      editorFile.edits
    );

    totalItemsEl.textContent = state.rows.length;

    renderAll();

  }

  function getStackSize() {
    return Number(selectedAddItem?.stackSize) || 64;
  }

  function getAmountBreakdown(total) {
    const stackSize = getStackSize();
    const totalValue = Math.max(0, Number(total) || 0);
    const stacks = Math.floor(totalValue / stackSize);
    const rem = totalValue % stackSize;
    const threshold = 27;
    const shulkers = Math.floor(stacks / threshold);
    const remStacks = stacks % threshold;

    return {
      total: totalValue,
      shulkers,
      stacks: remStacks,
      items: rem
    };
  }

  function setAddItemAmountEnabled(enabled) {
    addItemAmountFields.forEach(field => {
      field.disabled = !enabled;
    });
  }

  function syncAddItemIconVisibility(showRealIcon) {
    addItemIcon.hidden = !showRealIcon;
    if (addItemIconPlaceholder) {
      addItemIconPlaceholder.hidden = showRealIcon;
    }
  }

  function getAmountHintText() {
    if (!selectedAddItem) {
      return '';
    }

    const total = Math.max(0, Number.parseInt(addItemTotal.value || '0', 10) || 0);
    const breakdown = getAmountBreakdown(total);
    const parts = [];

    if (breakdown.shulkers > 0) parts.push(`${breakdown.shulkers} SB`);
    if (breakdown.stacks > 0) parts.push(`${breakdown.stacks} stacks`);
    if (breakdown.items > 0) parts.push(`${breakdown.items} items`);

    const shorthand = parts.length ? parts.join(' + ') : '0 items';
    return `${total.toLocaleString()} items • ${shorthand}`;
  }

  function syncAddItemAmountFields(source = 'total') {
    if (!selectedAddItem) {
      return;
    }

    const stackSize = getStackSize();

    if (source === 'total') {
      const total = Math.max(0, Number.parseInt(addItemTotal.value || '0', 10) || 0);
      const breakdown = getAmountBreakdown(total);
      addItemShulkers.value = breakdown.shulkers;
      addItemStacks.value = breakdown.stacks;
      addItemItems.value = breakdown.items;
    } else {
      const shulkers = Math.max(0, Number.parseInt(addItemShulkers.value || '0', 10) || 0);
      const stacks = Math.max(0, Number.parseInt(addItemStacks.value || '0', 10) || 0);
      const items = Math.max(0, Number.parseInt(addItemItems.value || '0', 10) || 0);
      const total = Math.max(0, (shulkers * 27 + stacks) * stackSize + items);
      addItemTotal.value = total;
    }

    updateAmountHint();
  }

  function positionAddItemSuggestions() {
    const rect = addItemName.getBoundingClientRect();
    addItemSuggestions.style.position = 'fixed';
    addItemSuggestions.style.left = `${rect.left}px`;
    addItemSuggestions.style.top = `${rect.bottom + 6}px`;
    addItemSuggestions.style.width = `${Math.max(320, rect.width)}px`;
    addItemSuggestions.style.zIndex = '10001';
  }

  function updateAmountHint() {
    addItemAmountHint.textContent = getAmountHintText();
  }

  function updateAddItemSuggestions() {
    const term = String(addItemName.value || '').trim().toLowerCase();
    addItemSuggestions.innerHTML = '';

    if (!term) {
      addItemSuggestions.hidden = true;
      selectedAddItem = null;
      // addItemIcon.hidden = true;
      addItemIcon.removeAttribute('src');
      updateAmountHint();
      return;
    }

    const matches = itemCatalog
      .filter(item => String(item.name || '').toLowerCase().includes(term))
      .slice(0, 8);

    if (!matches.length) {
      addItemSuggestions.hidden = true;
      updateAmountHint();
      return;
    }

    matches.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'editor-add-suggestion';
      btn.innerHTML = getSuggestionMarkup(item.name);
      btn.addEventListener('mousedown', event => {
        event.preventDefault();
      });
      btn.addEventListener('click', () => {
        selectedAddItem = item;
        addItemName.value = item.name;
        addItemIcon.src = getItemIconUrl(item.name);
        // addItemIcon.hidden = !addItemIcon.src;
        addItemSuggestions.hidden = true;
        // addItemTotal.value = '0';
        // addItemShulkers.value = '0';
        // addItemStacks.value = '0';
        // addItemItems.value = '0';
        syncAddItemAmountFields();
        syncAddItemIconVisibility(true);
        setAddItemAmountEnabled(true);
        updateAmountHint();
        addItemTotal.focus();
        addItemTotal.select();
      });
      addItemSuggestions.appendChild(btn);
    });

    positionAddItemSuggestions();
    addItemSuggestions.hidden = false;
  }

  function openAddItemPopup(e, editingIndex = null) {
    const isEditing = editingIndex !== null;

    editingAddedIndex = editingIndex;
    selectedAddItem = null;
    addItemName.value = '';
    addItemTotal.value = '0';
    addItemShulkers.value = '0';
    addItemStacks.value = '0';
    addItemItems.value = '0';
    setAddItemAmountEnabled(false);
    addItemIcon.removeAttribute('src');
    syncAddItemIconVisibility(false);
    addItemSuggestions.innerHTML = '';
    addItemSuggestions.hidden = true;
    addItemAmountHint.textContent = '';
    confirmAddItemBtn.textContent = isEditing ? 'Save' : 'Add';
    addItemTitle.textContent = isEditing ? 'Edit Item' : 'Add Item';

    if (isEditing && Array.isArray(editorFile.edits.added)) {
      const row = editorFile.edits.added[editingIndex];

      if (row) {
        selectedAddItem = itemCatalog.find(item => String(item.name || '').toLowerCase() === String(row.Item || '').trim().toLowerCase()) || null;
        addItemName.value = row.Item || '';
        addItemTotal.value = Number(row.Total || 0);
        const breakdown = getAmountBreakdown(Number(row.Total || 0));
        addItemShulkers.value = breakdown.shulkers;
        addItemStacks.value = breakdown.stacks;
        addItemItems.value = breakdown.items;
        setAddItemAmountEnabled(true);
        const iconUrl = getItemIconUrl(row.Item || '');
        addItemIcon.src = iconUrl;
        syncAddItemIconVisibility(Boolean(iconUrl));
        updateAmountHint();
      }
    }

    addItemPopup.hidden = false;
    requestAnimationFrame(() => {
      if (isEditing) {
        addItemTotal.focus();
        addItemTotal.select();
      } else {
        addItemName.focus();
      }
    });
  }

  function closeAddItemPopup() {
    selectedAddItem = null;
    editingAddedIndex = null;
    setAddItemAmountEnabled(false);
    confirmAddItemBtn.textContent = 'Add';
    addItemTitle.textContent = 'Add Item';
    addItemPopup.hidden = true;
    addItemSuggestions.hidden = true;
    addItemAmountHint.textContent = '';
  }

  addItemBtn.addEventListener("click", openAddItemPopup);
  cancelAddItemBtn.addEventListener("click", closeAddItemPopup);
  addItemName.addEventListener('input', updateAddItemSuggestions);
  addItemName.addEventListener('focus', () => {
    if (addItemName.value.trim()) {
      updateAddItemSuggestions();
    }
    updateAmountHint();
  });
  addItemName.addEventListener('blur', () => {
    window.setTimeout(() => {
      addItemSuggestions.hidden = true;
    }, 80);
  });
  addItemTotal.addEventListener('input', () => syncAddItemAmountFields('total'));
  addItemShulkers.addEventListener('input', () => syncAddItemAmountFields('breakdown'));
  addItemStacks.addEventListener('input', () => syncAddItemAmountFields('breakdown'));
  addItemItems.addEventListener('input', () => syncAddItemAmountFields('breakdown'));
  confirmAddItemBtn.addEventListener("click", async () => {
    const itemName = String(addItemName.value || '').trim();
    const total = Math.max(0, Number.parseInt(addItemTotal.value || '0', 10) || 0);

    if (!itemName) {
      editorStatus.textContent = 'Enter an item name';
      return;
    }

    const entry = {
      Item: itemName,
      Total: Number.isFinite(total) ? total : 0,
      Missing: '',
      Available: ''
    };

    if (editingAddedIndex !== null && Array.isArray(editorFile.edits.added)) {
      editorFile.edits.added[editingAddedIndex] = entry;
      editorStatus.textContent = `Updated ${itemName}`;
    } else {
      editorFile.edits.added.push(entry);
      editorStatus.textContent = `Added ${itemName}`;
    }

    editorFile.edits.ignored.added = editorFile.edits.ignored.added || [];
    closeAddItemPopup();
    await saveEditorFile();
    renderEditor();
  });

  // Settings interactions
  enableHeaderEl.addEventListener('change',()=>headerTextEl.disabled = !enableHeaderEl.checked);
  enableFooterEl.addEventListener('change',()=>footerTextEl.disabled = !enableFooterEl.checked);
  showStackEl.addEventListener('change',()=>{showShulkerEl.disabled = !showStackEl.checked; shulkerThresholdEl.disabled = !(showStackEl.checked && showShulkerEl.checked)});
  showShulkerEl.addEventListener('change',()=>shulkerThresholdEl.disabled = !(showStackEl.checked && showShulkerEl.checked));
  [authorEl, enableHeaderEl, headerTextEl, enableFooterEl, footerTextEl, includeSummaryEl, showListHeaderEl, repeatListHeaderEl, enableChecklistEl, checklistStyleEl, itemFormatEl, baseValueModeEl, considerAvailableEl, showStackEl, showShulkerEl, shulkerThresholdEl, pageWidthEl, linesPerPageEl, previewModeEl].forEach(el=>el.addEventListener('input', debounce(renderAll,200)));

  // Navigation
  prevPageBtn.addEventListener('click',()=>{
    const pagesToShow = Number(previewModeEl.value) || 2;
    state.currentPage = Math.max(0, state.currentPage - pagesToShow);
    updatePreview();
  });
  nextPageBtn.addEventListener('click',()=>{
    const pagesToShow = Number(previewModeEl.value) || 2;
    state.currentPage = Math.min(pagesToShow == 2 ? (Math.floor((state.pages.length - 1) / 2) * 2) : state.pages.length - 1, state.currentPage + pagesToShow);
    updatePreview();
  });

  // Export
  copyBtn.addEventListener('click',()=>{ navigator.clipboard.writeText(JSON.stringify(exportJSON(),null,2)); alert('JSON copied to clipboard') });
  downloadBtn.addEventListener('click',()=>{ const blob = new Blob([JSON.stringify(exportJSON(),null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='book.json'; a.click(); URL.revokeObjectURL(url); });
  toggleJsonBtn.addEventListener('click',()=>{ if(jsonBlock.style.display==='none'){ jsonBlock.style.display='block'; toggleJsonBtn.textContent='▼ Hide JSON' } else { jsonBlock.style.display='none'; toggleJsonBtn.textContent='▶ Show JSON' } });

  function exportJSON(){ return { author: authorEl.value || 'D3v1s0m', pages: state.pages.slice() } }

  // Main rendering
  function generateListHeader(fmt){
    if(!fmt) return '';
    const checkSym = enableChecklistEl.checked ? (checklistStyleEl.value==='unicode' ? '☐/☑' : '[ ]/[x]') : '';
    const map = {
      'item': 'Item',
      'total': 'Total',
      'missing': 'Missing',
      'available': 'Available',
      'check': checkSym,
      'status': 'Status'
    };
    return fmt.replace(/\{(.*?)\}/g, (_, key)=>{
      const k = key.trim();
      return map.hasOwnProperty(k) ? map[k] : '';
    });
  }

  function parseNumericField(row, keys) {
    for (const key of keys) {
      const raw = row[key];
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        continue;
      }

      const value = Number(String(raw).replace(/,/g, '').trim());
      return Number.isFinite(value) ? value : 0;
    }

    return 0;
  }

  function formatCountText(value, item) {
    let text = String(value);
    const stackSize = stackSizes[item] ?? 64;

    if (showStackEl.checked && value > stackSize) {
      const stacks = Math.floor(value / stackSize);
      const rem = value % stackSize;

      if (showShulkerEl.checked) {
        const threshold = Math.max(1, Number(shulkerThresholdEl.value) || 27);
        const shulkers = Math.floor(stacks / threshold);
        const remStacks = stacks % threshold;
        const parts = [];

        if (shulkers > 0) parts.push(`${shulkers} SB`);
        if (remStacks > 0) parts.push(`${remStacks}${stackSize > 1 ? 's' : ''}`);
        if (rem > 0) parts.push(rem);

        if (parts.length) text = `${value} (${parts.join(' + ')})`;
      } else if (stackSize > 1) {
        const parts = [];
        if (stacks > 0) parts.push(`${stacks}${stackSize > 1 ? 's' : ''}`);
        if (rem > 0) parts.push(rem);
        if (parts.length) text = `${value} (${parts.join(' + ')})`;
      }
    }

    return text;
  }

  function renderAll(){
    // sync pagination settings
    BOOK_WIDTH = Number(pageWidthEl.value) || 114;
    LINES_PER_PAGE = Math.max(1, Number(linesPerPageEl.value)||14);

    // Build list header flags
    const showListHeader = showListHeaderEl.checked;

    // Build ordered entries of final rendered text (unwrapped). Each entry may include explicit newlines.
    const entries = [];

    // Summary entries (we'll replace page count placeholder after pagination)
    if(includeSummaryEl.checked){
      const now = new Date();
      entries.push({type:'summary', text: `Items: ${state.rows.length}`} );
      entries.push({type:'summary', text: `Pages: {PAGENUM}`});
      entries.push({type:'summary', text: `Generated: ${now.toLocaleString()}`} );
      entries.push({type:'summary', text: `Author: ${authorEl.value||'D3v1s0m'}`} );
    }

    // Header lines (preserve user explicit newlines as separate entries)
    if(enableHeaderEl.checked && headerTextEl.value){
      headerTextEl.value.split('\n').forEach(line => entries.push({type:'header', text: line}));
    }

    // List header handling
    const repeatHeader = repeatListHeaderEl.checked && showListHeader;
    const listHeaderRaw = showListHeader ? generateListHeader(itemFormatEl.value || '') : '';
    // If header should appear only once (not repeated), don't push it into pre-entries now.
    // We'll insert it into the item stream (before the first item) later so it doesn't become a standalone page.
    const singleListHeaderRaw = (showListHeader && !repeatHeader && listHeaderRaw) ? listHeaderRaw : null;

    // Items: produce final rendered text per row (apply stacks/shulker/checklist/formatting)
    // IMPORTANT: do NOT pre-wrap or insert visual line breaks inside item text. Each item is a single entry.
    state.rows.forEach(r=>{
      const item = r['Item'] || r['item'] || '';
      const total = parseNumericField(r, ['Total', 'total']);
      const missing = parseNumericField(r, ['Missing', 'missing']);
      const available = parseNumericField(r, ['Available', 'available']);
      const baseValue = baseValueModeEl.value === 'missing' ? missing : total;
      const effectiveTotal = considerAvailableEl.checked ? Math.max(0, baseValue - available) : baseValue;
      const totalText = formatCountText(effectiveTotal, item);

      const checkSym = enableChecklistEl.checked ? (checklistStyleEl.value==='unicode' ? '☐' : '[ ]') : '';
      const statusText = available > 0 ? 'Done' : 'Need';
      const fmt = itemFormatEl.value || (enableChecklistEl.checked?'{check}{item}: {total}':'{item}: {total}');
      const rendered = fmt.replace(/{item}/g,item).replace(/{total}/g,totalText).replace(/{missing}/g,String(missing)).replace(/{available}/g,String(available)).replace(/{check}/g, checkSym).replace(/{status}/g,statusText);
      // push the full rendered item as a single entry (preserve explicit newlines inside only if present,
      // but do not break them apart for pagination; the wrapping simulator will count visual lines)
      entries.push({type:'item', text: rendered});
    });

    // Footer lines (preserve explicit newlines)
    if(enableFooterEl.checked && footerTextEl.value){
      footerTextEl.value.split('\n').forEach(line => entries.push({type:'footer', text: line}));
    }

    // Pagination strategy:
    // - Split entries into pre-list (everything before the first item), items, and post-list (after last item).
    // - Paginate pre-list normally (summary/header) but do NOT mix pre-list with list pages when repeatHeader is enabled.
    // - Start items on fresh pages. For each list page, insert the generated list header at the very top when
    //   `repeatHeader` is enabled; the header's visual lines count toward the page limit.
    // - After items are paginated, append post-list/footer entries, trying to pack them into the last page if space.

    // Build pages: keep summary separate, then paginate a single content stream (header + list header + items + footer)
    const pages = [];

    // Summary pages (keep as separate first pages)
    if(includeSummaryEl.checked){
      const now = new Date();
      const summaryLines = [ `Items: ${state.rows.length}`, `Pages: {PAGENUM}`, `Generated: ${now.toLocaleString()}`, `Author: ${authorEl.value||'D3v1s0m'}` ];
      // wrap summary and push as page(s)
      const summaryWrapped = [];
      summaryLines.forEach(s => summaryWrapped.push(...wrapMinecraftLine(s)));
      // push summary as its own page (original behavior preserved)
      pages.push(summaryWrapped.slice(0, LINES_PER_PAGE).map(l => l));
    }

    // Build a single content stream: header lines, (single) list header if non-repeating inserted into stream, items, footer
    const contentStream = [];
    // user header lines
    if(enableHeaderEl.checked && headerTextEl.value){ headerTextEl.value.split('\n').forEach(line => contentStream.push({type:'header', text: line})); }
    // if single (non-repeating) list header was requested and we haven't already injected it, we'll insert when we reach items
    // items
    state.rows.forEach(r=>{
      const item = r['Item'] || r['item'] || '';
      const total = parseNumericField(r, ['Total', 'total']);
      const missing = parseNumericField(r, ['Missing', 'missing']);
      const available = parseNumericField(r, ['Available', 'available']);
      const baseValue = baseValueModeEl.value === 'missing' ? missing : total;
      const effectiveTotal = considerAvailableEl.checked ? Math.max(0, baseValue - available) : baseValue;
      const totalText = formatCountText(effectiveTotal, item);
      const checkSym = enableChecklistEl.checked ? (checklistStyleEl.value==='unicode' ? '☐' : '[ ]') : '';
      const statusText = available > 0 ? 'Done' : 'Need';
      const fmt = itemFormatEl.value || (enableChecklistEl.checked?'{check}{item}: {total}':'{item}: {total}');
      const rendered = fmt.replace(/{item}/g,item).replace(/{total}/g,totalText).replace(/{missing}/g,String(missing)).replace(/{available}/g,String(available)).replace(/{check}/g, checkSym).replace(/{status}/g,statusText);
      contentStream.push({ type: 'item', text: rendered });
    });
    // footer
    if(enableFooterEl.checked && footerTextEl.value){ footerTextEl.value.split('\n').forEach(line => contentStream.push({type:'footer', text: line})); }

    // Paginate contentStream into pages, inserting repeated list header at the start of any page that contains items when requested.
    let cur = [];
    let curCount = 0;
    const listHeaderParts = listHeaderRaw ? String(listHeaderRaw).split('\n') : [];
    const listHeaderVisualCount = listHeaderParts.reduce((a,p)=>a + wrapMinecraftLine(p).length, 0);

    // track whether the current page so far contains only user header lines (no items/list-headers yet)
    let curHasOnlyHeader = false;
    function flushCur(){ if(cur.length){ pages.push(cur.slice()); cur = []; curCount = 0; } curHasOnlyHeader = false; }
    let insertedSingleHeader = false;
    for(const e of contentStream){

      // If we reach the first item and there is a single non-repeating list header, try to insert it now
      // Prefer keeping header + first item on the same page when possible to avoid creating a header-only page.
      if(!insertedSingleHeader && singleListHeaderRaw && e.type === 'item'){
        const costH = wrapMinecraftLine(singleListHeaderRaw).length;
        const costItem = wrapMinecraftLine(String(e.text)).length;
        // If header + item both fit on current page, insert both now and skip normal item handling
        if(curCount + costH + costItem <= LINES_PER_PAGE){
          cur.push(singleListHeaderRaw);
          curCount += costH;
          // insert item immediately
          cur.push(String(e.text));
          curCount += costItem;
          insertedSingleHeader = true;
          continue; // item handled
        }
        // If header fits but together they don't, insert header and let item be handled normally (may start new page)
        if(curCount + costH <= LINES_PER_PAGE){
          cur.push(singleListHeaderRaw);
          curCount += costH;
          insertedSingleHeader = true;
        } else {
          // header doesn't fit on current page: flush current page and insert header on fresh page
          flushCur();
          cur.push(singleListHeaderRaw);
          curCount += costH;
          insertedSingleHeader = true;
        }
      }

      const cost = wrapMinecraftLine(String(e.text)).length;

      // If this is an item and repeatHeader is enabled, ensure the repeated header is always
      // the first content on any page that contains items. Treat user header lines as separate
      // pre-content: if the current page only contains user header lines, insert the list header
      // immediately after them. If the current page already contains other content, start a new
      // page and insert the list header there so it remains first.
      if(e.type === 'item' && repeatHeader && listHeaderRaw){
        const headerPresent = cur.includes(listHeaderRaw);
        if(!headerPresent){
          const headerPlusItem = listHeaderVisualCount + cost;
          if(curCount === 0){
            // fresh page: if header+item fit, insert header now (item will follow normally),
            // otherwise insert header now and let item go to next page which will also start with header.
            cur.push(listHeaderRaw);
            curCount += listHeaderVisualCount;
            if(headerPlusItem > LINES_PER_PAGE){
              // header alone consumes page; force it as its own page so next page starts fresh
              if(cur.length) { pages.push(cur.slice()); cur = []; curCount = 0; }
              // prepare next page with header so item will be preceded by header
              cur.push(listHeaderRaw);
              curCount += listHeaderVisualCount;
            }
          } else if(curHasOnlyHeader){
            // page contains only user header lines: try to append list header after them
            if(curCount + listHeaderVisualCount + cost <= LINES_PER_PAGE){
              cur.push(listHeaderRaw);
              curCount += listHeaderVisualCount;
            } else {
              // not enough room: finish this page and start a new one with header
              flushCur();
              cur.push(listHeaderRaw);
              curCount += listHeaderVisualCount;
              // if header alone still won't allow item on same page, keep header-only page and prepare next page with header
              if(listHeaderVisualCount + cost > LINES_PER_PAGE){
                if(cur.length) { pages.push(cur.slice()); cur = []; curCount = 0; }
                cur.push(listHeaderRaw);
                curCount += listHeaderVisualCount;
              }
            }
          } else {
            // page already has non-header content: finish page and start a fresh one with header
            flushCur();
            cur.push(listHeaderRaw);
            curCount += listHeaderVisualCount;
            if(listHeaderVisualCount + cost > LINES_PER_PAGE){
              // header alone eats page: finalize it and start another header page for the item
              if(cur.length) { pages.push(cur.slice()); cur = []; curCount = 0; }
              cur.push(listHeaderRaw);
              curCount += listHeaderVisualCount;
            }
          }
        }
      }

      if(curCount + cost > LINES_PER_PAGE){
        if(curCount > 0) flushCur();
        // before placing an item on a fresh page, ensure repeated list header is inserted first
        if(e.type === 'item' && repeatHeader && listHeaderRaw && !cur.includes(listHeaderRaw)){
          cur.push(listHeaderRaw);
          curCount += listHeaderVisualCount;
        }
        cur.push(String(e.text));
        curCount += cost;
        // added a non-header entry
        curHasOnlyHeader = false;
        if(curCount >= LINES_PER_PAGE) flushCur();
      } else {
        // push entry and update header-only state
        if(e.type === 'item' && repeatHeader && listHeaderRaw && curHasOnlyHeader) {
            if(curCount + cost > LINES_PER_PAGE){
                if(curCount > 0) flushCur();
                // start new page with header
                cur.push(listHeaderRaw);
                curCount += listHeaderVisualCount;
                // If header alone causes overflow together with item (rare), put header on its own page
                if(curCount + cost > LINES_PER_PAGE){
                    flushCur();
                    cur.push(listHeaderRaw);
                    curCount += listHeaderVisualCount;
                }
            } else {
                // current page can accept the item; ensure header is present at top if page is empty
                if(!cur.includes(listHeaderRaw)){
                    cur.push(listHeaderRaw);
                    curCount += listHeaderVisualCount;
                }
            }
        }
        cur.push(String(e.text));
        curCount += cost;
        if(e.type === 'header' && repeatHeader && listHeaderRaw && (curHasOnlyHeader || curCount - cost === 0)){
          // page started with a user header line and still only header lines so far
          curHasOnlyHeader = true;
        } else if(e.type === 'header'){
          // header but there was already non-header content, so not header-only
          curHasOnlyHeader = false;
        } else {
          curHasOnlyHeader = false;
        }
      }
    }
    if(cur.length) pages.push(cur.slice());

    // replace page count placeholder in exported (unwrapped) pages
    if(includeSummaryEl.checked){
      const totalPages = pages.length;
      for(let pi=0; pi<pages.length; pi++){
        pages[pi] = pages[pi].map(t => t.replace('{PAGENUM}', String(totalPages)) );
      }
    }

    // convert pages arrays of entries into page strings (unwrapped per-entry, joined by newlines)
    state.pages = pages.map(p => p.join('\n'));
    // Validation: ensure re-wrapping the exported pages doesn't exceed LINES_PER_PAGE
    const issues = validatePagination(state.pages);
    if(issues.length){
      // mark UI and log details
      generatedPagesEl.textContent = state.pages.length + ' ⚠';
      generatedPagesEl.title = 'Pagination validation failed: see console for details';
      console.error('Pagination validation issues:', issues);
      // expose in JSON preview area as developer hint (don't overwrite real JSON)
      jsonPreview.textContent = JSON.stringify({pages: state.pages, validation: issues}, null, 2);
    } else {
      generatedPagesEl.textContent = state.pages.length;
    }
    // align currentPage to spread start based on pagesToShow
    const pagesToShow = Number(previewModeEl.value) || 2;
    // clamp currentPage to valid range (ensure we don't leave it negative when pages.length was previously zero)
    state.currentPage = Math.max(0, Math.min(state.currentPage, pages.length - 1));
    state.currentPage = Math.floor(state.currentPage / pagesToShow) * pagesToShow;
    updatePreview();
    // Preserve validation output when issues exist, otherwise show exported JSON
    if(issues && issues.length){
      // already set above during validation
    } else {
      jsonPreview.textContent = JSON.stringify(exportJSON(),null,2);
    }
  }

  // Re-run wrapMinecraftLine on each exported page and ensure the total wrapped lines per page
  // does not exceed the configured LINES_PER_PAGE. Returns an array of issue objects.
  function validatePagination(pages){
    const out = [];
    for(let pi=0; pi<pages.length; pi++){
      const page = pages[pi]||'';
      const lines = page.split('\n');
      // re-wrap each logical line and count resulting physical lines
      let total = 0;
      const rewrapped = [];
      for(const ln of lines){
        const wr = wrapMinecraftLine(ln);
        rewrapped.push(...wr);
        total += wr.length;
      }
      if(total > LINES_PER_PAGE){
        out.push({ pageIndex: pi, pageNumber: pi+1, allowed: LINES_PER_PAGE, actual: total, rewrappedSample: rewrapped.slice(0,Math.min(8,rewrapped.length)) });
      }
    }
    return out;
  }

  function updatePreview(){
    const pagesToShow = Number(previewModeEl.value) || 2;
    if(state.pages.length===0){
      bookTextLeft.textContent = '';
      bookTextRight.textContent = '';
      labelLeft.textContent = '';
      labelRight.textContent = '';
      pageLabel.textContent = '0 / 0';
      statPages.textContent = '0';
      statItems.textContent = '0';
      statView.textContent = '-';
    }

    // set blit size per Scribble blit behaviour and apply preview scale
    const PREVIEW_SCALE = 1.9; // increase preview size by ~25%
    const blitWidth = (122 * pagesToShow + 70) * PREVIEW_SCALE; // per Scribble scaled
    const blitHeight = 192 * PREVIEW_SCALE;
    blit.style.width = blitWidth + 'px';
    blit.style.height = blitHeight + 'px';

    // choose texture
    const img = pagesToShow===1 ? texVanilla : texTwo;

    // draw the correct source region from texture onto the canvas
    if(bookCtx && img && img.naturalWidth){
      // source region per instructions: start at 0,0; width depends on pagesToShow
      const srcW = Math.min(img.naturalWidth, 122 * pagesToShow + 70);
      const srcH = Math.min(img.naturalHeight, 192);
      const srcX = 0, srcY = 0;

      // destination canvas size (CSS pixels)
      const destW = blitWidth;
      const destH = blitHeight;

      // handle device pixel ratio for crisp rendering
      const ratio = window.devicePixelRatio || 1;
      bookCanvas.width = Math.round(destW * ratio);
      bookCanvas.height = Math.round(destH * ratio);
      bookCanvas.style.width = destW + 'px';
      bookCanvas.style.height = destH + 'px';
      bookCtx.setTransform(ratio,0,0,ratio,0,0);
      bookCtx.clearRect(0,0,destW,destH);
      try{
        bookCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, destW, destH);
      } catch(e) {
        // fallback: clear canvas
        bookCtx.clearRect(0,0,destW,destH);
      }
      // compute scale for text positioning
      const scale = destW / srcW;
      const leftOffset = Math.round(36 * scale);
      // move text slightly upward for better visual alignment (reduce top by 6 px before scaling)
      const topOffset = Math.round((30 - 6) * scale);
      const pageW = Math.round(114 * scale);
      const pageH = Math.round(128 * scale);
      const rightOffset = Math.round((36 + 126) * scale);
      // apply styles to text elements
      bookTextLeft.style.left = leftOffset + 'px';
      bookTextLeft.style.top = topOffset + 'px';
      bookTextLeft.style.width = pageW + 'px';
      bookTextLeft.style.height = (pageH + 15) + 'px';
      // compute font size so 14 lines fit into pageH (account for vertical padding)
      const paddingPx = 6; // matches .book-text padding
      const usableH = pageH - paddingPx * 2;
      const fontSizePx = Math.max(8, Math.floor(usableH / 14));
      bookTextLeft.style.fontSize = fontSizePx + 'px';
      bookTextLeft.style.lineHeight = '1';
      bookTextRight.style.left = rightOffset + 'px';
      bookTextRight.style.top = topOffset + 'px';
      bookTextRight.style.width = pageW + 'px';
      bookTextRight.style.height = (pageH + 15) + 'px';
      bookTextRight.style.fontSize = fontSizePx + 'px';
      bookTextRight.style.lineHeight = '1';
      // ensure text cannot overflow visually below page area
      // overflow is hidden via CSS; we keep line-height tightened to fit
    }

    if (state.pages.length === 0) {
        labelLeft.textContent = `Page 0`;
        labelRight.textContent = pagesToShow===2 ? `Page 0` : '';
        return;
    }

    // left and right page text come from state.pages (which now hold unwrapped entry texts).
    // For preview we must render the simulated wrapped version so the visual preview matches pagination.
    function renderWrappedForPreview(pageStr){
      if(!pageStr) return '';
      const parts = String(pageStr).split('\n');
      const out = parts.flatMap(p=>{
        // preserve explicit empty lines
        if(p === '') return [''];
        // return wrapMinecraftLine(p);
        return p;
      });
      return out.join('\n');
    }

    const left = state.pages[state.currentPage] || '';
    const right = pagesToShow===2 ? (state.pages[state.currentPage+1] || '') : '';
    bookTextLeft.textContent = renderWrappedForPreview(left);
    bookTextRight.textContent = renderWrappedForPreview(right);

    // page labels
    const leftNum = state.currentPage + 1;
    const rightNum = state.currentPage + 2;
    labelLeft.textContent = `Page ${leftNum}`;
    labelRight.textContent = pagesToShow===2 ? `Page ${rightNum}` : '';

    // pageLabel (compact)
    if(pagesToShow===1) pageLabel.textContent = `${leftNum} / ${state.pages.length}`;
    else pageLabel.textContent = `${leftNum}-${Math.min(rightNum, state.pages.length)} / ${state.pages.length}`;

    // stats
    statPages.textContent = state.pages.length;
    statItems.textContent = state.rows.length;
    statView.textContent = pagesToShow===1 ? `${leftNum}` : `${leftNum}-${Math.min(rightNum, state.pages.length)}`;
  }

  // debounce utility
  function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms)} }

  // initial render
  renderAll();

  // expose for debug
  window._ltb = { renderAll, state };
})();
