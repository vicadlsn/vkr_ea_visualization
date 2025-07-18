import { evaluateFunction } from './func.js';
import Plotly from 'plotly.js-dist-min';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export {
    plotSurface,
    resetCamera,
    addPoints,
    addMinimum,
    initConvergencePlot,
    updateConvergencePlot,
    extendConvergencePlot,
    addTrajectory,
};

const sceneBackgroundColor = 0xe6e7ee;

function initConvergencePlot(graphDiv) {
    const layout = {
        title: { text: 'График сходимости' },

        xaxis: { title: { text: 'Итерация' }, autorange: true },
        yaxis: { title: { text: 'Лучшее значение' }, autorange: true },
        margin: { t: 100, r: 70, b: 100, l: 70 },
    };

    const trace = {
        x: [],
        y: [],
        mode: 'lines+markers',
        line: { color: '#2d4cc8' },
        name: { text: 'Лучшее значение' },
    };

    Plotly.newPlot(graphDiv, [trace], layout);
}

function updateConvergencePlot(graphDiv, trace) {
    const newXValues = Array.from({ length: trace.length }, (_, i) => i + 1);
    const newYValues = trace;

    Plotly.update(graphDiv, { x: [newXValues], y: [newYValues] });
}

function extendConvergencePlot(graphDiv, iteration, bestFitness) {
    Plotly.extendTraces(
        graphDiv,
        {
            // x: [[iteration]],
            y: [[bestFitness]],
        },
        [0],
    );
}

function generateSurfaceData(func, xRange, yRange, resolution = 100) {
    const [xMin, xMax] = xRange;
    const [yMin, yMax] = yRange;

    const x = Array.from(
        { length: resolution },
        (_, i) => xMin + ((xMax - xMin) * i) / (resolution - 1),
    );
    const y = Array.from(
        { length: resolution },
        (_, i) => yMin + ((yMax - yMin) * i) / (resolution - 1),
    );

    const z = x.map((xVal) => y.map((yVal) => evaluateFunction(func, { x: xVal, y: yVal })));

    return { x, y, z };
}

let surface,
    pointCloud,
    minPoint,
    scene,
    renderer,
    camera,
    controls,
    grid,
    surfaceGrid,
    arrowX,
    arrowY,
    arrowZ,
    axes,
    trajectoryLine,
    axisTicks = [];

function plotSurface(f, plotSettings, population = [], minimum = undefined, trajectory = []) {
    if (!scene) {
        const container = document.getElementById('graph3d');
        if (!container) return;
        container.innerHTML = '';

        scene = new THREE.Scene();
        scene.background = new THREE.Color(sceneBackgroundColor);

        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        // Управление камерой
        controls = new OrbitControls(camera, renderer.domElement); // Инициализация OrbitControls
        controls.enableZoom = true; // Включаем масштабирование
        controls.enableDamping = true; // Включаем плавное движение
        controls.dampingFactor = 0.25; // Настройка плавности
        controls.enablePan = true;
        // controls.maxPolarAngle =Math.PI / 2; // Ограничиваем движение камеры только по вертикали
        resetCamera();

        const ambientLight = new THREE.AmbientLight(0xeeeeee, 1.7);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(0, 10, 0).normalize();
        scene.add(directionalLight);
        // directionalLight.position.set(0, 0, 1);
        // camera.add(directionalLight);
        scene.add(camera);

        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
    }

    updateGraph(f, plotSettings, population, minimum, trajectory);
}

function resetCamera() {
    camera.position.set(5, 5, -10);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}
