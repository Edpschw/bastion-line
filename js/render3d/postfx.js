// Pós-processamento HDR linear para o campo de batalha.
// index.js: no mount, criar createPostFX(renderer, scene, camera, { quality: 0 });
// no resize, atualizar renderer/câmera e chamar resize(larguraCSS, alturaCSS, DPR);
// no frame, chamar render(dtEmSegundos) no lugar de renderer.render();
// na qualidade adaptativa, chamar setQuality(level); no teardown, dispose().
// Manter renderer.toneMapping = THREE.ACESFilmicToneMapping,
// renderer.outputColorSpace = THREE.SRGBColorSpace e toneMappingExposure desejado.
// r169 não aplica tone mapping da cena nos alvos intermediários do composer;
// OutputPass lê essas propriedades e aplica ACES + sRGB uma única vez na saída.
// Remover outros passes gamma/tone mapping e conversões manuais nos shaders.
// Materiais personalizados devem produzir cor linear HDR. Não alterar ColorManagement.
// opts aceita quality, pixelRatio, ao, denoise, bloom e grading (sobrescritas abaixo).

import { Vector2, Vector3 } from '../../vendor/three/three.module.min.js';
import { EffectComposer } from '../../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from '../../vendor/three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from '../../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from '../../vendor/three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from '../../vendor/three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from '../../vendor/three/addons/postprocessing/OutputPass.js';

// Raio em células do tabuleiro: contato suave sem escurecer unidades inteiras.
export const AO_DEFAULTS = Object.freeze({
  radius: 0.38, thickness: 0.18, distanceExponent: 2,
  distanceFallOff: 1, scale: 1, samples: 16,
  screenSpaceRadius: false, blendIntensity: 0.32
});
// Filtro espacial estável, sem histórico temporal que deixe rastros nas tropas.
export const DENOISE_DEFAULTS = Object.freeze({
  radius: 6, samples: 16, rings: 2, lumaPhi: 10, depthPhi: 2, normalPhi: 3
});
// Limiar HDR acima do branco difuso; emissivos devem superar 1 em luminância.
export const BLOOM_DEFAULTS = Object.freeze({ strength: 0.24, radius: 0.35, threshold: 1.15 });
// Ajustes sutis em espaço linear: sombras frias, realces quentes e bordas suaves.
export const GRADING_DEFAULTS = Object.freeze({
  contrast: 1.04, saturation: 1.10, pivot: 0.18,
  shadowTint: Object.freeze([0.97, 0.99, 1.04]),
  highlightTint: Object.freeze([1.04, 1.015, 0.97]),
  vignette: 0.12, vignetteInner: 0.35, vignetteOuter: 0.95
});
// O UnrealBloomPass já começa em meia resolução; médio reduz mais uma vez.
const MEDIUM_BLOOM_SCALE = 0.5;

