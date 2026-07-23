  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);

    return [...new Uint8Array(hash)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }


function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('csv-app', 2);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'hash' });
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFile(filename, content) {
  const db = await openDB();
  const hash = await sha256(content);

  const tx = db.transaction(['files', 'meta'], 'readwrite');

  const files = tx.objectStore('files');
  const meta = tx.objectStore('meta');

  const existing = await new Promise(resolve => {
    const req = files.get(hash);
    req.onsuccess = () => resolve(req.result);
  });

  if (!existing) {
    files.put({
      hash,
      filename,
      content,
      uploadedAt: Date.now(),
      deletedAt: null,
      edits: {
        ignored: { original: [], added: [] },
        added: []
      }
    });
  } else {
    let changed = false;

    if (existing.deletedAt !== null) {
      existing.deletedAt = null;
      changed = true;
    }
    if (!existing.edits) {
      existing.edits = {
          ignored: { original: [], added: [] },
          added: []
      };
      changed = true;
    }

    if (changed)
      files.put(existing);
  }

  meta.put(hash, 'lastOpened');

  return hash;
}

async function loadLastFile() {
  const db = await openDB();

  const tx = db.transaction(['files', 'meta'], 'readonly');

  const meta = tx.objectStore('meta');
  const files = tx.objectStore('files');

  const hash = await new Promise((resolve, reject) => {
    const req = meta.get('lastOpened');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!hash) return null;

  return await new Promise((resolve, reject) => {
    const req = files.get(hash);
    req.onsuccess = () => {
      if (!req.result || req.result.deletedAt) {
        console.warn(`Missing file for hash ${hash}`);

        const tx2 = db.transaction('meta', 'readwrite');
        tx2.objectStore('meta').delete('lastOpened');

        resolve(null);
        return;
      }

      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}