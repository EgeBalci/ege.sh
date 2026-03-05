/**
 * GLFrame trail system - WebGL2 animation with flowing trails in a circular pattern.
 * NOTE: Be careful, it's a messy place.
 */

// ========================================
// TYPES
// ========================================

interface AuthoringConfig {
  animation: {
    baseSpeed: number;
    boostSpeed: number;
    hoverSpeed: number;
    durations: { spiralIn: number; disappear: number; respawn: number };
  };
  camera: {
    distance: number;
    startRotXDeg: number;
    scroll: {
      minDeg: number;
      maxDeg: number;
      rangeDeg: number;
      transitionDeg: number;
    };
    mouseRotationDeg: number;
  };
  interaction: {
    maxParallax: number;
    baseScale: number;
    pressedScale: number;
    hoverScale: number;
    otherHoverScale: number;
  };
  trails: {
    count: number;
    segmentCount: number;
    layers: number;
    layerAngleOffset: number;
    arcLength: number;
    baseRadius: number;
    reducedRadius: number;
    radiusReductionOnMouseDown: number;
    radiusReductionFromAngleFactor: number;
    spiralOffsetFactor: number;
    segmentRadiusSinFactor: number;
    segmentRadiusCosFactor: number;
    circleZFactor: number;
  };
  appearance: {
    minOpacity: number;
    maxOpacity: number;
    baseAlphaFactor: number;
    layerFadePower: number;
    brightness: number;
    brightnessMouseDown: number;
    brightnessBlurFactor: number;
    maxBlurDistance: number;
    distanceMultiplierFactor: number;
  };
  frame: {
    width: number;
    height: number;
    opacity: number;
    opacityMouseDown: number;
    offset: number;
    transforms: Array<{
      rotationX: number;
      rotationY: number;
      rotationZ: number;
      positionX: number;
      positionY: number;
      positionZ: number;
    }>;
  };
}

interface ComputedConfig extends AuthoringConfig {
  camera: AuthoringConfig["camera"] & {
    startRotX: number;
    scroll: {
      minDeg: number;
      maxDeg: number;
      rangeDeg: number;
      transitionDeg: number;
      min: number;
      max: number;
      range: number;
      transition: number;
    };
    mouseRotation: number;
  };
  animation: AuthoringConfig["animation"] & {
    spiralInDuration: number;
    disappearDuration: number;
    respawnDuration: number;
  };
}

interface TrailState {
  startDelay: number;
  originalRadius: number;
  spiralSpeed: number;
  respawnDelay: number;
}

interface AnimState {
  time: { last: number; rotationOffset: number; speed: number };
  input: {
    mouseY01: number;
    isDown: boolean;
    isOver: boolean;
    hoveredFrame: number;
  };
  camera: {
    target: { rotXCenter: number; rotXSide: number; rotY: number };
    current: {
      rotXCenter: number;
      rotXSide: number;
      rotY: number;
      rotXActive: number;
    };
    parallax: {
      target: { x: number; y: number };
      current: { x: number; y: number };
    };
  };
  radius: { target: number; current: number };
  scales: { target: number[]; current: number[] };
  spiral: {
    active: boolean;
    phase: string;
    startTime: number;
    perTrail: TrailState[];
  };
  morph: {
    volume: number;
    sphere: number;
    knot: number;
    target: { volume: number; sphere: number; knot: number };
  };
}

interface Buffers {
  frame: WebGLBuffer | null;
  batchPositions: WebGLBuffer | null;
  batchColors: WebGLBuffer | null;
  trailPoints: Float32Array;
  frameVertices: Float32Array;
}

type Vec3 = [number, number, number];

// ========================================
// GLOBAL STATE AND CONFIGURATION
// ========================================

let gl: WebGL2RenderingContext;
let canvasElement: HTMLCanvasElement;
let shaderProgram: WebGLProgram;
let attributePosition: number;
let attributeColor: number;
let uniformProjectionMatrix: WebGLUniformLocation | null;
let uniformViewMatrix: WebGLUniformLocation | null;
let uniformModelMatrix: WebGLUniformLocation | null;
let projectionMatrix: Float32Array;
let modelMatrix: Float32Array;
let cameraViewMatrix: Float32Array;
let frameViewMatrix: Float32Array;
let eyeVector: Vec3;
let targetVector: Vec3;
let upVector: Vec3;

const PI = Math.PI;
const D2R = PI / 180;

const authoringConfig: AuthoringConfig = {
  animation: {
    baseSpeed: 5.0,
    boostSpeed: 20.0,
    hoverSpeed: 1.1,
    durations: { spiralIn: 0.8, disappear: 0.2, respawn: 0.4 },
  },
  camera: {
    distance: 3.0,
    startRotXDeg: -77,
    scroll: { minDeg: -84, maxDeg: -77, rangeDeg: 8, transitionDeg: 65 },
    mouseRotationDeg: 1,
  },
  interaction: {
    maxParallax: 0.75,
    baseScale: 1.0,
    pressedScale: 0.95,
    hoverScale: 1.1,
    otherHoverScale: 0.98,
  },
  trails: {
    count: 35,
    segmentCount: 6,
    layers: 7,
    layerAngleOffset: 0.15,
    arcLength: 1.2,
    baseRadius: 0.677,
    reducedRadius: 0.25,
    radiusReductionOnMouseDown: 0.015,
    radiusReductionFromAngleFactor: 0.15,
    spiralOffsetFactor: 0.2,
    segmentRadiusSinFactor: 0.02,
    segmentRadiusCosFactor: 0.01,
    circleZFactor: 0.035,
  },
  appearance: {
    minOpacity: 0.14,
    maxOpacity: 1.0,
    baseAlphaFactor: 0.1,
    layerFadePower: 0.7,
    brightness: 0.9,
    brightnessMouseDown: 1.5,
    brightnessBlurFactor: 0.4,
    maxBlurDistance: 0.25,
    distanceMultiplierFactor: 0.24,
  },
  frame: {
    width: 1.05,
    height: 1.5,
    opacity: 0.64,
    opacityMouseDown: 0.9,
    offset: 0.006,
    transforms: [
      {
        rotationX: 1.23,
        rotationY: -0.2,
        rotationZ: -1.51,
        positionX: 0.8,
        positionY: 1.74,
        positionZ: -0.44,
      },
      {
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        positionX: 0,
        positionY: 0,
        positionZ: 0,
      },
      {
        rotationX: 0.39,
        rotationY: -0.02,
        rotationZ: 2.91,
        positionX: 0,
        positionY: -1.1,
        positionZ: -0.23,
      },
    ],
  },
};

