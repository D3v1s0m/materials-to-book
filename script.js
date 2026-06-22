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

  // Simple CSV parser for the expected format
  function parseCSV(text){
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(Boolean);
    if(lines.length===0) return [];
    const header = parseCSVLine(lines[0]);
    const out = [];
    for(let i=1;i<lines.length;i++){
      const row = parseCSVLine(lines[i]);
      if(row.length===0) continue;
      const obj = {};
      for(let j=0;j<header.length;j++) obj[header[j]] = row[j]===undefined?'':row[j];
      out.push(obj);
    }
    return out;
  }

  function parseCSVLine(line){
    const res = []; let cur=''; let inQuotes=false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(inQuotes){
        if(ch==='"'){
          if(line[i+1]==='"'){ cur += '"'; i++; } else { inQuotes=false }
        } else cur += ch;
      } else {
        if(ch==='"'){ inQuotes=true }
        else if(ch===','){ res.push(cur); cur=''}
        else cur += ch;
      }
    }
    res.push(cur);
    return res.map(s=>s.trim());
  }

  // DOM helpers
  const $ = sel => document.querySelector(sel);
  const state = {
    rows: [], pages: [], currentPage: 0
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

  // Wire up file input
  browseBtn.addEventListener('click', ()=>fileInput.click());
  fileInput.addEventListener('change',e=>{
    const f = e.target.files[0]; if(!f) return; handleFile(f);
  });

  dropzone.addEventListener('dragover',e=>{e.preventDefault(); dropzone.classList.add('hover')});
  dropzone.addEventListener('dragleave',e=>{dropzone.classList.remove('hover')});
  dropzone.addEventListener('drop',e=>{e.preventDefault(); dropzone.classList.remove('hover'); const f = e.dataTransfer.files[0]; if(f) handleFile(f);});

  function handleFile(file){
    filenameEl.textContent = file.name;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{ state.rows = parseCSV(reader.result); totalItemsEl.textContent = state.rows.length; renderAll(); }
      catch(err){ alert('Invalid CSV: '+err.message) }
    };
    reader.readAsText(file,'utf-8');
  }

  // Settings interactions
  enableHeaderEl.addEventListener('change',()=>headerTextEl.disabled = !enableHeaderEl.checked);
  enableFooterEl.addEventListener('change',()=>footerTextEl.disabled = !enableFooterEl.checked);
  [authorEl, enableHeaderEl, headerTextEl, enableFooterEl, footerTextEl, includeSummaryEl, showListHeaderEl, repeatListHeaderEl, enableChecklistEl, checklistStyleEl, itemFormatEl, showStackEl, showShulkerEl, shulkerThresholdEl, pageWidthEl, linesPerPageEl, previewModeEl].forEach(el=>el.addEventListener('input', debounce(renderAll,200)));

  // Navigation
  prevPageBtn.addEventListener('click',()=>{
    const pagesToShow = Number(previewModeEl.value) || 2;
    state.currentPage = Math.max(0, state.currentPage - pagesToShow);
    updatePreview();
  });
  nextPageBtn.addEventListener('click',()=>{
    const pagesToShow = Number(previewModeEl.value) || 2;
    state.currentPage = Math.min(state.pages.length - 1, state.currentPage + pagesToShow);
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
    const checkSym = enableChecklistEl.checked ? (checklistStyleEl.value==='unicode' ? '☐/☑ ' : '[ ]/[x] ') : '';
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
      const total = Number(r['Total'] || r['total'] || 0);
      const missing = r['Missing'] || r['missing'] || '';
      const available = Number(r['Available'] || r['available'] || 0);

      // total text with stack/shulker
      let totalText = String(total);
      if(showStackEl.checked){
        const stacks = Math.floor(total/64);
        const rem = total%64;
        if(showShulkerEl.checked){
          const threshold = Math.max(1, Number(shulkerThresholdEl.value)||27);
          const shulkers = Math.floor(stacks/threshold);
          const remStacks = stacks % threshold;
          const parts = [];
          if(shulkers>0) parts.push(shulkers + ' SB');
          if(remStacks>0) parts.push(remStacks + 's');
          if(rem>0) parts.push(rem);
          if(parts.length) totalText = `${total} (${parts.join(' + ')})`;
        } else {
          totalText = `${total} (${stacks}s + ${rem})`;
        }
      }

      const checkSym = enableChecklistEl.checked ? (checklistStyleEl.value==='unicode' ? '☐ ' : '[ ] ') : '';
      const statusText = (available && Number(available)>0) ? 'Done' : 'Need';
      const fmt = itemFormatEl.value || (enableChecklistEl.checked?'{check}{item}: {total}':'{item}: {total}');
      const rendered = fmt.replace(/{item}/g,item).replace(/{total}/g,totalText).replace(/{missing}/g,missing).replace(/{available}/g,String(available)).replace(/{check}/g, checkSym).replace(/{status}/g,statusText);
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
      const total = Number(r['Total'] || r['total'] || 0);
      const missing = r['Missing'] || r['missing'] || '';
      const available = Number(r['Available'] || r['available'] || 0);
      let totalText = String(total);
      if(showStackEl.checked){
        const stacks = Math.floor(total/64);
        const rem = total%64;
        if(showShulkerEl.checked){
          const threshold = Math.max(1, Number(shulkerThresholdEl.value)||27);
          const shulkers = Math.floor(stacks/threshold);
          const remStacks = stacks % threshold;
          const parts = [];
          if(shulkers>0) parts.push(shulkers + ' SB');
          if(remStacks>0) parts.push(remStacks + 's');
          if(rem>0) parts.push(rem);
          if(parts.length) totalText = `${total} (${parts.join(' + ')})`;
        } else {
          totalText = `${total} (${stacks}s + ${rem})`;
        }
      }
      const checkSym = enableChecklistEl.checked ? (checklistStyleEl.value==='unicode' ? '☐ ' : '[ ] ') : '';
      const statusText = (available && Number(available)>0) ? 'Done' : 'Need';
      const fmt = itemFormatEl.value || (enableChecklistEl.checked?'{check}{item}: {total}':'{item}: {total}');
      const rendered = fmt.replace(/{item}/g,item).replace(/{total}/g,totalText).replace(/{missing}/g,missing).replace(/{available}/g,String(available)).replace(/{check}/g, checkSym).replace(/{status}/g,statusText);
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
    // console.log(contentStream)
    let insertedSingleHeader = false;
    console.clear();
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
            console.log("Hahahahah")
            if(curCount + cost > LINES_PER_PAGE){
                console.log("curtCount:", curCount);
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
                    console.log("adding list header")
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
      console.log(cur)
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
      bookTextLeft.textContent=''; bookTextRight.textContent=''; pageLabel.textContent='0 / 0'; statPages.textContent='0'; statItems.textContent='0'; statView.textContent='-'; return
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
      bookTextLeft.style.height = pageH + 'px';
      // compute font size so 14 lines fit into pageH (account for vertical padding)
      const paddingPx = 6; // matches .book-text padding
      const usableH = pageH - paddingPx * 2;
      const fontSizePx = Math.max(8, Math.floor(usableH / 14));
      bookTextLeft.style.fontSize = fontSizePx + 'px';
      bookTextLeft.style.lineHeight = '1';
      bookTextRight.style.left = rightOffset + 'px';
      bookTextRight.style.top = topOffset + 'px';
      bookTextRight.style.width = pageW + 'px';
      bookTextRight.style.height = pageH + 'px';
      bookTextRight.style.fontSize = fontSizePx + 'px';
      bookTextRight.style.lineHeight = '1';
      // ensure text cannot overflow visually below page area
      // overflow is hidden via CSS; we keep line-height tightened to fit
    }

    // left and right page text come from state.pages (which now hold unwrapped entry texts).
    // For preview we must render the simulated wrapped version so the visual preview matches pagination.
    function renderWrappedForPreview(pageStr){
      if(!pageStr) return '';
      const parts = String(pageStr).split('\n');
      const out = parts.flatMap(p=>{
        // preserve explicit empty lines
        if(p === '') return [''];
        return wrapMinecraftLine(p);
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
