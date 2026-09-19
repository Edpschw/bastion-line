# Bastion Line

Tower defense de faixa vertical: os invasores atravessam um campo 7×14 do portal
até o bastião, e você ergue torres pelo caminho para segurá-los.

Jogue abrindo `index.html` — é um único arquivo estático, sem build.

## Como o jogo é desenhado

O projeto tem **dois renderers** para a mesma partida:

| | Renderer 3D (padrão) | Renderer 2D (reserva) |
|---|---|---|
| Onde | `js/render3d/` | dentro de `index.html` |
| Tecnologia | WebGL via three.js | Canvas 2D |
| Quando entra | sempre que o navegador suportar módulos ES e WebGL | se qualquer um dos dois faltar |

O **núcleo do jogo vive em `index.html`** e roda inteiramente em coordenadas
lógicas 2D (pixels, tabuleiro de 378×756). Ele não sabe que existe 3D: expõe
`window.BastionLine` e o renderer apenas *lê* esse estado a cada frame. Isso
mantém regras e apresentação separadas — e é o que permite a reserva 2D
continuar funcionando sem código duplicado.

```
index.html  ──readState()──▶  js/render3d/index.js  ──▶  cena three.js
     ▲                                 │
     └──── screenToLogical() ◀─────────┘   (raycast: tela → célula)
```

### Arquivos do renderer 3D

| Arquivo | Responsabilidade |
|---|---|
| `core.js` | paleta, cache de geometrias/materiais, conversão de coordenadas |
| `world.js` | céu, luzes, tabuleiro, floresta, portal e bastião |
| `actors.js` | malhas e animações de torres, inimigos e do Mestre de Obras |
| `fx.js` | projéteis, impactos e partículas (pools pré-alocados) |
| `overlay.js` | barras de vida, dano e galões, em canvas 2D por cima da cena |
| `index.js` | câmera, sincronização com o estado do jogo e entrada |

Nenhum modelo externo é carregado: torres, inimigos e cenário são montados a
partir de primitivas (caixas, cones, octaedros) com *flat shading*.

### Desempenho

A cena mede o tempo médio de frame e desce de degrau sozinha quando o aparelho
não sustenta ~18 fps: primeiro reduz resolução e mapa de sombra, depois desliga
as sombras. Só desce, nunca sobe — voltar atrás causaria oscilação visível.

## Dependências

- [three.js](https://threejs.org) r169, versionado em `vendor/three/` (MIT).
  Está no repositório de propósito: o jogo é publicado como HTML estático e não
  deve depender de CDN em tempo de execução. Ver `vendor/three/README.md`.

## Outros diretórios

- `sprites/` — ilustrações dos inimigos, usadas pelo renderer 2D de reserva.
- `godot/` — protótipo paralelo em Godot 4.7, seguindo o mesmo GDD.
- `godot-web/` — build web do protótipo Godot.
- `Fantasy_Tower_Defense_GDD_Claude.md` — documento de design.
