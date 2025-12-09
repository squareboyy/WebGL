'use strict';

let gl;
let surface;
let lightModel;
let pivotModel; 
let shProgram;
let spaceball;

let g_viewDistance = 15;
let g_drawWireframe = false;
let g_useTextures = true;
let lightAngle = 0;

let g_objRotation = 0;
let g_rotAxis = 'y';

let g_pivotMode = 'surface'; 
let g_pivotUV = { u: 0, v: 0 };
let g_pivotCustom = { x: 0, y: 0, z: 0 };

let g_surfaceParams = {
    R1: 3.0,
    R2: 2.0,
    fi: Math.PI / 6, 
    u_steps: 30,
    v_steps: 30
};

// --- Helper function for dynamic logic ---
// Автоматично інвертує кут fi, якщо R1 < R2, щоб виправити геометрію та рух
function getEffectiveParams() {
    // Створюємо копію параметрів, щоб не змінювати UI
    let params = { ...g_surfaceParams };
    
    // Ваше спостереження: якщо R1 < R2, зміна знаку кута виправляє проблему
    if (params.R1 < params.R2) {
        params.fi = -params.fi;
    }
    return params;
}

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTangent = -1;
    this.iAttribTexCoord = -1;
    
    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iNormalMatrix = -1;
    
    this.iLightPosition = -1;
    this.iAmbientProduct = -1;
    this.iDiffuseProduct = -1;
    this.iSpecularProduct = -1;
    this.iShininess = -1;
    
    this.iTMU0 = -1;
    this.iTMU1 = -1;
    this.iTMU2 = -1;

    this.iUseDiffuse = -1;
    this.iUseSpecular = -1;
    this.iUseNormal = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let projection = m4.perspective(Math.PI/8, gl.canvas.clientWidth / gl.canvas.clientHeight, 0.1, 200); 
    let modelView = spaceball.getViewMatrix(); 

    lightAngle += 0.01; 
    let lightRadius = 7.5;
    let lightPosWorld = [lightRadius * Math.sin(lightAngle), 7.5, lightRadius * Math.cos(lightAngle)];

    let viewMatrixOnly = m4.translation(0, 0, -g_viewDistance);
    let lightPosEye = m4.transformPoint(viewMatrixOnly, lightPosWorld);

    let currentPivot = [0, 0, 0];

    // Використовуємо ефективні параметри для розрахунку точки
    if (g_pivotMode === 'surface') {
        let effParams = getEffectiveParams();
        let pointData = calcSurfacePoint(g_pivotUV.u, g_pivotUV.v, effParams);
        currentPivot = pointData.p;
    } else {
        currentPivot = [g_pivotCustom.x, g_pivotCustom.y, g_pivotCustom.z];
    }

    let translateToOrigin = m4.translation(-currentPivot[0], -currentPivot[1], -currentPivot[2]);
    
    let rad = g_objRotation * Math.PI / 180;
    let rotateObj;
    if (g_rotAxis === 'x') {
        rotateObj = m4.xRotation(rad);
    } else if (g_rotAxis === 'y') {
        rotateObj = m4.yRotation(rad);
    } else {
        rotateObj = m4.zRotation(rad);
    }

    let translateBack = m4.translation(currentPivot[0], currentPivot[1], currentPivot[2]);
    
    let objectTransform = m4.multiply(translateBack, m4.multiply(rotateObj, translateToOrigin));
    
    let finalModelView = m4.multiply(modelView, objectTransform);

    let modelViewProjection = m4.multiply(projection, finalModelView);
    let normalMatrix = m4.inverse(finalModelView);
    normalMatrix = m4.transpose(normalMatrix);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, finalModelView);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    gl.uniform3fv(shProgram.iLightPosition, lightPosEye);

    gl.uniform3fv(shProgram.iAmbientProduct,  [0.2, 0.2, 0.2]);
    gl.uniform3fv(shProgram.iDiffuseProduct,  [1.0, 1.0, 1.0]); 
    gl.uniform3fv(shProgram.iSpecularProduct, [1.0, 1.0, 1.0]);
    gl.uniform1f(shProgram.iShininess, 50.0);
    
    gl.uniform1i(shProgram.iTMU0, 0);
    gl.uniform1i(shProgram.iTMU1, 1);
    gl.uniform1i(shProgram.iTMU2, 2);

    let useState = g_useTextures ? 1 : 0;
    gl.uniform1i(shProgram.iUseDiffuse, useState);
    gl.uniform1i(shProgram.iUseSpecular, useState);
    gl.uniform1i(shProgram.iUseNormal, useState);

    surface.Draw(g_drawWireframe);

    let lightTrans = m4.translation(lightPosWorld[0], lightPosWorld[1], lightPosWorld[2]);
    let lightModelView = m4.multiply(viewMatrixOnly, lightTrans);
    let lightMVP = m4.multiply(projection, lightModelView);
    let lightNormalMat = m4.inverse(lightModelView);
    lightNormalMat = m4.transpose(lightNormalMat);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, lightMVP);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, lightModelView);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, lightNormalMat);

    gl.uniform3fv(shProgram.iAmbientProduct,  [1.0, 1.0, 1.0]); 
    gl.uniform3fv(shProgram.iDiffuseProduct,  [0.0, 0.0, 0.0]);
    gl.uniform3fv(shProgram.iSpecularProduct, [0.0, 0.0, 0.0]);

    gl.uniform1i(shProgram.iUseDiffuse, 0);
    gl.uniform1i(shProgram.iUseSpecular, 0);
    gl.uniform1i(shProgram.iUseNormal, 0);

    lightModel.Draw(false); 

    let pivotMatrix = m4.translation(currentPivot[0], currentPivot[1], currentPivot[2]);
    let pivotMV = m4.multiply(modelView, pivotMatrix); 
    
    let pivotMVP = m4.multiply(projection, pivotMV);
    let pivotNM = m4.inverse(pivotMV);
    pivotNM = m4.transpose(pivotNM);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, pivotMVP);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, pivotMV);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, pivotNM);

    gl.uniform3fv(shProgram.iAmbientProduct,  [0.0, 1.0, 0.0]); 
    gl.uniform3fv(shProgram.iDiffuseProduct,  [0.0, 0.0, 0.0]);
    gl.uniform3fv(shProgram.iSpecularProduct, [0.0, 0.0, 0.0]);

    pivotModel.Draw(false);

    requestAnimationFrame(draw);
}