const computeConfig = (c: AuthoringConfig): ComputedConfig => {
  const cam = {
    ...c.camera,
    startRotX: c.camera.startRotXDeg * D2R,
    scroll: {
      ...c.camera.scroll,
      min: c.camera.scroll.minDeg * D2R,
      max: c.camera.scroll.maxDeg * D2R,
      range: c.camera.scroll.rangeDeg * D2R,
      transition: c.camera.scroll.transitionDeg * D2R,
    },
    mouseRotation: c.camera.mouseRotationDeg * D2R,
  };
  return {
    ...c,
    camera: cam,
    animation: {
      ...c.animation,
      spiralInDuration: c.animation.durations.spiralIn,
      disappearDuration: c.animation.durations.disappear,
      respawnDuration: c.animation.durations.respawn,
    },
  };
};

const config = computeConfig(authoringConfig);

const createState = (cfg: ComputedConfig): AnimState => ({
  time: { last: 0, rotationOffset: 0, speed: cfg.animation.baseSpeed },
  input: { mouseY01: 0.5, isDown: false, isOver: false, hoveredFrame: -1 },
  camera: {
    target: {
      rotXCenter: cfg.camera.startRotX,
      rotXSide: cfg.camera.startRotX,
      rotY: 0,
    },
    current: {
      rotXCenter: cfg.camera.startRotX,
      rotXSide: cfg.camera.startRotX,
      rotY: 0,
      rotXActive: cfg.camera.startRotX,
    },
    parallax: { target: { x: 0, y: 0 }, current: { x: 0, y: 0 } },
  },
  radius: { target: cfg.trails.baseRadius, current: cfg.trails.baseRadius },
  scales: {
    target: [
      cfg.interaction.baseScale,
      cfg.interaction.baseScale,
      cfg.interaction.baseScale,
    ],
    current: [
      cfg.interaction.baseScale,
      cfg.interaction.baseScale,
      cfg.interaction.baseScale,
    ],
  },
  spiral: { active: false, phase: "normal", startTime: 0, perTrail: [] },
  morph: {
    volume: 0,
    sphere: 0,
    knot: 0,
    target: { volume: 0, sphere: 0, knot: 0 },
  },
});

const state = createState(config);

const buffers: Buffers = {
  frame: null,
  batchPositions: null,
  batchColors: null,
  trailPoints: new Float32Array(config.trails.segmentCount * 3),
  frameVertices: new Float32Array(18),
};

// ========================================
// MATH UTILITIES
// ========================================

const createPerspectiveMatrix = (
  fieldOfView: number,
  aspectRatio: number,
  near: number,
  far: number
): Float32Array => {
  const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfView);
  const rangeInv = 1.0 / (near - far);
  return new Float32Array([
    f / aspectRatio, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0,
  ]);
};

const subtractVectors = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

const normalizeVector = (vector: Vec3): Vec3 => {
  const length = Math.sqrt(
    vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]
  );
  return length > 0
    ? [vector[0] / length, vector[1] / length, vector[2] / length]
    : [0, 0, 0];
};

const crossProduct = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const dotProduct = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const easeInOutCubic = (progress: number): number =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const createLookAtMatrix = (
  out: Float32Array,
  eye: Vec3,
  target: Vec3,
  up: Vec3
): Float32Array => {
  const zAxis = normalizeVector(subtractVectors(eye, target));
  const xAxis = normalizeVector(crossProduct(up, zAxis));
  const yAxis = normalizeVector(crossProduct(zAxis, xAxis));

  out[0] = xAxis[0]; out[1] = yAxis[0]; out[2] = zAxis[0]; out[3] = 0;
  out[4] = xAxis[1]; out[5] = yAxis[1]; out[6] = zAxis[1]; out[7] = 0;
  out[8] = xAxis[2]; out[9] = yAxis[2]; out[10] = zAxis[2]; out[11] = 0;
  out[12] = -dotProduct(xAxis, eye);
  out[13] = -dotProduct(yAxis, eye);
  out[14] = -dotProduct(zAxis, eye);
  out[15] = 1;

  return out;
};

const identityMatrix = (out: Float32Array): Float32Array => {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
};

const translateMatrix = (
  out: Float32Array,
  a: Float32Array,
  v: Vec3
): Float32Array => {
  const x = v[0], y = v[1], z = v[2];
  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  } else {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
    out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
    out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;
    out[12] = a00 * x + a10 * y + a20 * z + a[12];
    out[13] = a01 * x + a11 * y + a21 * z + a[13];
    out[14] = a02 * x + a12 * y + a22 * z + a[14];
    out[15] = a03 * x + a13 * y + a23 * z + a[15];
  }
  return out;
};

const rotateMatrix = (
  out: Float32Array,
  a: Float32Array,
  rad: number,
  axis: Vec3
): Float32Array | null => {
  let x = axis[0], y = axis[1], z = axis[2];
  let len = Math.hypot(x, y, z);
  if (len < 0.000001) return null;
  len = 1 / len;
  x *= len; y *= len; z *= len;
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  const t = 1 - c;
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const b00 = x * x * t + c, b01 = y * x * t + z * s, b02 = z * x * t - y * s;
  const b10 = x * y * t - z * s, b11 = y * y * t + c, b12 = z * y * t + x * s;
  const b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c;
  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22;
  if (a !== out) {
    out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
  }
  return out;
};

// ========================================
// TRAIL SHAPE FUNCTIONS
// ========================================

