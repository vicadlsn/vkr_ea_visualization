import { getFunctionData } from "./func.js";

export const state = {
    activeRequests: {}, // { method_id: request_id }
    currentTab: "bbo",
    currentFunction: {
        function: getFunctionData("cos(x^2+y^2)"),
        boundsX: [-5, 5],
        boundsY: [-5, 5],
    },
    plotSettings: {
        resolution: 50,
        showSurface: true,
        showPopulation: true,
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
            history: [],
            total_iterations: 0,
        },
        cultural: {
            params: {},
            population: [],
            best_solution: undefined,
            best_fitness: undefined,
            iteration: 0,
            history: [],
            total_iterations: 0,
        },
    },
};
