import { state, getCurrentTabData, getCurrentTabDataFunction, METHOD_NAMES } from './state.js';

import { getFunctionData, getFunctionLabels, builtinFunctions } from './func.js';

import {
    plotSurface,
    resetCamera,
    addPoints,
    initConvergencePlot,
    updateConvergencePlot,
} from './plot.js';

export { updatePlot, updateMethodInfo, getCurrentTabData };

const funcInputErrMsg = 'Ошибка ввода функции.';
const info = document.getElementById('methodInfoContent');
const convergencePlotDiv = document.getElementById('convergencePlot');

function restoreStateFunctionChange() {
    const tab = getCurrentTabData();
    tab.population = [];
    tab.history = [];
    tab.best_solution = undefined;
    tab.best_fitness = undefined;
    tab.iteration = 0;
    tab.total_iterations = 0;
}
function updateMethodInfo() {
    const currentTab = getCurrentTabData();
    const func = getCurrentTabDataFunction().function.original;

    const bestSolution =
        Array.isArray(currentTab.best_solution) && currentTab.best_solution.length >= 2
            ? `(${currentTab.best_solution[0].toFixed(4)}, ${currentTab.best_solution[1].toFixed(4)})`
            : '';

    const bestFitness =
        typeof currentTab.best_fitness === 'number' ? currentTab.best_fitness.toFixed(4) : '';

    const iteration =
        typeof currentTab.iteration === 'number' && typeof currentTab.total_iterations === 'number'
            ? `${currentTab.iteration}/${currentTab.total_iterations}`
            : '';

    info.innerHTML = `
        <strong>Функция:</strong> ${func}<br>
        <strong>Метод:</strong> ${state.currentTab}<br>
        <strong>Текущее решение:</strong> ${bestSolution}<br>
        <strong>Значение:</strong> ${bestFitness}<br>
        <strong>Итерация:</strong> ${iteration}<br>
    `;
}

function updatePlot() {
    const tabData = getCurrentTabData();
    if (state.plotSettings.showSurface) {
        plotSurface(
            tabData.currentFunction,
            { ...state.plotSettings, ...tabData.plotSettings },
            tabData.population,
            tabData.best_solution,
        );
    } else {
        updateConvergencePlot(convergencePlotDiv, tabData.history);
    }
}

function setInput(inputElement, valid, errorElement, errMsg = '') {
    if (valid) {
        inputElement.classList.remove('invalid');
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    } else {
        inputElement.classList.add('invalid');

        errorElement.textContent = errMsg;
        errorElement.style.display = 'block';
    }
}

function handleFunctionChange(inputElement, selectElement, functionErrorElement) {
    const data = getFunctionData(inputElement.value);
    if (data) {
        setInput(inputElement, true, functionErrorElement);
        getCurrentTabDataFunction().function = data;
        getCurrentTabDataFunction().builtin = '';
        restoreStateFunctionChange();
        updateMethodInfo();
        updatePlot();
    } else {
        setInput(inputElement, false, functionErrorElement, funcInputErrMsg);
    }
    selectElement.selectedIndex = 0;
}

function updateSettingsUI() {
    const tabData = getCurrentTabData();
    document.getElementById('functionSelectBuiltin').value = tabData.currentFunction.builtin;
    /*document.getElementById("showGrid").checked =
        tabData.plotSettings.showGrid;*/

    // Параметры графика
    document.getElementById('resolutionInput').value = tabData.plotSettings.resolution;
    /*document.getElementById("showPopulation").checked =
        tabData.plotSettings.showPopulation;*/
    /*document.getElementById("equalScale").checked =
        tabData.plotSettings.equalScale;*/
    document.getElementById('pointSizeInput').value = tabData.plotSettings.pointSize;
    document.getElementById('aspectratioXInput').value = tabData.plotSettings.aspectratioX;
    document.getElementById('aspectratioYInput').value = tabData.plotSettings.aspectratioY;
    document.getElementById('aspectratioZInput').value = tabData.plotSettings.aspectratioZ;

    // Общие параметры метода
    document.getElementById('functionInput').value = tabData.currentFunction.function.original;
    document.getElementById('xRangeMin').value = tabData.currentFunction.boundsX[0];
    document.getElementById('xRangeMax').value = tabData.currentFunction.boundsX[1];
    document.getElementById('yRangeMin').value = tabData.currentFunction.boundsY[0];
    document.getElementById('yRangeMax').value = tabData.currentFunction.boundsY[1];
    document.getElementById('populationSizeInput').value = tabData.population_size;
    document.getElementById('iterationsCountInput').value = tabData.iterations_count;
}

