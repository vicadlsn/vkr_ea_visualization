import { v4 as uuidv4 } from 'uuid';
import { initUI, updateMethodInfo, updateCurrentStatus, isFormValid } from './ui.js';
import { createWebsocket } from './websocket.js';
import { state, getCurrentTabData } from './state.js';
import { addPoints, addTrajectory, updateConvergencePlot } from './plot.js';

const wsConnections = new Map();

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    state.activeRequests = {};

    const startButton = document.getElementById('startOptimization');
    const stopButton = document.getElementById('stopOptimization');

    startButton.addEventListener('click', (e) => {
        if (!isFormValid()) {
            e.preventDefault();
            alert('Пожалуйста, исправьте ошибки перед отправкой.');
            return;
        }

        const tab = getCurrentTabData();
        if (state.activeRequests[tab.method_name]) {
            alert('Задача уже выполняется в этой вкладке.');
            return;
        }
        startOptimization();
    });

    stopButton.addEventListener('click', () => {
        const tab = getCurrentTabData();
        const method_id = tab.method_name;
        stopOptimization(method_id);
        startButton.disabled = false;
    });

    document.addEventListener('function-changed', (e) => {
        const method_id = e.detail?.method_id;
        stopOptimization(method_id);
        startButton.disabled = false;
    });
});

function startOptimization() {
    if (wsConnections.size >= 5) {
        alert('Максимум 5 активных задач');
        return;
    }

    const tab = getCurrentTabData();
    const method_id = tab.method_name;

    if (wsConnections.has(method_id)) {
        stopOptimization(method_id);
    }

    const request_id = uuidv4();
    state.activeRequests[method_id] = request_id;
    state.tabsData[method_id].currentStatus = 'Подключение...';
    tab.history = [];
    tab.trajectory = [];
    tab.total_iterations = tab.iterations_count;
    const boundsX = tab.currentFunction.boundsX.slice().sort((a, b) => a - b);
    const boundsY = tab.currentFunction.boundsY.slice().sort((a, b) => a - b);

    const params = {
        action: 'start',
        request_id: request_id,
        method_id: method_id,
        function: tab.currentFunction.function.juliaString,
        lower_bounds: [boundsX[0], boundsY[0]],
        upper_bounds: [boundsX[1], boundsY[1]],
        iterations_count: tab.iterations_count,
        params: tab.params,
    };
    console.log('Параметры запроса: ', tab.params);

    const startTime = performance.now();
    state.tabsData[method_id].startTime = startTime;
    const ws = createWebsocket(
        method_id,
        () => {
            getCurrentTabData().currentStatus = 'Соединение установлено';
            updateCurrentStatus();
            ws.send(params);
        },
        (data) => handleWebsocketMessage(data, method_id),
        () => {
            stopOptimization(method_id);
            getCurrentTabData().currentStatus = 'Ошибка соединения';
            updateCurrentStatus();
        }, // Ошибка
        () => {
            stopOptimization(method_id);
            getCurrentTabData().currentStatus = 'Соединение закрыто';
            updateCurrentStatus();
        }, // Закрытие
    );
    wsConnections.set(method_id, ws);
}

function stopOptimization(method_id) {
    const ws = wsConnections.get(method_id);
    const request_id = state.activeRequests[method_id];
    if (ws && request_id) {
        ws.send({
            action: 'stop',
            request_id: request_id,
            method_id: method_id,
        });
        ws.close();
    }
    wsConnections.delete(method_id);
    delete state.activeRequests[method_id];
}

function handleWebsocketMessage(data, method_id) {
    console.log('Received message:', data);
    const request_id = data.request_id;
    const action = data.action;

    if (state.activeRequests[method_id] !== request_id) {
        console.log('outdated message');
        return; // устаревшее сообщение
    }

    const elapsedTime = (performance.now() - state.tabsData[method_id].startTime) / 1000;

    switch (action) {
        case 'start_ack': {
            console.log(`Start ack received after ${elapsedTime} seconds`);
            state.tabsData[method_id].currentStatus = 'Оптимизация в процессе';
            updateCurrentStatus();
            break;
        }
        case 'stop_ack': {
            console.log(`Stop ack received after ${elapsedTime} seconds`);
            const ws = wsConnections.get(method_id);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            wsConnections.delete(method_id);
            delete state.activeRequests[method_id];
            state.tabsData[method_id].currentStatus = 'Остановлено';
            updateCurrentStatus();
            if (method_id === state.currentTab && !state.plotSettings.showSurface) {
                updateConvergencePlot(
                    document.getElementById('convergencePlot'),
                    state.tabsData[method_id].history,
                );
            }
            break;
        }
        case 'error': {
            console.log(`Error received after ${elapsedTime} seconds: ${data.message}`);
            const wsError = wsConnections.get(method_id);
            if (wsError && wsError.readyState === WebSocket.OPEN) {
                wsError.close();
            }
            wsConnections.delete(method_id);
            delete state.activeRequests[method_id];
            state.tabsData[method_id].currentStatus = `Ошибка: ${data.message}`;
            updateCurrentStatus();
            if (method_id === state.currentTab && !state.plotSettings.showSurface) {
                updateConvergencePlot(
                    document.getElementById('convergencePlot'),
                    state.tabsData[method_id].history,
                );
            }
            break;
        }
        case 'complete': {
            console.log(`Optimization completed after ${elapsedTime} seconds`);
            const wsComplete = wsConnections.get(method_id);
            if (wsComplete && wsComplete.readyState === WebSocket.OPEN) {
                wsComplete.close();
            }
            wsConnections.delete(method_id);
            delete state.activeRequests[method_id];
            state.tabsData[method_id].currentStatus = 'Оптимизация завершена';
            updateCurrentStatus();
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
            tab.iteration = data['iteration'];
            tab.history.push(data['best_fitness']);
            tab.trajectory.push(data['best_solution']);
            console.log(tab);

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
                    addTrajectory(
                        tab.currentFunction,
                        state.plotSettings.showTrajectory,
                        tab.trajectory,
                    );
                }
            }
            break;
        }
    }
}
