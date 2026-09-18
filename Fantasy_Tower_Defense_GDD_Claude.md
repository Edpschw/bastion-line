# GAME DESIGN DOCUMENT — Fantasy Tower Defense
## Documento-base para desenvolvimento com Claude

**Versão:** 1.0  
**Status:** Conceito / MVP em planejamento  
**Engine sugerida:** Godot 4.x  
**Gênero:** Tower Defense + RPG + Progressão de torres  
**Plataforma inicial:** PC/Web, com arquitetura preparada para expansão  
**Estilo:** Fantasia medieval, 2D, top-down/isométrico leve

---

# 1. Objetivo deste documento

Este documento serve como contexto-base para o desenvolvimento de um jogo Tower Defense de fantasia.

O objetivo é orientar Claude como parceiro de desenvolvimento, cobrindo:

- Game Design;
- arquitetura técnica;
- sistema de torres;
- evolução das torres;
- inimigos;
- waves;
- bosses;
- economia;
- relíquias;
- progressão;
- mapas;
- UI;
- arte;
- pipeline de geração de imagens;
- organização dos assets;
- MVP;
- roadmap de desenvolvimento.

**Regra importante:** não tentar desenvolver tudo de uma vez. Primeiro construir um MVP jogável e divertido, depois expandir.

---

# 2. Conceito do jogo

O jogador precisa defender um reino contra ondas progressivamente mais difíceis de criaturas fantásticas.

Loop principal:

```text
Ganhar ouro
    ↓
Construir torre
    ↓
Eliminar inimigos
    ↓
Ganhar mais ouro
    ↓
Melhorar torre
    ↓
Escolher especialização
    ↓
Combinar torres e efeitos
    ↓
Sobreviver às waves
    ↓
Derrotar Boss
    ↓
Desbloquear progressão
```

A característica principal do jogo será a **evolução funcional das torres**.

As evoluções não devem apenas aumentar dano/vida. Elas devem alterar a função estratégica da torre.

Exemplo:

```text
Archer
   ↓
Ranger       Sniper
   ↓            ↓
Área        Dano crítico
```

Assim, o jogador precisa tomar decisões de build.

---

# 3. Direção de design

## 3.1 Princípios

1. Fácil de entender.
2. Difícil de dominar.
3. Cada torre deve ter função clara.
4. Cada inimigo deve resolver um problema diferente.
5. Evoluções devem alterar gameplay.
6. Posicionamento deve ser importante.
7. O jogador deve sentir progressão visual.
8. A arte deve ser consistente.
9. Dados de gameplay devem ficar separados dos assets.
10. O MVP deve ser pequeno.

---

# 4. Direção visual

## 4.1 Estilo

Proposta:

- fantasia medieval;
- RPG;
- 2D HD;
- perspectiva top-down/isométrica leve;
- personagens com silhueta clara;
- cores fortes, mas coerentes;
- iluminação suave;
- texturas detalhadas;
- aparência de jogo premium;
- fundo transparente nos personagens e torres;
- sem texto incorporado nas artes.

A referência de RPG/fantasia pode incluir categorias gerais de criaturas encontradas em jogos como Tibia, mas o projeto deve ter **identidade própria**.

## 4.2 Propriedade intelectual

Tibia/TibiaWiki pode servir como referência conceitual para:

- tipos de criaturas;
- variedade de monstros;
- arquétipos;
- fantasia medieval;
- organização de informações.

Não copiar:

- sprites;
- personagens;
- nomes exclusivos;
- mapas;
- ícones;
- artes;
- animações;
- assets proprietários.

O jogo deve criar criaturas e elementos visuais próprios.

---

# 5. Engine e tecnologia

## Engine

**Godot 4.x**

Motivos:

- excelente suporte 2D;
- TileMap/TileSet;
- AnimatedSprite2D;
- AnimationPlayer;
- cenas reutilizáveis;
- bom suporte a dados;
- open source;
- adequada para um Tower Defense.

## Estrutura conceitual

```text
Game
│
├── GameManager
├── WaveManager
├── EconomyManager
├── TowerManager
├── EnemyManager
├── UpgradeManager
├── RelicManager
├── MapManager
├── UIManager
└── SaveManager
```

---

# 6. Arquitetura recomendada

Separar:

