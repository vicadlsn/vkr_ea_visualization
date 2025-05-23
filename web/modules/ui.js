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
    tab.current_best_solution = undefined;
    tab.current_best_fitness = undefined;
    tab.best_solution = undefined;
    tab.best_fitness = undefined;
    tab.iteration = 0;
    tab.total_iterations = 0;
}
function updateMethodInfo() {
    const currentTab = getCurrentTabData();
    const func = getCurrentTabDataFunction().function.original;

    const bestCurrentSolution =
        Array.isArray(currentTab.current_best_solution) &&
        currentTab.current_best_solution.length >= 2
            ? `(${currentTab.current_best_solution[0].toFixed(4)}, ${currentTab.current_best_solution[1].toFixed(4)})`
            : '';

    const bestCurrentFitness =
        typeof currentTab.current_best_fitness === 'number'
            ? currentTab.current_best_fitness.toFixed(4)
            : '';

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
        <strong>Текущее решение:</strong> ${bestCurrentSolution}<br>
        <strong>Текущее значение:</strong> ${bestCurrentFitness}<br>
        <strong>Лучшее решение:</strong> ${bestSolution}<br>
        <strong>Лучшее значение:</strong> ${bestFitness}<br>
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
    /*document.getElementById("showGrid").checked =
        tabData.plotSettings.showGrid;*/
    // Параметры графика
    resolutionInput.value = tabData.plotSettings.resolution;
    /*document.getElementById("showPopulation").checked =
        tabData.plotSettings.showPopulation;*/
    /*document.getElementById("equalScale").checked =
        tabData.plotSettings.equalScale;*/
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
            alert('Пожалуйста, исправьте ошибки в вводе.');
            return;
        }
        activateTab(METHOD_NAMES.bbo);
    });
    culturalTabButton.addEventListener('click', (e) => {
        if (!isFormValid()) {
            e.preventDefault();
            alert('Пожалуйста, исправьте данные на текущей вкладке.');
            return;
        }
        activateTab(METHOD_NAMES.cultural);
    });
    harmonyTabButton.addEventListener('click', (e) => {
        if (!isFormValid()) {
            e.preventDefault();
            alert('Пожалуйста, исправьте данные на текущей вкладке.');
            return;
        }
        activateTab(METHOD_NAMES.harmony);
    });
}