function setupTabs() {
    const bboTabButton = document.getElementById('bbo_tab_button');
    const culturalTabButton = document.getElementById('cultural_tab_button');

    const bboTab = document.getElementById('bbo_algorithm_tab');
    const culturalTab = document.getElementById('cultural_algorithm_tab');

    const tabs = document.getElementsByClassName('tab-content');
    const tabButtons = document.getElementsByClassName('tabButton');

    state.currentTab = METHOD_NAMES.bbo;

    bboTab.classList.add('active-tab');
    bboTabButton.classList.add('active-button');

    function activateTab(tab_name) {
        for (let i = 0; i < tabButtons.length; i++) {
            tabButtons[i].classList.remove('active-button');
        }

        for (let i = 0; i < tabs.length; i++) {
            tabs[i].classList.remove('active-tab');
        }

        if (tab_name === METHOD_NAMES.bbo) {
            bboTabButton.classList.add('active-button');
            bboTab.classList.add('active-tab');
        }
        if (tab_name === METHOD_NAMES.cultural) {
            culturalTabButton.classList.add('active-button');
            culturalTab.classList.add('active-tab');
        }

        state.currentTab = tab_name;
        updateMethodInfo();
        updateSettingsUI();
        updatePlot();
    }

    bboTabButton.addEventListener('click', () => activateTab(METHOD_NAMES.bbo));
    culturalTabButton.addEventListener('click', () => activateTab(METHOD_NAMES.cultural));
}

