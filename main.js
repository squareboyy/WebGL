'use strict';

let gl;
let surface;
let shProgram;
let spaceball;

let g_viewDistance = 10;
let g_surfaceColor = [1.0, 1.0, 0.0, 1.0];

// Глобальні параметри поверхні (зберігаємо кут phi в градусах)
let g_surfaceParams = {
    R1: 1.0,
    R2: 2.0,
    phi_deg: 30.0, // Кут 'φ' (f) в ГРАДУСАХ.
    u_steps: 30,
    v_steps: 30
};

/**
 * Конвертує градуси в радіани.
 */
function deg2rad(angle) {
    return angle * Math.PI / 180;
}

/**
 * Обчислює координати точки на поверхні за параметрами u та v.
 * @param {number} u - Параметр кута (аналог β)
 * @param {number} v - Параметр висоти (аналог z)
 * @param {object} params - Глобальні параметри g_surfaceParams
 * @returns {Array<number>} Координати [x, y, z]
 */
function surfaceOfConjugation(u, v, params) {
    const { R1, R2, phi_deg } = params;

    // 1. Конвертуємо кут f (phi) в радіани
    const phi_rad = deg2rad(phi_deg);
    
    // 2. Обчислюємо 'a' (амплітуду), ВИПРАВЛЕНО
    const book_a = (R2 - R1) / 2;
    
    // 3. Обчислюємо висоту 'c' (в коді 'h')
    let tanPhi = Math.tan(phi_rad);
    if (Math.abs(tanPhi) < 1e-6) {
        tanPhi = 1e-6; // Запобігаємо діленню на нуль
    }
    // Формула з книги c = 2πa / tan(φ)
    // 2 * a = R2 - R1
    const book_c = Math.abs((Math.PI * (R2 - R1)) / tanPhi); 
    
    // 4. Призначаємо змінні з книги
    const book_z = v; // 'v' - це вже реальна висота (0...h)
    const book_beta = u; 

    // 5. Рівняння зі стор. 117
    // r(z) = a(1 - cos(2πz/c)) + R1
    const radius = book_a * (1 - Math.cos(2 * Math.PI * book_z / book_c)) + R1;
    
    const x = radius * Math.cos(book_beta);
    const y = radius * Math.sin(book_beta);
    const z = book_z - book_c / 2; // Центруємо поверхню
    
    return [x, y, z];
}

/**
 * Генерує масиви вершин для U та V поліліній.
 */
function generateSurfaceData(params) {
    let verticesU = [];
    let verticesV = [];

    // --- Обчислюємо висоту 'h' (book 'c') на основі параметрів ---
    const { R1, R2, phi_deg } = params;
    const phi_rad = deg2rad(phi_deg);
    const book_a = (R2 - R1) / 2;
    let tanPhi = Math.tan(phi_rad);
    if (Math.abs(tanPhi) < 1e-6) tanPhi = 1e-6;
    const h = Math.abs((Math.PI * (R2 - R1)) / tanPhi);
    
    // Оновлюємо UI-елемент (показуємо розраховану висоту)
    document.getElementById("calcC").value = h.toFixed(2);
    // -----------------------------------------------------------
    
    const u_max = 2 * Math.PI;
    const v_max = h; // Максимальне 'v' - це розрахована висота 'h'
    const u_steps = parseInt(params.u_steps);
    const v_steps = parseInt(params.v_steps);

    // Генерація U-ліній (горизонтальні кола)
    for (let i = 0; i <= v_steps; i++) {
        let v = (i / v_steps) * v_max; 
        for (let j = 0; j < u_steps; j++) {
            let u1 = (j / u_steps) * u_max;
            let u2 = ((j + 1) / u_steps) * u_max;
            
            let p1 = surfaceOfConjugation(u1, v, params); 
            let p2 = surfaceOfConjugation(u2, v, params);
            
            verticesU.push(p1[0], p1[1], p1[2]);
            verticesU.push(p2[0], p2[1], p2[2]);
        }
    }

    // Генерація V-ліній (вертикальні меридіани)
    for (let i = 0; i <= u_steps; i++) {
        let u = (i / u_steps) * u_max;
        for (let j = 0; j < v_steps; j++) {
            let v1 = (j / v_steps) * v_max;
            let v2 = ((j + 1) / v_steps) * v_max;

            let p1 = surfaceOfConjugation(u, v1, params);
            let p2 = surfaceOfConjugation(u, v2, params);

            verticesV.push(p1[0], p1[1], p1[2]);
            verticesV.push(p2[0], p2[1], p2[2]);
        }
    }

    return { verticesU, verticesV };
}