function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex   = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal   = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTangent  = gl.getAttribLocation(prog, "tangent");
    shProgram.iAttribTexCoord = gl.getAttribLocation(prog, "texCoord");

    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog, "NormalMatrix");
    
    shProgram.iLightPosition   = gl.getUniformLocation(prog, "LightPosition");
    shProgram.iAmbientProduct  = gl.getUniformLocation(prog, "AmbientProduct");
    shProgram.iDiffuseProduct  = gl.getUniformLocation(prog, "DiffuseProduct");
    shProgram.iSpecularProduct = gl.getUniformLocation(prog, "SpecularProduct");
    shProgram.iShininess       = gl.getUniformLocation(prog, "Shininess");
    
    shProgram.iTMU0 = gl.getUniformLocation(prog, "iTMU0");
    shProgram.iTMU1 = gl.getUniformLocation(prog, "iTMU1");
    shProgram.iTMU2 = gl.getUniformLocation(prog, "iTMU2");

    shProgram.iUseDiffuse = gl.getUniformLocation(prog, "uUseDiffuse");
    shProgram.iUseSpecular = gl.getUniformLocation(prog, "uUseSpecular");
    shProgram.iUseNormal = gl.getUniformLocation(prog, "uUseNormal");

    regenerateSurface();

    lightModel = new Model("Light");
    let sphereData = CreateSphereData(0.2); 
    lightModel.BufferData(sphereData.verticesF32, sphereData.normalsF32, sphereData.tangentsF32, sphereData.texCoordsF32, sphereData.indicesTriU16, null);

    pivotModel = new Model("Pivot");
    let pivotData = CreateSphereData(0.05); 
    pivotModel.BufferData(pivotData.verticesF32, pivotData.normalsF32, pivotData.tangentsF32, pivotData.texCoordsF32, pivotData.indicesTriU16, null);

    gl.enable(gl.DEPTH_TEST);
}

function regenerateSurface() {
    let data = {};
    let effParams = getEffectiveParams();
    CreateSurfaceData(data, effParams);
    
    if (!surface) surface = new Model('Surface');
    surface.BufferData(data.verticesF32, data.normalsF32, data.tangentsF32, data.texCoordsF32, data.indicesTriU16, data.indicesLinesU16);

    if (surface.idTextureDiffuse === -1) {
        surface.idTextureDiffuse = LoadTexture("./textures/diff.jpg"); 
        surface.idTextureSpecular = LoadTexture("./textures/spec.jpg");
        surface.idTextureNormal = LoadTexture("./textures/norm.jpg");
    }

    const { R1, R2, fi } = effParams;
    const a = R2 - R1;
    let tanFi = Math.tan(fi);
    if (Math.abs(tanFi) < 1e-6) tanFi = 1e-6;
    const c = (-2 * Math.PI * a) / tanFi;
    const b = (3 * c) / 4;
    
    if (g_pivotUV.u === 0 && g_pivotUV.v === 0) {
        g_pivotUV.u = Math.PI;
        g_pivotUV.v = Math.abs(b) / 2;
    }
}

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

