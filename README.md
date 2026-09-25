# Bastion Line

Tower defense de faixa vertical: os invasores atravessam um campo 7×14 do portal
até o bastião, e você ergue torres pelo caminho para segurá-los.

Jogue abrindo `index.html` — é um único arquivo estático, sem build.

## Sistemas de jogo

| Sistema | Onde | Nota |
|---|---|---|
| **Status** | `applyStatus` / `tickStatus` | `e.status[tipo] = {fim, poder, stacks, fonte}`. `refresh` renova e mantém o mais forte; `add` empilha até um teto. Produtores hoje: Gélida (slow), Piromante (burn). `stun`, `poison`, `bleed` e `armorBreak` já funcionam, à espera das torres que os produzem. |
| **Terra / ar** | `canHit`, `UNIT_BASE[].targets` | Voadores traçam rota reta e ignoram o labirinto. A Milícia é corpo a corpo e não alcança o ar — a loja e a ficha da torre dizem isso, porque é regra de balanceamento e não pode ser invisível. |
| **Inimigos atacantes** | `ENEMY_BASE[].attacker` | Só criaturas marcadas param a marcha para destruir torres. O resto corre para o bastião. Torres sobreviventes são reparadas entre ondas: a pressão vale dentro da onda, sem virar bola de neve. |
| **Criaturas** | `ENEMY_BASE` | Cada uma carrega uma função estratégica (GDD §18), declarada como dado e não como código especial: `flying`, `attacker`, `splitInto`, `regen`, `immune`, `aura`. `shape2d` diz qual desenho o renderer 2D reaproveita — sem ele, tipo novo cai no `else` e aparece como o chefe. |
| **Composição de ondas** | `WAVE_THEMES` | Receitas com pesos e onda mínima, em vez de um tipo em destaque mais goblins. É o que permite expressar "incursão aérea" ou "coluna blindada". |

### Torres

As oito do GDD têm 20 níveis. O nível 5 escolhe um dos dois ramos; os
níveis 10, 15 e 20 desbloqueiam novas mecânicas, enquanto os intermediários
melhoram vida, dano, alcance e cadência. `TOWER_LEVELS` concentra os marcos,
`getBaseStats()` calcula a progressão e `visualTier()` escolhe uma das cinco
formas 3D (básica, evoluída, avançada, épica e suprema). A arte 3D usa
paletas e silhuetas distintas por ramo, inspiradas no plano visual da conversa.

| Torre | Função | Ramos |
|---|---|---|
| Milícia | corpo a corpo, só terra | Guardião / Guerreiro |
| Arqueira | dano físico a distância | Patrulheira / Franco-atiradora |
| Mago | dano em área | Piromante (queima) / Arcanista |
| Gélida | lentidão | Eterna / Cristalina |
| **Bobina** | dano elétrico | Corrente (salta entre inimigos) / Canhão (alvo único, atordoa) |
| **Druida** | suporte | Guardiã do Bosque (cura torres) / Praga (veneno e quebra de armadura) |
| **Armadilha** | controle de rota | Tóxica / Explosiva |
| **Necromante** | invocação | Lich (magia) / Senhor da Morte (exército) |

Duas delas fogem do molde:

- A **Armadilha** é `walkable`: ocupa a célula mas não fecha a rota. É o que
  separa armadilha de muro — o inimigo passa por cima, e é aí que ela dispara.
  Como nunca bloqueia, construí-la jamais arrisca fechar o caminho.
- O **Necromante** ergue esqueletos, a única entidade que anda, briga e morre
  sem ser torre nem inimigo. Ficam presos a uma coleira em volta da torre: são
  linha de frente, não um segundo exército solto. Inimigos atacantes os incluem
  na busca de alvo, que é o que os faz valer a pena. O abate conta como
  veterania de quem os ergueu.

Aplicar um acerto passa por `hitEnemy()`: a cadeia de raios precisa repetir um
acerto por completo — armadura, perda de força por salto, todo efeito embutido —
e duplicar isso era como as duas versões iriam divergir.

A Armadilha continua `walkable` em todos os níveis. O Senhor da Morte sustenta
1/2/3/5/7 esqueletos nos níveis 1/5/10/15/20 (mais um com a relíquia Livro).

### Elenco

| Criatura | Função | Como se distingue de cima |
|---|---|---|
| Goblin / Batedor | básico / rápido | pequeno, cabeça clara |
| Lobo | extremamente rápido, em matilha | único quadrúpede: silhueta horizontal |
| Gosma → Gosminha | divide-se ao morrer | gel translúcido que saltita |
| Orc | muita vida, ataca torres | massa e tronco curvado |
| Cavaleiro Esqueleto | armadura, ataca torres | osso e aço, capa |
| Troll | regenera fora de combate | alto, corcunda, braços até o chão |
| Golem | armadura alta, imune a slow, ataca torres | blocos empilhados, fendas acesas |
| Xamã | amaldiçoa torres por perto | manto cônico, anel roxo no chão |
| Harpia | voadora barata | asas longas, sombra deslocada |
| Dragão de Cristal | chefe voador | maior, asas batendo |

### Relíquias

Seis bênçãos globais (GDD §23). A cada onda de chefe vencida o jogo oferece três
ainda não tomadas, e o relógio da construção fica suspenso enquanto a escolha
está aberta — recompensa não pode custar tempo de preparo.

