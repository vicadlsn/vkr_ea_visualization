import {
    getFunctionData,
    getFunctionLabels,
    builtinFunctions,
} from "./func.js";

import {
    plotSurface,
    resetCamera,
    addPoints,
    addMinimum,
    initConvergencePlot,
    updateConvergencePlot,
} from "./plot.js";

export { updatePlot, updateMethodInfo };

export let state = {
    activeRequests: {}, // { method_id: request_id }
    currentFunction: {
        function: getFunctionData("cos(x^2+y^2)"),
        boundsX: [-5, 5],
        boundsY: [-5, 5],
    },
    plotSettings: {
        resolution: 50,
        plotStyle: true,
        showMinimum: true,
        showGrid: false,
        equalScale: false,
        pointSize: 0.08,
        aspectratioX: 1,
        aspectratioY: 1,
        aspectratioZ: 1,
    },

    populationSize: 50,
    iterationsCount: 10,

    tabsData: {
        bbo: {
            params: {},
            population: [],
            best_solution: undefined,
            best_fitness: undefined,
            iteration: 0,
            total_iterations: 0,
        },
        cultural: {
            params: {},
            population: [],
            best_solution: undefined,
            best_fitness: undefined,
            iteration: 0,
            total_iterations: 0,
        },
    },
    currentTab: "bbo",
};

const info = document.getElementById("methodInfoContent");

function restoreStateFunctionChange() {
    getCurrentTabData().population = [];
    getCurrentTabData().trajectory = [];
    getCurrentTabData().best_solution = undefined;
    getCurrentTabData().best_fitness = undefined;
    getCurrentTabData().iteration = 0;
    getCurrentTabData().total_iterations = 0;
}

function updateMethodInfo() {
    const currentTab = getCurrentTabData();
    info.innerHTML = `
        <strong>Метод:</strong> ${state.currentTab}<br>
        <strong>Текущее решение:</strong> ${
            currentTab.best_solution
                ? "(" +
                  currentTab.best_solution[0].toFixed(4) +
                  "," +
                  currentTab.best_solution[0].toFixed(4) +
                  ")"
                : ""
        }<br>
        <strong>Значение:</strong> ${
            currentTab.best_fitness ? currentTab.best_fitness.toFixed(4) : ""
        }<br>
        <strong>Итерация:</strong> ${
            currentTab.iteration
                ? currentTab.iteration + "/" + currentTab.total_iterations
                : ""
        }<br>
    `;

    /*
    <strong>Функция:</strong> ${
           state.currentFunction.function
               ? state.currentFunction.function.original
               : ""
       }<br>*/
}

function getCurrentTabData() {
    return state.tabsData[state.currentTab];
}

function updatePlot() {
    const tabData = getCurrentTabData();
    if (state.plotSettings.plotStyle) {
        plotSurface(
            state.currentFunction,
            state.plotSettings,
            tabData.population,
            tabData.best_solution
        );
    } else {
        initConvergencePlot();
    }
}

function setInput(inputElement, valid) {
    if (valid) {
        inputElement.classList.remove("invalid");
        functionError.textContent = "";
        functionError.style.display = "none";
    } else {
        inputElement.classList.add("invalid");
        functionError.textContent = "Ошибка ввода функции.";
        functionError.style.display = "block";
    }
}

function handleFunctionChange(inputElement, selectElement, functionError) {
    const data = getFunctionData(inputElement.value);
    if (data) {
        setInput(inputElement, true);

        state.currentFunction.function = data;
        restoreStateFunctionChange();
        updateMethodInfo();
        updatePlot();
    } else {
        setInput(inputElement, false);
    }
    selectElement.selectedIndex = 0;
}

function setupTabs() {
    const bboTabButton = document.getElementById("bbo_tab_button");
    const culturalTabButton = document.getElementById("cultural_tab_button");

    const bboTab = document.getElementById("bbo_algorithm_tab");
    const culturalTab = document.getElementById("cultural_algorithm_tab");

    const tabs = document.getElementsByClassName("tab-content");
    const tabButtons = document.getElementsByClassName("tabButton");

    state.currentTab = "bbo";
    bboTab.classList.add("active-tab");
    bboTabButton.classList.add("active-button");

    function activateTab(tab_name) {
        for (let i = 0; i < tabButtons.length; i++) {
            tabButtons[i].classList.remove("active-button");
        }

        for (let i = 0; i < tabs.length; i++) {
            tabs[i].classList.remove("active-tab");
        }

        if (tab_name === "bbo") {
            bboTabButton.classList.add("active-button");
            bboTab.classList.add("active-tab");
        }
        if (tab_name === "cultural") {
            culturalTabButton.classList.add("active-button");
            culturalTab.classList.add("active-tab");
        }

        state.currentTab = tab_name;
        updateMethodInfo();
        updatePlot();
    }

    bboTabButton.addEventListener("click", () => activateTab("bbo"));
    culturalTabButton.addEventListener("click", () => activateTab("cultural"));
}

