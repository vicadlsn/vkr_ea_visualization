import { parse } from 'mathjs';

export { builtinFunctions, getFunctionData, evaluateFunction, getFunctionLabels };

const builtinFunctions = {};
builtinFunctions['rastrigin'] = {
    original: '20 + (x * x - 10 * cos(2 * pi * x)) + (y * y - 10 * cos(2 * pi * y))',
    boundsX: [-5.12, 5.12],
    boundsY: [-5.12, 5.12],
    zoom: [1, 1, 0.15],
    name: 'Функция Растригина',
};
builtinFunctions['rosenbrock'] = {
    original: '(1-x)^2 + 100*(y - x^2)^2',
    boundsX: [-5, 5],
    boundsY: [-5, 5],
    zoom: [1, 1, 0.005],
    name: 'Функция Розенброка',
};

builtinFunctions['schwefel'] = {
    original: '-x * sin(sqrt(abs(x))) - y*sin(sqrt(abs(y)))',
    boundsX: [-100, 100],
    boundsY: [-100, 100],
    zoom: [1, 1, 1],
    name: 'Функция Швефеля',
};

builtinFunctions['griewank'] = {
    original: '(x^2 + y^2)/4000 - cos(x) * cos(y / sqrt(2)) + 1',
    boundsX: [-600, 600],
    boundsY: [-600, 600],
    zoom: [0.05, 0.05, 1],
    name: 'Функция Гриванка',
};

builtinFunctions['ackley'] = {
    original:
        '-20 * exp(-0.2 * sqrt(0.5 * (x^2 + y^2))) - exp(0.5 * (cos(2*PI*x) + cos(2*PI*y))) + e + 20',
    boundsX: [-5, 5],
    boundsY: [-5, 5],
    zoom: [1, 1, 1],
    name: 'Функция Экли',
};

builtinFunctions['levy'] = {
    original:
        'sin(PI*x)^2 + (x - 1)^2 * (1 + 10 * sin(PI*y + 1)^2) + (y - 1)^2 * (1 + sin(2*PI*y)^2)',
    boundsX: [-10, 10],
    boundsY: [-10, 10],
    zoom: [1, 1, 0.01],
    name: 'Функция Леви',
};

const allowedFunctions = new Set([
    /* основные математические функции */
    'sqrt',
    'cbrt', // ?
    'abs',
    'exp',
    'log',
    'log10',
    'log2',

    /* тригонометрические функции */
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',

    /* гиперболические функции надо? */
    'sinh',
    'cosh',
    'tanh',
    'asinh',
    'acosh',
    'atanh',

    /* округление, ограничение и т.п., надо? */
    'min',
    'max',
    'round',
    'ceil',
    'floor',
    'mod',
    'hypot',
]);
const allowedSymbols = new Set(['x', 'y', 'pi', 'e', 'E', 'PI']);

const getFunctionLabels = () => {
    const entries = Object.entries(builtinFunctions);
    return entries.map(([key, value]) => {
        return {
            key: key,
            name: value.name,
        };
    });
};

function isSafeNode(node) {
    if (node.isOperatorNode) {
        return ['+', '-', '*', '/', '^'].includes(node.op) && node.args.every(isSafeNode);
    }

    if (node.isFunctionNode) {
        return allowedFunctions.has(node.fn.name) && node.args.every(isSafeNode);
    }

    if (node.isSymbolNode) {
        return allowedSymbols.has(node.name);
    }

    if (node.isConstantNode) {
        return true;
    }

    if (node.isParenthesisNode) {
        return isSafeNode(node.content);
    }

    return false;
}

const getFunctionData = (expression) => {
    /*try {
        const parsed = math.parse(expression);
        parsed.evaluate({ x: 1, y: 1 });
        return { original: expression, parsed: parsed };
    } catch (error) {
        console.error("Ошибка парсинга:", error);
        return null;
    }*/

    try {
        const parsed = parse(expression);
        const safe = isSafeNode(parsed);
        if (!safe) return null;
        return { original: expression, parsed: parsed };
    } catch (error) {
        console.error('Ошибка парсинга:', error);
        return null;
    }
};

const evaluateFunction = (func, variables) => {
    try {
        const scope = Object.assign({}, variables);
        return func.parsed.evaluate(scope);
    } catch (error) {
        console.error('Ошибка вычисления функции:', error);
    }
    return null;
};
