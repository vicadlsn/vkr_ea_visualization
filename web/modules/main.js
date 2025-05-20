import { initUI } from "./ui.js";
import { connectWebsocket } from "./websocket.js";
import { v4 as uuidv4 } from "uuid";
import { state } from "./state.js";

document.addEventListener("DOMContentLoaded", () => {
    initUI();

    state.activeRequests = {};
    document.getElementById(
        "appState"
    ).textContent = `Нет соединения с Websocket сервером...`;

    let socket,
        sendMessage = connectWebsocket();
    const startButton = document.getElementById("startOptimization");
    const stopButton = document.getElementById("stopOptimization");
    const appState = document.getElementById("appState");

    startButton.addEventListener("click", () => {
        const method_id = state.currentTab;
        /* if (state.activeRequests[method_id]) {
            errorDiv.textContent = `Optimization already running for ${method_id}`;
            return;
        }
*/

        const request_id = uuidv4();
        state.activeRequests[method_id] = request_id;
        state.tabsData[method_id].history = [];
        state.tabsData[method_id].total_iterations = state.iterationsCount;
        const params = {
            action: "start",
            request_id: request_id,
            method_id: method_id,
            function: state.currentFunction.function.original,
            lower_bounds: [
                state.currentFunction.boundsX[0],
                state.currentFunction.boundsY[0],
            ],
            upper_bounds: [
                state.currentFunction.boundsX[1],
                state.currentFunction.boundsY[1],
            ],
            boundsX: state.currentFunction.boundsX,
            boundsY: state.currentFunction.boundsY,
            method: state.currentTab,
            iterations_count: state.iterationsCount,
            population_size: state.populationSize,
            params: state.tabsData[state.currentTab].params,
        };
        console.log(state.tabsData[method_id].params);
        sendMessage(params);
    });

    stopButton.addEventListener("click", () => {
        const method_id = state.currentTab;
        const request_id = state.activeRequests[method_id];

        sendMessage({
            action: "stop",
            request_id: request_id,
            method_id: method_id,
        });
    });
});
