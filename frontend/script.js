document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const pdfUpload = document.getElementById('pdf-upload');
    const fileNameDisplay = document.getElementById('file-name');
    const uploadBtn = document.getElementById('upload-btn');
    const statusPanel = document.getElementById('status-panel');
    const statusText = document.getElementById('status-text');
    const loader = document.getElementById('loader');
    
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    let sessionId = null;
    const API_BASE_URL = 'http://localhost:8000';

    // Update File Name and Validate Input
    pdfUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            fileNameDisplay.style.color = 'var(--text-primary)';
        } else {
            fileNameDisplay.textContent = 'No file selected';
            fileNameDisplay.style.color = 'var(--text-secondary)';
        }
        validateInputs();
    });

    apiKeyInput.addEventListener('input', validateInputs);

    function validateInputs() {
        if (apiKeyInput.value.trim() && pdfUpload.files.length > 0) {
            uploadBtn.disabled = false;
        } else {
            uploadBtn.disabled = true;
        }
    }

    // Handle Upload
    uploadBtn.addEventListener('click', async () => {
        const file = pdfUpload.files[0];
        const apiKey = apiKeyInput.value.trim();
        
        if (!file || !apiKey) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', apiKey);

        uploadBtn.disabled = true;
        statusPanel.classList.remove('hidden');
        statusText.textContent = 'Uploading and processing PDF...';
        statusText.style.color = 'var(--text-primary)';
        loader.style.display = 'block';

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                sessionId = data.session_id;
                statusText.textContent = 'PDF Indexed Successfully! 🎉';
                statusText.style.color = 'var(--success)';
                loader.style.display = 'none';
                
                chatInput.disabled = false;
                sendBtn.disabled = false;
                chatInput.focus();
                
                appendMessage('bot', `I've successfully read and processed **${file.name}**.\n\nWhat would you like to know about this document?`);
            } else {
                throw new Error(data.detail || 'Failed to upload PDF.');
            }
        } catch (error) {
            statusText.textContent = `Error: ${error.message}`;
            statusText.style.color = 'var(--error)';
            loader.style.display = 'none';
            uploadBtn.disabled = false;
        }
    });

    // Chat functionality
    const handleSend = async () => {
        const message = chatInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        
        if (!message || !sessionId || !apiKey) return;
        
        appendMessage('user', message);
        chatInput.value = '';
        chatInput.disabled = true;
        sendBtn.disabled = true;

        const loadingId = appendLoadingIndicator();

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: message,
                    api_key: apiKey
                })
            });

            const data = await response.json();
            removeElement(loadingId);

            if (response.ok) {
                appendMessage('bot', data.answer);
            } else {
                appendMessage('bot', `**Error:** ${data.detail || 'Unable to retrieve answer'}`);
            }
        } catch (error) {
            removeElement(loadingId);
            appendMessage('bot', '**Connection Error:** Unable to reach the server. Make sure the backend is running.');
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    };

    sendBtn.addEventListener('click', handleSend);
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    });

    // Utility: Format basic Markdown and append message
    function appendMessage(role, content) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Basic Markdown Parse
        const formatted = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .split('\n')
            .map(line => {
                if(line.startsWith('- ')) return `<li>${line.substring(2)}</li>`;
                if(line.match(/^\d+\.\s/)) return `<li>${line.replace(/^\d+\.\s/, '')}</li>`;
                return line ? `<p>${line}</p>` : '';
            })
            .join('')
            .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')
            // Fix nested uls and multiple consecutive uls properly (simplified for this demo)
            .replace(/<\/ul><ul>/g, '');
            
        contentDiv.innerHTML = formatted || content;
        div.appendChild(contentDiv);
        chatMessages.appendChild(div);
        scrollToBottom();
        return div;
    }

    function appendLoadingIndicator() {
        const id = 'loading-' + Date.now();
        const div = document.createElement('div');
        div.className = `message bot`;
        div.id = id;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = '<div class="loader" style="margin: 0; width: 16px; height: 16px; border-width: 2px;"></div>';
        
        div.appendChild(contentDiv);
        chatMessages.appendChild(div);
        scrollToBottom();
        return id;
    }

    function removeElement(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }
});