function updateGraph(f, plotSettings, population, minimum, trajectory) {
    removePreviousElements();

    let { x, y, z } = generateSurfaceData(
        f.function,
        f.boundsX,
        f.boundsY,
        plotSettings.resolution,
    );

    let { geometry, vertices } = getSurfaceGeometry(f, { x, y, z });
    let colors = getSurfaceColors({ x, y, z }, vertices);
    surface = getSurface(geometry, colors);

    const { zMax, zMin } = calculateZRanges(f.boundsX, f.boundsY, z);

    if (plotSettings.equalScale) {
        applyEqualScale(f.boundsX, f.boundsY, zMax, zMin);
    } else {
        applyRealScale(plotSettings, 100);
        let axeLength = Math.ceil(
            Math.max(
                Math.abs(f.boundsX[0]),
                Math.abs(f.boundsX[1]),
                Math.abs(f.boundsY[0]),
                Math.abs(f.boundsY[1]),
            ),
        );
        addGrid(scene, axeLength * 2);
        grid.scale.set(surface.scale.x, 1, surface.scale.y);

        addAxes(
            scene,
            [-axeLength * surface.scale.x, axeLength * surface.scale.x],
            [-axeLength * surface.scale.y, axeLength * surface.scale.y],
            [Math.min(-5, Math.floor(zMin)), Math.max(5, Math.ceil(zMax))].map(
                (v) => v * surface.scale.z,
            ),
        );
        addAxisTicks(scene, 'x', -axeLength, axeLength, surface.scale.x);
        addAxisTicks(scene, 'z', -axeLength, axeLength, surface.scale.y);
        addAxisTicks(
            scene,
            'y',
            Math.min(-5, Math.floor(zMin)),
            Math.max(5, Math.ceil(zMax)),
            surface.scale.z,
        );
    }

    scene.add(surface);
    if (plotSettings.showGrid) {
        addGridToSurface(x, y, z, scene);

        surfaceGrid.scale.set(surface.scale.x, surface.scale.y, surface.scale.z);
        surfaceGrid.rotateX(-Math.PI / 2);
    }
    addPoints(f, population, minimum, plotSettings.showPopulation, plotSettings.pointSize);
    addTrajectory(f, plotSettings.showTrajectory, trajectory);
    surface.rotateX(-Math.PI / 2);
}

function removePreviousElements() {
    const elements = [
        surface,
        pointCloud,
        minPoint,
        grid,
        surfaceGrid,
        arrowX,
        arrowY,
        arrowZ,
        axes,
        trajectoryLine,
    ];

    elements.forEach((element) => {
        if (element) {
            scene.remove(element);
            disposeObject(element);
        }
    });

    removeAxesAndLabels();
}

function disposeObject(obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
            });
        } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    }
}

function removeAxesAndLabels() {
    axisTicks.forEach((tick) => scene.remove(tick));
    axisTicks = [];
    scene.children = scene.children.filter((child) => {
        if (child instanceof THREE.Line || child instanceof THREE.Sprite) {
            disposeObject(child);
            return false;
        }
        return true;
    });
}

function calculateZRanges(boundsX, boundsY, z) {
    let allZValues = z.flat();
    let zMax = Math.max(...allZValues),
        zMin = Math.min(...allZValues);

    return { zMax, zMin };
}

function applyEqualScale(boundsX, boundsY, zMax, zMin) {
    // Рассчитываем масштаб для равных пропорций
    const scaleFactor = 10;
    const xSize = boundsX[1] - boundsX[0];
    const ySize = boundsY[1] - boundsY[0];
    const zSize = zMax - zMin;

    surface.scale.set(scaleFactor / xSize, scaleFactor / ySize, scaleFactor / zSize);

    surface.position.set(0, 0, 0);
}

function applyRealScale(plotSettings) {
    surface.scale.set(
        plotSettings.aspectratioX,
        plotSettings.aspectratioY,
        plotSettings.aspectratioZ,
    );
}

function getSurface(geometry, colors) {
    const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        opacity: 0.9,
        transparent: true,
    });

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    let surface = new THREE.Mesh(geometry, material);

    return surface;
}

function getSurfaceGeometry(f, data) {
    const { x, y, z } = data;

    const geometry = new THREE.PlaneGeometry(
        f.boundsX[1] - f.boundsX[0], // ширина по оси X
        f.boundsY[1] - f.boundsY[0], // высота по оси Y
        x.length - 1, // количество делений по оси X
        y.length - 1, // количество делений по оси Y
    );

    const vertices = geometry.attributes.position.array;
    let i = 0;

    // Заполнение координат для каждой вершины
    for (let xi = 0; xi < x.length; xi++) {
        for (let yi = 0; yi < y.length; yi++) {
            const value = z[xi][yi];
            vertices[i + 0] = x[xi];
            vertices[i + 1] = y[yi];
            vertices[i + 2] = value;
            i += 3;
        }
    }
    geometry.computeVertexNormals();
    return { geometry, vertices };
}