| Relíquia | Efeito |
|---|---|
| Flechas Ardentes | +20% de dano das torres físicas (Milícia, Arqueira, Armadilha) |
| Cristal Arcano | +15% de dano mágico (Mago, Gélida, Bobina, Druida, Necromante) |
| Núcleo Gélido | +15% de duração da lentidão |
| Livro do Necromante | +1 esqueleto invocado |
| Tesouro do Rei | +10% de ouro recebido |
| Coração de Ferro | +20% de vida da Milícia |

Não são casos especiais espalhados pelo código: viram multiplicadores que os
cálculos existentes consultam, e por isso uma relíquia nova é uma linha em
`RELICS` mais um caso em `relicMult()`. Todo ouro passa por `ganharOuro()`, para
o Tesouro do Rei valer em abate, renda passiva, bônus de onda e chamada
antecipada — sem isso ele pegaria só em algumas fontes.

### Chefes

Um a cada cinco ondas, em rodízio fixo, para o jogador poder se preparar.
Cada um carrega uma mecânica própria — chefe não é inimigo comum com a vida
inflada (GDD §20).

| Chefe | Ondas | Mecânica |
|---|---|---|
| Senhor da Guerra | 5, 20, 35… | convoca orcs e **acelera os aliados por perto** |
| Dragão Ancião | 10, 25… | voa, **troca de coluna no meio da travessia**, imune a fogo |
| Rei da Morte | 15, 30… | convoca cavaleiros, enfraquece torres e **ergue de volta o que você já matou** |

A ressurreição lê uma lista curta de caídos (`fallen`, no máximo 12) e devolve o
inimigo com metade da vida e 40% do ouro — senão o Rei vira fonte infinita de
renda em vez de ameaça.

### Ocultação

O **Assassino** alterna entre oculto e visível. Enquanto oculto nenhuma torre
consegue mirá-lo, então ele só leva dano em janelas — o que favorece cadência
alta sobre golpe pesado. A **Armadilha** é a exceção: dispara por contato e não
por mira (`ignoresCloak`), o que a torna o contra-ataque específico dele.

O Xamã não bate em torre: a maldição é um efeito de presença recalculado por
frame, então sai de cena e o efeito some junto — não precisa de status com
duração. O anel no chão desenha o alcance verdadeiro da aura.

Ao remover uma torre — vendida ou destruída — use sempre `removeUnit()`: quem
a estivesse atacando precisa soltar o alvo, senão o inimigo fica parado batendo
num fantasma que nunca morre.

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
| `towerArchitecture.js` | oito estruturas procedurais próprias, com detalhes por ramo e nível |
| `actors.js` | ocupantes, inimigos, Mestre de Obras e animações |
| `fx.js` | projéteis, impactos e partículas (pools pré-alocados) |
| `overlay.js` | barras de vida, dano e galões, em canvas 2D por cima da cena |
| `index.js` | câmera, sincronização com o estado do jogo e entrada |

Nenhum modelo externo é carregado: torres, inimigos e cenário são montados a
partir de primitivas (caixas, cones, octaedros) com *flat shading*.
O visual de campanha usa pedra escurecida, madeira, bronze e cores de ramo em
silhuetas distintas. O terreno mantém a grade jogável, com variação discreta de
grama, terra, bosque misto e estandartes. Para comparar as cinco formas de cada
especialização, abra `tests/tower-gallery.html`.

### Câmera

Calcada na de *Warcraft III*, cujos padrões são ângulo de ataque **304**, campo
de visão **70** e distância ao alvo **1650** (≈ 12,9 tiles de 128 unidades). Em
WC3, 360° é a horizontal e 270° aponta direto para baixo — então 304° equivale a
**56° acima do horizonte**, que é a inclinação usada aqui.

O que dá o "olhar de RTS" não é a inclinação, e sim o **campo de visão largo com
a câmera perto**: a perspectiva diverge e o tabuleiro deixa de parecer maquete.
`fitCamera()` faz busca binária pela distância que enquadra o tabuleiro na tela
atual, e chega sozinha a ~10 células — mesma ordem de grandeza do WC3.

### Controles de câmera

No arranjo que Warcraft III e Age of Empires usam: **a roda dá zoom**, e quem
anda pelo mapa são teclas e arrasto.

| Gesto | Ação |
|---|---|
| Roda do mouse / pinça | zoom, mantendo sob o cursor o ponto que já estava lá (como o AoE) |
| Setas ou WASD | mover |
| Arrastar com botão direito ou do meio | mover |
| Dois dedos | mover e dar zoom |
| `Home` | reenquadrar o tabuleiro inteiro |
| `+` / `−` | zoom pelo teclado |

O WC3 clássico vai de 1250 a 1650 de distância — só 0,76× para dentro, e o
padrão já é o mais afastado. Aqui a visão inicial também é a mais afastada, mas
a faixa é mais generosa à moda do AoE. O limite de afastamento não é um número
escolhido a dedo: é a distância em que o tabuleiro inteiro cabe, dividida pela
da janela padrão, o que mantém o limite certo em qualquer proporção de tela.

Não há rolagem de borda, que os dois jogos têm. Neles a interface é uma barra
sólida que barra o ponteiro; aqui os painéis flutuam sobre o tabuleiro, e a
câmera sairia andando toda vez que o jogador fosse até a loja.

O botão direito serve a duas coisas: parado, cancela a construção; arrastando, é
câmera. No Chrome o `contextmenu` dispara no *pressionar*, antes de existir
qualquer arrasto, então o menu é sempre engolido e quem decide é o soltar — o
renderer avisa o jogo via `cancelPlacing()`.

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
