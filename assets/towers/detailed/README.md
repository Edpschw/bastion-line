# Torres detalhadas do Bastion Line

72 GLB originais: oito bases de nível 1 e os dois ramos de cada classe nos níveis 5, 10, 15 e 20. O mapeamento e as medidas estão em `manifest.json`.

- glTF 2.0 binário, cores por vértice, materiais PBR e emissivos; sem texturas externas.
- Y para cima; chão em Y=0; frente +Z; uma unidade corresponde a uma célula.
- Cada base cabe dentro de uma célula. Armadilhas ficam abaixo de 0,15 unidade.
- `weapon` contém o equipamento que gira; `muzzle` acompanha esse nó após ser vinculado pelo loader. A estrutura fica imóvel.
- Modelo estático: mira, recuo e pressão da armadilha são animações aplicadas pelo renderer. Personagens/inimigos e regras de combate continuam no código do jogo.

`js/render3d/towerModels.js` carrega somente as variantes solicitadas, limita a três downloads concorrentes e compartilha geometria/material entre instâncias. Conserva até oito modelos ociosos; modelos em uso nunca são descartados. Falhas mantêm a torre procedural jogável. Construções vendidas ou evoluídas descartam o resultado de um carregamento atrasado.

A galeria em `tests/tower-gallery.html` aguarda os GLB antes de desenhar. O servidor deve servir os arquivos `.glb` sem modificações; não há CDN externa ou etapa de build.

Para gerar novamente, com Python + NumPy:

```sh
python scripts/detailed-towers/towers.py
```

`source_towers.json` registra a árvore usada na geração. Se as classes/ramos do núcleo mudarem, atualize esse arquivo e `TOWER_BRANCHES` antes de exportar. A integração é coberta por `node tests/tower-models.test.mjs`; a progressão é coberta por `node tests/tower-levels.test.js`.

Os modelos mais detalhados têm cerca de 19 mil triângulos. Somente os assets são compartilhados; transformações de mira/recuo pertencem a cada instância. Não há LOD nesta versão. O visual mantém inspiração em arquitetura medieval, sem recursos extraídos de Age of Empires ou do Castle Kit.