function addGridToSurface(x, y, z, scene) {
    if (surfaceGrid) {
        scene.remove(surfaceGrid);
        disposeObject(surfaceGrid);
    }

    const geometry = surface.geometry;
    const wireframeGeometry = new THREE.WireframeGeometry(geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({
        color: 0x888888,
        opacity: 0.7,
        transparent: true,
    });
    surfaceGrid = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);

    surfaceGrid.scale.set(surface.scale.x, surface.scale.y, surface.scale.z);
    scene.add(surfaceGrid);
}

function getSurfaceColors(data) {
    const { x, y, z } = data;
    const allZValues = z.flat();
    const minZ = Math.min(...allZValues);
    const maxZ = Math.max(...allZValues);

    const colors = new Float32Array(x.length * y.length * 3);

    for (let i = 0; i < x.length; i++) {
        for (let j = 0; j < y.length; j++) {
            let value = (z[i][j] - minZ) / (maxZ - minZ); // нормализуем значение Z
            // Логарифмическая трансформация для сглаживания значений
            value = Math.log(1 + z[i][j] - minZ) / Math.log(1 + maxZ - minZ);

            const hue = (1 - value) * 240; // от синего (240) к красному (0)

            const saturation = 0.7;
            const lightness = 0.5;

            // Преобразуем HSL в RGB
            const color = new THREE.Color().setHSL(hue / 360, saturation, lightness); // hue делим на 360 для корректной работы с THREE.js

            const idx = (i * y.length + j) * 3; // Индекс для RGB (умножаем на 3)

            colors[idx] = color.r;
            colors[idx + 1] = color.g;
            colors[idx + 2] = color.b;
        }
    }

    return colors;
}

function addPoints(f, population, minimum, showPopulation, radius = 0.08, color = 0xff0000) {
    scene.remove(minPoint);
    scene.remove(pointCloud);
    if (population.length > 0 && showPopulation) {
        pointCloud = new THREE.Group(); // Группа для всех точек (сфер)

        const sphereGeometry = new THREE.SphereGeometry(radius, 10, 10);
        const sphereMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,

            transparent: true,
            opacity: 0.5,
        });

        population.forEach((p) => {
            const zValue = evaluateFunction(f.function, { x: p[0], y: p[1] });

            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            const xScaled = p[0] * surface.scale.x;
            const yScaled = p[1] * surface.scale.y;
            const zScaled = zValue * surface.scale.z;
            sphere.position.set(xScaled, zScaled, -yScaled);

            pointCloud.add(sphere);
        });

        scene.add(pointCloud);
    }
    if (minimum) {
        addMinimum(f, minimum, radius);
    }
}

function addMinimum(f, p, radius = 0.08) {
    const sphereGeometry = new THREE.SphereGeometry(radius, 10, 10);
    const sphereMaterial = new THREE.MeshStandardMaterial({
        color: 0x0000ff,
        emissive: 0x0000ff,
    });

    const zValue = evaluateFunction(f.function, { x: p[0], y: p[1] });

    minPoint = new THREE.Mesh(sphereGeometry, sphereMaterial);
    const xScaled = p[0] * surface.scale.x;
    const yScaled = p[1] * surface.scale.y;
    const zScaled = zValue * surface.scale.z;
    minPoint.position.set(xScaled, zScaled, -yScaled);

    scene.add(minPoint);
}

