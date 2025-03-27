class UARTInterface {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.terminal = document.querySelector('.terminal');
        this.connectBtn = document.getElementById('connect-btn');
        this.connectionStatus = document.querySelector('.connection-status');
        
        this.initEventListeners();
    }

    initEventListeners() {
        this.connectBtn.addEventListener('click', () => {
            if (this.isConnected) {
                this.disconnect();
            } else {
                this.connect();
            }
        });
    }

    async connect() {
        try {
            if (!navigator.serial) {
                throw new Error('Web Serial API not supported in your browser. Try Chrome/Edge 89+ or Opera 76+');
            }
            
            this.port = await navigator.serial.requestPort();
            const baudRate = parseInt(document.querySelector('select').value) || 9600;
            
            await this.port.open({
                baudRate,
                dataBits: 8,
                parity: 'none', 
                stopBits: 1,
                flowControl: 'none'
            });

            this.writer = this.port.writable.getWriter();
            this.reader = this.port.readable.getReader();
            this.isConnected = true;
            this.updateUI();
            this.readData();
            
            this.addTerminalMessage('Connected to device', 'system');
        } catch (error) {
            console.error('Connection error:', error);
            this.addTerminalMessage(`Connection error: ${error.message}`, 'error');
        }
    }

    async disconnect() {
        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader = null;
            }
            if (this.writer) {
                await this.writer.release();
                this.writer = null;
            }
            if (this.port) {
                await this.port.close();
                this.port = null;
            }
            
            this.isConnected = false;
            this.updateUI();
            this.addTerminalMessage('Disconnected from device', 'system');
        } catch (error) {
            console.error('Disconnection error:', error);
        }
    }

    async readData() {
        try {
            while (this.isConnected) {
                const { value, done } = await this.reader.read();
                if (done) {
                    this.reader.releaseLock();
                    break;
                }
                if (value) {
                    this.addTerminalMessage(value, 'incoming');
                }
            }
        } catch (error) {
            console.error('Read error:', error);
            this.addTerminalMessage(`Read error: ${error.message}`, 'error');
            this.disconnect();
        }
    }

    async sendData(data) {
        if (!this.isConnected || !this.writer) {
            this.addTerminalMessage('Not connected to device', 'error');
            return;
        }

        try {
            const encoder = new TextEncoder();
            await this.writer.write(encoder.encode(data));
            this.addTerminalMessage(data, 'outgoing');
        } catch (error) {
            console.error('Send error:', error);
            this.addTerminalMessage(`Send error: ${error.message}`, 'error');
        }
    }

    addTerminalMessage(message, type = 'normal') {
        const messageElement = document.createElement('div');
        const timestamp = new Date().toLocaleTimeString();
        
        // Handle both string and ArrayBuffer/Uint8Array data
        let displayMessage = message;
        if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
            displayMessage = new TextDecoder().decode(message);
        }
        
        messageElement.innerHTML = `
            <span class="text-gray-500 text-xs">[${timestamp}]</span>
            ${type === 'incoming' ? '<<' : type === 'outgoing' ? '>>' : ''}
            <span class="${this.getMessageColor(type)}">${displayMessage}</span>
        `;
        
        this.terminal.appendChild(messageElement);
        this.terminal.scrollTop = this.terminal.scrollHeight;
        
        // Auto-scroll if near bottom
        if (this.terminal.scrollTop > this.terminal.scrollHeight - this.terminal.clientHeight - 50) {
            this.terminal.scrollTop = this.terminal.scrollHeight;
        }
    }

    getMessageColor(type) {
        switch (type) {
            case 'incoming': return 'text-green-400';
            case 'outgoing': return 'text-blue-400';
            case 'error': return 'text-red-400';
            case 'system': return 'text-yellow-400';
            default: return 'text-gray-300';
        }
    }

    updateUI() {
        if (this.isConnected) {
            this.connectBtn.textContent = 'Disconnect';
            this.connectBtn.className = 'w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded';
            this.connectionStatus.classList.remove('disconnected');
            this.connectionStatus.classList.add('connected');
        } else {
            this.connectBtn.textContent = 'Connect to Device';
            this.connectBtn.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded';
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.classList.add('disconnected');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const uartInterface = new UARTInterface();
    
    // Set up send button
    document.querySelector('.flex button:first-of-type').addEventListener('click', () => {
        const input = document.querySelector('.flex input[type="text"]');
        if (input.value.trim()) {
            uartInterface.sendData(input.value.trim());
            input.value = '';
        }
    });
    
    // Set up clear button
    document.querySelector('.flex button:last-of-type').addEventListener('click', () => {
        document.querySelector('.terminal').innerHTML = '';
    });
    
    // Allow sending with Enter key
    document.querySelector('.flex input[type="text"]').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.querySelector('.flex button:first-of-type').click();
        }
    });
});