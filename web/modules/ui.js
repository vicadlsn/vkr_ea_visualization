import { state, getCurrentTabData, getCurrentTabDataFunction, METHOD_NAMES } from './state.js';

import { getFunctionData, getFunctionLabels, builtinFunctions } from './func.js';

import {
    plotSurface,
    resetCamera,
    addPoints,
    initConvergencePlot,
    updateConvergencePlot,
    addTrajectory,
} from './plot.js';

export { updatePlot, updateMethodInfo, updateCurrentStatus, getCurrentTabData };

export function isFormValid() {
    const invalidInputs = document.querySelectorAll('.form-input-error');
    return invalidInputs.length === 0;
}

const funcInputErrMsg = 'Ошибка ввода функции.';
const info = document.getElementById('methodInfoContent');
const convergencePlotDiv = document.getElementById('convergencePlot');
let isConvergenceInitialized = false;
function restoreStateFunctionChange() {
    const tab = getCurrentTabData();
    tab.population = [];
    tab.history = [];
    tab.trajectory = [];
    tab.best_solution = undefined;
    tab.best_fitness = undefined;
    tab.iteration = 0;
    tab.total_iterations = 0;
}

const tabStatus = document.getElementById('tabStatus');
function updateCurrentStatus() {
    tabStatus.textContent = getCurrentTabData().currentStatus;
}

function updateMethodInfo() {
    const tabData = getCurrentTabData();
    const func = getCurrentTabDataFunction().function.original;

    const bestSolution =
        Array.isArray(tabData.best_solution) && tabData.best_solution.length >= 2
            ? `(${tabData.best_solution[0].toFixed(4)}, ${tabData.best_solution[1].toFixed(4)})`
            : '';

    const bestFitness =
        typeof tabData.best_fitness === 'number' ? tabData.best_fitness.toFixed(4) : '';

    const iteration =
        typeof tabData.iteration === 'number' && typeof tabData.total_iterations === 'number'
            ? `${tabData.iteration}/${tabData.total_iterations}`
            : '';

    info.innerHTML = `
        <strong>Функция:</strong> ${func}<br>
        <strong>Лучшее решение:</strong> ${bestSolution}<br>
        <strong>Лучшее значение:</strong> ${bestFitness}<br>
        <strong>Итерация:</strong> ${iteration}<br>
    `;
    // <strong>Метод:</strong> ${tabData.method_name}<br>
    updateCurrentStatus();
}

function updatePlot() {
    const tabData = getCurrentTabData();
    if (state.plotSettings.showSurface) {
        plotSurface(
            tabData.currentFunction,
            { ...state.plotSettings, ...tabData.plotSettings },
            tabData.population,
            tabData.best_solution,
            tabData.trajectory,
        );
    } else {
        updateConvergencePlot(convergencePlotDiv, tabData.history);
    }
}

function setInput(inputElement, valid, errorElement, errMsg = '') {
    if (valid) {
        inputElement.classList.remove('form-input-error');
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    } else {
        inputElement.classList.add('form-input-error');

        errorElement.textContent = errMsg;
        errorElement.style.display = 'block';
    }
}

function handleFunctionChange(inputElement, selectElement, functionErrorElement) {
    const tabData = getCurrentTabData();
    const data = getFunctionData(inputElement.value);
    if (data) {
        const tab = getCurrentTabData();
        if (state.activeRequests[tab.method_name]) {
            alert('Нельзя обновить функцию, пока задача выполняется в этой вкладке.');
            return;
        }

        setInput(inputElement, true, functionErrorElement);
        tabData.currentFunction.function = data;
        tabData.currentFunction.builtin = '';
        restoreStateFunctionChange();
        updateMethodInfo();
        updatePlot();
        document.dispatchEvent(
            new CustomEvent('function-change', {
                detail: { method_id: tabData.method_name },
            }),
        );
    } else {
        setInput(inputElement, false, functionErrorElement, funcInputErrMsg);
    }
    selectElement.selectedIndex = 0;
}