```text
GAMEPLAY
ARTE
DADOS
UI
MAPA
ÁUDIO
```

Nunca colocar valores importantes de gameplay diretamente nos sprites.

Exemplo:

```json
{
  "name": "Archer",
  "damage": 15,
  "range": 180,
  "attack_speed": 1.2,
  "cost": 100
}
```

A imagem:

```text
archer_level_1.png
```

é apenas o asset visual.

Isso permite alterar:

```text
damage = 15
```

para:

```text
damage = 18
```

sem gerar uma nova imagem.

---

# 7. Organização do projeto

Sugestão:

```text
project/
│
├── scenes/
│   ├── main/
│   ├── maps/
│   ├── towers/
│   ├── enemies/
│   ├── bosses/
│   └── ui/
│
├── scripts/
│   ├── core/
│   ├── towers/
│   ├── enemies/
│   ├── waves/
│   ├── economy/
│   └── ui/
│
├── data/
│   ├── towers/
│   ├── enemies/
│   ├── waves/
│   ├── relics/
│   └── maps/
│
├── assets/
│   ├── towers/
│   ├── enemies/
│   ├── bosses/
│   ├── maps/
│   ├── effects/
│   ├── projectiles/
│   ├── ui/
│   └── icons/
│
├── audio/
│   ├── music/
│   └── sfx/
│
└── docs/
```

---

# 8. MVP

O MVP deve conter:

## Mapa

1 mapa.

## Torres

3 torres:

- Archer;
- Fire Mage;
- Guardian.

## Inimigos

5 inimigos:

- Goblin;
- Orc;
- Skeleton;
- Wolf;
- Slime.

## Waves

20 waves.

## Boss

1 Boss.

## Evolução

Cada torre deve possuir:

- nível 1;
- nível 2;
- duas especializações;
- nível 3.

## Sistemas

- construção;
- venda;
- upgrade;
- ouro;
- waves;
- vitória;
- derrota;
- Boss;
- UI básica.

---

# 9. Torres completas planejadas

O jogo final pode ter aproximadamente 8 torres.

| Torre | Função |
|---|---|
| Archer | dano físico rápido |
| Guardian | tanque/controle |
| Fire Mage | dano em área |
| Frost Mage | slow/controle |
| Lightning | dano em cadeia |
| Necromancer | invocação |
| Trap | controle de caminho |
| Nature | suporte |

---

# 10. Torre Archer

## Level 1 — Archer

Características:

- dano físico;
- velocidade alta;
- alcance médio;
- alvo único.

## Level 2A — Ranger

Especialização:

- maior velocidade;
- ataques múltiplos;
- bom contra grupos.

## Level 3A — Hunter

Especialização avançada:

- vários projéteis;
- chance de aplicar bleed;
- excelente contra ondas.

## Level 2B — Sniper

Especialização:

- alcance muito alto;
- velocidade menor;
- dano elevado.

## Level 3B — Assassin

Especialização avançada:

- dano crítico;
- chance de executar inimigos fracos;
- excelente contra alvos prioritários.

---

# 11. Torre Fire Mage

## Level 1

Bola de fogo.

## Level 2A — Inferno Mage

- dano em área;
- burn;
- explosão.

## Level 3A — Dragon Mage

- meteoros;
- enorme área;
- burn prolongado.

## Level 2B — Flame Warlock

- dano individual alto;
- projétil mais poderoso.

## Level 3B — Demon Mage

- projéteis atravessam inimigos;
- dano elevado;
- forte contra corredores densos.

---

# 12. Torre Guardian

## Level 1

Função:

- tanque;
- bloqueio;
- controle de inimigos.

## Level 2A — Paladin

- resistência;
- aura defensiva;
- suporte às torres próximas.

## Level 3A — Holy Knight

- cura;
- escudo;
- resistência a efeitos.

## Level 2B — Fortress

- armadura;
- enorme resistência;
- controle de passagem.

## Level 3B — Iron Bastion

- bloqueia múltiplos inimigos;
- provoca inimigos;
- extremamente resistente.

---

# 13. Frost Mage

## Level 1

Slow.

## Level 2A — Ice Wizard

- slow mais forte;
- chance de congelar.

## Level 3A — Blizzard Master

- grande área;
- slow em massa;
- congelamento.

## Level 2B

Foco em alvo único.

## Level 3B — Frozen Prison

