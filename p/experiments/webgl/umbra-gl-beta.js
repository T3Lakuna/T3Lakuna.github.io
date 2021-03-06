// Umbra GL version 1.0
// Copyright (c) Travis Martin 2021
// MIT License

// Heavily inspired by TWGL 4.x (https://twgljs.org/).
// Copyright (c) Gregg Tavares 2019
// MIT License

/*
Standard WebGL program layout:

Init time:
- Create all shaders and programs and look up locations.
- Create buffers and upload vertex data.
- Create a vertex array for each thing you want to draw.
	- For each attribute call gl.bindBuffer, gl.vertexAttribPointer, and gl.enableVertexAttribArray.
	- Bind any indices to gl.ELEMENT_ARRAY_BUFFER.
- Create textures and upload texture data.

Render time:
- Clear and set the viewport and other global state.
- For each thing you want to draw:
	- Call gl.useProgram for the program needed to draw.
	- Bind the vertex array for that thing (gl.bindVertexArray).
	- Setup uniforms for the thing you want to draw.
		- Call gl.uniformXXX for each uniform.
		- Call gl.activeTexture and gl.bindTexture to assign textures to texture units.
	- Call gl.drawArrays or gl.drawElements.
*/

// Contains static properties and methods for use with WebGL contexts.
class UmbraGL {
	// Contains a WebGL2RenderingContext on a "ghost" canvas, which can be used to access WebGL constants without a WebGL(2)RenderingContext.
	// An up-to-date list of constants can be found on the MDN Web Docs: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants
	static constants = WebGL2RenderingContext.prototype;

	// Ensure that a canvas' physical size (CSS) and drawing buffer size (WebGL) match.
	static resizeCanvasToDisplaySize = (canvas) => {
		const displayWidth = canvas.clientWidth;
		const displayHeight = canvas.clientHeight;

		if (canvas.width != displayWidth || canvas.height != displayHeight) {
			canvas.width = displayWidth;
			canvas.height = displayHeight;
		}
	}
}

