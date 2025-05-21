import { getFunctionData } from './func.js';

export function getCurrentTabData() {
    return state.tabsData[state.currentTab];
}

export function getCurrentTabDataFunction() {
    return state.tabsData[state.currentTab].currentFunction;
}

export const METHOD_NAMES = {
    bbo: 'bbo',
    cultural: 'cultural',
};

export const state = {
    activeRequests: {}, // { method_id: request_id }
    currentTab: METHOD_NAMES.bbo,
    plotSettings: {
        //resolution: 50,
        showSurface: true,
        showPopulation: true,
        showGrid: false,
        equalScale: false,
        //pointSize: 0.08,
        //aspectratioX: 1,
        //aspectratioY: 1,
        //aspectratioZ: 1,
    },

    tabsData: {
        bbo: {
            method_name: METHOD_NAMES.bbo,
            params: {},
            population: [],
            best_solution: undefined,
            best_fitness: undefined,
            iteration: 0,
            history: [],
            population_size: 50,
            iterations_count: 10,
            total_iterations: 0, // это для отображения инфы о методе
            currentFunction: {
                function: getFunctionData('cos(x^2+y^2)'),
                boundsX: [-5, 5],
                boundsY: [-5, 5],
                builtin: '',
            },
            plotSettings: {
                resolution: 50,
                pointSize: 0.08,
                aspectratioX: 1,
                aspectratioY: 1,
                aspectratioZ: 1,
            },
        },
        cultural: {
            method_name: METHOD_NAMES.cultural,
            params: {},
            population: [],
            best_solution: undefined,
            best_fitness: undefined,
            iteration: 0,
            history: [],
            population_size: 50,
            iterations_count: 10,
            total_iterations: 0, // это для отображения инфы о методе
            currentFunction: {
                function: getFunctionData('cos(x^2+y^2)'),
                boundsX: [-5, 5],
                boundsY: [-5, 5],
                builtin: '',
            },
            plotSettings: {
                resolution: 50,
                pointSize: 0.08,
                aspectratioX: 1,
                aspectratioY: 1,
                aspectratioZ: 1,
            },
        },
    },
};