- congela inimigos fortes;
- controle de Boss limitado por duração.

---

# 14. Lightning Tower

## Level 1

Dano elétrico.

## Level 2A — Chain Lightning

O ataque pula entre inimigos.

## Level 3A — Storm Lord

- grande número de saltos;
- dano em cadeia;
- chance de stun.

## Level 2B — Thunder Cannon

- dano alto em um alvo.

## Level 3B — Thunder God

- ataques extremamente poderosos;
- stun;
- forte contra elites.

---

# 15. Necromancer

## Level 1

Dano mágico.

## Level 2 — Summoner

Começa a invocar esqueletos.

## Level 3A — Lich

- dano mágico elevado;
- debuffs;
- ataques de longa distância.

## Level 3B — Death Lord

- exército de esqueletos;
- foco em quantidade;
- transforma inimigos mortos em unidades temporárias.

Essa torre deve ter uma mecânica muito diferente das demais.

---

# 16. Trap Tower

## Level 1

Armadilhas simples.

## Evolução Poison

- veneno;
- dano ao longo do tempo.

## Evolução Explosive

- explosão;
- dano em área.

Pode ser usada para modificar o caminho e controlar ondas.

---

# 17. Nature Tower

## Level 1

Suporte.

## Evolução Healing

- cura Guardian;
- aumenta sobrevivência.

## Evolução Poison

- dano ao longo do tempo;
- redução de resistência.

---

# 18. Sistema de inimigos

Cada inimigo precisa ter uma característica estratégica.

| Inimigo | Função |
|---|---|
| Goblin | rápido |
| Orc | muita vida |
| Skeleton | resistência física |
| Wolf | extremamente rápido |
| Slime | divide-se |
| Troll | regeneração |
| Mage | debuff |
| Assassin | invisibilidade |
| Golem | armadura |
| Dragon | voador |

---

# 19. Inimigos voadores

Criaturas voadoras adicionam uma camada estratégica.

Nem todas as torres podem atacar:

```text
Ground Target
Air Target
Ground + Air
```

Exemplo:

- Guardian: Ground;
- Trap: Ground;
- Archer: Ground + Air;
- Mage: Ground + Air.

Assim, o jogador precisa se preparar para waves aéreas.

---

# 20. Bosses

Bosses devem possuir mecânicas, não apenas HP gigantesco.

Exemplos:

## Orc Warlord

- alta vida;
- convoca Orcs;
- aumenta velocidade dos aliados.

## Ancient Dragon

- voador;
- ataque em área;
- muda de rota;
- resistência a fogo.

## Death King

- invoca esqueletos;
- revive inimigos;
- reduz eficiência de torres.

Cada Boss deve ensinar uma nova mecânica.

---

# 21. Sistema de Waves

Exemplo:

```text
Wave 1
Goblin

Wave 2
Goblin + Wolf

Wave 3
Goblin + Skeleton

Wave 4
Orc

Wave 5
Elite Wave

Wave 6
Slime

Wave 7
Wolf + Goblin

Wave 8
Skeleton + Orc

Wave 9
Mixed Wave

Wave 10
BOSS
```

Depois repetir a lógica aumentando dificuldade.

A dificuldade pode crescer por:

- HP;
- velocidade;
- armadura;
- quantidade;
- composição;
- habilidades.

---

# 22. Economia

Sistema inicial:

```text
Enemy killed
     ↓
Gold
     ↓
Build / Upgrade
```

Variáveis:

- gold;
- tower cost;
- upgrade cost;
- sell value;
- starting gold;
- wave reward.

Evitar inflação excessiva.

O balanceamento deve ser baseado em dados, não em valores arbitrários espalhados pelo código.

---

# 23. Relíquias

Relíquias são modificadores escolhidos antes ou durante a progressão.

Exemplos:

### Burning Arrows

+20% dano de torres físicas.

### Frozen Core

+15% duração de slow.

### Necromancer's Book

+1 unidade invocada.

### King's Treasury

+10% geração de ouro.

### Arcane Crystal

+15% dano mágico.

### Iron Heart

+20% HP de Guardian.

Relíquias devem incentivar builds diferentes.

---

# 24. Progressão permanente

Além da partida, o jogador pode evoluir o reino.