const functionInput = document.getElementById('functionInput');
const functionErrorElement = document.getElementById('functionError');
const functionSelectBuiltin = document.getElementById('functionSelectBuiltin');
const xRangeMinInput = document.getElementById('xRangeMin');
const xRangeMaxInput = document.getElementById('xRangeMax');
const yRangeMinInput = document.getElementById('yRangeMin');
const yRangeMaxInput = document.getElementById('yRangeMax');
const resolutionInput = document.getElementById('resolutionInput');
const pointSizeInput = document.getElementById('pointSizeInput');
const aspectratioXInput = document.getElementById('aspectratioXInput');
const aspectratioYInput = document.getElementById('aspectratioYInput');
const aspectratioZInput = document.getElementById('aspectratioZInput');
const iterationsCountInput = document.getElementById('iterationsCountInput');
const iterationsCountInputErrorDiv = document.getElementById('iterationsCountInputErrorDiv');

function updateSettingsUI() {
    const tabData = getCurrentTabData();
    functionSelectBuiltin.value = tabData.currentFunction.builtin;

    // Параметры графика
    resolutionInput.value = tabData.plotSettings.resolution;
    pointSizeInput.value = tabData.plotSettings.pointSize;
    aspectratioXInput.value = tabData.plotSettings.aspectratioX;
    aspectratioYInput.value = tabData.plotSettings.aspectratioY;
    aspectratioZInput.value = tabData.plotSettings.aspectratioZ;

    // Общие параметры метода
    functionInput.value = tabData.currentFunction.function.original;
    xRangeMinInput.value = tabData.currentFunction.boundsX[0];
    xRangeMaxInput.value = tabData.currentFunction.boundsX[1];
    yRangeMinInput.value = tabData.currentFunction.boundsY[0];
    yRangeMaxInput.value = tabData.currentFunction.boundsY[1];
    iterationsCountInput.value = tabData.iterations_count;
}

function setupTabs() {
    const bboTabButton = document.getElementById('bbo_tab_button');
    const culturalTabButton = document.getElementById('cultural_tab_button');
    const harmonyTabButton = document.getElementById('harmony_tab_button');

    const bboTab = document.getElementById('bbo_algorithm_tab');
    const culturalTab = document.getElementById('cultural_algorithm_tab');
    const harmonyTab = document.getElementById('harmony_algorithm_tab');

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
        if (tab_name === METHOD_NAMES.harmony) {
            harmonyTabButton.classList.add('active-button');
            harmonyTab.classList.add('active-tab');
        }

        state.currentTab = tab_name;
        updateMethodInfo();
        updateSettingsUI();
        updatePlot();
    }

    bboTabButton.addEventListener('click', (e) => {
        if (!isFormValid()) {
            e.preventDefault();
            alert('Пожалуйста, исправьте ошибки на текущей вкладке.');
            return;
        }
        activateTab(METHOD_NAMES.bbo);
    });
    culturalTabButton.addEventListener('click', (e) => {
        if (!isFormValid()) {
            e.preventDefault();
            alert('Пожалуйста, исправьте ошибки на текущей вкладке.');
            return;
        }
        activateTab(METHOD_NAMES.cultural);
    });
    harmonyTabButton.addEventListener('click', (e) => {
        if (!isFormValid()) {
            e.preventDefault();
            alert('Пожалуйста, исправьте ошибки на текущей вкладке.');
            return;
        }
        activateTab(METHOD_NAMES.harmony);
    });
}

