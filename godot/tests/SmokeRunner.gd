class_name SmokeRunner
extends Node
## Teste de fumaça headless: joga sozinho para validar economia, combate e ondas.
## Uso: godot --headless --fixed-fps 60 --quit-after 9000 --path godot -- --smoke

var main: Node2D
var rush_waves: bool = false
var _build_cooldown: float = 0.0
var _last_wave_logged: int = -1
var _leaks: int = 0
var _sim_time: float = 0.0
var _kills: int = 0


func _ready() -> void:
	Game.game_finished.connect(_on_finished)
	print("[smoke] inicio | ouro=%d base=%d ondas=%d" % [Economy.gold, Game.base_hp, GameData.wave_count()])


func _process(delta: float) -> void:
	if not Game.running:
		return
	_sim_time += delta
	_build_cooldown = maxf(0.0, _build_cooldown - delta)
	if _build_cooldown <= 0.0:
		_build_cooldown = 0.5
		_try_build_anything()

	var waves: WaveManager = main.get_node("WaveManager")
	if rush_waves and waves.phase == WaveManager.Phase.BUILD:
		waves.call_wave_early()
	if waves.wave_index != _last_wave_logged:
		_last_wave_logged = waves.wave_index
		var enemies := get_tree().get_nodes_in_group("enemies").size()
		var towers := get_tree().get_nodes_in_group("towers").size()
		print("[smoke] t=%5.0fs onda=%d ouro=%d base=%d torres=%d inimigos=%d fase=%d" % [
			_sim_time, waves.wave_index + 1, Economy.gold, Game.base_hp, towers, enemies, waves.phase
		])


func _try_build_anything() -> void:
	var tower_ids: Array = GameData.towers.keys()
	if tower_ids.is_empty():
		return
	# tenta evoluir uma torre existente antes de construir outra
	for node in get_tree().get_nodes_in_group("towers"):
		var tower := node as Tower
		if tower == null:
			continue
		for option_variant in tower.upgrade_options():
			var option: Dictionary = option_variant as Dictionary
			if Economy.can_afford(int(option.get("cost", 0))):
				if tower.upgrade_to(str(option.get("id", ""))):
					print("[smoke] evoluiu para %s" % tower.display_name())
					return
	var pick := str(tower_ids[randi() % tower_ids.size()])
	var cost := int(GameData.tower(pick).get("cost", 0))
	if not Economy.can_afford(cost):
		return
	var range_for_pick := float(GameData.tower_node(pick, str(GameData.tower(pick).get("root", ""))).get("range", 150))
	var slots: Array = main.build_slots
	var best_slot := -1
	var best_cover := -1
	for i in slots.size():
		var slot: Dictionary = slots[i]
		if slot["tower"] != null:
			continue
		var slot_position: Vector2 = slot["position"]
		var cover: int = _path_coverage(slot_position, range_for_pick)
		if cover > best_cover:
			best_cover = cover
			best_slot = i
	if best_slot >= 0:
		main._try_build(best_slot, pick)


## Quantos pontos amostrados do caminho ficam dentro do alcance da torre.
func _path_coverage(slot_position: Vector2, tower_range: float) -> int:
	var points: PackedVector2Array = main.waypoints
	if points.size() < 2:
		return 0
	var range_sq := tower_range * tower_range
	var covered := 0
	for i in range(points.size() - 1):
		var a: Vector2 = points[i]
		var b: Vector2 = points[i + 1]
		var steps := maxi(1, int(a.distance_to(b) / 20.0))
		for s in steps:
			var p: Vector2 = a.lerp(b, float(s) / float(steps))
			if slot_position.distance_squared_to(p) <= range_sq:
				covered += 1
	return covered


func _on_finished(victory: bool) -> void:
	var waves: WaveManager = main.get_node("WaveManager")
	print("[smoke] FIM | vitoria=%s onda=%d base=%d ouro=%d" % [
		str(victory), waves.wave_index + 1, Game.base_hp, Economy.gold
	])
	get_tree().quit(0 if victory else 0)