// Contains info about a WebGL variable type.
class VariableTypeInfo {
	// Map of VariableTypeInfo to the equivalent GLenum for uniforms.
	static map = (() => {
		let _; // Undefined.

		// Define WebGL2 constants as numbers to save a lot of space when compressed.
		// Not a big fan of the idea of hard-coding external variables, but it saves enough space to be worth it.
		const TEXTURE_2D = 0xDE1;
		const INT = 0x1404;
		const UNSIGNED_INT = 0x1405;
		const FLOAT = 0x1406;
		const TEXTURE_3D = 0x806F;
		const TEXTURE0 = 0x84C0;
		const TEXTURE_CUBE_MAP = 0x8513;
		const FLOAT_VEC2 = 0x8B50;
		const FLOAT_VEC3 = 0x8B51;
		const FLOAT_VEC4 = 0x8B52;
		const INT_VEC2 = 0x8B53;
		const INT_VEC3 = 0x8B54;
		const INT_VEC4 = 0x8B55;
		const BOOL = 0x8B56;
		const BOOL_VEC2 = 0x8B57;
		const BOOL_VEC3 = 0x8B58;
		const BOOL_VEC4 = 0x8B59;
		const FLOAT_MAT2 = 0x8B5A;
		const FLOAT_MAT3 = 0x8B5B;
		const FLOAT_MAT4 = 0x8B5C;
		const SAMPLER_2D = 0x8B5E;
		const SAMPLER_3D = 0x8B5F;
		const SAMPLER_CUBE = 0x8B60;
		const SAMPLER_2D_SHADOW = 0x8B62;
		const FLOAT_MAT2x3 = 0x8B65;
		const FLOAT_MAT2x4 = 0x8B66;
		const FLOAT_MAT3x2 = 0x8B67;
		const FLOAT_MAT3x4 = 0x8B68;
		const FLOAT_MAT4x2 = 0x8B69;
		const FLOAT_MAT4x3 = 0x8B6A;
		const TEXTURE_2D_ARRAY = 0x8C1A;
		const SAMPLER_2D_ARRAY = 0x8DC1;
		const SAMPLER_2D_ARRAY_SHADOW = 0x8DC4;
		const SAMPLER_CUBE_SHADOW = 0x8DC5;
		const UNSIGNED_INT_VEC2 = 0x8DC6;
		const UNSIGNED_INT_VEC3 = 0x8DC7;
		const UNSIGNED_INT_VEC4 = 0x8DC8;
		const INT_SAMPLER_2D = 0x8DCA;
		const INT_SAMPLER_3D = 0x8DCB;
		const INT_SAMPLER_CUBE = 0x8DCC;
		const INT_SAMPLER_2D_ARRAY = 0x8DCF;
		const UNSIGNED_INT_SAMPLER_2D = 0x8DD2;
		const UNSIGNED_INT_SAMPLER_3D = 0x8DD3;
		const UNSIGNED_INT_SAMPLER_CUBE = 0x8DD4;
		const UNSIGNED_INT_SAMPLER_2D_ARRAY = 0x8DD7;

		// Parameters which are used multiple times are declared here as variables for minification purposes.
		const f32a = Float32Array;
		const i32a = Int32Array;
		const u32a = Uint32Array;

		const basicSetter = (suffix) => (gl, location) => {
			const setterMethod = gl[`uniform${suffix}`].bind(gl); // Find the setter method during setup because it's really slow.
			return (v) => setterMethod(location, v);
		};

		const matrixSetter = (suffix) => (gl, location) => {
			const setterMethod = gl[`uniformMatrix${suffix}`].bind(gl); // Find the setter method during setup because it's really slow.
			return (v) => setterMethod(location, false, v);
		};

		const u1i = basicSetter('1i');
		const u1iv = basicSetter('1iv');
		const u2iv = basicSetter('2iv');
		const u3iv = basicSetter('3iv');
		const u4iv = basicSetter('4iv');

		// [dataType, size, setter, arraySetter, bindPoint]
		const samplerSettings = (bindPoint) => [
			_,
			0,
			(gl, location, type, unit) => (texture) => {
				gl.uniform1i(location, unit);
				gl.activeTexture(TEXTURE0 + unit);
				gl.bindTexture(bindPoint, texture);
			},
			(gl, location, type, unit, size) => {
				let units = new i32a(size);
				for (let i = 0; i < size; i++) {
					units[i] = unit + i;
				}

				return (textures) => {
					gl.uniform1iv(location, units);

					for (const [i, texture] of textures.entries()) {
						gl.activeTexture(TEXTURE0 + units[i]);
						gl.bindTexture(bindPoint, texture);
					}
				};
			},
			bindPoint
		];

		const t2d = samplerSettings(TEXTURE_2D);
		const tcm = samplerSettings(TEXTURE_CUBE_MAP);
		const t3d = samplerSettings(TEXTURE_3D);
		const t2da = samplerSettings(TEXTURE_2D_ARRAY);

		const list = [
			new VariableTypeInfo(FLOAT, f32a, 4, basicSetter('1f'), basicSetter('1fv')),
			new VariableTypeInfo(FLOAT_VEC2, f32a, 8, basicSetter('2fv')),
			new VariableTypeInfo(FLOAT_VEC3, f32a, 12, basicSetter('3fv')),
			new VariableTypeInfo(FLOAT_VEC4, f32a, 16, basicSetter('4fv')),

			new VariableTypeInfo(INT, i32a, 4, u1i, u1iv),
			new VariableTypeInfo(INT_VEC2, i32a, 8, u2iv),
			new VariableTypeInfo(INT_VEC3, i32a, 12, u3iv),
			new VariableTypeInfo(INT_VEC4, i32a, 16, u4iv),

			new VariableTypeInfo(BOOL, u32a, 4, u1i, u1iv),
			new VariableTypeInfo(BOOL_VEC2, u32a, 8, u2iv),
			new VariableTypeInfo(BOOL_VEC3, u32a, 12, u3iv),
			new VariableTypeInfo(BOOL_VEC4, u32a, 16, u4iv),

			new VariableTypeInfo(UNSIGNED_INT, u32a, 4, basicSetter('1ui'), basicSetter('1uiv')),
			new VariableTypeInfo(UNSIGNED_INT_VEC2, u32a, 8, basicSetter('2uiv')),
			new VariableTypeInfo(UNSIGNED_INT_VEC3, u32a, 12, basicSetter('3uiv')),
			new VariableTypeInfo(UNSIGNED_INT_VEC4, u32a, 16, basicSetter('4uiv')),

			new VariableTypeInfo(FLOAT_MAT2, f32a, 16, matrixSetter('2fv')),
			new VariableTypeInfo(FLOAT_MAT3, f32a, 36, matrixSetter('3fv')),
			new VariableTypeInfo(FLOAT_MAT4, f32a, 64, matrixSetter('4fv')),

			new VariableTypeInfo(FLOAT_MAT2x3, f32a, 24, matrixSetter('2x3fv')),
			new VariableTypeInfo(FLOAT_MAT2x4, f32a, 32, matrixSetter('2x4fv')),
			new VariableTypeInfo(FLOAT_MAT3x2, f32a, 24, matrixSetter('3x2fv')),
			new VariableTypeInfo(FLOAT_MAT3x4, f32a, 48, matrixSetter('3x4fv')),
			new VariableTypeInfo(FLOAT_MAT4x2, f32a, 32, matrixSetter('4x2fv')),
			new VariableTypeInfo(FLOAT_MAT4x3, f32a, 48, matrixSetter('4x3fv')),

			new VariableTypeInfo(SAMPLER_2D, ...t2d),
			new VariableTypeInfo(SAMPLER_3D, ...t3d),
			new VariableTypeInfo(SAMPLER_CUBE, ...tcm),
			new VariableTypeInfo(SAMPLER_2D_SHADOW, ...t2d),
			new VariableTypeInfo(SAMPLER_2D_ARRAY, ...t2da),
			new VariableTypeInfo(SAMPLER_2D_ARRAY_SHADOW, ...t2da),
			new VariableTypeInfo(SAMPLER_CUBE_SHADOW, ...tcm),

			new VariableTypeInfo(INT_SAMPLER_2D, ...t2d),
			new VariableTypeInfo(INT_SAMPLER_3D, ...t3d),
			new VariableTypeInfo(INT_SAMPLER_CUBE, ...tcm),
			new VariableTypeInfo(INT_SAMPLER_2D_ARRAY, ...t2da),

			new VariableTypeInfo(UNSIGNED_INT_SAMPLER_2D, ...t2d),
			new VariableTypeInfo(UNSIGNED_INT_SAMPLER_3D, ...t3d),
			new VariableTypeInfo(UNSIGNED_INT_SAMPLER_CUBE, ...tcm),
			new VariableTypeInfo(UNSIGNED_INT_SAMPLER_2D_ARRAY, ...t2da)
		];

		let output = {};
		list.forEach((variableTypeInfo) => output[variableTypeInfo.glEnum] = variableTypeInfo);
		return output;
	})();

