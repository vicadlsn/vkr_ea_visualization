export { addWebsocket, sendMessage };
import { addPoints } from "./plot.js";
import { updatePlot, updateMethodInfo, state } from "./ui.js";

var readystateDesc = { 0: "CONNECTING", 1: "OPEN", 2: "CLOSING", 3: "CLOSED" };

function addWebsocket() {
    const socket = new WebSocket("ws://" + window.location.host);
    socket.onerror = function (e) {
        console.log("Ошибка: " + e.target.readystateDesc);
    };

    socket.onopen = function () {
        console.log("Соединение установлено");
    };

    function sleep(time) {
        return new Promise((resolve) => setTimeout(resolve, time));
    }

    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        const method_name = data["method"];
        const tab_id = data["tab_id"];
        state.tabsData[tab_id].population = data["population"];
        state.tabsData[tab_id].best_solution = data["best_solution"];
        state.tabsData[tab_id].best_fitness = data["best_fitness"];
        state.tabsData[tab_id].iteration = data["iteration"];
        if (state.currentTab == data["tab_id"]) {
            //updatePlot();
            updateMethodInfo();
            addPoints(
                state.currentFunction,
                state.tabsData[tab_id].population,
                state.tabsData[tab_id].best_solution,
                state.plotSettings.showPopulation,
                state.plotSettings.pointSize
            );
        }
        console.log(data);
    };

    socket.onclose = function () {
        console.log("Соединение закрыто");
    };

    return socket;
}

function sendMessage(socket, params) {
    socket.send(JSON.stringify(params));
}