function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl = canvas.getContext("webgl");
        if ( ! gl ) throw "Browser does not support WebGL";
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML = "<p>Error: " + e + "</p>";
        return;
    }
    
    initGL();
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    spaceball = new TrackballRotator(canvas, function(){}, g_viewDistance);

    window.addEventListener("keydown", function(e) {
        if (g_pivotMode !== 'surface') return;

        // Використовуємо ефективні параметри для розрахунку кроку та меж
        const effParams = getEffectiveParams();
        const { R1, R2, fi } = effParams;
        
        const a = R2 - R1;
        let tanFi = Math.tan(fi);
        if (Math.abs(tanFi) < 1e-6) tanFi = 1e-6;
        const c = (-2 * Math.PI * a) / tanFi;
        const b = (3 * c) / 4;

        const uMax = 2 * Math.PI;
        const vMax = Math.abs(b);
        
        const stepU = uMax / 50; 
        const stepV = vMax / 50;

        switch(e.key.toLowerCase()) {
            case 'a': 
                g_pivotUV.u -= stepU; 
                if (g_pivotUV.u < 0) g_pivotUV.u += uMax; 
                break;
            case 'd': 
                g_pivotUV.u += stepU; 
                if (g_pivotUV.u > uMax) g_pivotUV.u -= uMax; 
                break;
            case 's': 
                g_pivotUV.v = Math.max(0, g_pivotUV.v - stepV); 
                break;
            case 'w': 
                g_pivotUV.v = Math.min(vMax, g_pivotUV.v + stepV); 
                break;
        }
    });

    canvas.addEventListener("wheel", function(evt) {
        evt.preventDefault();
        let scale = (evt.deltaY < 0) ? 0.9 : 1.1;
        g_viewDistance *= scale;
        g_viewDistance = Math.max(3, Math.min(50, g_viewDistance));
        spaceball.setViewDistance(g_viewDistance);
    });

    document.getElementById("chkWireframe").addEventListener("change", function(evt) {
        g_drawWireframe = evt.target.checked;
    });

    document.getElementById("chkTextures").addEventListener("change", (e) => { 
        g_useTextures = e.target.checked; 
    });

    document.getElementById("paramRotation").addEventListener("input", (e) => {
        g_objRotation = parseFloat(e.target.value);
    });

    document.querySelectorAll('input[name="rotAxis"]').forEach((elem) => {
        elem.addEventListener("change", function(event) {
            g_rotAxis = event.target.value;
        });
    });

    document.querySelectorAll('input[name="pivotSource"]').forEach((elem) => {
        elem.addEventListener("change", function(event) {
            g_pivotMode = event.target.value;
        });
    });

    function updateCustomPivot() {
        g_pivotCustom.x = parseFloat(document.getElementById("pivotX").value);
        g_pivotCustom.y = parseFloat(document.getElementById("pivotY").value);
        g_pivotCustom.z = parseFloat(document.getElementById("pivotZ").value);
    }
    document.getElementById("pivotX").addEventListener("input", updateCustomPivot);
    document.getElementById("pivotY").addEventListener("input", updateCustomPivot);
    document.getElementById("pivotZ").addEventListener("input", updateCustomPivot);

    function setupSlider(id, paramKey) {
        let el = document.getElementById(id);
        if(el) {
            el.addEventListener("input", (e) => {
                g_surfaceParams[paramKey] = parseFloat(e.target.value);
                regenerateSurface();
            });
        }
    }
    
    setupSlider("paramR1", "R1");
    setupSlider("paramR2", "R2");
    setupSlider("paramResU", "u_steps");
    setupSlider("paramResV", "v_steps"); 
    
    document.getElementById("paramFi").addEventListener("input", function(evt) {
        let val = evt.target.value;
        if (val === "pi/6") g_surfaceParams.fi = Math.PI / 6;
        else if (val === "-pi/6") g_surfaceParams.fi = -Math.PI / 6;
        regenerateSurface();
    });

    draw();
}