	// Map of VariableTypeInfo to the equivalent GLenum for attributes.
	static attributeMap = (() => {
		let _; // Undefined.

		// Define WebGL2 constants as numbers to save a lot of space when compressed.
		// Not a big fan of the idea of hard-coding external variables, but it saves enough space to be worth it.
		const INT = 0x1404;
		const UNSIGNED_INT = 0x1405;
		const FLOAT = 0x1406;
		const ARRAY_BUFFER = 0x8892;
		const FLOAT_VEC2 = 0x8B50;
		const FLOAT_VEC3 = 0x8B51;
		const FLOAT_VEC4 = 0x8B52;
		const INT_VEC2 = 0x8B53;
		const INT_VEC3 = 0x8B54;
		const INT_VEC4 = 0x8B55;
		const BOOL = 0x8B56;
		const BOOL_VEC2 = 0x8B57;
		const BOOL_VEC3 = 0x8B58;
		const BOOL_VEC4 = 0x8B59;
		const FLOAT_MAT2 = 0x8B5A;
		const FLOAT_MAT3 = 0x8B5B;
		const FLOAT_MAT4 = 0x8B5C;
		const UNSIGNED_INT_VEC2 = 0x8DC6;
		const UNSIGNED_INT_VEC3 = 0x8DC7;
		const UNSIGNED_INT_VEC4 = 0x8DC8;

		const setterBase = (bufferHandler) => (gl, index) => (b) => {
			gl.bindBuffer(ARRAY_BUFFER, b.buffer);
			gl.enableVertexAttribArray(index);
			bufferHandler(gl, index, b);
		};

		const floatSetter = setterBase((gl, index, b) => gl.vertexAttribPointer(index, b.size, b.type, b.stride, b.offset));

		const intSetter = setterBase((gl, index, b) => gl.vertexAttribIPointer(index, b.size, b.type, b.stride, b.offset));

		const matrixSetter = (gl, index, typeInfo) => (b) => {
			gl.bindBuffer(ARRAY_BUFFER, b.buffer);

			for (let i = 0; i < typeInfo.count; i++) {
				gl.enableVertexAttribArray(index + i);
				const stride = typeInfo.size * b.size;
				gl.vertexAttribPointer(index + i, b.size / typeInfo.count, b.type, b.normalize, stride, b.offset + (stride / typeInfo.count) * i);
			}
		};

		const list = [
			new VariableTypeInfo(FLOAT, _, 4, floatSetter),
			new VariableTypeInfo(FLOAT_VEC2, _, 8, floatSetter),
			new VariableTypeInfo(FLOAT_VEC3, _, 12, floatSetter),
			new VariableTypeInfo(FLOAT_VEC4, _, 16, floatSetter),

			new VariableTypeInfo(INT, _, 4, intSetter),
			new VariableTypeInfo(INT_VEC2, _, 8, intSetter),
			new VariableTypeInfo(INT_VEC3, _, 12, intSetter),
			new VariableTypeInfo(INT_VEC4, _, 16, intSetter),

			new VariableTypeInfo(UNSIGNED_INT, _, 4, intSetter),
			new VariableTypeInfo(UNSIGNED_INT_VEC2, _, 8, intSetter),
			new VariableTypeInfo(UNSIGNED_INT_VEC3, _, 12, intSetter),
			new VariableTypeInfo(UNSIGNED_INT_VEC4, _, 16, intSetter),

			new VariableTypeInfo(BOOL, _, 4, intSetter),
			new VariableTypeInfo(BOOL_VEC2, _, 8, intSetter),
			new VariableTypeInfo(BOOL_VEC3, _, 12, intSetter),
			new VariableTypeInfo(BOOL_VEC4, _, 16, intSetter),

			new VariableTypeInfo(FLOAT_MAT2, _, 4, intSetter, _, _, 2),
			new VariableTypeInfo(FLOAT_MAT3, _, 9, intSetter, _, _, 3),
			new VariableTypeInfo(FLOAT_MAT4, _, 16, intSetter, _, _, 4)
		];

		let output = {};
		list.forEach((variableTypeInfo) => output[variableTypeInfo.glEnum] = variableTypeInfo);
		return output;
	})();

