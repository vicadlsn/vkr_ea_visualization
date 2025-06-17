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
    harmony: 'harmony',
};

export const state = {
    activeRequests: {}, // { method_id: request_id }
    currentTab: METHOD_NAMES.bbo,
    plotSettings: {
        showSurface: true,
        showPopulation: true,
        showGrid: false,
        equalScale: false,
        showTrajectory: false,
    },

    copied: null,

    tabsData: {
        bbo: {
            method_name: METHOD_NAMES.bbo,
            currentStatus: '',
            params: {
                islands_count: 50,
                mutation_probability: 0.1,
                blending_rate: 0.1,
                num_elites: 2,
            },
            population: [],
            best_solution: undefined,
            best_fitness: undefined,
            iteration: 0,
            history: [],
            trajectory: [],
            iterations_count: 100,
            total_iterations: 0, // это для отображения инфы о методе
            currentFunction: {
                function: getFunctionData('cos(x^2+y^2)'),
                boundsX: [-5, 5],
                boundsY: [-5, 5],
                builtin: '',
            },
            dimension: 2,
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
            currentStatus: '',
            params: {
                population_size: 50,
                num_accepted: 5,
                inertia: 0.5,
                gamma: 1.0,
                beta: 0.0,
            },
            population: [],
            best_solution: undefined,
            best_fitness: undefined,
            iteration: 0,
            history: [],
            trajectory: [],
            iterations_count: 100,
            total_iterations: 0, // это для отображения инфы о методе
            currentFunction: {
                function: getFunctionData('cos(x^2+y^2)'),
                boundsX: [-5, 5],
                boundsY: [-5, 5],
                builtin: '',
            },
            dimension: 2,
            plotSettings: {
                resolution: 50,
                pointSize: 0.08,
                aspectratioX: 1,
                aspectratioY: 1,
                aspectratioZ: 1,
            },
        },
        harmony: {
            method_name: METHOD_NAMES.harmony,
            currentStatus: '',
            params: {
                hms: 30,
                hmcr: 0.9,
                par: 0.65,
                bw: 0.05,
                bw_start: 0.05,
                bw_end: 0.0001,
                par_start: 0.35,
                par_end: 0.99,
            },
            population: [],
            best_solution: undefined,
            best_fitness: undefined,
            iteration: 0,
            history: [],
            trajectory: [],
            iterations_count: 1000,
            total_iterations: 0, // это для отображения инфы о методе
            currentFunction: {
                function: getFunctionData('cos(x^2+y^2)'),
                boundsX: [-5, 5],
                boundsY: [-5, 5],
                builtin: '',
            },
            dimension: 2,
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
