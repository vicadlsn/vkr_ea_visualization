export { connectWebsocket };

const RECONNECT_INTERVALS = [1000, 2000, 4000];
const MAX_RECONNECT_ATTEMPTS = 3;

const appStatusText = document.getElementById('appState');
function connectWebsocket() {
    let currentSocket = null;

    function connect() {
        let reconnectAttempts = 0;

        //currentSocket = new WebSocket("ws://" + window.location.origin);
        currentSocket = new WebSocket('ws://localhost:9000');

        currentSocket.onopen = function () {
            console.log('WebSocket connection established');
            appStatusText.textContent = 'Соединение установлено';
            reconnectAttempts = 0;
        };

        currentSocket.onerror = (e) => {
            console.error('WebSocket error:', e);
            appStatusText.textContent = 'Ошибка соединения с сервером';
        };

        currentSocket.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);
                document.dispatchEvent(
                    new CustomEvent('got-websocket-message', {
                        detail: { data: data },
                    }),
                );
            } catch (err) {
                console.error('Invalid JSON received:', event.data, err);
            }
        };

        currentSocket.onclose = function () {
            console.log('Соединение закрыто');
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay =
                    RECONNECT_INTERVALS[reconnectAttempts] ||
                    RECONNECT_INTERVALS[RECONNECT_INTERVALS.length - 1];
                reconnectAttempts++;
                appStatusText.textContent = `Соединение закрыто, переподключение...`;
                setTimeout(connect, delay);
            } else {
                appStatusText.textContent = 'Не удалось переподключиться к серверу';
            }
        };
    }

    function sendMessage(params, callback) {
        if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
            try {
                currentSocket.send(JSON.stringify(params));
                console.log('Sent message:', params);
                if (callback) callback();
            } catch (e) {
                console.error('Error sending message:', e);
                appStatusText.textContent = 'Не удалось отправить сообщение';
            }
        } else {
            console.error('WebSocket is not opened:');
            appStatusText.textContent = 'Не удалось отправить сообщение: соединение не установлено';
        }
    }

    connect();
    return sendMessage;
}