/**
 * Функція для перерахунку та оновлення геометрії поверхні.
 */
function regenerateSurface() {
    let data = generateSurfaceData(g_surfaceParams);
    surface.BufferData(data.verticesU, data.verticesV);
    draw();
}

/**
 * Конструктор шейдерної програми
 */
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.iAttribVertex = -1;
    this.iColor = -1;
    this.iModelViewProjectionMatrix = -1;
    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

/**
 * Основна функція малювання сцени.
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let projection = m4.perspective(Math.PI/8, 1, 0.1, 200); 
    let modelView = spaceball.getViewMatrix();
    let modelViewProjection = m4.multiply(projection, modelView );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
    gl.uniform4fv(shProgram.iColor, g_surfaceColor);

    surface.Draw();
}

/**
 * Ініціалізація WebGL контексту.
 */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    surface = new Model('Surface');
    gl.enable(gl.DEPTH_TEST);
}


/* Функція створення програми */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * Головна функція ініціалізації
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Вибачте, не вдалося отримати графічний контекст WebGL.</p>";
        return;
    }
    try {
        initGL();
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Вибачте, не вдалося ініціалізувати WebGL: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, g_viewDistance);

    let data = generateSurfaceData(g_surfaceParams);
    surface.BufferData(data.verticesU, data.verticesV);
    
    // Обробник масштабування
    canvas.addEventListener("wheel", function(evt) {
        evt.preventDefault();
        let scale = (evt.deltaY < 0) ? 0.9 : 1.1;
        g_viewDistance *= scale;
        g_viewDistance = Math.max(3, Math.min(50, g_viewDistance));
        spaceball.setViewDistance(g_viewDistance);
        draw();
    });

    // Обробник вибору кольору
    document.getElementById("colorPicker").addEventListener("input", function(evt) {
        let hex = evt.target.value;
        let r = parseInt(hex.substring(1, 3), 16) / 255;
        let g = parseInt(hex.substring(3, 5), 16) / 255;
        let b = parseInt(hex.substring(5, 7), 16) / 255;
        g_surfaceColor = [r, g, b, 1.0];
        draw();
    });

    // Допоміжна функція для зв'язування повзунків
    function setupSlider(sliderId, numId, paramKey, isInt = false) {
        let slider = document.getElementById(sliderId);
        let numInput = document.getElementById(numId);
        
        function updateParam() {
            let value = isInt ? parseInt(slider.value) : parseFloat(slider.value);
            g_surfaceParams[paramKey] = value;
            numInput.value = value;
            
            if (paramKey === "u_steps") {
                g_surfaceParams.v_steps = value;
            }
            
            regenerateSurface();
        }
        slider.addEventListener("input", updateParam);
        numInput.addEventListener("input", function() {
            slider.value = numInput.value;
            updateParam();
        });
    }
    
    // Ініціалізуємо всі повзунки
    setupSlider("paramR1", "numR1", "R1");
    setupSlider("paramR2", "numR2", "R2");
    setupSlider("paramPhi", "numPhi", "phi_deg"); // Зберігаємо 'phi_deg' (кут f) як градуси
    setupSlider("paramRes", "numRes", "u_steps", true); 

    // Перший рендер сцени
    draw();
}