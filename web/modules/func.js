import * as math from "mathjs";

export {
    builtinFunctions,
    getFunctionData,
    evaluateFunction,
    getFunctionLabels,
};

const builtinFunctions = {};
builtinFunctions["rastrigin"] = {
    original:
        "20 + (x * x - 10 * cos(2 * pi * x)) + (y * y - 10 * cos(2 * pi * y))",
    boundsX: [-5.12, 5.12],
    boundsY: [-5.12, 5.12],
    zoom: [1, 1, 0.15],
    name: "Функция Растригина",
};
builtinFunctions["rosenbrock"] = {
    original: "(1-x)^2 + 100*(y - x^2)^2",
    boundsX: [-5, 5],
    boundsY: [-5, 5],
    zoom: [1, 1, 0.005],
    name: "Функция Розенброка",
};

builtinFunctions["schwefel"] = {
    original: "-x * sin(sqrt(abs(x))) - y*sin(sqrt(abs(y)))",
    boundsX: [-100, 100],
    boundsY: [-100, 100],
    zoom: [1, 1, 1],
    name: "Функция Швефеля",
};

const getFunctionLabels = () => {
    const entries = Object.entries(builtinFunctions);
    return entries.map(([key, value]) => {
        return {
            key: key,
            name: value.name,
        };
    });
};

const getFunctionData = (expression) => {
    try {
        const parsed = math.parse(expression);
        parsed.evaluate({ x: 1, y: 1 });
        return { original: expression, parsed: parsed };
    } catch (error) {
        console.error("Ошибка парсинга:", error);
        return null;
    }
};
const evaluateFunction = (func, variables) => {
    try {
        const scope = Object.assign({}, variables);
        return func.parsed.evaluate(scope);
    } catch (error) {
        console.error("Ошибка вычисления функции:", error);
    }
    return null;
};