	constructor(glEnum, dataType, size, setter, arraySetter, bindPoint, count) {
		this.glEnum = glEnum;
		this.dataType = dataType;
		this.size = size;
		this.setter = setter;
		this.arraySetter = arraySetter;
		this.bindPoint = bindPoint;
		this.count = count;
	}
}

// Contains information about a WebGL variable.
class VariableInfo {
	constructor(activeInfo, location, setter) {
		this.activeInfo = activeInfo;
		this.location = location;
		this.setter = setter;
	}
}

// Contains a WebGLShader.
class ShaderInfo {
	constructor(gl, type, src) {
		const COMPILE_STATUS = 0x8B81;

		this.shader = gl.createShader(type);
		gl.shaderSource(this.shader, src);
		gl.compileShader(this.shader);

		if (!gl.getShaderParameter(this.shader, COMPILE_STATUS)) {
			const errorString = gl.getShaderInfoLog(this.shader);
			gl.deleteShader(this.shader);
			throw errorString;
		}
	}
}

// Contains a WebGLProgram.
class ProgramInfo {
	constructor(gl, vertexShaderInfo, fragmentShaderInfo) {
		const LINK_STATUS = 0x8B82;
		const ACTIVE_UNIFORMS = 0x8B86;
		const ACTIVE_ATTRIBUTES = 0x8B89;

		this.program = gl.createProgram();
		[vertexShaderInfo, fragmentShaderInfo].forEach((shaderInfo) => gl.attachShader(this.program, shaderInfo.shader));
		gl.linkProgram(this.program);

		if (!gl.getProgramParameter(this.program, LINK_STATUS)) {
			const errorString = gl.getProgramInfoLog(this.program);
			gl.deleteProgram(this.program);
			throw errorString;
		}

		let textureUnit = 0; // Used to assign texture units to textures during initialization.

		this.uniforms = {};
		const uniformCount = gl.getProgramParameter(this.program, ACTIVE_UNIFORMS);
		for (let i = 0; i < uniformCount; i++) {
			const activeInfo = gl.getActiveUniform(this.program, i);
			const location = gl.getUniformLocation(this.program, activeInfo.name);

			this.uniforms[activeInfo.name] = new VariableInfo(activeInfo, location,
				(() => {
					const typeInfo = VariableTypeInfo.map[activeInfo.type];

					// Increment the texture unit if the uniform is a texture.
					let unit;
					if (typeInfo.bindPoint) {
						unit = textureUnit;
						textureUnit += activeInfo.size;
					}

					const parameters = [gl, location, activeInfo.type, unit, activeInfo.size]
					return activeInfo.name.endsWith('[0]')
						? typeInfo.arraySetter(...parameters)
						: typeInfo.setter(...parameters);
				})()
			);
		}

		this.attributes = {};
		const attributeCount = gl.getProgramParameter(this.program, ACTIVE_ATTRIBUTES);
		for (let i = 0; i < attributeCount; i++) {
			const activeInfo = gl.getActiveAttrib(this.program, i);
			const location = gl.getAttribLocation(this.program, activeInfo.name);

			this.attributes[activeInfo.name] = new VariableInfo(activeInfo, location,
				VariableTypeInfo.attributeMap[activeInfo.type].setter(gl, location, VariableTypeInfo.attributeMap[activeInfo.type]));
		}
	}
}

