# Fantasy Tower Defense — protótipo Godot

Protótipo da Fase 1/2 do GDD (`../Fantasy_Tower_Defense_GDD_Claude.md`), feito em **Godot 4.7**.

## Rodar

Abra a pasta `godot/` como projeto no Godot 4.7+ e dê play (`F5`).

## Teste automático (headless)

Um bot joga a partida inteira sozinho — serve para validar economia, combate, ondas e vitória sem abrir o editor:

```bash
godot --headless --fixed-fps 30 --quit-after 60000 --path . -- --smoke
```

Saída esperada: uma linha por onda e, no fim, `[smoke] FIM | vitoria=true ...`.
Use `-- --smoke --rush` para o modo estresse, que chama todas as ondas imediatamente.

## Estrutura

```
data/      balanceamento em JSON — nenhum atributo fica no código (GDD §6, §43)
scripts/   core, towers, enemies, waves, ui
scenes/    Main.tscn (cena inicial)
assets/    sprites dos inimigos
tests/     bot de teste headless
```

Para rebalancear, edite apenas os JSON em `data/`. Nenhuma alteração de código é necessária.

## Conteúdo atual

**Torres** (cada uma com nível 1 → 2 especializações → nível 3, GDD §10–12):

| Torre | Especializações |
|---|---|
| Archer | Ranger → Hunter / Sniper → Assassin |
| Fire Mage | Inferno Mage → Dragon Mage / Flame Warlock → Demon Mage |
| Guardian | Paladin → Holy Knight / Fortress → Iron Bastion |

**Inimigos**: Goblin, Wolf, Orc, Skeleton, Slime (divide-se ao morrer), Slimeling e o boss Ancient Dragon (voador).

**Ondas**: 20 ondas com boss na última, vitória e derrota.

## Pendente

- Arte final de Wolf e Orc (hoje usam o sprite do Goblin com tint — marcados com `placeholder_art` no JSON)
- Animações (idle/walk/attack/death) — sprites são estáticos
- Guardian ainda não bloqueia inimigos, só ataca em área curta (GDD §12)
- Tilemap no lugar do mapa desenhado por código (GDD §26)
- Relíquias, progressão permanente e mapas adicionais (pós-MVP, GDD §23–25)
- Balanceamento: o bot vence com folga; falta ajuste fino (GDD §41)