const getLayeredVolumeCoordinates = (
  trailIndex: number,
  _segmentRatio: number,
  baseAngle: number,
  radius: number,
  timeInSeconds: number
): { x: number; y: number; z: number } => {
  const heightRatio = (trailIndex / config.trails.count) * 2 - 1;
  const heightSq = heightRatio * heightRatio;
  const z =
    heightRatio * Math.sqrt(1 - heightSq) * radius * 0.5 +
    Math.sin(timeInSeconds * 0.3 + trailIndex * 0.5) * 0.1;
  const circleRadius = Math.abs(heightRatio) * radius;
  return {
    x: Math.cos(baseAngle) * circleRadius,
    y: Math.sin(baseAngle) * circleRadius,
    z,
  };
};

const getLayeredSphereCoordinates = (
  trailIndex: number,
  _segmentRatio: number,
  _baseAngle: number,
  radius: number,
  _timeInSeconds: number
): { x: number; y: number; z: number } => {
  const t = trailIndex % 2 === 0 ? -_baseAngle : _baseAngle;

  const seedA = Math.sin(trailIndex * 12.9898) * 43758.5453;
  const seedB = Math.cos(trailIndex * 78.233) * 24634.6345;

  const tilt = seedA - Math.floor(seedA);
  const az = seedB - Math.floor(seedB);
  const tiltRad = tilt * PI;
  const azRad = az * (PI * 2.0);

  const normal: Vec3 = [
    Math.sin(tiltRad) * Math.cos(azRad),
    Math.sin(tiltRad) * Math.sin(azRad),
    Math.cos(tiltRad),
  ];

  const helper: Vec3 =
    Math.abs(normal[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  let u = crossProduct(normal, helper);
  u = normalizeVector(u);
  let v = crossProduct(normal, u);
  v = normalizeVector(v);

  return {
    x: (Math.cos(t) * u[0] + Math.sin(t) * v[0]) * radius,
    y: (Math.cos(t) * u[1] + Math.sin(t) * v[1]) * radius,
    z: (Math.cos(t) * u[2] + Math.sin(t) * v[2]) * radius,
  };
};

const getLayeredKnotCoordinates = (
  trailIndex: number,
  segmentRatio: number,
  _baseAngle: number,
  radius: number,
  timeInSeconds: number
): { x: number; y: number; z: number } => {
  const t = _baseAngle;
  const twistFreq = 2.0 + (trailIndex % 3) * 0.5;
  const phase =
    timeInSeconds * 1.1 + trailIndex * 0.37 + segmentRatio * 1.7;
  const R = Math.max(0.12, radius * 0.62);
  const r = Math.max(0.06, radius * 0.38);
  const tube = Math.cos(twistFreq * t + phase);
  const ring = Math.sin(twistFreq * t + phase);
  const localRadius = R + r * tube;
  return {
    x: localRadius * Math.cos(t),
    y: localRadius * Math.sin(t),
    z: r * ring,
  };
};

// ========================================
// WEBGL SETUP AND SHADER MANAGEMENT
// ========================================

const resizeCanvas = (): void => {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvasElement.getBoundingClientRect();

  const newWidth = Math.round(rect.width * pixelRatio);
  const newHeight = Math.round(rect.height * pixelRatio);

  if (canvasElement.width !== newWidth || canvasElement.height !== newHeight) {
    canvasElement.width = newWidth;
    canvasElement.height = newHeight;
    canvasElement.style.width = rect.width + "px";
    canvasElement.style.height = rect.height + "px";

    if (gl) {
      gl.viewport(0, 0, newWidth, newHeight);
    }
    projectionMatrix = createPerspectiveMatrix(
      PI / 4,
      newWidth / 3 / newHeight,
      0.1,
      100.0
    );
  }
};

const setupWebGLContext = (): void => {
  canvasElement = document.getElementById("gl") as HTMLCanvasElement;
  gl = canvasElement.getContext("webgl2", { stencil: true }) as WebGL2RenderingContext;
  if (!gl) {
    throw new Error("WebGL2 not supported in this environment");
  }

  resizeCanvas();

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.STENCIL_TEST);
  gl.clearColor(0.07, 0.07, 0.07, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

  cameraViewMatrix = new Float32Array(16);
  frameViewMatrix = new Float32Array(16);
  modelMatrix = new Float32Array(16);
  eyeVector = [0, 0, 0];
  targetVector = [0, 0, 0];
  upVector = [0, 1, 0];
};

const createShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createShaderProgram = (
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null => {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      "Error linking shader program:",
      gl.getProgramInfoLog(program)
    );
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

const setupShaders = (): void => {
  const vertexShaderSource = `#version 300 es
    in vec3 aPos;
    in vec4 aCol;
    uniform mat4 uProj;
    uniform mat4 uView;
    uniform mat4 uModel;
    out vec4 vCol;
    void main() {
      vCol = aCol;
      gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
    }
  `;

  const fragmentShaderSource = `#version 300 es
    precision mediump float;
    in vec4 vCol;
    out vec4 fragColor;
    void main() {
      fragColor = vCol;
    }
  `;

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)!;
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  )!;
  shaderProgram = createShaderProgram(gl, vertexShader, fragmentShader)!;

  attributePosition = gl.getAttribLocation(shaderProgram, "aPos");
  attributeColor = gl.getAttribLocation(shaderProgram, "aCol");
  uniformProjectionMatrix = gl.getUniformLocation(shaderProgram, "uProj");
  uniformViewMatrix = gl.getUniformLocation(shaderProgram, "uView");
  uniformModelMatrix = gl.getUniformLocation(shaderProgram, "uModel");
};

const setupWebGLBuffers = (): void => {
  buffers.frame = gl.createBuffer();
  buffers.batchPositions = gl.createBuffer();
  buffers.batchColors = gl.createBuffer();
};

// ========================================
// CAMERA HELPERS
// ========================================

const calculateCameraAngleForSides = (normalizedY: number): number => {
  const y = clamp01(normalizedY);
  return config.camera.scroll.min + (y / 0.5) * config.camera.scroll.range;
};

const calculateCameraAngleForCenter = (normalizedY: number): number => {
  const y = clamp01(normalizedY);
  return y <= 0.5
    ? config.camera.scroll.min + (y / 0.5) * config.camera.scroll.range
    : config.camera.scroll.max +
        ((y - 0.5) / 0.5) * config.camera.scroll.transition;
};

const updateCameraViewMatrix = (
  rotationX: number,
  rotationY: number,
  distance: number = config.camera.distance
): void => {
  eyeVector[0] = Math.sin(rotationY) * distance;
  eyeVector[1] = Math.sin(rotationX) * distance;
  eyeVector[2] = Math.cos(rotationX) * distance;
  createLookAtMatrix(cameraViewMatrix, eyeVector, [0, 0, 0], upVector);
};

const updateFrameViewMatrix = (scaleForFrame: number): void => {
  const frameDistance = config.camera.distance / scaleForFrame;
  eyeVector[0] = state.camera.parallax.current.y;
  eyeVector[1] = state.camera.parallax.current.x;
  eyeVector[2] = frameDistance;
  createLookAtMatrix(frameViewMatrix, eyeVector, targetVector, upVector);
};

// ========================================
// ANIMATION AND SPIRAL EFFECTS
// ========================================

const getSpiralRadius = (
  trailIndex: number,
  baseRadius: number,
  timeInSeconds: number
): number => {
  if (!state.spiral.active || state.spiral.phase === "normal")
    return baseRadius;

  const trailState = state.spiral.perTrail[trailIndex];
  if (!trailState) return baseRadius;

  const phaseTime = timeInSeconds - state.spiral.startTime;

  switch (state.spiral.phase) {
    case "s_in": {
      const adjustedTime = Math.max(0, phaseTime - trailState.startDelay);
      const progress = Math.min(
        1.0,
        (adjustedTime / config.animation.spiralInDuration) *
          trailState.spiralSpeed
      );
      if (progress <= 0) return baseRadius;
      const easedProgress = easeInOutCubic(progress);
      return (
        trailState.originalRadius * (1 - easedProgress) +
        config.trails.reducedRadius * easedProgress
      );
    }
    case "dis":
      return config.trails.reducedRadius;
    case "res": {
      const respawnTime = Math.max(0, phaseTime - trailState.respawnDelay);
      const respawnProgress = Math.min(
        1.0,
        respawnTime / config.animation.respawnDuration
      );
      if (respawnProgress <= 0) return config.trails.reducedRadius;
      const easedRespawnProgress = easeInOutCubic(respawnProgress);
      return (
        config.trails.reducedRadius * (1 - easedRespawnProgress) +
        baseRadius * easedRespawnProgress
      );
    }
    default:
      return baseRadius;
  }
};

const getSpiralVisibility = (
  trailIndex: number,
  timeInSeconds: number
): number => {
  if (!state.spiral.active || state.spiral.phase === "normal") return 1.0;

  const trailState = state.spiral.perTrail[trailIndex];
  if (!trailState) return 1.0;

  const phaseTime = timeInSeconds - state.spiral.startTime;

  switch (state.spiral.phase) {
    case "s_in": {
      const adjustedTime = Math.max(0, phaseTime - trailState.startDelay);
      const progress = Math.min(
        1.0,
        (adjustedTime / config.animation.spiralInDuration) *
          trailState.spiralSpeed
      );
      if (progress <= 0) return 1.0;
      return Math.pow(1.0 - progress, 1.5);
    }
    case "dis":
      return 0.0;
    case "res": {
      const respawnTime = Math.max(0, phaseTime - trailState.respawnDelay);
      const respawnProgress = Math.min(
        1.0,
        respawnTime / config.animation.respawnDuration
      );
      if (respawnProgress <= 0) return 0.0;
      return Math.pow(respawnProgress, 0.7);
    }
    default:
      return 1.0;
  }
};

const updateAnimationState = (timeInSeconds: number): void => {
  const deltaTime = timeInSeconds - state.time.last;
  state.time.last = timeInSeconds;

  const isVolumeActive = state.morph.volume > 0.01;
  const isSphereActive = state.morph.sphere > 0.01;
  const isKnotActive = state.morph.knot > 0.01;

  let targetSpeed = config.animation.baseSpeed;
  if (state.input.isDown) targetSpeed = config.animation.boostSpeed;
  else if (isVolumeActive || isSphereActive || isKnotActive)
    targetSpeed = config.animation.hoverSpeed;

  const slowMotionFactor =
    isVolumeActive || isSphereActive || isKnotActive ? 0.5 : 1.0;

  state.time.speed +=
    (targetSpeed - state.time.speed) * (0.1 * slowMotionFactor);
  state.radius.current +=
    (state.radius.target - state.radius.current) * (0.24 * slowMotionFactor);

  const isTransitioningToVolume =
    state.morph.target.volume > state.morph.volume;
  const volumeTransitionSpeed = isTransitioningToVolume ? 0.13 : 0.17;
  state.morph.volume +=
    (state.morph.target.volume - state.morph.volume) *
    (volumeTransitionSpeed * slowMotionFactor);

  const isTransitioningToSphere =
    state.morph.target.sphere > state.morph.sphere;
  const sphereTransitionSpeed = isTransitioningToSphere ? 0.15 : 0.17;
  state.morph.sphere +=
    (state.morph.target.sphere - state.morph.sphere) *
    (sphereTransitionSpeed * slowMotionFactor);

  const isTransitioningToKnot =
    state.morph.target.knot > state.morph.knot;
  const knotTransitionSpeed = isTransitioningToKnot ? 0.09 : 0.17;
  state.morph.knot +=
    (state.morph.target.knot - state.morph.knot) *
    (knotTransitionSpeed * slowMotionFactor);

  if (state.spiral.active) {
    const phaseTime = timeInSeconds - state.spiral.startTime;
    switch (state.spiral.phase) {
      case "s_in":
        if (phaseTime >= config.animation.spiralInDuration) {
          state.spiral.phase = "dis";
          state.spiral.startTime = timeInSeconds;
        }
        break;
      case "dis":
        if (phaseTime >= config.animation.disappearDuration) {
          state.spiral.phase = "res";
          state.spiral.startTime = timeInSeconds;
        }
        break;
      case "res":
        if (phaseTime >= config.animation.respawnDuration) {
          state.spiral.active = false;
          state.spiral.phase = "normal";
        }
        break;
    }
  }

  state.time.rotationOffset += state.time.speed * deltaTime;

  const smoothingFactor = 0.05 * slowMotionFactor;
  const cam = state.camera;
  cam.current.rotXCenter +=
    (cam.target.rotXCenter - cam.current.rotXCenter) * smoothingFactor;
  cam.current.rotXSide +=
    (cam.target.rotXSide - cam.current.rotXSide) * smoothingFactor;
  cam.current.rotY +=
    (cam.target.rotY - cam.current.rotY) * smoothingFactor;
  cam.parallax.current.x +=
    (cam.parallax.target.x - cam.parallax.current.x) *
    (0.08 * slowMotionFactor);
  cam.parallax.current.y +=
    (cam.parallax.target.y - cam.parallax.current.y) *
    (0.08 * slowMotionFactor);

  for (let i = 0; i < 3; i++) {
    const current = state.scales.current[i];
    const target = state.scales.target[i];
    state.scales.current[i] =
      current + (target - current) * smoothingFactor * 2;
  }
};

// ========================================
// RENDERING UTILITIES
// ========================================

const setVertex = (
  buffer: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number
): void => {
  const offset = index * 3;
  buffer[offset] = x;
  buffer[offset + 1] = y;
  buffer[offset + 2] = z;
};

const setRectangleVertices = (
  buffer: Float32Array,
  width: number,
  height: number,
  offset: number = 0
): void => {
  const left = -width / 2 + offset;
  const right = width / 2 - offset;
  const bottom = -height / 2 + offset;
  const top = height / 2 - offset;
  const verts: Vec3[] = [
    [left, bottom, 0],
    [right, bottom, 0],
    [right, top, 0],
    [left, bottom, 0],
    [right, top, 0],
    [left, top, 0],
  ];
  verts.forEach((vertex, i) => setVertex(buffer, i, ...vertex));
};

const setupVertexBuffer = (
  buffer: WebGLBuffer,
  data: Float32Array
): void => {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
  gl.enableVertexAttribArray(attributePosition);
  gl.vertexAttribPointer(attributePosition, 3, gl.FLOAT, false, 0, 0);
};

const calculateEffectiveRadius = (): number => {
  const radiusReductionOnMouseDown = state.input.isDown
    ? config.trails.radiusReductionOnMouseDown
    : 0;
  const activeRotX =
    state.camera.current.rotXActive ?? state.camera.current.rotXCenter;
  const angleProgress = clamp01(
    (activeRotX - config.camera.scroll.min) / (0 - config.camera.scroll.min)
  );
  const radiusReductionFromAngle =
    angleProgress * config.trails.radiusReductionFromAngleFactor;
  return (
    state.radius.current -
    radiusReductionOnMouseDown -
    radiusReductionFromAngle
  );
};

const calculateDistance = (): number => {
  let distanceMultiplier = 1.0;
  if (state.input.mouseY01 > 0.5) {
    const bottomProgress = (state.input.mouseY01 - 0.5) / 0.5;
    distanceMultiplier =
      1.0 + bottomProgress * config.appearance.distanceMultiplierFactor;
  }
  return config.camera.distance * distanceMultiplier;
};

const calculateTrailVertices = (
  trailIndex: number,
  timeInSeconds: number,
  curveReduction: number,
  spiralRadius: number,
  startAngle: number
): number => {
  let totalDepth = 0;
  const distance = calculateDistance();
  const eye: Vec3 = [
    Math.sin(state.camera.current.rotY) * distance,
    Math.sin(
      state.camera.current.rotXActive ?? state.camera.current.rotXCenter
    ) * distance,
    Math.cos(
      state.camera.current.rotXActive ?? state.camera.current.rotXCenter
    ) * distance,
  ];

  for (let i = 0; i < config.trails.segmentCount; i++) {
    const segmentRatio = i / config.trails.segmentCount;
    const spiralOffset =
      segmentRatio * config.trails.spiralOffsetFactor * curveReduction;
    const currentAngle =
      startAngle +
      (segmentRatio - 0.5) * config.trails.arcLength +
      spiralOffset;

    const segmentRadius =
      spiralRadius +
      Math.sin(
        segmentRatio * PI * 1.5 + timeInSeconds * 12.0 + trailIndex * 0.5
      ) *
        config.trails.segmentRadiusSinFactor *
        curveReduction +
      Math.cos(
        segmentRatio * PI * 2 + timeInSeconds * 9.0 + trailIndex * 0.8
      ) *
        config.trails.segmentRadiusCosFactor *
        curveReduction;

    const circleX = Math.cos(currentAngle) * Math.max(0.2, segmentRadius);
    const circleY = Math.sin(currentAngle) * Math.max(0.2, segmentRadius);
    const circleZ =
      Math.sin(currentAngle + timeInSeconds * 2.5 + trailIndex * 0.5) *
      config.trails.circleZFactor *
      curveReduction;

    // Step 1: circle -> volume
    const volumeCoords = getLayeredVolumeCoordinates(
      trailIndex,
      segmentRatio,
      currentAngle,
      Math.max(0.2, segmentRadius * 0.8),
      timeInSeconds
    );
    let x =
      circleX * (1 - state.morph.volume) +
      volumeCoords.x * state.morph.volume;
    let y =
      circleY * (1 - state.morph.volume) +
      volumeCoords.y * state.morph.volume;
    let z =
      circleZ * (1 - state.morph.volume) +
      volumeCoords.z * state.morph.volume;

    // Step 2: (circle/volume) -> sphere
    if (state.morph.sphere > 0.001) {
      const tSphere = currentAngle;
      const sphereRadius = Math.max(0.2, segmentRadius * 0.8);
      const sphereCoords = getLayeredSphereCoordinates(
        trailIndex,
        segmentRatio,
        tSphere,
        sphereRadius,
        timeInSeconds
      );
      x =
        x * (1 - state.morph.sphere) + sphereCoords.x * state.morph.sphere;
      y =
        y * (1 - state.morph.sphere) + sphereCoords.y * state.morph.sphere;
      z =
        z * (1 - state.morph.sphere) + sphereCoords.z * state.morph.sphere;
    }

    // Step 3: (previous) -> knot/rosette
    if (state.morph.knot > 0.001) {
      const tKnot = currentAngle;
      const knotRadius = Math.max(0.18, segmentRadius * 0.85);
      const knotCoords = getLayeredKnotCoordinates(
        trailIndex,
        segmentRatio,
        tKnot,
        knotRadius,
        timeInSeconds
      );
      x = x * (1 - state.morph.knot) + knotCoords.x * state.morph.knot;
      y = y * (1 - state.morph.knot) + knotCoords.y * state.morph.knot;
      z = z * (1 - state.morph.knot) + knotCoords.z * state.morph.knot;
    }

    setVertex(buffers.trailPoints, i, x, y, z);

    const dx = x - eye[0];
    const dy = y - eye[1];
    const dz = z - eye[2];
    totalDepth += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return totalDepth / config.trails.segmentCount;
};

const buildBatchedTrailGeometry = (
  timeInSeconds: number
): { positions: Float32Array; colors: Float32Array; vertexCount: number } => {
  const positions: number[] = [];
  const colors: number[] = [];
  const effectiveRadius = calculateEffectiveRadius();

  for (
    let trailIndex = 0;
    trailIndex < config.trails.count;
    trailIndex++
  ) {
    const trailAngle = (trailIndex / config.trails.count) * PI * 2;
    const isOuterTrail = trailIndex % 4 === 0;
    const baseVariation =
      Math.sin(timeInSeconds * 6.0 + trailIndex * 0.8) * 0.02;
    const outerOffset = isOuterTrail
      ? 0.08 +
        Math.sin(timeInSeconds * 4.0 + trailIndex * 1.5) * 0.04
      : 0;

    const speedRatio =
      (state.time.speed - config.animation.baseSpeed) /
      (config.animation.boostSpeed - config.animation.baseSpeed);
    const curveReduction = Math.max(0.25, 1.0 - speedRatio * 0.8);

    const baseRadiusForTrail =
      effectiveRadius + (baseVariation + outerOffset) * curveReduction;
    const spiralRadius = getSpiralRadius(
      trailIndex,
      baseRadiusForTrail,
      timeInSeconds
    );
    const spiralVisibility = getSpiralVisibility(trailIndex, timeInSeconds);
    if (spiralVisibility <= 0.01) continue;

    const angleVariation =
      Math.sin(timeInSeconds * 4.4 + trailIndex * 1.5) *
      0.1 *
      curveReduction;

    let spiralAngleOffset = 0;
    if (state.spiral.active && state.spiral.phase === "s_in") {
      const trailState = state.spiral.perTrail[trailIndex];
      if (trailState) {
        const phaseTime = timeInSeconds - state.spiral.startTime;
        const adjustedTime = Math.max(0, phaseTime - trailState.startDelay);
        const trailProgress = Math.min(
          1.0,
          (adjustedTime / config.animation.spiralInDuration) *
            trailState.spiralSpeed
        );
        if (trailProgress > 0) {
          const spiralIntensity = easeInOutCubic(trailProgress) * 3.0;
          spiralAngleOffset = spiralIntensity * PI * 2;
        }
      }
    }

    for (let layer = 0; layer < config.trails.layers; layer++) {
      const layerAngleOffset = layer * config.trails.layerAngleOffset;
      const startAngle =
        state.time.rotationOffset -
        layerAngleOffset +
        trailAngle +
        angleVariation +
        spiralAngleOffset;

      const averageDistance = calculateTrailVertices(
        trailIndex,
        timeInSeconds,
        curveReduction,
        spiralRadius,
        startAngle
      );
      const distance = calculateDistance();
      const distanceFromFocus = Math.max(0, averageDistance - distance);
      const blurFactor = Math.min(
        1.0,
        distanceFromFocus / config.appearance.maxBlurDistance
      );
      const depthOpacity =
        config.appearance.minOpacity +
        (config.appearance.maxOpacity - config.appearance.minOpacity) *
          (1.0 - blurFactor);

      const morphVisibilityBoost =
        0.7 +
        0.3 *
          Math.max(
            state.morph.volume,
            state.morph.sphere,
            state.morph.knot
          );
      const baseAlpha =
        (0.6 +
          Math.sin(timeInSeconds * 3.5 + trailIndex * 0.3) *
            config.appearance.baseAlphaFactor) *
        depthOpacity *
        spiralVisibility *
        morphVisibilityBoost;
      const layerFade = Math.pow(config.appearance.layerFadePower, layer);
      const alpha = baseAlpha * layerFade;
      const brightness =
        (state.input.isDown && layer < 2
          ? config.appearance.brightnessMouseDown
          : config.appearance.brightness) *
        (1.0 - blurFactor * config.appearance.brightnessBlurFactor);

      const r = brightness,
        g = brightness,
        b = brightness,
        a = alpha;

      for (let i = 1; i < config.trails.segmentCount; i++) {
        const prevOffset = (i - 1) * 3;
        const currOffset = i * 3;
        const x0 = buffers.trailPoints[prevOffset];
        const y0 = buffers.trailPoints[prevOffset + 1];
        const z0 = buffers.trailPoints[prevOffset + 2];
        const x1 = buffers.trailPoints[currOffset];
        const y1 = buffers.trailPoints[currOffset + 1];
        const z1 = buffers.trailPoints[currOffset + 2];

        positions.push(x0, y0, z0, x1, y1, z1);
        colors.push(r, g, b, a, r, g, b, a);
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    vertexCount: positions.length / 3,
  };
};

const drawFrameMask = (): void => {
  gl.uniformMatrix4fv(uniformViewMatrix, false, frameViewMatrix);
  gl.uniformMatrix4fv(
    uniformModelMatrix,
    false,
    identityMatrix(modelMatrix)
  );

  setRectangleVertices(
    buffers.frameVertices,
    config.frame.width,
    config.frame.height
  );
  setupVertexBuffer(buffers.frame!, buffers.frameVertices);
  gl.disableVertexAttribArray(attributeColor);
  gl.vertexAttrib4f(attributeColor, 0, 0, 0, 1);

  gl.stencilFunc(gl.ALWAYS, 1, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  gl.colorMask(false, false, false, false);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.colorMask(true, true, true, true);
};

const drawFrame = (): void => {
  gl.uniformMatrix4fv(uniformViewMatrix, false, frameViewMatrix);
  gl.uniformMatrix4fv(
    uniformModelMatrix,
    false,
    identityMatrix(modelMatrix)
  );
  gl.stencilFunc(gl.ALWAYS, 0, 0xff);

  const frameOpacity = state.input.isDown
    ? config.frame.opacityMouseDown
    : config.frame.opacity;
  gl.disableVertexAttribArray(attributeColor);
  gl.vertexAttrib4f(attributeColor, 1, 1, 1, frameOpacity);

  const left = -config.frame.width / 2;
  const right = config.frame.width / 2;
  const bottom = -config.frame.height / 2;
  const top = config.frame.height / 2;

  const corners: Vec3[] = [
    [left, bottom, 0],
    [right, bottom, 0],
    [right, top, 0],
    [left, top, 0],
  ];
  corners.forEach((vertex, i) => setVertex(buffers.frameVertices, i, ...vertex));

  setupVertexBuffer(buffers.frame!, buffers.frameVertices.subarray(0, 12));
  gl.drawArrays(gl.LINE_LOOP, 0, 4);

  const offset = config.frame.offset;
  const innerCorners: Vec3[] = [
    [left + offset, bottom + offset, 0],
    [right - offset, bottom + offset, 0],
    [right - offset, top - offset, 0],
    [left + offset, top - offset, 0],
  ];
  innerCorners.forEach((vertex, i) =>
    setVertex(buffers.frameVertices, i, ...vertex)
  );

  gl.bufferData(
    gl.ARRAY_BUFFER,
    buffers.frameVertices.subarray(0, 12),
    gl.STREAM_DRAW
  );
  gl.drawArrays(gl.LINE_LOOP, 0, 4);
};

// ========================================
// EVENT HANDLERS
// ========================================

const handlePointerMove = (clientX: number, clientY: number): void => {
  state.input.mouseY01 = clientY / window.innerHeight;

  state.camera.target.rotXCenter = calculateCameraAngleForCenter(
    state.input.mouseY01
  );
  state.camera.target.rotXSide = calculateCameraAngleForSides(
    state.input.mouseY01
  );

  const normalizedMouseX = (1 - clientX / window.innerWidth) * 2 - 1;
  state.camera.target.rotY = normalizedMouseX * config.camera.mouseRotation;

  const centeredNormalizedMouseY = (clientY / window.innerHeight) * 2 - 1;
  state.camera.parallax.target.y =
    normalizedMouseX * config.interaction.maxParallax;
  state.camera.parallax.target.x =
    centeredNormalizedMouseY * config.interaction.maxParallax;

  if (canvasElement) {
    const rect = canvasElement.getBoundingClientRect();
    const px = clientX - rect.left;
    if (px >= 0 && px <= rect.width) {
      const columnWidth = rect.width / 3;
      const index = Math.max(0, Math.min(2, Math.floor(px / columnWidth)));
      state.input.hoveredFrame = index;
      updateCanvasScale();
      updateHoverDrivenStates();
    }
  }
};

const handleInteractionStart = (): void => {
  state.input.isDown = true;
};

const handleInteractionEnd = (): void => {
  state.input.isDown = false;
};

const handleCanvasStart = (event: Event): void => {
  event.preventDefault();
  state.input.isDown = true;
  state.radius.target = config.trails.reducedRadius;
  updateCanvasScale();

  if (!state.spiral.active) {
    state.spiral.active = true;
    state.spiral.phase = "s_in";
    state.spiral.startTime = performance.now() * 0.001;

    state.spiral.perTrail.length = 0;
    for (let i = 0; i < config.trails.count; i++) {
      state.spiral.perTrail.push({
        startDelay: (i / config.trails.count) * 0.25,
        originalRadius:
          config.trails.baseRadius + (Math.random() - 0.5) * 0.1,
        spiralSpeed: 1.0 + (Math.random() - 0.5) * 0.3,
        respawnDelay: (i / config.trails.count) * 0.25,
      });
    }
  }
};

const handleCanvasEnd = (event: Event): void => {
  event.preventDefault();
  state.input.isDown = false;
  state.radius.target = config.trails.baseRadius;
  updateCanvasScale();
};

const handleCanvasEnter = (): void => {
  state.input.isOver = true;
  updateCanvasScale();
  updateHoverDrivenStates();
};

const handleCanvasLeave = (): void => {
  state.input.isDown = false;
  state.radius.target = config.trails.baseRadius;
  state.input.isOver = false;
  state.input.hoveredFrame = -1;
  updateCanvasScale();
  updateHoverDrivenStates();
};

const updateCanvasScale = (): void => {
  const base = config.interaction.baseScale;
  const pressed = config.interaction.pressedScale;
  const hovered = config.interaction.hoverScale;
  const other = config.interaction.otherHoverScale;

  for (let i = 0; i < 3; i++) {
    let target = base;
    if (state.input.isDown) target = pressed;
    else if (state.input.isOver) {
      target = state.input.hoveredFrame === i ? hovered : other;
    }
    state.scales.target[i] = target;
  }
};

// ========================================
// HOVER EFFECT STATE MAPPING
// ========================================

const computeFrameHoverEffects = (
  frameIndex: number
): {
  volumeTransitionTarget: number;
  sphereTransitionTarget: number;
  knotTransitionTarget: number;
} => {
  if (!state.input.isOver || frameIndex < 0) {
    return {
      volumeTransitionTarget: 0.0,
      sphereTransitionTarget: 0.0,
      knotTransitionTarget: 0.0,
    };
  }
  if (frameIndex === 0) {
    return {
      volumeTransitionTarget: 1.0,
      sphereTransitionTarget: 0.0,
      knotTransitionTarget: 0.0,
    };
  }
  if (frameIndex === 1) {
    return {
      volumeTransitionTarget: 0.0,
      sphereTransitionTarget: 1.0,
      knotTransitionTarget: 0.0,
    };
  }
  return {
    volumeTransitionTarget: 0.0,
    sphereTransitionTarget: 0.0,
    knotTransitionTarget: 1.0,
  };
};

const updateHoverDrivenStates = (): void => {
  const effects = computeFrameHoverEffects(state.input.hoveredFrame);
  state.morph.target.volume = effects.volumeTransitionTarget;
  state.morph.target.sphere = effects.sphereTransitionTarget;
  state.morph.target.knot = effects.knotTransitionTarget;
};

const setupEventListeners = (): void => {
  document.body.addEventListener("mousemove", (event) =>
    handlePointerMove(event.clientX, event.clientY)
  );
  document.body.addEventListener("mousedown", handleInteractionStart);
  document.body.addEventListener("mouseup", handleInteractionEnd);
  document.body.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    handlePointerMove(touch.clientX, touch.clientY);
  });
  document.body.addEventListener("touchstart", handleInteractionStart);
  document.body.addEventListener("touchend", handleInteractionEnd);

  const canvasEvents: [string, EventListener][] = [
    ["mousedown", handleCanvasStart as EventListener],
    ["mouseup", handleCanvasEnd as EventListener],
    ["mouseenter", handleCanvasEnter as EventListener],
    ["mouseleave", handleCanvasLeave as EventListener],
    ["touchstart", handleCanvasStart as EventListener],
    ["touchend", handleCanvasEnd as EventListener],
    ["touchcancel", handleCanvasLeave as EventListener],
  ];

  canvasEvents.forEach(([event, handler]) =>
    canvasElement.addEventListener(event, handler)
  );

  canvasElement.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
      const touch = event.touches[0];
      handlePointerMove(touch.clientX, touch.clientY);
    },
    { passive: false }
  );

  window.addEventListener("resize", resizeCanvas);
};

// ========================================
// MAIN ANIMATION LOOP
// ========================================

const render = (timestamp: number): void => {
  const timeInSeconds = timestamp * 0.001;

  if (state.time.last === 0) {
    state.time.last = timeInSeconds;
  }

  updateAnimationState(timeInSeconds);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  gl.useProgram(shaderProgram);
  gl.uniformMatrix4fv(uniformProjectionMatrix, false, projectionMatrix);

  const frameWidth = canvasElement.width / 3;
  const frameHeight = canvasElement.height;

  for (let i = -1; i <= 1; i++) {
    const viewportX = (i + 1) * frameWidth;
    gl.viewport(viewportX, 0, frameWidth, frameHeight);

    const isCenter = i === 0;
    const rotationXForFrame = isCenter
      ? state.camera.current.rotXCenter
      : state.camera.current.rotXSide;
    state.camera.current.rotXActive = rotationXForFrame;
    updateCameraViewMatrix(rotationXForFrame, state.camera.current.rotY);
    const scaleForFrame = state.scales.current[i + 1];
    updateFrameViewMatrix(scaleForFrame);
    drawFrameMask();

    const frameIndex = i + 1;
    const frameTransform = config.frame.transforms[frameIndex];

    identityMatrix(modelMatrix);
    translateMatrix(modelMatrix, modelMatrix, [
      frameTransform.positionX,
      frameTransform.positionY,
      frameTransform.positionZ,
    ]);
    rotateMatrix(modelMatrix, modelMatrix, frameTransform.rotationX, [
      1, 0, 0,
    ]);
    rotateMatrix(modelMatrix, modelMatrix, frameTransform.rotationY, [
      0, 1, 0,
    ]);
    rotateMatrix(modelMatrix, modelMatrix, frameTransform.rotationZ, [
      0, 0, 1,
    ]);

    gl.uniformMatrix4fv(uniformViewMatrix, false, cameraViewMatrix);
    gl.uniformMatrix4fv(uniformModelMatrix, false, modelMatrix);

    const prevRotationX = state.camera.current.rotXActive;
    state.camera.current.rotXActive = rotationXForFrame;

    gl.stencilFunc(gl.EQUAL, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    const batch = buildBatchedTrailGeometry(timeInSeconds);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.batchPositions);
    gl.bufferData(gl.ARRAY_BUFFER, batch.positions, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(attributePosition);
    gl.vertexAttribPointer(attributePosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.batchColors);
    gl.bufferData(gl.ARRAY_BUFFER, batch.colors, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(attributeColor);
    gl.vertexAttribPointer(attributeColor, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, batch.vertexCount);

    state.camera.current.rotXActive = prevRotationX;
    drawFrame();
  }

  requestAnimationFrame(render);
};

// ========================================
// PUBLIC API
// ========================================

/**
 * Check if WebGL2 is supported in the current browser
 */
export const isWebGLSupported = (): boolean => {
  try {
    const canvas = document.createElement("canvas");
    const ctx =
      canvas.getContext("webgl2") || canvas.getContext("webgl");
    return !!ctx;
  } catch {
    return false;
  }
};

/**
 * Initialize the GLFrame trail animation
 */
export const initGLFrame = (): void => {
  try {
    setupWebGLContext();
    setupShaders();
    setupWebGLBuffers();
    setupEventListeners();
    updateHoverDrivenStates();
    requestAnimationFrame(render);
  } catch (error) {
    console.error("Error initializing GLFrame:", error);
  }
};