function setupEventListeners() {
    const functionInput = document.getElementById("functionInput");
    functionInput.value = state.currentFunction.function.original;

    const functionError = document.getElementById("functionError");
    const functionSelectBuiltin = document.getElementById(
        "functionSelectBuiltin"
    );

    const xRangeMin = document.getElementById("xRangeMin");
    const xRangeMax = document.getElementById("xRangeMax");
    const yRangeMin = document.getElementById("yRangeMin");
    const yRangeMax = document.getElementById("yRangeMax");
    const resolution = document.getElementById("resolution");
    const pointSize = document.getElementById("pointSize");
    const aspectratioX = document.getElementById("aspectratioX");
    const aspectratioY = document.getElementById("aspectratioY");
    const aspectratioZ = document.getElementById("aspectratioZ");

    functionSelectBuiltin.addEventListener("change", (event) => {
        const target = event.target;
        const builtin = builtinFunctions[target.value];
        functionInput.value = builtin.original;

        setInput(functionInput, true);

        xRangeMin.value = String(builtin.boundsX[0]);
        xRangeMax.value = String(builtin.boundsX[1]);
        yRangeMin.value = String(builtin.boundsY[0]);
        yRangeMax.value = String(builtin.boundsY[1]);

        state.currentFunction.function = getFunctionData(functionInput.value);
        state.currentFunction.boundsX = [...builtin.boundsX];
        state.currentFunction.boundsY = [...builtin.boundsY];

        state.plotSettings.aspectratioX = builtin.zoom[0];
        state.plotSettings.aspectratioY = builtin.zoom[1];
        state.plotSettings.aspectratioZ = builtin.zoom[2];
        aspectratioX.value = state.plotSettings.aspectratioX;
        aspectratioY.value = state.plotSettings.aspectratioY;
        aspectratioZ.value = state.plotSettings.aspectratioZ;

        restoreStateFunctionChange();
        updateMethodInfo();
        updatePlot();
    });

    functionInput.addEventListener("change", () =>
        handleFunctionChange(
            functionInput,
            functionSelectBuiltin,
            functionError
        )
    );
    xRangeMin.addEventListener("change", () => {
        state.currentFunction.boundsX[0] = parseFloat(xRangeMin.value);
        updatePlot();
    });
    xRangeMax.addEventListener("change", () => {
        state.currentFunction.boundsX[1] = parseFloat(xRangeMax.value);
        updatePlot();
    });
    yRangeMin.addEventListener("change", () => {
        state.currentFunction.boundsY[0] = parseFloat(yRangeMin.value);
        updatePlot();
    });
    yRangeMax.addEventListener("change", () => {
        state.currentFunction.boundsY[1] = parseFloat(yRangeMax.value);
        updatePlot();
    });

    //state.plotSettings.resolution = parseInt(resolution.value);
    resolution.value = state.plotSettings.resolution;
    resolution.addEventListener("change", () => {
        const val = parseInt(resolution.value);
        if (val && val > 0) {
            state.plotSettings.resolution = val;
        }
        updatePlot();
    });

    pointSize.value = state.plotSettings.pointSize;
    pointSize.addEventListener("input", () => {
        const val = parseFloat(pointSize.value);
        if (val && val > 0) {
            state.plotSettings.pointSize = val;
        }
        updatePlot();
    });

    aspectratioX.value = state.plotSettings.aspectratioX;
    aspectratioY.value = state.plotSettings.aspectratioY;
    aspectratioZ.value = state.plotSettings.aspectratioZ;

    aspectratioX.addEventListener("change", () => {
        state.plotSettings.aspectratioX = parseFloat(aspectratioX.value);
        updatePlot();
    });
    aspectratioY.addEventListener("change", () => {
        state.plotSettings.aspectratioY = parseFloat(aspectratioY.value);
        updatePlot();
    });
    aspectratioZ.addEventListener("change", () => {
        state.plotSettings.aspectratioZ = parseFloat(aspectratioZ.value);
        updatePlot();
    });
}