```text
KINGDOM
│
├── Archer Research
├── Mage Research
├── Guardian Research
├── Economy
├── Castle
└── Relics
```

O jogador pode desbloquear:

- novas torres;
- novas evoluções;
- novas relíquias;
- mapas;
- melhorias permanentes.

---

# 25. Mapas

Planejamento inicial:

## Map 1 — Green Valley

Tutorial.

Caminho simples.

## Map 2 — Dark Forest

Dois caminhos.

## Map 3 — Frozen Lands

Bônus para gelo.

## Map 4 — Volcano

Inimigos de fogo.

## Map 5 — Castle

Mapa final inicial.

---

# 26. Tile system

O cenário deve ser modular.

```text
Grass
Dirt
Water
Rock
Tree
Path
Bridge
Castle
Decoration
```

Usar TileSet/TileMap.

Não criar cada mapa como uma imagem única.

Isso permite:

- reutilização;
- mapas maiores;
- mudanças rápidas;
- colisões;
- navegação;
- diferentes layouts.

---

# 27. Pipeline de geração de imagens

Não gerar imagens aleatórias.

Criar primeiro uma **Bíblia Visual**.

Ela deve definir:

- perspectiva;
- proporção;
- iluminação;
- paleta;
- textura;
- nível de detalhe;
- estilo dos contornos;
- escala dos personagens;
- fundo;
- transparência.

Prompt-base conceitual:

```text
Fantasy RPG Tower Defense game art,
2D HD, top-down/isometric light perspective,
consistent character proportions,
clear readable silhouette,
vivid but coherent fantasy colors,
soft directional lighting,
detailed hand-painted textures,
premium game asset quality,
transparent background,
no text,
no logo,
no watermark.
```

Esse conceito deve ser mantido consistente para todos os assets.

---

# 28. Assets necessários

## Torres

Para cada torre:

```text
level_1
level_2a
level_2b
level_3a
level_3b
```

## Inimigos

Para cada inimigo:

```text
idle
walk
attack
hit
death
```

## Efeitos

```text
fire
ice
lightning
poison
explosion
heal
slow
stun
upgrade
death
```

## Projectiles

```text
arrow
fireball
ice_bolt
lightning
poison_projectile
magic_projectile
```

## UI

```text
gold_icon
health_icon
upgrade_button
sell_button
tower_icons
enemy_icons
ability_icons
relic_icons
wave_indicator
```

---

# 29. Spritesheets

Sempre que possível, utilizar spritesheets.

Exemplo:

```text
ARCHER_ATTACK.png

[frame 1][frame 2][frame 3][frame 4][frame 5][frame 6]
```

Animações:

```text
idle
walk
attack
hit
death
upgrade
```

Usar AnimatedSprite2D ou AnimationPlayer no Godot.

---

# 30. Escala dos assets

Definir uma escala global antes de gerar dezenas de imagens.

Exemplo conceitual:

```text
Enemy pequeno: 48–64 px
Enemy médio: 64–96 px
Boss: 128–256 px
Tower: 96–160 px
Projectile: 16–32 px
```

Os valores exatos devem ser ajustados após o primeiro protótipo.

O mais importante é manter consistência.

---

# 31. Como usar IA na produção de arte

Pipeline:

```text
Conceito
   ↓
Design final
   ↓
Imagem base
   ↓
Remoção/controle do fundo
   ↓
Padronização de escala
   ↓
Sprite
   ↓
Spritesheet
   ↓
Godot
```

Não usar uma imagem gerada como se fosse automaticamente um asset final.

Cada asset deve ser revisado.

---

# 32. Regra de consistência

Antes de gerar uma nova criatura, torre ou Boss, verificar:

- mesma perspectiva;
- mesma escala;
- mesma iluminação;
- mesma paleta;
- mesmo nível de detalhe;
- mesma linguagem visual;
- fundo transparente;
- sem texto;
- sem watermark.

---

# 33. UI

HUD básico:

```text
┌──────────────────────────────────────┐
│ ❤️ 20      🪙 350       WAVE 08/20  │
├──────────────────────────────────────┤
│                                      │
│             MAPA                     │
│                                      │
│        🏹       🔥                   │
│                                      │
│     👹 👹 👹 →→→→ 🏰               │
│                                      │
│              🛡️                     │
│                                      │
├──────────────────────────────────────┤
│ 🏹  🔥  🛡️  ❄️  ⚡                  │
└──────────────────────────────────────┘
```

