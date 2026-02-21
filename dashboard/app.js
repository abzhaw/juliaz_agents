const BRIDGE_URL = 'http://127.0.0.1:3001';
const POLL_INTERVAL = 3000;

const elements = {
    statusBadge: document.getElementById('bridge-status'),
    statusText: document.querySelector('.status-text'),
    juliaHeartbeat: document.getElementById('julia-heartbeat'),
    openclawHeartbeat: document.getElementById('openclaw-heartbeat'),
    juliaQueueSize: document.getElementById('julia-queue-size'),
    openclawQueueSize: document.getElementById('openclaw-queue-size'),
    messageStream: document.getElementById('message-stream'),
    messageForm: document.getElementById('message-form'),
    messageInput: document.getElementById('message-input'),
    clearBtn: document.getElementById('clear-messages')
};

let knownMessageIds = new Set();

async function pollHealth() {
    try {
        const response = await fetch(`${BRIDGE_URL}/queues/julia`); // Simple check to see if server is up
        if (response.ok) {
            elements.statusBadge.classList.add('online');
            elements.statusText.textContent = 'ACTIVE';

            // In a real scenario we'd call bridge_health via MCP, 
            // but for simplicity we'll poll the /queues endpoints
            const juliaRes = await fetch(`${BRIDGE_URL}/queues/julia`);
            const openclawRes = await fetch(`${BRIDGE_URL}/queues/openclaw`);

            const juliaData = await juliaRes.json();
            const openclawData = await openclawRes.json();

            elements.juliaQueueSize.textContent = juliaData.size;
            elements.openclawQueueSize.textContent = openclawData.size;

            // Update heartbeats based on presence in queues (visual placeholder)
            elements.juliaHeartbeat.textContent = juliaData.size > 0 ? 'ACTIVE' : 'IDLE';
            elements.openclawHeartbeat.textContent = 'LISTENING';

            // Display messages
            const allMessages = [...juliaData.messages, ...openclawData.messages]
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            allMessages.forEach(msg => {
                if (!knownMessageIds.has(msg.id)) {
                    addMessageToStream(msg);
                    knownMessageIds.add(msg.id);
                }
            });

        } else {
            setOffline();
        }
    } catch (e) {
        setOffline();
    }
}

function setOffline() {
    elements.statusBadge.classList.remove('online');
    elements.statusText.textContent = 'DISCONNECTED';
}

function addMessageToStream(msg) {
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const div = document.createElement('div');
    div.className = `message ${msg.from}`;

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <div class="message-text">${msg.text}</div>
        <div class="message-meta">${msg.from.toUpperCase()} • ${time}</div>
    `;

    elements.messageStream.appendChild(div);
    elements.messageStream.scrollTop = elements.messageStream.scrollHeight;
}

elements.messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = elements.messageInput.value.trim();
    if (!text) return;

    try {
        const response = await fetch(`${BRIDGE_URL}/incoming`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: 'dashboard-ui',
                username: 'User',
                text: text
            })
        });

        if (response.ok) {
            elements.messageInput.value = '';
            pollHealth(); // Immediate poll to show update
        }
    } catch (e) {
        console.error('Failed to send message', e);
    }
});

elements.clearBtn.addEventListener('click', () => {
    elements.messageStream.innerHTML = '<div class="empty-state">Waiting for messages...</div>';
    knownMessageIds.clear();
});

// Initial poll and interval
pollHealth();
setInterval(pollHealth, POLL_INTERVAL);