function setupAlgorithmParams() {
    // Общие параметры
    const populationInput = document.getElementById("population");
    const iterationsInput = document.getElementById("iterations");

    // BBO
    const bboMutationInput = document.getElementById(
        "bbo_mutation_probability"
    );
    const bboBlendingInput = document.getElementById("bbo_blending_rate");

    // Cultural
    const culturalParamInput = document.getElementById("cultural_param");

    function updateCommonParams() {
        state.populationSize = parseInt(populationInput.value);
        state.iterationsCount = parseInt(iterationsInput.value);
    }

    function updateBBOParams() {
        state.tabsData["bbo"].params.mutation_probability = parseFloat(
            bboMutationInput.value
        );
        state.tabsData["bbo"].params.blending_rate = parseFloat(
            bboBlendingInput.value
        );
    }

    function updateCulturalParams() {
        state.tabsData["cultural"].params.cultural_param = parseFloat(
            culturalParamInput.value
        );
    }

    // Подписки на изменения
    populationInput.addEventListener("change", updateCommonParams);
    iterationsInput.addEventListener("change", updateCommonParams);

    bboMutationInput.addEventListener("change", updateBBOParams);
    bboBlendingInput.addEventListener("change", updateBBOParams);

    culturalParamInput.addEventListener("change", updateCulturalParams);

    // Инициализация состояния
    updateCommonParams();
    updateBBOParams();
    updateCulturalParams();
}

function initTestFunctionOptions() {
    const select = document.getElementById("functionSelectBuiltin");
    select.length = 1;

    for (const { key, name } of getFunctionLabels()) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = name;
        select.appendChild(option);
    }
}

function switchPlots() {
    if (state.plotSettings.plotStyle) {
        document.getElementById("graph3d").style.display = "block";
        document.getElementById("convergencePlot").style.display = "none";
    } else {
        document.getElementById("graph3d").style.display = "none";
        document.getElementById("convergencePlot").style.display = "block";
    }
    updatePlot();
}

function setupUI() {
    initTestFunctionOptions();

    const plotStyle = document.getElementById("plotStyle");
    plotStyle.textContent = state.plotSettings.plotStyle
        ? "График сходимости"
        : "График поверхности";

    plotStyle.addEventListener("click", () => {
        state.plotSettings.plotStyle = !state.plotSettings.plotStyle;
        plotStyle.textContent = state.plotSettings.plotStyle
            ? "График сходимости"
            : "График поверхности";
        switchPlots();
        //updatePlot();
        let tab = getCurrentTabData();
        addPoints(
            state.currentFunction,
            tab.population,
            tab.best_solution,
            state.plotSettings.plotStyle,
            state.plotSettings.showMinimum,
            state.plotSettings.pointSize,

            state.plotSettings.plotStyle,
            tab.iteration,
            tab.best_fitness
        );
    });

    const showMinimum = document.getElementById("showMinimum");
    showMinimum.textContent = state.plotSettings.showMinimum
        ? "Показать минимум"
        : "Показать популяцию";

    showMinimum.addEventListener("click", () => {
        state.plotSettings.showMinimum = !state.plotSettings.showMinimum;
        showMinimum.textContent = state.plotSettings.showMinimum
            ? "Показать минимум"
            : "Показать популяцию";
        //updatePlot();
        let tab = getCurrentTabData();
        addPoints(
            state.currentFunction,
            tab.population,
            tab.best_solution,
            state.plotSettings.showMinimum,
            state.plotSettings.pointSize,

            state.plotSettings.plotStyle,
            tab.iteration,
            tab.best_fitness
        );
    });

    const showGrid = document.getElementById("showGrid");
    showGrid.addEventListener("click", () => {
        state.plotSettings.showGrid = !state.plotSettings.showGrid;
        showGrid.textContent = state.plotSettings.showGrid
            ? "Скрыть сетку"
            : "Показать сетку";
        if (state.plotSettings.plotStyle) updatePlot();
    });

    const dropCamera = document.getElementById("dropCamera");
    dropCamera.addEventListener("click", resetCamera);

    const showMode = document.getElementById("showMode");
    showMode.addEventListener("click", () => {
        state.plotSettings.equalScale = !state.plotSettings.equalScale;
        /*showMode.textContent = state.plotSettings.equalScale
            ? "Показать в реальных пропорциях"
            : "Показать в равных пропорциях";*/
        updatePlot();
    });
}

export function initUI() {
    const graph_container = document.getElementById("graph3d");

    setupEventListeners();
    setupAlgorithmParams();
    setupTabs();

    setupUI();
    updateMethodInfo();
    updatePlot();
}