Ao selecionar torre:

```text
ARCHER

Damage: 25
Range: 180
Speed: 1.2

[UPGRADE]

Cost: 150

[SELL]
```

---

# 34. Posicionamento

O jogador deve clicar em áreas válidas para construir.

Sistema:

```text
Buildable Area
    ↓
Click
    ↓
Tower Preview
    ↓
Confirm
    ↓
Tower Instance
```

Mostrar raio da torre ao selecionar.

---

# 35. Targeting

Cada torre deve possuir uma estratégia de alvo configurável.

Possibilidades:

```text
First
Last
Strongest
Weakest
Closest
Air First
Boss First
```

Isso aumenta a profundidade sem exigir muitas torres.

---

# 36. Sistema de dano

Criar tipos:

```text
Physical
Fire
Ice
Lightning
Poison
Holy
Dark
```

Inimigos podem ter resistências.

Exemplo:

```json
{
  "physical_resistance": 0.2,
  "fire_resistance": -0.1,
  "ice_resistance": 0.3
}
```

Evitar criar complexidade excessiva no MVP.

---

# 37. Sistema de status

Possíveis efeitos:

```text
Burn
Poison
Slow
Freeze
Stun
Bleed
Armor Break
Fear
```

Cada status deve ter:

- duração;
- intensidade;
- stack máximo;
- fonte;
- interação com outros efeitos.

---

# 38. Sinergias

O sistema deve incentivar combinações.

Exemplo:

```text
Frost Mage
    ↓
Slow
    ↓
Fire Mage
    ↓
Inimigos ficam mais tempo na área de dano
```

Outro:

```text
Guardian
    ↓
Bloqueia inimigos
    ↓
Lightning
    ↓
Ataca vários inimigos agrupados
```

Outro:

```text
Necromancer
    ↓
Skeletons
    ↓
Guardian
    ↓
Cria linha defensiva
```

---

# 39. MVP técnico

Primeira versão jogável:

### Cena

```text
Main
├── Map
├── EnemyPath
├── Towers
├── Enemies
├── Projectiles
├── Effects
└── UI
```

### Sistemas

```text
GameManager
WaveManager
TowerManager
EnemyManager
EconomyManager
UIManager
```

---

# 40. Ordem correta de desenvolvimento

## Fase 1 — Protótipo

Usar formas simples.

Não gastar tempo com arte.

Criar:

- mapa;
- caminho;
- inimigo;
- torre;
- tiro;
- dano;
- morte;
- ouro;
- wave.

Objetivo: jogo funcionando.

---

## Fase 2 — MVP de gameplay

Adicionar:

- 3 torres;
- 5 inimigos;
- 20 waves;
- Boss;
- upgrades;
- especializações;
- UI.

Objetivo: jogo divertido.

---

## Fase 3 — Arte

Substituir placeholders:

- torres;
- inimigos;
- projectiles;
- efeitos;
- mapa;
- UI.

---

## Fase 4 — Progressão

Adicionar:

- relíquias;
- XP;
- pesquisa;
- desbloqueios;
- mapas.

---

## Fase 5 — Conteúdo

Expandir:

- 8 torres;
- 20+ inimigos;
- vários Bosses;
- 5+ mapas;
- novas habilidades.

---

# 41. Roadmap resumido

```text
MVP
 ↓
3 torres
 ↓
5 inimigos
 ↓
20 waves
 ↓
1 Boss
 ↓
Balanceamento
 ↓
Arte
 ↓
Relíquias
 ↓
Progressão
 ↓
8 torres
 ↓
20+ inimigos
 ↓
5 mapas
 ↓
Polimento
```

---

# 42. Métricas para acompanhar

Mesmo no protótipo, registrar:

- duração média da partida;
- ouro acumulado por wave;
- taxa de vitória;
- torre mais usada;
- evolução mais escolhida;
- inimigo responsável por derrotas;
- dano médio por torre;
- utilização de cada torre;
- custo médio para completar mapa.

Isso ajudará no balanceamento.

---

# 43. Princípios para Claude durante o desenvolvimento

Claude deve:

