import { v4 as uuidv4 } from 'uuid';
import { initUI, updateMethodInfo, isFormValid } from './ui.js';
import { connectWebsocket } from './websocket.js';
import { state, getCurrentTabData } from './state.js';
import { addPoints, updateConvergencePlot } from './plot.js';

let sendMessage = null;

document.addEventListener('DOMContentLoaded', () => {
    initUI();

    state.activeRequests = {};
    document.getElementById('appState').textContent = `Нет соединения с Websocket сервером...`;

    sendMessage = connectWebsocket();
    const startButton = document.getElementById('startOptimization');
    const stopButton = document.getElementById('stopOptimization');

    startButton.addEventListener('click', (e) => {
        if (!isFormValid()) {
            e.preventDefault();
            alert('Пожалуйста, исправьте ошибки перед отправкой.');
            return;
        }
        startOptimization();
    });

    stopButton.addEventListener('click', () => {
        const tab = getCurrentTabData();
        const method_id = tab.method_name;
        const request_id = state.activeRequests[method_id];

        sendMessage({
            action: 'stop',
            request_id: request_id,
            method_id: method_id,
        });
    });

    document.addEventListener('got-websocket-message', handleWebsocketMessage);
    document.addEventListener('function-changed', () => {
        const tab = getCurrentTabData();
        const method_id = tab.method_name;
        const request_id = state.activeRequests[method_id];
        if (state.activeRequests[method_id]) {
            delete state.activeRequests[method_id];
        }
        sendMessage({
            action: 'stop',
            request_id: request_id,
            method_id: method_id,
        });
    });
});

function startOptimization() {
    const tab = getCurrentTabData();
    const method_id = tab.method_name;
    const request_id = uuidv4();
    state.activeRequests[method_id] = request_id;
    tab.history = [];
    tab.total_iterations = tab.iterations_count;
    const boundsX = tab.currentFunction.boundsX.slice().sort((a, b) => a - b);
    const boundsY = tab.currentFunction.boundsY.slice().sort((a, b) => a - b);

    const params = {
        action: 'start',
        request_id: request_id,
        method_id: method_id,
        function: tab.currentFunction.function.original,
        lower_bounds: [boundsX[0], boundsY[0]],
        upper_bounds: [boundsX[1], boundsY[1]],
        iterations_count: tab.iterations_count,
        params: tab.params,
    };

    console.log(tab.params);
    sendMessage(params);
}

function handleWebsocketMessage(event) {
    const data = event.detail.data;
    console.log('Received message:', data);

    const method_id = data.method_id;
    const request_id = data.request_id;
    const action = data.action;

    switch (action) {
        case 'start_ack':
            break;
        case 'stop_ack':
        case 'error':
        case 'complete': {
            if (state.activeRequests[method_id] !== request_id) {
                break;
            }

            delete state.activeRequests[method_id];
            if (method_id === state.currentTab && !state.plotSettings.showSurface) {
                updateConvergencePlot(
                    document.getElementById('convergencePlot'),
                    state.tabsData[method_id].history,
                );
            }

            break;
        }
        case 'iteration': {
            if (state.activeRequests[method_id] !== request_id) {
                break;
            }

            const tab = state.tabsData[method_id];
            tab.population = data['population'];
            tab.best_solution = data['best_solution'];
            tab.best_fitness = data['best_fitness'];
            tab.current_best_solution = data['current_best_solution'];
            tab.current_best_fitness = data['current_best_fitness'];
            tab.iteration = data['iteration'];
            tab.history.push(data['current_best_fitness']);
            if (method_id === state.currentTab) {
                updateMethodInfo();
                if (state.plotSettings.showSurface) {
                    addPoints(
                        tab.currentFunction,
                        tab.population,
                        tab.best_solution,
                        state.plotSettings.showPopulation,
                        tab.plotSettings.pointSize,
                    );
                }
            }
        }
    }
}
