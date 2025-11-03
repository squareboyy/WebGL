'use strict';

/**
 * Конструктор для 3D-моделі.
 * Створює два буфери: для U-поліліній та V-поліліній.
 */
function Model(name) {
    this.name = name;
    
    // Буфери для U-ліній
    this.iVertexBufferU = gl.createBuffer();
    this.countU = 0;

    // Буфери для V-ліній
    this.iVertexBufferV = gl.createBuffer();
    this.countV = 0;
}

/**
 * Заповнення буферів WebGL даними вершин.
 * @param {Float32Array} verticesU - Вершини для U-ліній.
 * @param {Float3Array} verticesV - Вершини для V-ліній.
 */
Model.prototype.BufferData = function(verticesU, verticesV) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBufferU);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticesU), gl.DYNAMIC_DRAW);
    this.countU = verticesU.length / 3;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBufferV);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticesV), gl.DYNAMIC_DRAW);
    this.countV = verticesV.length / 3;
}

/**
 * Відображення поліліній (U та V).
 */
Model.prototype.Draw = function() {
    
    // U-лінії
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBufferU);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);
    gl.drawArrays(gl.LINES, 0, this.countU);

    // V-лінії
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBufferV);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);
    gl.drawArrays(gl.LINES, 0, this.countV);
}