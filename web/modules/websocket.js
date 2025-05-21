import {
    addPoints,
    extendConvergencePlot,
    updateConvergencePlot,
} from "./plot.js";
import { updateMethodInfo } from "./ui.js";
import { state } from "./state.js";

export { connectWebsocket };

const RECONNECT_INTERVALS = [1000, 2000, 4000];
const MAX_RECONNECT_ATTEMPTS = 3;

const appStatusText = document.getElementById("appState");
function connectWebsocket() {
    let currentSocket = null;

    function connect() {
        let reconnectAttempts = 0;

        //currentSocket = new WebSocket("ws://" + window.location.origin);
        currentSocket = new WebSocket("ws://localhost:9000");

        currentSocket.onopen = function () {
            console.log("WebSocket connection established");
            appStatusText.textContent = "Соединение установлено";
            reconnectAttempts = 0;
        };

        currentSocket.onerror = (e) => {
            console.error("WebSocket error:", e);
            appStatusText.textContent = "Ошибка соединения с сервером";
        };

        currentSocket.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (err) {
                console.error("Invalid JSON received:", event.data, err);
            }
        };

        currentSocket.onclose = function () {
            console.log("Соединение закрыто");
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay =
                    RECONNECT_INTERVALS[reconnectAttempts] ||
                    RECONNECT_INTERVALS[RECONNECT_INTERVALS.length - 1];
                reconnectAttempts++;
                appStatusText.textContent = `Соединение закрыто, переподключение...`;
                setTimeout(connect, delay);
            } else {
                appStatusText.textContent =
                    "Не удалось переподключиться к серверу";
            }
        };
    }

    function sendMessage(params, callback) {
        if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
            try {
                currentSocket.send(JSON.stringify(params));
                console.log("Sent message:", params);
                if (callback) callback();
            } catch (e) {
                console.error("Error sending message:", e);
                appStatusText.textContent = "Не удалось отправить сообщение";
            }
        } else {
            console.error(
                "WebSocket is not opened:",
                readystateDesc[currentSocket.readyState]
            );
            appStatusText.textContent =
                "Не удалось отправить сообщение: соединение не установлено";
        }
    }

    connect();
    return sendMessage;
}

function handleMessage(data) {
    console.log("Received message:", data);

    const method_id = data.method_id;
    const request_id = data.request_id;
    const action = data.action;

    switch (action) {
        case "start_ack":
            break;
        case "stop_ack":
        case "error":
        case "complete":
            if (state.activeRequests[method_id] !== request_id) {
                break;
            }

            delete state.activeRequests[method_id];
            if (
                method_id === state.currentTab &&
                !state.plotSettings.showSurface
            ) {
                updateConvergencePlot(
                    document.getElementById("convergencePlot"),
                    state.tabsData[method_id].history
                );
            }

            break;
        case "iteration":
            if (state.activeRequests[method_id] !== request_id) {
                break;
            }

            state.tabsData[method_id].population = data["population"];
            state.tabsData[method_id].best_solution = data["best_solution"];
            state.tabsData[method_id].best_fitness = data["best_fitness"];
            state.tabsData[method_id].iteration = data["iteration"];
            state.tabsData[method_id].history.push(data["best_fitness"]);
            if (method_id === state.currentTab) {
                updateMethodInfo();
                if (state.plotSettings.showSurface) {
                    addPoints(
                        state.currentFunction,
                        state.tabsData[method_id].population,
                        state.tabsData[method_id].best_solution,
                        state.plotSettings.showPopulation,
                        state.plotSettings.pointSize
                    );
                }
            }
    }
}