function addTrajectory(f, showTrajectory, history, color = 0x0000ff) {
    scene.remove(trajectoryLine);
    if (!showTrajectory) return;
    if (!history || history.length < 2) return;
    const points = history.map(
        ([x, y]) =>
            new THREE.Vector3(
                x * surface.scale.x,
                evaluateFunction(f.function, { x, y }) * surface.scale.z,
                -y * surface.scale.y,
            ),
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    trajectoryLine = new THREE.Line(geometry, material);
    scene.add(trajectoryLine);
}

function addGrid(scene, length) {
    const gridMaterial = new THREE.LineBasicMaterial({
        color: 0x999999,
        transparent: true,
        opacity: 0.5,
    });

    grid = new THREE.GridHelper(length, length);
    grid.material = gridMaterial; // Применяем новый материал

    scene.add(grid);
}

function addAxisTicks(scene, axis, rangeL, rangeR, scale) {
    const tickSize = 0.2;
    const fontSize = 48;

    let step = 1;

    if (Math.abs(rangeR - rangeL) > 50) {
        step = Math.floor(Math.abs(rangeR - rangeL) / 100);
    }
    if (scale < 0.5) {
        step = Math.floor(Math.abs(rangeR - rangeL) / 10);
    }

    if (step === 0) step = 1;

    for (let i = rangeL; i <= rangeR; i += step) {
        const value = i.toFixed(1);
        if (value == 0) continue;
        let position = i * scale;

        if (axis === 'z') position *= -1;

        // Добавляем черточки
        let tickStart, tickEnd;
        if (axis === 'x') {
            tickStart = new THREE.Vector3(position, -tickSize / 2, 0);
            tickEnd = new THREE.Vector3(position, tickSize / 2, 0);
        } else if (axis === 'y') {
            tickStart = new THREE.Vector3(-tickSize / 2, position, 0);
            tickEnd = new THREE.Vector3(tickSize / 2, position, 0);
        } else if (axis === 'z') {
            tickStart = new THREE.Vector3(0, -tickSize / 2, position);
            tickEnd = new THREE.Vector3(0, tickSize / 2, position);
        }

        const tickGeometry = new THREE.BufferGeometry().setFromPoints([tickStart, tickEnd]);
        const tickMaterial = new THREE.LineBasicMaterial({
            color: 0x222222,
        });
        const tick = new THREE.Line(tickGeometry, tickMaterial);
        scene.add(tick);
        axisTicks.push(tick);

        // Добавляем подписи
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = ctx.measureText(toString(value)).width * 3;
        canvas.height = ctx.measureText(toString(value)).width * 1.5;

        ctx.fillStyle = 'rgba(255, 255, 255, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillText(value, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(tickSize * 3, tickSize * 1.5, 1);

        if (axis === 'x') {
            sprite.position.set(position, -tickSize * 3, 0);
        } else if (axis === 'y') {
            sprite.position.set(-tickSize * 3, position, 0);
        } else if (axis === 'z') {
            sprite.position.set(0, -tickSize * 3, position);
        }

        scene.add(sprite);
        axisTicks.push(sprite);
    }
}

// Функция для создания текстуры на канвасе
function createTextTexture(text, fontSize, textColor = 'black', forAxis = false) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${fontSize}px Arial`;
    if (forAxis) {
        canvas.width = fontSize * 4;
        canvas.height = fontSize * 2;
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// Функция для создания подписи с использованием канваса
function createLabel(text, position, fontSize, textColor = 'black', forAxis = false) {
    const texture = createTextTexture(text, fontSize, textColor, forAxis);
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(position.x, position.y, position.z);
    sprite.scale.set(4, 2, 1.0);
    scene.add(sprite);
}

// Функция добавления осей с делениями
function addAxes(scene, xRange, yRange, zRange) {
    const axesMaterial = new THREE.LineBasicMaterial({ color: 0x222222 });

    const axesGeometry = new THREE.BufferGeometry();
    const axesVertices = [
        xRange[0],
        0,
        0,
        xRange[1],
        0,
        0, // Ось X
        0,
        zRange[0],
        0,
        0,
        zRange[1],
        0, // Ось Z
        0,
        0,
        yRange[0],
        0,
        0,
        yRange[1], // Ось Y
    ];

    axesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(axesVertices, 3));
    const axes = new THREE.LineSegments(axesGeometry, axesMaterial);
    scene.add(axes);

    // Длина стрелок
    const arrowLength = 2.0;
    const arrowColor = 0x222222;

    // Стрелка для оси X
    arrowX = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(xRange[1], 0, 0),
        arrowLength,
        arrowColor,
    );
    scene.add(arrowX);
    createLabel('X', new THREE.Vector3(xRange[1] + 0.05 + arrowLength, -0.3, 0), 72, 'black', true);
    arrowX.scale.y *= Math.sign(surface.scale.x);

    // Стрелка для оси Y
    arrowY = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0, yRange[0]),
        arrowLength,
        arrowColor,
    );
    scene.add(arrowY);
    createLabel(
        'Y',
        new THREE.Vector3(-0.3, 0, -yRange[1] - 0.05 - arrowLength),
        72,
        'black',
        true,
    );
    arrowY.scale.y *= Math.sign(surface.scale.y);
    // Стрелка для оси Z
    arrowZ = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, zRange[1], 0),
        arrowLength,
        arrowColor,
    );
    scene.add(arrowZ);
    createLabel('Z', new THREE.Vector3(0, zRange[1] + 0.05 + arrowLength, -0.3));
    arrowZ.scale.y *= Math.sign(surface.scale.z);
    arrowZ.scale.y *= Math.sign(surface.scale.z);
}
