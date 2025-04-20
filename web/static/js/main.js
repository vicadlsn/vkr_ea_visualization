import { initUI, state } from "./ui.js";
import { addWebsocket, sendMessage } from "./websocket.js";

document.addEventListener("DOMContentLoaded", () => {
    initUI();

    let socket = addWebsocket();
    const startButton = document.getElementById("startOptimization");
    startButton.addEventListener("click", () => {
        const params = {
            action: "start",
            tab_id: state.currentTab,
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
        console.log(params);
        sendMessage(socket, params);
    });

    const stopOptimization = document.getElementById("stopOptimization");
    stopOptimization.addEventListener("click", () => {
        sendMessage(socket, { action: "stop", tab_id: state.currentTab });
    });
});
