export { createWebsocket };

function createWebsocket(method_id, onOpen, onMessage, onError, onClose) {
    const host = window.location.host;
    const ws = new WebSocket(`ws//${host}`);

    // const ws = new WebSocket('ws://localhost:9000');

    ws.onopen = (e) => {
        console.log('WebSocket opened for ${method_id}');
        onOpen(e);
    };

    ws.onerror = (e) => {
        console.error('WebSocket error for ${method_id}:', e);
        onError(e);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onMessage(data);
        } catch (err) {
            console.error('Invalid JSON:', event.data, err);
        }
    };

    ws.onclose = (e) => {
        console.log(`WebSocket closed for ${method_id}`);
        onClose(e);
    };

    return {
        send: (params) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(params));
                console.log('Sent message:', params);
            } else {
                console.error(`WebSocket for ${method_id} not opened`);
            }
        },
        close: () => ws.close(),
    };
}