function setupEventListeners() {
    const functionInput = document.getElementById('functionInput');
    functionInput.value = getCurrentTabDataFunction().function.original;

    const functionErrorElement = document.getElementById('functionError');
    const functionSelectBuiltin = document.getElementById('functionSelectBuiltin');

    const xRangeMin = document.getElementById('xRangeMin');
    const xRangeMax = document.getElementById('xRangeMax');
    const yRangeMin = document.getElementById('yRangeMin');
    const yRangeMax = document.getElementById('yRangeMax');
    const resolution = document.getElementById('resolutionInput');
    const pointSize = document.getElementById('pointSizeInput');
    const aspectratioX = document.getElementById('aspectratioXInput');
    const aspectratioY = document.getElementById('aspectratioYInput');
    const aspectratioZ = document.getElementById('aspectratioZInput');

    functionSelectBuiltin.addEventListener('change', (event) => {
        const target = event.target;
        const builtin = builtinFunctions[target.value];
        const curFunc = getCurrentTabDataFunction();

        functionInput.value = builtin.original;
        setInput(functionInput, true, functionErrorElement);

        xRangeMin.value = String(builtin.boundsX[0]);
        xRangeMax.value = String(builtin.boundsX[1]);
        yRangeMin.value = String(builtin.boundsY[0]);
        yRangeMax.value = String(builtin.boundsY[1]);

        curFunc.function = getFunctionData(functionInput.value);
        curFunc.boundsX = [...builtin.boundsX];
        curFunc.boundsY = [...builtin.boundsY];
        curFunc.builtin = target.value;

        const tabData = getCurrentTabData();
        tabData.plotSettings.aspectratioX = builtin.zoom[0];
        tabData.plotSettings.aspectratioY = builtin.zoom[1];
        tabData.plotSettings.aspectratioZ = builtin.zoom[2];
        aspectratioX.value = tabData.plotSettings.aspectratioX;
        aspectratioY.value = tabData.plotSettings.aspectratioY;
        aspectratioZ.value = tabData.plotSettings.aspectratioZ;

        restoreStateFunctionChange();
        updateMethodInfo();
        updatePlot();
    });

    functionInput.addEventListener('change', () =>
        handleFunctionChange(functionInput, functionSelectBuiltin, functionErrorElement),
    );

    xRangeMin.addEventListener('change', () => {
        getCurrentTabDataFunction().boundsX[0] = parseFloat(xRangeMin.value);
        updatePlot();
    });
    xRangeMax.addEventListener('change', () => {
        getCurrentTabDataFunction().boundsX[1] = parseFloat(xRangeMax.value);
        updatePlot();
    });
    yRangeMin.addEventListener('change', () => {
        getCurrentTabDataFunction().boundsY[0] = parseFloat(yRangeMin.value);
        updatePlot();
    });
    yRangeMax.addEventListener('change', () => {
        getCurrentTabDataFunction().boundsY[1] = parseFloat(yRangeMax.value);
        updatePlot();
    });

    const tabData = getCurrentTabData();
    resolution.value = tabData.plotSettings.resolution;
    resolution.addEventListener('change', () => {
        const val = parseInt(resolution.value);
        if (val && val > 0) {
            getCurrentTabData().plotSettings.resolution = val;
        }
        updatePlot();
    });

    pointSize.value = tabData.pointSize;
    pointSize.addEventListener('input', () => {
        const val = parseFloat(pointSize.value);
        if (val && val > 0) {
            getCurrentTabData().plotSettings.pointSize = val;
        }
        updatePlot();
    });

    aspectratioX.value = tabData.plotSettings.aspectratioX;
    aspectratioY.value = tabData.plotSettings.aspectratioY;
    aspectratioZ.value = tabData.plotSettings.aspectratioZ;

    aspectratioX.addEventListener('change', () => {
        getCurrentTabData().plotSettings.aspectratioX = parseFloat(aspectratioX.value);
        updatePlot();
    });
    aspectratioY.addEventListener('change', () => {
        getCurrentTabData().plotSettings.aspectratioY = parseFloat(aspectratioY.value);
        updatePlot();
    });
    aspectratioZ.addEventListener('change', () => {
        getCurrentTabData().plotSettings.aspectratioZ = parseFloat(aspectratioZ.value);
        updatePlot();
    });
}

function setupAlgorithmParams() {
    const populationInput = document.getElementById('populationSizeInput');
    const iterationsInput = document.getElementById('iterationsCountInput');

    // BBO
    const bboMutationInput = document.getElementById('bbo_mutation_probability');
    const bboBlendingInput = document.getElementById('bbo_blending_rate');
    const bboNumElites = document.getElementById('bbo_num_elites');

    // Cultural
    const culturalParamInput = document.getElementById('cultural_param');

    function updateGeneralParams() {
        const tab = getCurrentTabData();
        tab.population_size = parseInt(populationInput.value);
        tab.iterations_count = parseInt(iterationsInput.value);
    }

    function updateBBOParams() {
        state.tabsData[METHOD_NAMES.bbo].params.mutation_probability = parseFloat(
            bboMutationInput.value,
        );
        state.tabsData[METHOD_NAMES.bbo].params.blending_rate = parseFloat(bboBlendingInput.value);
    }

    function updateCulturalParams() {
        state.tabsData['cultural'].params.cultural_param = parseFloat(culturalParamInput.value);
    }

    // Подписки на изменения
    populationInput.addEventListener('change', updateGeneralParams);
    iterationsInput.addEventListener('change', updateGeneralParams);

    bboMutationInput.addEventListener('change', updateBBOParams);
    bboBlendingInput.addEventListener('change', updateBBOParams);
    bboNumElites.addEventListener('change', () => {
        const value = parseFloat(bboNumElites.value);
        console.log(
            value,
            state.tabsData[METHOD_NAMES.bbo].population_size,
            value < 0 || value >= state.tabsData[METHOD_NAMES.bbo].population_size,
        );
        if (value < 0 || value >= state.tabsData[METHOD_NAMES.bbo].population_size) {
            setInput(
                bboNumElites,
                false,
                document.getElementById('bbo_num_elites_error'),
                'Число элитных особей не должно быть больше размера популяции',
            );
            return;
        }
        setInput(bboNumElites, true, document.getElementById('bbo_num_elites_error'));
        state.tabsData[METHOD_NAMES.bbo].params.num_elites = value;
    });

    culturalParamInput.addEventListener('change', updateCulturalParams);

    populationInput.value = parseInt(getCurrentTabData().population_size);
    iterationsInput.value = parseInt(getCurrentTabData().iterations_count);

    // Инициализация состояния
    updateGeneralParams();
    updateBBOParams();
    updateCulturalParams();
}

