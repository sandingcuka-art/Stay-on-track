const STORAGE_KEY = 'stayOnTrackApplications';

let apps = [];
let currentFilter = 'all';
let editingId = null;

const STATUS_FLOW = ['applied', 'interview', 'offer'];

const statusLabels = {
    applied: 'Applied',
    interview: 'Interview',
    offer: 'Offer',
    rejected: 'Rejected'

};

const statusEmojis = {
    applied: '📝',
    interview: '📞',
    offer: '🎉',
    rejected: '💔'
};

const form = document.getElementById('app-form');
const appList = document.getElementById('app-list');
const emptyState = document.getElementById('empty-state');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit');
const searchInput = document.getElementById('search');
const toast = document.getElementById('toast');

function loadApps() {
    try {
        apps = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
        apps = [];
    }
}

function saveApps() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function updateStats() {
    const total = apps.length;
    const applied = apps.filter(a => a.status === 'applied').length;
    const interview = apps.filter(a => a.status === 'interview').length;
    const offer = apps.filter(a => a.status === 'offer').length;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-applied').textContent = applied;
    document.getElementById('stat-interview').textContent = interview;
    document.getElementById('stat-offer').textContent = offer;
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString(undefined, opts);
}

function render() {
    const query = searchInput.value.trim().toLowerCase();
    let filtered = apps.filter(a => currentFilter === 'all' || a.status === currentFilter);

    if (query) {
        filtered = filtered.filter(a =>
            (a.company || '').toLowerCase().includes(query) ||
            (a.position || '').toLowerCase().includes(query)
        );
    }

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    appList.innerHTML = '';

    if (filtered.length === 0) {
        emptyState.textContent = apps.length === 0
            ? 'No applications yet. Add your first one! ✨'
            : 'No applications match your filter 🔍';
        appList.appendChild(emptyState);
    } else {
        filtered.forEach(app => {
            const card = document.createElement('div');
            card.className = `app-card ${app.status}`;

            const isLastStage = app.status === 'offer' || app.status === 'rejected';
            const nextLabel = app.status === 'applied' ? 'Interview' :
                              app.status === 'interview' ? 'Offer' : '';
            const canPromote = !isLastStage;

            const meta = [];
            if (app.location) meta.push(`📍 ${escapeHTML(app.location)}`);
            if (app.createdAt) meta.push(`🗓 ${escapeHTML(formatDate(app.createdAt))}`);

            card.innerHTML = `
                <div class="app-info">
                    <div class="app-company">${escapeHTML(app.company || '')}</div>
                    <div class="app-position">${escapeHTML(app.position || '')}</div>
                    <div class="app-meta">
                        ${meta.map(m => `<span>${m}</span>`).join('')}
                        <span class="badge badge-${app.status}">${statusEmojis[app.status]} ${statusLabels[app.status]}</span>
                    </div>
                    ${app.notes ? `<div class="app-notes">💭 ${escapeHTML(app.notes)}</div>` : ''}
                </div>
                <div class="app-actions">
                    ${canPromote ? `<button class="action-btn promote" data-action="promote" data-id="${app.id}">⬆ ${nextLabel}</button>` : ''}
                    <button class="action-btn" data-action="edit" data-id="${app.id}">✏️ Edit</button>
                    <button class="action-btn delete" data-action="delete" data-id="${app.id}">🗑 Delete</button>
                </div>
            `;
            appList.appendChild(card);
        });
    }

    updateStats();
}

function addApp(data) {
    const app = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        company: data.company,
        position: data.position,
        status: data.status || 'applied',
        location: data.location || '',
        notes: data.notes || '',
        createdAt: new Date().toISOString()
    };
    apps.push(app);
    saveApps();
    showToast(`Added ${app.company} ✅`);
}

function updateApp(id, data) {
    const app = apps.find(a => a.id === id);
    if (!app) return;
    app.company = data.company;
    app.position = data.position;
    app.status = data.status;
    app.location = data.location || '';
    app.notes = data.notes || '';
    saveApps();
    showToast(`Updated ${app.company} ✅`);
}

function deleteApp(id) {
    const app = apps.find(a => a.id === id);
    apps = apps.filter(a => a.id !== id);
    saveApps();
    showToast(`Deleted ${app ? app.company : 'application'} 🗑`);
}

function promoteApp(id) {
    const app = apps.find(a => a.id === id);
    if (!app) return;
    const idx = STATUS_FLOW.indexOf(app.status);
    if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
        app.status = STATUS_FLOW[idx + 1];
        saveApps();
        showToast(`${app.company} → ${statusLabels[app.status]} 🎉`);
    }
}

function readForm() {
    return {
        company: document.getElementById('company').value.trim(),
        position: document.getElementById('position').value.trim(),
        status: document.getElementById('status').value,
        location: document.getElementById('location').value.trim(),
        notes: document.getElementById('notes').value.trim()
    };
}

function resetForm() {
    form.reset();
    editingId = null;
    submitBtn.textContent = '💾 Add Application';
    cancelEditBtn.classList.add('hidden');
    document.getElementById('company').focus();
}

function fillForm(app) {
    document.getElementById('company').value = app.company || '';
    document.getElementById('position').value = app.position || '';
    document.getElementById('status').value = app.status || 'applied';
    document.getElementById('location').value = app.location || '';
    document.getElementById('notes').value = app.notes || '';
    submitBtn.textContent = '✏️ Save Changes';
    cancelEditBtn.classList.remove('hidden');
    document.getElementById('app-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = readForm();

    if (editingId) {
        updateApp(editingId, data);
        resetForm();
    } else {
        addApp(data);
        resetForm();
    }
    render();
});

cancelEditBtn.addEventListener('click', resetForm);

appList.addEventListener('click', (e) => {
    const btn = e.target.closest('.action-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'delete') {
        if (confirm('Delete this application?')) {
            deleteApp(id);
            if (editingId === id) resetForm();
            render();
        }
    } else if (action === 'promote') {
        promoteApp(id);
        render();
    } else if (action === 'edit') {
        const app = apps.find(a => a.id === id);
        if (app) {
            editingId = id;
            fillForm(app);
        }
    }
});

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        render();
    });
});

searchInput.addEventListener('input', render);

loadApps();
render();