function setupEventListeners() {
    functionInput.value = getCurrentTabDataFunction().function.original;

    functionSelectBuiltin.addEventListener('change', (event) => {
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
        getCurrentTabDataFunction().boundsX[0] = parseFloat(xRangeMinInput.value);
        updatePlot();
    });
    xRangeMaxInput.addEventListener('change', () => {
        getCurrentTabDataFunction().boundsX[1] = parseFloat(xRangeMaxInput.value);
        updatePlot();
    });
    yRangeMinInput.addEventListener('change', () => {
        getCurrentTabDataFunction().boundsY[0] = parseFloat(yRangeMinInput.value);
        updatePlot();
    });
    yRangeMaxInput.addEventListener('change', () => {
        getCurrentTabDataFunction().boundsY[1] = parseFloat(yRangeMaxInput.value);
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
        getCurrentTabData().plotSettings.aspectratioX = parseFloat(aspectratioXInput.value);
        updatePlot();
    });
    aspectratioYInput.addEventListener('change', () => {
        getCurrentTabData().plotSettings.aspectratioY = parseFloat(aspectratioYInput.value);
        updatePlot();
    });
    aspectratioZInput.addEventListener('change', () => {
        getCurrentTabData().plotSettings.aspectratioZ = parseFloat(aspectratioZInput.value);
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
                    'Число островов должно быть положительным целым числом',
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
    const caNumElites = document.getElementById('ca_num_elites');
    const caNumAccepted = document.getElementById('ca_num_accepted');
    const caNumElitesErrorDiv = document.getElementById('ca_num_elites_error');
    const caNumAcceptedErrorDiv = document.getElementById('ca_num_accepted_error');

    function setupCulturalInputs() {
        const culturalState = state.tabsData[METHOD_NAMES.cultural];
        const params = culturalState.params;

        caPopulationSize.value = params.population_size;
        caNumElites.value = params.num_elites;
        caNumAccepted.value = params.num_accepted;

        function validateCAFields(source) {
            const count = parseInt(caPopulationSize.value);
            const elites = parseInt(caNumElites.value);
            const accepted = parseInt(caNumAccepted.value);

            let valid = true;

            // Проверка count
            if (!Number.isInteger(count) || count <= 0) {
                if (source === 'count') {
                    setInput(
                        caPopulationSize,
                        false,
                        caPopulationSizeErrorDiv,
                        'Число индивидов должно быть положительным целым числом',
                    );
                }
                valid = false;
            } else if (
                (Number.isInteger(elites) && elites > count) ||
                (Number.isInteger(accepted) && accepted > count)
            ) {
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

            // Проверка элитных особей
            if (!Number.isInteger(elites) || elites < 0 || elites > count) {
                if (source === 'elites') {
                    setInput(
                        caNumElites,
                        false,
                        caNumElitesErrorDiv,
                        'Число элитных особей должно быть неотрицательным и не больше числа всех особей',
                    );
                }
                valid = false;
            } else {
                setInput(caNumElites, true, caNumElitesErrorDiv);
            }

            // Проверка принятых особей
            if (!Number.isInteger(accepted) || accepted < 0 || accepted > count) {
                if (source === 'accepted') {
                    setInput(
                        caNumAccepted,
                        false,
                        caNumAcceptedErrorDiv,
                        'Число принятых особей должно быть неотрицательным и не больше числа всех особей',
                    );
                }
                valid = false;
            } else {
                setInput(caNumAccepted, true, caNumAcceptedErrorDiv);
            }

            if (valid) {
                params.population_size = count;
                params.num_elites = elites;
                params.num_accepted = accepted;
            }
        }

        caPopulationSize.addEventListener('change', () => validateCAFields('count'));
        caNumElites.addEventListener('change', () => validateCAFields('elites'));
        caNumAccepted.addEventListener('change', () => validateCAFields('accepted'));
    }

    const caepPopulationSize = document.getElementById('caep_population_size');
    const caepPopulationSizeErrorDiv = document.getElementById('caep_population_size_error');
    //const caepNumElites = document.getElementById('caep_num_elites');
    const caepNumAccepted = document.getElementById('caep_num_accepted');
    // const caepNumElitesErrorDiv = document.getElementById('caep_num_elites_error');
    const caepNumAcceptedErrorDiv = document.getElementById('caep_num_accepted_error');

    function setupCAEPInputs() {
        const params = state.tabsData[METHOD_NAMES.caep].params;

        caepPopulationSize.value = params.population_size;
        caepNumAccepted.value = params.num_accepted;

        function validateCAEPFields(source) {
            const count = parseInt(caepPopulationSize.value);
            const accepted = parseInt(caepNumAccepted.value);

            let valid = true;

            // Проверка count
            if (!Number.isInteger(count) || count <= 0) {
                if (source === 'count') {
                    setInput(
                        caepPopulationSize,
                        false,
                        caepPopulationSizeErrorDiv,
                        'Число индивидов должно быть положительным целым числом',
                    );
                }
                valid = false;
            } else if (Number.isInteger(accepted) && accepted > count) {
                if (source === 'count') {
                    setInput(
                        caepPopulationSize,
                        false,
                        caepPopulationSizeErrorDiv,
                        'Число индивидов должно быть не меньше числа принимаемых особей',
                    );
                }
                valid = false;
            } else {
                setInput(caepPopulationSize, true, caepPopulationSizeErrorDiv);
            }

            // Проверка принимаемых особей
            if (!Number.isInteger(accepted) || accepted < 0 || accepted > count) {
                if (source === 'accepted') {
                    setInput(
                        caepNumAccepted,
                        false,
                        caepNumAcceptedErrorDiv,
                        'Число принимаемых особей должно быть неотрицательным и не больше числа всех особей',
                    );
                }
                valid = false;
            } else {
                setInput(caepNumAccepted, true, caepNumAcceptedErrorDiv);
            }

            if (valid) {
                params.population_size = count;
                params.num_accepted = accepted;
            }
        }

        caepPopulationSize.addEventListener('change', () => validateCAEPFields('count'));
        caepNumAccepted.addEventListener('change', () => validateCAEPFields('accepted'));
    }

    // --- Harmony Search ---
    const hsModeSelect = document.getElementById('hs_mode');
    const hsHmcrInput = document.getElementById('hs_hmcr');
    const hsParInput = document.getElementById('hs_par');
    const hsBwInput = document.getElementById('hs_bw');
    const hsHmsInput = document.getElementById('hs_hms');
    const hsHmcrErrorDiv = document.getElementById('hs_hmcr_error');
    const hsParErrorDiv = document.getElementById('hs_par_error');
    const hsBwErrorDiv = document.getElementById('hs_bw_error');
    const hsHmsErrorDiv = document.getElementById('hs_hms_error');

    function setupHSInputs() {
        const hsState = state.tabsData[METHOD_NAMES.harmony].params;
        hsModeSelect.value = hsState.mode || 'canonical';
        hsHmcrInput.value = hsState.hmcr;
        hsParInput.value = hsState.par;
        hsBwInput.value = hsState.bw;
        hsHmsInput.value = hsState.hms;

        function updateHSModeUI() {
            const isCanonical = hsModeSelect.value === 'canonical';
            hsHmcrInput.disabled = !isCanonical;
            hsParInput.disabled = !isCanonical;
            hsBwInput.disabled = !isCanonical;
        }

        hsModeSelect.addEventListener('change', () => {
            hsState.mode = hsModeSelect.value;
            if (hsState.mode !== 'canonical') {
                hsState.hmcr = undefined;
                hsState.par = undefined;
                hsState.bw = undefined;
            }
            updateHSModeUI();
        });

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
            'Значение должно быть в пределах от 0 до 1.',
        );

        bindNumericInput(
            hsHmsInput,
            parseInt,
            (val) => (hsState.hms = val),
            (val) => Number.isInteger(val) && val >= 1,
            hsHmsErrorDiv,
            'Значение должно быть целым и больше 0.',
        );

        updateHSModeUI();
    }

    setupGeneralParams();
    setupBBOInputs();
    setupCulturalInputs();
    setupCAEPInputs();
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
        );
    } else {
        document.getElementById('graph3d').style.display = 'none';
        convergencePlotDiv.style.display = 'block';
        //Plotly.Plots.resize(convergencePlotDiv);
        //initConvergencePlot(convergencePlotDiv);
        if (!isConvergenceInitialized) {
            initConvergencePlot(convergencePlotDiv);
            isConvergenceInitialized = true;
        }
        updateConvergencePlot(convergencePlotDiv, tabData.history);
        // Plotly.Plots.resize(convergencePlotDiv);
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
    // initConvergencePlot(convergencePlotDiv);

    updatePlot();
}