1. Não reescrever sistemas inteiros sem necessidade.
2. Preservar arquitetura modular.
3. Separar dados de lógica.
4. Evitar hardcode de atributos.
5. Criar sistemas reutilizáveis.
6. Documentar decisões importantes.
7. Fazer mudanças pequenas e testáveis.
8. Priorizar o MVP.
9. Não adicionar funcionalidades sem necessidade.
10. Manter o jogo jogável após cada etapa.
11. Criar placeholders antes de depender de assets finais.
12. Manter compatibilidade com Godot 4.x.
13. Evitar dependências externas desnecessárias.
14. Manter a estrutura de arquivos organizada.

---

# 44. Prompt inicial para Claude

Use este documento como contexto permanente do projeto.

Você é o parceiro técnico e de game design responsável por ajudar a desenvolver este Tower Defense.

Antes de implementar funcionalidades grandes:

1. Analise a arquitetura existente.
2. Identifique os arquivos afetados.
3. Explique rapidamente a estratégia.
4. Implemente a menor mudança necessária.
5. Teste a funcionalidade.
6. Verifique se não quebrou sistemas existentes.
7. Atualize a documentação quando necessário.

Prioridade:

```text
JOGABILIDADE
>
ARQUITETURA
>
BALANCEAMENTO
>
ARTE
>
POLIMENTO
```

Não tente desenvolver o jogo inteiro de uma vez.

O primeiro objetivo é construir o MVP:

```text
1 mapa
3 torres
5 inimigos
20 waves
1 Boss
ouro
construção
upgrade
especialização
vitória/derrota
UI básica
```

Somente após o MVP estar jogável e estável devemos expandir o conteúdo.

---

# 45. Próxima tarefa recomendada para Claude

Começar pelo protótipo técnico sem arte final.

Implementar:

### 1. Projeto Godot

Criar estrutura inicial.

### 2. Mapa

Criar um mapa simples com:

- caminho;
- área de construção;
- entrada;
- castelo/base.

### 3. Enemy

Criar inimigo genérico com:

- HP;
- velocidade;
- caminho;
- dano à base;
- recompensa.

### 4. Tower

Criar torre genérica com:

- range;
- damage;
- attack speed;
- targeting;
- projectile.

### 5. WaveManager

Criar:

- waves;
- spawn;
- dificuldade;
- Boss.

### 6. Economy

Criar:

- gold;
- custo;
- recompensa;
- upgrade.

### 7. UI

Criar:

- HP da base;
- ouro;
- wave;
- botão de torre;
- botão de upgrade.

### 8. Primeiro teste

O jogo deve permitir:

```text
Iniciar partida
↓
Construir Archer
↓
Inimigos aparecem
↓
Archer ataca
↓
Inimigo morre
↓
Jogador recebe Gold
↓
Jogador faz Upgrade
↓
Wave aumenta
↓
Boss aparece
↓
Vitória/derrota
```

Depois disso, implementar Fire Mage e Guardian.

---

# 46. Critério de sucesso do MVP

O MVP está pronto quando uma pessoa consegue:

1. iniciar uma partida;
2. entender onde construir;
3. construir uma torre;
4. observar a torre atacar;
5. ganhar ouro;
6. fazer upgrade;
7. escolher uma especialização;
8. enfrentar diferentes inimigos;
9. derrotar ou perder para o Boss;
10. reiniciar a partida.

O objetivo não é ter muitas funcionalidades.

O objetivo é provar que:

> **o loop de Tower Defense + evolução de torres é divertido.**

---

# 47. Expansão futura

Depois do MVP, considerar:

- multiplayer/co-op;
- desafios diários;
- endless mode;
- ranking;
- equipamentos;
- personagens heróis;
- habilidades ativas;
- árvores de talentos;
- mapas procedurais;
- eventos;
- temporadas;
- skins;
- mais Bosses;
- história/campanha.

Esses recursos não devem entrar no MVP.

---

# 48. Visão final

O produto final pretendido é um:

**Tower Defense de fantasia com forte progressão RPG**, em que:

- posicionamento importa;
- composição de torres importa;
- evolução muda o gameplay;
- inimigos possuem counters;
- relíquias criam builds;
- Bosses exigem estratégia;
- progressão permanente cria retenção;
- arte possui identidade consistente.

A estrutura deve permitir adicionar novas torres, inimigos e mapas sem reescrever o núcleo do jogo.

---

# FIM DO DOCUMENTO