// Contains a WebGLBuffer.
class BufferInfo {
	constructor(gl, data, target = 0x8892 /* ARRAY_BUFFER */, usage = 0x88E4 /* STATIC_DRAW */) {
		this.gl = gl;
		this.target = target;
		this.usage = usage;

		this.buffer = gl.createBuffer();

		this.setData(data);
	}

	setData(data) {
		this.data = data;

		this.gl.bindBuffer(this.target, this.buffer);
		this.gl.bufferData(this.target, data, this.usage);
	};
}

// Contains an instance of a WebGL attribute.
class AttributeInfo {
	constructor(name, bufferInfo, size = 3, type = 0x1406 /* FLOAT */, normalized = false, stride = 0, offset = 0) {
		this.name = name;
		this.bufferInfo = bufferInfo;
		this.size = size;
		this.type = type;
		this.normalized = normalized;
		this.stride = stride;
		this.offset = offset;
	}
}

// Vertex Array Object.
class VAOInfo {
	constructor(gl, programInfo) {
		this.gl = gl;
		this.programInfo = programInfo;

		this.vao = this.gl.createVertexArray();
		this.attributeInfos = [];
	}

	addAttribute(attributeInfo) {
		this.gl.bindVertexArray(this.vao);

		this.attributeInfos.push(attributeInfo);

		const variableInfo = this.programInfo.attributes[attributeInfo.name];

		this.gl.enableVertexAttribArray(variableInfo.location);
		this.gl.bindBuffer(attributeInfo.bufferInfo.target, attributeInfo.bufferInfo.buffer);
		this.gl.vertexAttribPointer(variableInfo.location, attributeInfo.size, attributeInfo.type, attributeInfo.normalized, attributeInfo.stride, attributeInfo.offset);
	}

	setIndices = (data) => this.indices = new BufferInfo(this.gl, data, 0x8893 /* ELEMENT_ARRAY_BUFFER */);

	draw(mode = 0x4 /* TRIANGLES */, type = 0x1401 /* UNSIGNED_BYTE */, offset = 0) {
		this.gl.useProgram(this.programInfo.program);
		this.gl.bindVertexArray(this.vao);

		const bufferLength = this.attributeInfos.length ? this.attributeInfos[0].bufferInfo.data.length : 0;
		const attributeSize = bufferLength ? this.attributeInfos[0].size : 1;
		if (this.indices) {
			this.gl.drawElements(mode, bufferLength, type, offset);
		} else {
			this.gl.drawArrays(mode, offset, bufferLength / attributeSize)
		}
	}
}

// Texture.
class TextureInfo {
	constructor(gl, target = 0xDE1 /* TEXTURE_2D */) {
		this.gl = gl;
		this.target = target;

		this.texture = gl.createTexture();
	}

	setColor(data, level = 0, internalFormat = 0x1908 /* RGBA */, width = 1, height = 1, border = 0, format = 0x1908 /* RGBA */, type = 0x1401 /* UNSIGNED_BYTE */) {
		gl.bindTexture(target, this.texture);
		gl.texImage2D(target, level, internalFormat, width, height, border, format, type, data);
	}

	loadImage = (url, cors, doGenerateMipmap = true, level = 0, internalFormat = 0x1908 /* RGBA */, format = 0x1908 /* RGBA */, type = 0x1401 /* UNSIGNED_BYTE */) => new Promise((resolve) => {
		const image = new Image();
		image.crossOrigin = cors;
		image.addEventListener('load', () => {
			gl.bindTexture(target, this.texture);
			gl.texImage2D(target, level, internalFormat, format, type, image);
			if (doGenerateMipmap) {
				gl.generateMipmap(target);
			}
			resolve();
		});
		image.src = url;
	});
}

// Export CommonJS package.
if (typeof module == 'object') {
	module.exports = {
		UmbraGL,
		VariableTypeInfo,
		VariableInfo,
		ShaderInfo,
		ProgramInfo,
		BufferInfo,
		AttributeInfo,
		VAOInfo,
		TextureInfo
	};
}