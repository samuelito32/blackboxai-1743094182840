class UARTManager {
    constructor() {
        this.serialPort = null;
        this.reader = null;
        this.writer = null;
        this.baudRate = 9600;
        this.connectionCallbacks = [];
        this.dataCallbacks = [];
    }

    async connect(baudRate = 9600) {
        try {
            if (!navigator.serial) {
                throw new Error('Web Serial API not supported in this browser');
            }

            this.serialPort = await navigator.serial.requestPort();
            await this.serialPort.open({ baudRate });

            this.writer = this.serialPort.writable.getWriter();
            this.reader = this.serialPort.readable.getReader();
            this.baudRate = baudRate;

            this.notifyConnectionChange(true);
            this.readLoop();

            return true;
        } catch (error) {
            console.error('UART connection error:', error);
            this.notifyConnectionChange(false, error);
            return false;
        }
    }

    async disconnect() {
        try {
            if (this.reader) {
                await this.reader.cancel();
            }
            if (this.writer) {
                await this.writer.release();
            }
            if (this.serialPort) {
                await this.serialPort.close();
            }
        } catch (error) {
            console.error('UART disconnection error:', error);
        } finally {
            this.serialPort = null;
            this.reader = null;
            this.writer = null;
            this.notifyConnectionChange(false);
        }
    }

    async readLoop() {
        try {
            while (this.serialPort && this.serialPort.readable) {
                const { value, done } = await this.reader.read();
                if (done) {
                    this.reader.releaseLock();
                    break;
                }
                
                // Handle both text and binary data
                let data = value;
                if (value instanceof Uint8Array) {
                    // Convert binary data to hex string for display
                    data = Array.from(value)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');
                }
                
                this.notifyDataReceived(data);
            }
        } catch (error) {
            console.error('UART read error:', error);
            this.notifyDataReceived(`Read error: ${error.message}`, 'error');
            this.disconnect();
        }
    }

    async send(data) {
        if (!this.writer) {
            throw new Error('Not connected to UART device');
        }

        try {
            const encoder = new TextEncoder();
            await this.writer.write(encoder.encode(data));
            return true;
        } catch (error) {
            console.error('UART send error:', error);
            this.disconnect();
            return false;
        }
    }

    onConnectionChange(callback) {
        this.connectionCallbacks.push(callback);
    }

    onDataReceived(callback) {
        this.dataCallbacks.push(callback);
    }

    notifyConnectionChange(isConnected, error = null) {
        this.connectionCallbacks.forEach(cb => cb(isConnected, error));
    }

    notifyDataReceived(data) {
        this.dataCallbacks.forEach(cb => cb(data));
    }

    isConnected() {
        return this.serialPort !== null;
    }

    getBaudRate() {
        return this.baudRate;
    }

    async getAvailablePorts() {
        try {
            const ports = await navigator.serial.getPorts();
            return ports;
        } catch (error) {
            console.error('Error getting available ports:', error);
            return [];
        }
    }
}

// Export for use in main application
const uartManager = new UARTManager();