const gradingShader = {
  name: 'FantasyRTSColorGrading',
  uniforms: {
    tDiffuse: { value: null }, contrast: { value: 1 }, saturation: { value: 1 },
    pivot: { value: 0.18 }, shadowTint: { value: new Vector3() },
    highlightTint: { value: new Vector3() }, vignette: { value: 0 },
    vignetteInner: { value: 0.35 }, vignetteOuter: { value: 0.95 },
    aspect: { value: 1 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float contrast, saturation, pivot, vignette;
    uniform float vignetteInner, vignetteOuter, aspect;
    uniform vec3 shadowTint, highlightTint;
    varying vec2 vUv;
    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = max(source.rgb, vec3(0.0));
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);
      // Contraste multiplicativo preserva preto e valores HDR acima de 1.
      color *= pow(max(luma, 0.0001) / max(pivot, 0.0001), contrast - 1.0);
      float highlight = smoothstep(0.08, 0.9, luma);
      color *= mix(shadowTint, highlightTint, highlight);
      vec2 centered = (vUv - 0.5) * 2.0;
      centered.x *= aspect;
      float distanceToCenter = length(centered) / sqrt(aspect * aspect + 1.0);
      color *= 1.0 - vignette * smoothstep(vignetteInner, vignetteOuter, distanceToCenter);
      gl_FragColor = vec4(max(color, vec3(0.0)), source.a);
    }
  `
};

const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
const qualityLevel = value => Number.isFinite(value) ? Math.max(0, Math.min(2, Math.floor(value))) : 0;

export function createPostFX(renderer, scene, camera, opts = {}) {
  const initialSize = renderer.getSize(new Vector2());
  let width = positive(initialSize.x, 1);
  let height = positive(initialSize.y, 1);
  let pixelRatio = positive(opts.pixelRatio, positive(renderer.getPixelRatio(), 1));
  let level = qualityLevel(opts.quality);
  let disposed = false;
  const composer = new EffectComposer(renderer);
  let composerPixelRatio = renderer.getPixelRatio();
  const renderPass = new RenderPass(scene, camera);
  const aoConfig = { ...AO_DEFAULTS, ...opts.ao };
  const ao = new GTAOPass(scene, camera, 1, 1, undefined, aoConfig,
    { ...DENOISE_DEFAULTS, ...opts.denoise });
  ao.blendIntensity = aoConfig.blendIntensity;
  const bloomConfig = { ...BLOOM_DEFAULTS, ...opts.bloom };
  const bloom = new UnrealBloomPass(new Vector2(1, 1), bloomConfig.strength,
    bloomConfig.radius, bloomConfig.threshold);
  // Escalar aqui faz qualquer resize do composer respeitar o nível vigente.
  const bloomSetSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => {
    const scale = level === 0 ? 1 : MEDIUM_BLOOM_SCALE;
    // Cinco mips precisam de pelo menos 32 pixels para evitar dimensões zero.
    bloomSetSize(Math.max(32, Math.round(w * scale)), Math.max(32, Math.round(h * scale)));
  };
  const grading = new ShaderPass(gradingShader);
  grading.material.toneMapped = false;
  grading.material.depthTest = false;
  grading.material.depthWrite = false;
  const gradeConfig = { ...GRADING_DEFAULTS, ...opts.grading };
  for (const key of Object.keys(GRADING_DEFAULTS)) {
    if (key === 'shadowTint' || key === 'highlightTint') {
      grading.uniforms[key].value.fromArray(gradeConfig[key]);
    } else {
      grading.uniforms[key].value = gradeConfig[key];
    }
  }
  const smaa = new SMAAPass(1, 1);
  const output = new OutputPass();
  const passes = [renderPass, ao, bloom, grading, smaa, output];
  for (const pass of passes) composer.addPass(pass);

  function updateEnabled() {
    ao.enabled = level === 0;
    bloom.enabled = level < 2;
    smaa.enabled = level < 2;
    // Baixo: RenderPass → grading → OutputPass, mantendo a mesma saída de cor.
  }

  function resize(w, h, ratio = renderer.getPixelRatio()) {
    if (disposed) return;
    width = Math.max(1, Math.round(positive(w, width)));
    height = Math.max(1, Math.round(positive(h, height)));
    const nextRatio = positive(ratio, pixelRatio);
    if (nextRatio !== composerPixelRatio) {
      composer.setPixelRatio(nextRatio);
      composerPixelRatio = nextRatio;
    }
    pixelRatio = nextRatio;
    // Composer repassa dimensões físicas a GTAO/SMAA; não multiplicar DPR de novo.
    composer.setSize(width, height);
    grading.uniforms.aspect.value = width / height;
  }

  updateEnabled();
  resize(width, height, pixelRatio);

  return {
    render(dt) {
      if (!disposed) composer.render(Number.isFinite(dt) ? Math.max(0, dt) : undefined);
    },
    resize,
    setQuality(value) {
      if (disposed) return;
      const next = qualityLevel(value);
      if (next === level) return;
      const previous = level;
      level = next;
      updateEnabled();
      // Só redimensionar bloom ao trocar sua escala, sem recriar passes/shaders.
      if ((previous === 0) !== (level === 0)) bloom.setSize(width * pixelRatio, height * pixelRatio);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const pass of passes) pass.dispose();
      // r169 omite estes materiais nos respectivos dispose().
      ao.gtaoMaterial.dispose();
      ao.blendMaterial.dispose();
      bloom.materialHighPassFilter.dispose();
      composer.dispose();
    }
  };
}