function setupEventListeners() {
    functionInput.value = getCurrentTabDataFunction().function.original;

    functionSelectBuiltin.addEventListener('change', (event) => {
        const tab = getCurrentTabData();
        if (state.activeRequests[tab.method_name]) {
            alert('Нельзя обновить функцию, пока задача выполняется в этой вкладке.');
            return;
        }

        const target = event.target;

        const builtin = builtinFunctions[target.value];
        const curFunc = getCurrentTabDataFunction();

        functionInput.value = builtin.original;
        setInput(functionInput, true, functionErrorElement);

        xRangeMinInput.value = String(builtin.boundsX[0]);
        xRangeMaxInput.value = String(builtin.boundsX[1]);
        yRangeMinInput.value = String(builtin.boundsY[0]);
        yRangeMaxInput.value = String(builtin.boundsY[1]);

        curFunc.function = getFunctionData(functionInput.value);
        curFunc.boundsX = [...builtin.boundsX];
        curFunc.boundsY = [...builtin.boundsY];
        curFunc.builtin = target.value;

        const tabData = getCurrentTabData();
        tabData.plotSettings.aspectratioX = builtin.zoom[0];
        tabData.plotSettings.aspectratioY = builtin.zoom[1];
        tabData.plotSettings.aspectratioZ = builtin.zoom[2];
        aspectratioXInput.value = tabData.plotSettings.aspectratioX;
        aspectratioYInput.value = tabData.plotSettings.aspectratioY;
        aspectratioZInput.value = tabData.plotSettings.aspectratioZ;

        restoreStateFunctionChange();
        updateMethodInfo();
        updatePlot();
    });

    functionInput.addEventListener('change', () =>
        handleFunctionChange(functionInput, functionSelectBuiltin, functionErrorElement),
    );

    xRangeMinInput.addEventListener('change', () => {
        const value = parseFloat(xRangeMinInput.value);
        const boundsMax = getCurrentTabDataFunction().boundsX[1];

        if (isNaN(value) || value >= boundsMax) {
            xRangeMinInput.classList.add('form-input-error');
            return;
        }

        getCurrentTabDataFunction().boundsX[0] = value;
        xRangeMinInput.classList.remove('form-input-error');
        updatePlot();
    });

    xRangeMaxInput.addEventListener('change', () => {
        const value = parseFloat(xRangeMaxInput.value);
        const boundsMin = getCurrentTabDataFunction().boundsX[0];

        if (isNaN(value) || value <= boundsMin) {
            xRangeMaxInput.classList.add('form-input-error');
            return;
        }

        getCurrentTabDataFunction().boundsX[1] = value;
        xRangeMaxInput.classList.remove('form-input-error');
        updatePlot();
    });

    yRangeMinInput.addEventListener('change', () => {
        const value = parseFloat(yRangeMinInput.value);
        const boundsMax = getCurrentTabDataFunction().boundsY[1];

        if (isNaN(value) || value >= boundsMax) {
            yRangeMinInput.classList.add('form-input-error');
            return;
        }

        getCurrentTabDataFunction().boundsY[0] = value;
        yRangeMinInput.classList.remove('form-input-error');
        updatePlot();
    });

    yRangeMaxInput.addEventListener('change', () => {
        const value = parseFloat(yRangeMaxInput.value);
        const boundsMin = getCurrentTabDataFunction().boundsY[0];

        if (isNaN(value) || value <= boundsMin) {
            yRangeMaxInput.classList.add('form-input-error');
            return;
        }

        getCurrentTabDataFunction().boundsY[1] = value;
        yRangeMaxInput.classList.remove('form-input-error');
        updatePlot();
    });

    const tabData = getCurrentTabData();
    resolutionInput.value = tabData.plotSettings.resolution;
    resolutionInput.addEventListener('change', () => {
        const val = parseInt(resolutionInput.value);
        if (val && val > 0) {
            getCurrentTabData().plotSettings.resolution = val;
        }
        updatePlot();
    });

    pointSizeInput.value = tabData.pointSize;
    pointSizeInput.addEventListener('input', () => {
        const val = parseFloat(pointSizeInput.value);
        if (val && val > 0) {
            getCurrentTabData().plotSettings.pointSize = val;
        }
        updatePlot();
    });

    aspectratioXInput.value = tabData.plotSettings.aspectratioX;
    aspectratioYInput.value = tabData.plotSettings.aspectratioY;
    aspectratioZInput.value = tabData.plotSettings.aspectratioZ;

    aspectratioXInput.addEventListener('change', () => {
        const value = parseFloat(aspectratioXInput.value);
        if (isNaN(value)) {
            aspectratioXInput.classList.add('form-input-error');
            return;
        }
        getCurrentTabData().plotSettings.aspectratioX = value;
        aspectratioXInput.classList.remove('form-input-error');
        updatePlot();
    });
    aspectratioYInput.addEventListener('change', () => {
        const value = parseFloat(aspectratioYInput.value);
        if (isNaN(value)) {
            aspectratioYInput.classList.add('form-input-error');
            return;
        }
        getCurrentTabData().plotSettings.aspectratioY = value;
        aspectratioYInput.classList.remove('form-input-error');
        updatePlot();
    });
    aspectratioZInput.addEventListener('change', () => {
        const value = parseFloat(aspectratioZInput.value);
        if (isNaN(value)) {
            aspectratioZInput.classList.add('form-input-error');
            return;
        }
        getCurrentTabData().plotSettings.aspectratioZ = value;
        aspectratioZInput.classList.remove('form-input-error');
        updatePlot();
    });

    const copyDataButton = document.getElementById('copyData');
    const pasteDataButton = document.getElementById('pasteData');

    copyDataButton.addEventListener('click', () => {
        const tabData = getCurrentTabData();
        if (!state.copied) state.copied = {};
        state.copied.function = structuredClone(tabData.currentFunction);
        state.copied.iterations_count = tabData.iterations_count;
        state.copied;
    });
    pasteDataButton.addEventListener('click', () => {
        if (
            state.copied &&
            state.copied.function &&
            typeof state.copied.iterations_count === 'number'
        ) {
            const tab = getCurrentTabData();
            if (state.activeRequests[tab.method_name]) {
                alert('Нельзя обновить настройки, пока задача выполняется в этой вкладке.');
                return;
            }

            const copiedFunction = state.copied.function;
            functionInput.value = copiedFunction.function.original || '';
            functionSelectBuiltin.value = copiedFunction.builtin || '';
            xRangeMinInput.value = copiedFunction.boundsX?.[0] ?? '';
            xRangeMaxInput.value = copiedFunction.boundsX?.[1] ?? '';
            yRangeMinInput.value = copiedFunction.boundsY?.[0] ?? '';
            yRangeMaxInput.value = copiedFunction.boundsY?.[1] ?? '';
            iterationsCountInput.value = state.copied.iterations_count;

            functionInput.dispatchEvent(new Event('change', { bubbles: true }));
            functionSelectBuiltin.dispatchEvent(new Event('change', { bubbles: true }));
            xRangeMinInput.dispatchEvent(new Event('change', { bubbles: true }));
            xRangeMaxInput.dispatchEvent(new Event('change', { bubbles: true }));
            yRangeMinInput.dispatchEvent(new Event('change', { bubbles: true }));
            yRangeMaxInput.dispatchEvent(new Event('change', { bubbles: true }));
            iterationsCountInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

function bindNumericInput(
    input,
    parseFunc,
    updateCallback,
    validator = null,
    errorDiv = null,
    errorMsg = '',
) {
    input.addEventListener('change', () => {
        const value = parseFunc(input.value);
        if (validator === null || validator(value)) {
            updateCallback(value);
            if (errorDiv) setInput(input, true, errorDiv);
        } else {
            if (errorDiv) setInput(input, false, errorDiv, errorMsg || 'Неверное значение');
        }
    });
}

function setupAlgorithmParams() {
    function setupGeneralParams() {
        iterationsCountInput.value = state.tabsData[METHOD_NAMES.bbo].iterations_count;
        iterationsCountInput.addEventListener('change', () => {
            const val = parseInt(iterationsCountInput.value);
            if (Number.isInteger(val) && val > 0) {
                state.tabsData[state.currentTab].iterations_count = val;
                setInput(iterationsCountInput, true, iterationsCountInputErrorDiv);
            } else {
                setInput(
                    iterationsCountInput,
                    false,
                    iterationsCountInputErrorDiv,
                    'Число итераций должно быть целым и больше 0.',
                );
            }
        });
    }

    // --- BBO ---
    const bboIslandsCount = document.getElementById('bbo_islands_count');
    const bboIslandsCountErrorDiv = document.getElementById('bbo_islands_count_error');
    const bboMutationInput = document.getElementById('bbo_mutation_probability');
    const bboMutationInputErrorDiv = document.getElementById('bbo_mutation_probability_error');
    const bboBlendingInput = document.getElementById('bbo_blending_rate');
    const bboBlendingInputErrorDiv = document.getElementById('bbo_blending_rate_error');
    const bboNumElites = document.getElementById('bbo_num_elites');
    const bboNumElitesErrorDiv = document.getElementById('bbo_num_elites_error');

    function setupBBOInputs() {
        const params = state.tabsData[METHOD_NAMES.bbo].params;

        bboIslandsCount.value = params.islands_count;
        bboMutationInput.value = params.mutation_probability;
        bboBlendingInput.value = params.blending_rate;
        bboNumElites.value = params.num_elites;

        bboIslandsCount.addEventListener('change', () => {
            const islands = parseInt(bboIslandsCount.value);
            const elites = parseInt(bboNumElites.value);

            // Проверка islandsCount
            if (!Number.isInteger(islands) || islands <= 0) {
                setInput(
                    bboIslandsCount,
                    false,
                    bboIslandsCountErrorDiv,
                    'Число островов должно быть целым положительным числом',
                );
                return;
            }

            // Проверка numElites (вторично)
            if (Number.isInteger(elites) && elites >= islands) {
                setInput(
                    bboIslandsCount,
                    false,
                    bboIslandsCountErrorDiv,
                    'Число островов должно быть больше числа элитных островов.',
                );
                return;
            }

            setInput(bboIslandsCount, true, bboIslandsCountErrorDiv);
            if (Number.isInteger(elites)) {
                setInput(bboNumElites, true, bboNumElitesErrorDiv);
            }

            params.islands_count = islands;
            params.num_elites = elites;
        });

        bindNumericInput(
            bboMutationInput,
            parseFloat,
            (val) => (params.mutation_probability = val),
            (val) => typeof val === 'number' && !Number.isNaN(val) && val >= 0 && val <= 1,
            bboMutationInputErrorDiv,
            'Вероятность мутации должна быть в пределах от 0 до 1',
        );

        bindNumericInput(
            bboBlendingInput,
            parseFloat,
            (val) => (params.blending_rate = val),
            (val) => typeof val === 'number' && !Number.isNaN(val) && val >= 0 && val <= 1,
            bboBlendingInputErrorDiv,
            'Вес родителя должен быть в пределах от 0 до 1',
        );

        bboNumElites.addEventListener('change', () => {
            const islands = parseInt(bboIslandsCount.value);
            const elites = parseInt(bboNumElites.value);

            // Проверка islandsCount
            if (!Number.isInteger(elites) || elites <= 0) {
                setInput(
                    bboNumElites,
                    false,
                    bboNumElitesErrorDiv,
                    'Число элитных островов должно положительным целым числом',
                );
                return;
            }

            // Проверка islandsCount (вторично)
            if (Number.isInteger(islands) && elites >= islands) {
                setInput(
                    bboNumElites,
                    false,
                    bboNumElitesErrorDiv,
                    'Число элитных островов должно быть меньше числа островов.',
                );
                return;
            }

            setInput(bboNumElites, true, bboNumElitesErrorDiv);
            if (Number.isInteger(elites)) {
                setInput(bboIslandsCount, true, bboIslandsCountErrorDiv);
            }

            params.islands_count = islands;
            params.num_elites = elites;
        });
    }

    // --- Cultural ---
    const caPopulationSize = document.getElementById('ca_population_size');
    const caPopulationSizeErrorDiv = document.getElementById('ca_population_size_error');

    const caNumAccepted = document.getElementById('ca_num_accepted');
    const caNumAcceptedErrorDiv = document.getElementById('ca_num_accepted_error');

    const caBeliefSpaceInertia = document.getElementById('ca_belief_space_inertia');
    const caBeliefSpaceInertiaErrorDiv = document.getElementById('ca_belief_space_inertia_error');

    const caMutationalDispersion = document.getElementById('ca_mutational_dispersion');
    const caMutationalDispersionErrorDiv = document.getElementById(
        'ca_mutational_dispersion_error',
    );

    const caMutationScale = document.getElementById('ca_mutation_scale');
    const caMutationScaleErrorDiv = document.getElementById('ca_mutation_scale_error');

    function setupCulturalInputs() {
        const culturalState = state.tabsData[METHOD_NAMES.cultural];
        const params = culturalState.params;

        caPopulationSize.value = params.population_size;
        caNumAccepted.value = params.num_accepted;
        caBeliefSpaceInertia.value = params.inertia;
        caMutationalDispersion.value = params.gamma;
        caMutationScale.value = params.beta;

        function validateCAFields(source) {
            const count = parseInt(caPopulationSize.value);
            const accepted = parseInt(caNumAccepted.value);
            let valid = true;

            // Проверка count
            if (!Number.isInteger(count) || count <= 0) {
                if (source === 'count') {
                    setInput(
                        caPopulationSize,
                        false,
                        caPopulationSizeErrorDiv,
                        'Число индивидов должно быть целым положительным числом',
                    );
                }
                valid = false;
            } else if (Number.isInteger(accepted) && accepted > count) {
                if (source === 'count') {
                    setInput(
                        caPopulationSize,
                        false,
                        caPopulationSizeErrorDiv,
                        'Число индивидов должно быть не меньше элитных и принимаемых особей.',
                    );
                }
                valid = false;
            } else {
                setInput(caPopulationSize, true, caPopulationSizeErrorDiv);
            }

            // Проверка принятых особей
            if (!Number.isInteger(accepted) || accepted < 1 || accepted > count) {
                if (source === 'accepted') {
                    setInput(
                        caNumAccepted,
                        false,
                        caNumAcceptedErrorDiv,
                        'Число принятых особей должно быть >= 1 и не больше числа всех особей',
                    );
                }
                valid = false;
            } else {
                setInput(caNumAccepted, true, caNumAcceptedErrorDiv);
            }

            if (valid) {
                params.population_size = count;
                //  params.num_elites = elites;
                params.num_accepted = accepted;
            }
        }

        bindNumericInput(
            caBeliefSpaceInertia,
            parseFloat,
            (val) => (params.inertia = val),
            (val) => typeof val === 'number' && !Number.isNaN(val) && val >= 0 && val <= 1,
            caBeliefSpaceInertiaErrorDiv,
            'Инерция пространства убеждений должна быть в диапазоне [0, 1]',
        );

        bindNumericInput(
            caMutationalDispersion,
            parseFloat,
            (val) => (params.gamma = val),
            (val) => typeof val === 'number' && !Number.isNaN(val) && val >= 0,
            caMutationalDispersionErrorDiv,
            'Базовая дисперсия должна быть больше 0',
        );

        bindNumericInput(
            caMutationScale,
            parseFloat,
            (val) => (params.beta = val),
            (val) => typeof val === 'number' && !Number.isNaN(val) && val >= 0,
            caMutationScaleErrorDiv,
            'Коэффициент влияния приспособленности должен быть больше 0',
        );

        caPopulationSize.addEventListener('change', () => validateCAFields('count'));
        caNumAccepted.addEventListener('change', () => validateCAFields('accepted'));
    }

    // --- Harmony Search ---
    const hsModeSelect = document.getElementById('hs_mode');
    const hsHmsInput = document.getElementById('hs_hms');
    const hsHmsErrorDiv = document.getElementById('hs_hms_error');
    const hsHmcrInput = document.getElementById('hs_hmcr');
    const hsHmcrErrorDiv = document.getElementById('hs_hmcr_error');
    const hsParInput = document.getElementById('hs_par');
    const hsParErrorDiv = document.getElementById('hs_par_error');
    const hsBwInput = document.getElementById('hs_bw');
    const hsBwErrorDiv = document.getElementById('hs_bw_error');

    const hsParStartInput = document.getElementById('hs_par_start');
    const hsParEndInput = document.getElementById('hs_par_end');
    const hsParRangeErrorDiv = document.getElementById('hs_par_range_error');
    const hsBwStartInput = document.getElementById('hs_bw_start');
    const hsBwEndInput = document.getElementById('hs_bw_end');
    const hsBwRangeErrorDiv = document.getElementById('hs_bw_range_error');

    const hsCanonicalParamsDiv = document.getElementById('hs_canonical_params');
    const hsAdaptiveParamsDiv = document.getElementById('hs_adaptive_params');

    function setupHSInputs() {
        const hsState = state.tabsData[METHOD_NAMES.harmony].params;
        hsModeSelect.value = hsState.mode || 'canonical';
        hsHmcrInput.value = hsState.hmcr;
        hsParInput.value = hsState.par;
        hsBwInput.value = hsState.bw;
        hsHmsInput.value = hsState.hms;

        hsParStartInput.value = hsState.par_start;
        hsParEndInput.value = hsState.par_end;
        hsBwStartInput.value = hsState.bw_start;
        hsBwEndInput.value = hsState.bw_end;

        function updateHSModeUI() {
            const isCanonical = hsModeSelect.value === 'canonical';
            //hsHmcrInput.disabled = !isCanonical;
            /*hsParInput.disabled = !isCanonical;
            hsBwInput.disabled = !isCanonical;
            hsParInput.parentElement.style.display = isCanonical ? '' : 'none';
            hsBwInput.parentElement.style.display = isCanonical ? '' : 'none';*/

            hsCanonicalParamsDiv.style.display = isCanonical ? '' : 'none';
            hsAdaptiveParamsDiv.style.display = isCanonical ? 'none' : '';
        }

        hsModeSelect.addEventListener('change', () => {
            hsState.mode = hsModeSelect.value;
            updateHSModeUI();
        });

        bindNumericInput(
            hsHmsInput,
            parseInt,
            (val) => (hsState.hms = val),
            (val) => Number.isInteger(val) && val >= 1,
            hsHmsErrorDiv,
            'Значение должно быть целым и больше 0.',
        );

        bindNumericInput(
            hsHmcrInput,
            parseFloat,
            (val) => (hsState.hmcr = val),
            (val) => val >= 0 && val <= 1,
            hsHmcrErrorDiv,
            'Значение должно быть в пределах от 0 до 1.',
        );

        bindNumericInput(
            hsParInput,
            parseFloat,
            (val) => (hsState.par = val),
            (val) => val >= 0 && val <= 1,
            hsParErrorDiv,
            'Значение должно быть в пределах от 0 до 1.',
        );

        bindNumericInput(
            hsBwInput,
            parseFloat,
            (val) => (hsState.bw = val),
            (val) => val > 0,
            hsBwErrorDiv,
            'Значение должно быть больше 0.',
        );

        bindNumericInput(
            hsParStartInput,
            parseFloat,
            (val) => (hsState.par_start = val),
            (val) => val >= 0 && val <= 1,
            hsParRangeErrorDiv,
            'Значения должны быть в пределах от 0 до 1.',
        );

        bindNumericInput(
            hsParEndInput,
            parseFloat,
            (val) => (hsState.par_end = val),
            (val) => val >= 0 && val <= 1,
            hsParRangeErrorDiv,
            'Значения должны быть в пределах от 0 до 1.',
        );

        bindNumericInput(
            hsBwStartInput,
            parseFloat,
            (val) => (hsState.bw_start = val),
            (val) => val > 0,
            hsBwRangeErrorDiv,
            'Значения должны быть больше 0.',
        );

        bindNumericInput(
            hsBwEndInput,
            parseFloat,
            (val) => (hsState.bw_end = val),
            (val) => val > 0,
            hsBwRangeErrorDiv,
            'Значения должны быть больше 0.',
        );

        updateHSModeUI();
    }

    setupGeneralParams();
    setupBBOInputs();
    setupCulturalInputs();
    setupHSInputs();
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
            tabData.trajectory,
        );
    } else {
        document.getElementById('graph3d').style.display = 'none';
        convergencePlotDiv.style.display = 'block';

        if (!isConvergenceInitialized) {
            initConvergencePlot(convergencePlotDiv);
            isConvergenceInitialized = true;
        }

        updateConvergencePlot(convergencePlotDiv, tabData.history);
    }
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

    const showTrajectory = document.getElementById('showTrajectory');
    showTrajectory.textContent = state.plotSettings.showTrajectory
        ? 'Скрыть траекторию'
        : 'Показать траекторию';

    showTrajectory.addEventListener('click', () => {
        state.plotSettings.showTrajectory = !state.plotSettings.showTrajectory;
        showTrajectory.textContent = state.plotSettings.showTrajectory
            ? 'Скрыть траекторию'
            : 'Показать траекторию';
        if (state.plotSettings.showSurface) {
            const tabData = getCurrentTabData();
            addTrajectory(
                tabData.currentFunction,
                state.plotSettings.showTrajectory,
                tabData.trajectory,
            );
        }
    });

    const showPopulation = document.getElementById('showPopulation');
    showPopulation.textContent = state.plotSettings.showPopulation
        ? 'Показать решение'
        : 'Показать популяцию';

    showPopulation.addEventListener('click', () => {
        state.plotSettings.showPopulation = !state.plotSettings.showPopulation;
        showPopulation.textContent = state.plotSettings.showPopulation
            ? 'Показать решение'
            : 'Показать популяцию';

        let tab = getCurrentTabData();
        if (state.plotSettings.showSurface) {
            addPoints(
                tab.currentFunction,
                tab.population,
                tab.best_solution,
                state.plotSettings.showPopulation,
                tab.plotSettings.pointSize,
            );
            addTrajectory(tab.currentFunction, state.plotSettings.showTrajectory, tab.trajectory);
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

    updatePlot();

    document.getElementById('showHelp').onclick = function () {
        document.getElementById('helpModal').style.display = 'flex';
    };
    document.getElementById('closeHelpModal').onclick = function () {
        document.getElementById('helpModal').style.display = 'none';
    };
    window.onclick = function (event) {
        const modal = document.getElementById('helpModal');
        if (event.target === modal) modal.style.display = 'none';
    };
}
