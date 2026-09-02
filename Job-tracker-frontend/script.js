const ITEMS_KEY = 'stayOnTrackItems';
const COLS_KEY = 'stayOnTrackColumns';

let items = [];
let columns = [];
let currentSearch = '';
let editingId = null;

const DEFAULT_COLUMNS = [
    { id: 'todo', name: 'To Do', emoji: '📝' },
    { id: 'inprogress', name: 'In Progress', emoji: '⏳' },
    { id: 'done', name: 'Done', emoji: '✅' }
];

const form = document.getElementById('app-form');
const board = document.getElementById('board');
const stats = document.getElementById('stats');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit');
const searchInput = document.getElementById('search');
const statusSelect = document.getElementById('status');
const toast = document.getElementById('toast');

function loadData() {
    try {
        items = JSON.parse(localStorage.getItem(ITEMS_KEY)) || [];
    } catch (e) { items = []; }
    try {
        columns = JSON.parse(localStorage.getItem(COLS_KEY)) || null;
    } catch (e) { columns = null; }
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
        columns = clone(DEFAULT_COLUMNS);
    }
}

function saveItems() {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

function saveColumns() {
    localStorage.setItem(COLS_KEY, JSON.stringify(columns));
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function colById(id) {
    return columns.find(c => c.id === id);
}

function renderStats() {
    const total = items.length;
    const countFor = (id) => items.filter(i => i.status === id).length;

    let html = `
        <div class="stat-card">
            <span class="stat-icon">📦</span>
            <div class="stat-info">
                <span class="stat-value">${total}</span>
                <span class="stat-label">Total</span>
            </div>
        </div>
    `;
    columns.forEach(c => {
        html += `
            <div class="stat-card">
                <span class="stat-icon">${escapeHTML(c.emoji || '•')}</span>
                <div class="stat-info">
                    <span class="stat-value">${countFor(c.id)}</span>
                    <span class="stat-label">${escapeHTML(c.name)}</span>
                </div>
            </div>
        `;
    });
    stats.innerHTML = html;
}

function renderStatusSelect() {
    const current = statusSelect.value;
    statusSelect.innerHTML = columns.map(c =>
        `<option value="${escapeHTML(c.id)}">${escapeHTML(c.emoji ? c.emoji + ' ' : '')}${escapeHTML(c.name)}</option>`
    ).join('');
    if (columns.some(c => c.id === current)) {
        statusSelect.value = current;
    }
}

function renderBoard() {
    renderStatusSelect();
    renderStats();

    const query = currentSearch.trim().toLowerCase();

    board.innerHTML = '';

    columns.forEach(col => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.col = col.id;

        let colItems = items.filter(i => i.status === col.id);
        if (query) {
            colItems = colItems.filter(i =>
                (i.title || '').toLowerCase().includes(query) ||
                (i.notes || '').toLowerCase().includes(query)
            );
        }
        colItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        column.innerHTML = `
            <div class="column-header">
                <span class="column-title">${escapeHTML(col.emoji ? col.emoji + ' ' : '')}${escapeHTML(col.name)}</span>
                <span class="column-count">${colItems.length}</span>
            </div>
            <div class="column-body">
                ${colItems.map(item => renderCard(item, col)).join('') || `<p class="column-empty">Nothing here ✨</p>`}
            </div>
        `;

        column.querySelector('.column-body').addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        column.querySelector('.column-body').addEventListener('drop', (e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            setStatus(id, col.id);
        });

        board.appendChild(column);
    });
}

function renderCard(item, col) {
    const meta = [];
    if (item.createdAt) meta.push(`🗓 ${formatDate(item.createdAt)}`);
    const metaStr = meta.length ? `<div class="app-meta">${meta.map(m => `<span>${m}</span>`).join('')}</div>` : '';

    return `
        <div class="app-card" draggable="true" data-id="${item.id}">
            <div class="app-info">
                <div class="app-title">${escapeHTML(item.title || '')}</div>
                ${metaStr}
                ${item.notes ? `<div class="app-notes">💭 ${escapeHTML(item.notes)}</div>` : ''}
            </div>
            <div class="app-actions">
                ${nextCol(col) ? `<button class="action-btn promote" data-action="promote" data-id="${item.id}">▸ ${escapeHTML(nextCol(col).name)}</button>` : ''}
                <button class="action-btn" data-action="edit" data-id="${item.id}">✏️</button>
                <button class="action-btn delete" data-action="delete" data-id="${item.id}">🗑</button>
            </div>
        </div>
    `;
}

function nextCol(col) {
    const idx = columns.findIndex(c => c.id === col.id);
    return columns[idx + 1] || null;
}

function setStatus(id, statusId) {
    const item = items.find(i => i.id === id);
    if (!item || !colById(statusId)) return;
    item.status = statusId;
    saveItems();
    renderBoard();
}

function addItem(data) {
    const item = {
        id: uid(),
        title: data.title,
        status: data.status,
        notes: data.notes || '',
        createdAt: new Date().toISOString()
    };
    items.push(item);
    saveItems();
    showToast(`Added "${item.title}" ✅`);
}

function updateItem(id, data) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    item.title = data.title;
    item.status = data.status;
    item.notes = data.notes || '';
    saveItems();
    showToast(`Updated "${item.title}" ✅`);
}