function initTestFunctionOptions() {
    const select = document.getElementById('functionSelectBuiltin');
    select.length = 1;

    for (const { key, name } of getFunctionLabels()) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = name;
        select.appendChild(option);
    }
}

function switchPlots() {
    const tabData = getCurrentTabData();
    if (state.plotSettings.showSurface) {
        document.getElementById('graph3d').style.display = 'block';
        convergencePlotDiv.style.display = 'none';
        plotSurface(
            tabData.currentFunction,
            { ...state.plotSettings, ...tabData.plotSettings },
            tabData.population,
            tabData.best_solution,
        );
    } else {
        document.getElementById('graph3d').style.display = 'none';
        convergencePlotDiv.style.display = 'block';
        initConvergencePlot(convergencePlotDiv);
        updateConvergencePlot(convergencePlotDiv, tabData.history);
        //Plotly.Plots.resize(document.getElementById(convergencePlotDiv));
    }

    //updatePlot();
}

function setupUI() {
    initTestFunctionOptions();

    const showSurface = document.getElementById('showSurface');
    showSurface.textContent = state.plotSettings.showSurface
        ? 'График сходимости'
        : 'График поверхности';

    showSurface.addEventListener('click', () => {
        state.plotSettings.showSurface = !state.plotSettings.showSurface;
        showSurface.textContent = state.plotSettings.showSurface
            ? 'График сходимости'
            : 'График поверхности';
        switchPlots();
    });

    const showPopulation = document.getElementById('showPopulation');
    showPopulation.textContent = state.plotSettings.showPopulation
        ? 'Показать минимум'
        : 'Показать популяцию';

    showPopulation.addEventListener('click', () => {
        state.plotSettings.showPopulation = !state.plotSettings.showPopulation;
        showPopulation.textContent = state.plotSettings.showPopulation
            ? 'Показать минимум'
            : 'Показать популяцию';
        //updatePlot();
        let tab = getCurrentTabData();
        if (state.plotSettings.showSurface) {
            addPoints(
                tab.currentFunction,
                tab.population,
                tab.best_solution,
                state.plotSettings.showPopulation,
                tab.plotSettings.pointSize,
            );
        }
    });

    const showGridCheckbox = document.getElementById('showGridCheckbox');
    showGridCheckbox.addEventListener('click', () => {
        state.plotSettings.showGrid = !state.plotSettings.showGrid;
        showGridCheckbox.textContent = state.plotSettings.showGrid
            ? 'Скрыть сетку'
            : 'Показать сетку';
        updatePlot();
    });

    const dropCamera = document.getElementById('dropCamera');
    dropCamera.addEventListener('click', resetCamera);

    const showMode = document.getElementById('showMode');
    showMode.addEventListener('click', () => {
        state.plotSettings.equalScale = !state.plotSettings.equalScale;
        updatePlot();
    });
}

export function initUI() {
    setupEventListeners();
    setupAlgorithmParams();
    setupTabs();

    setupUI();
    updateMethodInfo();
    //initConvergencePlot(convergencePlotDiv);
    updatePlot();
}
