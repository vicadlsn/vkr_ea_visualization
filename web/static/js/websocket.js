export { connectWebsocket };
import { addPoints } from "./plot.js";
import { updateMethodInfo, state } from "./ui.js";

const RECONNECT_INTERVALS = [1000, 2000, 4000];
const MAX_RECONNECT_ATTEMPTS = 3;

function connectWebsocket() {
    let currentSocket = null;

    function connect() {
        let reconnectAttempts = 0;

        currentSocket = new WebSocket("ws://" + window.location.host);

        currentSocket.onopen = function () {
            console.log("WebSocket connection established");
            document.getElementById("appState").textContent =
                "Соединение установлено";
            reconnectAttempts = 0;
        };

        currentSocket.onerror = (e) => {
            console.error("WebSocket error:", e);
            document.getElementById("appState").textContent =
                "Ошибка соединения с сервером";
        };

        currentSocket.onmessage = function (event) {
            const data = JSON.parse(event.data);
            //console.log("Received message:", data);

            const method_id = data.method_id;

            /*if (data.action === "start_ack") {
                if (state.activeRequests[method_id] === data.request_id) {
                }
            } else */
            if (
                data.action === "stop_ack" ||
                data.action === "complete" ||
                data.action === "error"
            ) {
                if (state.activeRequests[method_id] === data.request_id) {
                    delete state.activeRequests[method_id];
                }
            } else if (data.action === "iteration") {
                const method_id = data.method_id;
                state.tabsData[method_id].population = data["population"];
                state.tabsData[method_id].best_solution = data["best_solution"];
                state.tabsData[method_id].best_fitness = data["best_fitness"];
                state.tabsData[method_id].iteration = data["iteration"];

                if (method_id === state.currentTab) {
                    updateMethodInfo();
                    addPoints(
                        state.currentFunction,
                        state.tabsData[method_id].population,
                        state.tabsData[method_id].best_solution,
                        state.plotSettings.showPopulation,
                        state.plotSettings.pointSize
                    );
                }
            }
        };

        currentSocket.onclose = function () {
            console.log("Соединение потеряно");
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay =
                    RECONNECT_INTERVALS[reconnectAttempts] ||
                    RECONNECT_INTERVALS[RECONNECT_INTERVALS.length - 1];
                reconnectAttempts++;
                document.getElementById(
                    "appState"
                ).textContent = `Соединение потеряно, переподключение через ${
                    delay / 1000
                }с...`;
                setTimeout(connect, delay);
            } else {
                document.getElementById("appState").textContent =
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
                document.getElementById("appState").textContent =
                    "Не удалось отправить сообщение";
            }
        } else {
            console.error(
                "WebSocket is not opened:",
                readystateDesc[currentSocket.readyState]
            );
            document.getElementById("appState").textContent =
                "Не удалось отправить сообщение: соединение не установлено";
        }
    }

    connect();
    return sendMessage;
}
