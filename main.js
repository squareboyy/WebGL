'use strict';

let gl;
let surface;
let shProgram;
let spaceball;

let g_viewDistance = 10;
let g_surfaceColor = [0.0, 1.0, 0.0, 1.0];

// Глобальні параметри поверхні
let g_surfaceParams = {
    R1: 1.0,
    R2: 2.0,
    fi: Math.PI / 6,
    u_steps: 30,
    v_steps: 30
};


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
    const { R1, R2, fi } = params;
    const book_beta = u;
    const book_z = v;
    const a = R2 - R1;
    
    let tanFi = Math.tan(fi);
    if (Math.abs(tanFi) < 1e-6) {
        tanFi = 1e-6; // Запобігання діленню на нуль
    }

    const c = (-2 * Math.PI * a) / tanFi; 
    const b = (3 * c) / 4;
    const radius = a * (1 - Math.cos(2 * Math.PI * book_z / c)) + R1;
    
    const x = radius * Math.cos(book_beta);
    const y = radius * Math.sin(book_beta);
    const z = book_z - (b / 2); 
    
    return [x, y, z];
}

/**
 * Генерує масиви вершин для U та V поліліній.
 */
function generateSurfaceData(params) {
    let verticesU = [];
    let verticesV = [];

    const { R1, R2, fi } = params;
    const a = R2 - R1;
    
    let tanFi = Math.tan(fi);
    if (Math.abs(tanFi) < 1e-6) tanFi = 1e-6;
    
    const c = (-2 * Math.PI * a) / tanFi;
    const b = (3 * c) / 4;
    const u_max = 2 * Math.PI; // Діапазон для β: 0 <= β <= 2π
    const v_max = b;           // Діапазон для z: 0 <= z <= b
    const u_steps = parseInt(params.u_steps);
    const v_steps = parseInt(params.v_steps);

    // Генерація U-ліній
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

    // Генерація V-ліній
    for (let i = 0; i <= u_steps; i++) {
        let u = (i / u_steps) * u_max; // u = β
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
    
    // Ініціалізація R1, R2 та Res
    setupSlider("paramR1", "numR1", "R1");
    setupSlider("paramR2", "numR2", "R2");
    setupSlider("paramRes", "numRes", "u_steps", true); 

    // Обробник для вибору кута fi
    document.getElementById("paramFi").addEventListener("input", function(evt) {
        let val = evt.target.value;
        if (val === "pi/6") {
            g_surfaceParams.fi = Math.PI / 6;
        } else if (val === "-pi/6") {
            g_surfaceParams.fi = -Math.PI / 6;
        }
        regenerateSurface();
    });

    // Перший рендер сцени
    draw();
}