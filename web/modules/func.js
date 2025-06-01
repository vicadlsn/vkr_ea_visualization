import { parse, FunctionNode } from 'mathjs';

export { builtinFunctions, getFunctionData, evaluateFunction, getFunctionLabels };

const builtinFunctions = {};
builtinFunctions['sphere'] = {
    original: 'x^2 + y^2',
    boundsX: [-5.12, 5.12],
    boundsY: [-5.12, 5.12],
    zoom: [1, 1, 1],
    name: 'Сферическая функция',
};

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
    original: '418.9829*2-x * sin(sqrt(abs(x))) - y*sin(sqrt(abs(y)))',
    boundsX: [-500, 500],
    boundsY: [-500, 500],
    zoom: [0.01, 0.01, 0.01],
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

const functionArity = {
    sqrt: 1,
    cbrt: 1,
    abs: 1,
    exp: 1,
    log: [1, 2],
    log10: 1,
    log2: 1,
    sin: 1,
    cos: 1,
    tan: 1,
    asin: 1,
    acos: 1,
    atan: 1,
    sinh: 1,
    cosh: 1,
    tanh: 1,
    asinh: 1,
    acosh: 1,
    atanh: 1,
    round: 1,
    ceil: 1,
    floor: 1,
    hypot: null, // допускает >= 1
    min: null, // допускает >= 1
    max: null, // допускает >= 1
    mod: 2,
};

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
        const name = node.fn.name;
        if (!allowedFunctions.has(name)) return false;

        const expected = functionArity[name];
        const actual = node.args.length;

        if (expected === null) {
            if (actual < 1) return false;
        } else if (Array.isArray(expected)) {
            if (!expected.includes(actual)) return false;
        } else if (actual !== expected) {
            return false;
        }

        return node.args.every(isSafeNode);
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

function transformSafeExpression(node) {
    return node.transform(function (node) {
        if (node.isFunctionNode) {
            const name = node.name;

            // log(x, base) в log(base, x)
            if (name === 'log' && node.args.length === 2) {
                return new FunctionNode('log', [node.args[1], node.args[0]]);
            }
        }

        return node;
    });
}

const getFunctionData = (expression) => {
    try {
        const parsed = parse(expression);
        if (!isSafeNode(parsed)) return null;

        const transformed = transformSafeExpression(parsed);
        return {
            original: expression,
            parsed: parsed,
            juliaString: transformed.toString(),
        };
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
