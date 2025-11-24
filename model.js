function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// Helper class for Vertex
function Vertex(p, n) {
    this.p = p;
    this.n = n;
}

// Model Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBufferTriangles = gl.createBuffer();
    this.iIndexBufferLines = gl.createBuffer(); // Новий буфер для ліній
    
    this.countTriangles = 0;
    this.countLines = 0;

    this.BufferData = function(vertices, normals, indicesTri, indicesLines) {
        // Vertex Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // Normal Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        // Index Buffer (Triangles)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferTriangles);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesTri, gl.STATIC_DRAW);
        this.countTriangles = indicesTri.length;

        // Index Buffer (Lines) - якщо передано
        if (indicesLines) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferLines);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesLines, gl.STATIC_DRAW);
            this.countLines = indicesLines.length;
        }
    }

    this.Draw = function(wireframe) {
        // Bind Vertices
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        // Bind Normals
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        if (wireframe) {
            // Малюємо лінії (сітку)
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferLines);
            gl.drawElements(gl.LINES, this.countLines, gl.UNSIGNED_SHORT, 0);
        } else {
            // Малюємо трикутники (заливку)
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBufferTriangles);
            gl.drawElements(gl.TRIANGLES, this.countTriangles, gl.UNSIGNED_SHORT, 0);
        }
    }
}

// Function to calculate surface point and analytic normal
function calcSurfacePoint(u, v, params) {
    const { R1, R2, fi } = params;
    
    const a = R2 - R1;
    let tanFi = Math.tan(fi);
    if (Math.abs(tanFi) < 1e-6) tanFi = 1e-6;
    const c = (-2 * Math.PI * a) / tanFi;
    const b = (3 * c) / 4;

    const beta = u; 
    const z = v;

    // Surface equations
    const r = a * (1 - Math.cos(2 * Math.PI * z / c)) + R1;
    const x = r * Math.cos(beta);
    const y = r * Math.sin(beta);
    const z_centered = z - b/2; 

    // Analytic Normal Calculation
    const dr_dz = a * (2 * Math.PI / c) * Math.sin(2 * Math.PI * z / c);

    const tx_u = -r * Math.sin(beta);
    const ty_u =  r * Math.cos(beta);
    const tz_u =  0;

    const tx_v = dr_dz * Math.cos(beta);
    const ty_v = dr_dz * Math.sin(beta);
    const tz_v = 1;

    let nx = ty_u * tz_v - tz_u * ty_v;
    let ny = tz_u * tx_v - tx_u * tz_v;
    let nz = tx_u * ty_v - ty_u * tx_v;

    let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (len > 0.00001) {
        nx /= len; ny /= len; nz /= len;
    }

    return {
        p: [x, y, z_centered],
        n: [nx, ny, nz]
    };
}

function CreateSurfaceData(data, params) {
    let vertices = [];
    let normals = [];
    let indicesTri = [];
    let indicesLines = []; // Для сітки

    const { R1, R2, fi, u_steps, v_steps } = params;
    const a = R2 - R1;
    let tanFi = Math.tan(fi);
    if (Math.abs(tanFi) < 1e-6) tanFi = 1e-6;
    const c = (-2 * Math.PI * a) / tanFi;
    const b = (3 * c) / 4;

    const uMax = 2 * Math.PI;
    const vMax = b;

    // Vertices
    for (let i = 0; i <= v_steps; i++) {
        let v = (i / v_steps) * vMax;
        for (let j = 0; j <= u_steps; j++) {
            let u = (j / u_steps) * uMax;
            
            let point = calcSurfacePoint(u, v, params);
            
            vertices.push(point.p[0], point.p[1], point.p[2]);
            normals.push(point.n[0], point.n[1], point.n[2]);
        }
    }

    // Indices
    const rowLen = u_steps + 1;

    for (let i = 0; i < v_steps; i++) {
        for (let j = 0; j < u_steps; j++) {
            let p1 = i * rowLen + j;
            let p2 = p1 + 1;
            let p3 = (i + 1) * rowLen + j;
            let p4 = p3 + 1;

            // Triangles (Filled)
            indicesTri.push(p1, p3, p2);
            indicesTri.push(p2, p3, p4);

            // Lines (Wireframe Grid)
            // Горизонтальна лінія (p1 -> p2)
            indicesLines.push(p1, p2);
            // Вертикальна лінія (p1 -> p3)
            indicesLines.push(p1, p3);
        }
    }

    data.verticesF32 = new Float32Array(vertices);
    data.normalsF32 = new Float32Array(normals);
    data.indicesTriU16 = new Uint16Array(indicesTri);
    data.indicesLinesU16 = new Uint16Array(indicesLines);
}

// Проста сфера для візуалізації лампи
function CreateSphereData(radius) {
    let vertices = [];
    let normals = [];
    let indices = [];
    
    let latBands = 16;
    let longBands = 16;

    for (let lat = 0; lat <= latBands; lat++) {
        let theta = lat * Math.PI / latBands;
        let sinTheta = Math.sin(theta);
        let cosTheta = Math.cos(theta);

        for (let long = 0; long <= longBands; long++) {
            let phi = long * 2 * Math.PI / longBands;
            let sinPhi = Math.sin(phi);
            let cosPhi = Math.cos(phi);

            let x = cosPhi * sinTheta;
            let y = cosTheta;
            let z = sinPhi * sinTheta;

            normals.push(x, y, z);
            vertices.push(radius * x, radius * y, radius * z);
        }
    }

    for (let lat = 0; lat < latBands; lat++) {
        for (let long = 0; long < longBands; long++) {
            let first = (lat * (longBands + 1)) + long;
            let second = first + longBands + 1;
            
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return {
        vertices: new Float32Array(vertices),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices)
    };
}