function deleteItem(id) {
    const item = items.find(i => i.id === id);
    items = items.filter(i => i.id !== id);
    saveItems();
    showToast(`Deleted "${item ? item.title : 'item'}" 🗑`);
}

function readForm() {
    return {
        title: document.getElementById('title').value.trim(),
        status: document.getElementById('status').value,
        notes: document.getElementById('notes').value.trim()
    };
}

function resetForm() {
    form.reset();
    editingId = null;
    submitBtn.textContent = '💾 Add Item';
    cancelEditBtn.classList.add('hidden');
    renderStatusSelect();
    document.getElementById('title').focus();
}

function fillForm(item) {
    document.getElementById('title').value = item.title || '';
    document.getElementById('status').value = item.status || columns[0].id;
    document.getElementById('notes').value = item.notes || '';
    submitBtn.textContent = '✏️ Save Changes';
    cancelEditBtn.classList.remove('hidden');
    document.getElementById('app-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = readForm();
    if (!data.title) return;
    if (editingId) {
        updateItem(editingId, data);
        resetForm();
    } else {
        addItem(data);
        resetForm();
    }
    renderBoard();
});

cancelEditBtn.addEventListener('click', resetForm);

board.addEventListener('click', (e) => {
    const btn = e.target.closest('.action-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'delete') {
        if (confirm('Delete this item?')) {
            deleteItem(id);
            if (editingId === id) resetForm();
            renderBoard();
        }
    } else if (action === 'promote') {
        const item = items.find(i => i.id === id);
        if (item) setStatus(id, nextCol(colById(item.status)).id);
    } else if (action === 'edit') {
        const item = items.find(i => i.id === id);
        if (item) {
            editingId = id;
            fillForm(item);
        }
    }
});

searchInput.addEventListener('input', () => {
    currentSearch = searchInput.value;
    renderBoard();
});

/* Drag & drop */
board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.app-card');
    if (card) e.dataTransfer.setData('text/plain', card.dataset.id);
});

/* ---- Settings / column editor ---- */
const settingsModal = document.getElementById('settings-modal');
const columnsEditor = document.getElementById('columns-editor');

document.getElementById('open-settings').addEventListener('click', () => {
    renderColumnsEditor();
    settingsModal.classList.add('open');
});
document.getElementById('close-settings').addEventListener('click', closeSettings);
document.getElementById('done-settings').addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
});

function closeSettings() {
    settingsModal.classList.remove('open');
}

function renderColumnsEditor() {
    columnsEditor.innerHTML = '';
    columns.forEach((col, idx) => {
        const row = document.createElement('div');
        row.className = 'column-editor-row';

        const emoji = document.createElement('input');
        emoji.type = 'text';
        emoji.className = 'col-emoji';
        emoji.value = col.emoji || '';
        emoji.placeholder = '🎯';
        emoji.maxLength = 4;

        const name = document.createElement('input');
        name.type = 'text';
        name.className = 'col-name';
        name.value = col.name;
        name.placeholder = 'Column name';

        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'col-move';
        up.disabled = idx === 0;
        up.textContent = '↑';

        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'col-move';
        down.disabled = idx === columns.length - 1;
        down.textContent = '↓';

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'col-delete';
        del.textContent = '🗑';

        row.append(emoji, name, up, down, del);
        columnsEditor.appendChild(row);

        const applyFromRow = () => {
            col.emoji = emoji.value.trim();
            col.name = name.value.trim() || 'Column';
        };

        name.addEventListener('input', applyFromRow);
        emoji.addEventListener('input', applyFromRow);

        up.addEventListener('click', () => {
            if (idx > 0) {
                [columns[idx - 1], columns[idx]] = [columns[idx], columns[idx - 1]];
                saveColumnChanges();
                renderColumnsEditor();
                renderBoard();
            }
        });
        down.addEventListener('click', () => {
            if (idx < columns.length - 1) {
                [columns[idx + 1], columns[idx]] = [columns[idx], columns[idx + 1]];
                saveColumnChanges();
                renderColumnsEditor();
                renderBoard();
            }
        });
        del.addEventListener('click', () => {
            if (columns.length <= 1) {
                showToast('You need at least one column ⚠️');
                return;
            }
            if (!confirm(`Delete column "${col.name}"? Its items will be moved to the first column.`)) return;
            columns = columns.filter(c => c.id !== col.id);
            items.forEach(i => {
                if (i.status === col.id) i.status = columns[0].id;
            });
            saveColumnChanges();
            saveItems();
            renderColumnsEditor();
            renderBoard();
        });
    });
}

document.getElementById('add-column').addEventListener('click', () => {
    columns.push({ id: uid(), name: 'New Column', emoji: '🌟' });
    saveColumnChanges();
    renderColumnsEditor();
    renderBoard();
});

function saveColumnChanges() {
    saveColumns();
    renderBoard();
}

loadData();
renderBoard();
