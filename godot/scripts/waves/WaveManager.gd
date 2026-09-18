class_name WaveManager
extends Node
## Controla as ondas: contagem de construção, spawn, limpeza e vitória (GDD §21).

signal wave_started(index: int, total: int, is_boss: bool)
signal wave_cleared(index: int, reward: int)
signal build_time_changed(remaining: float, total: float)
signal all_waves_cleared()

enum Phase { BUILD, RUNNING, DONE }

var phase: int = Phase.BUILD
var wave_index: int = 0
var build_remaining: float = 0.0
var build_total: float = 0.0

var enemy_container: Node2D
var waypoints: PackedVector2Array = PackedVector2Array()

var _queue: Array = []
var _elapsed: float = 0.0
var _alive: int = 0


func start(container: Node2D, path_points: PackedVector2Array) -> void:
	enemy_container = container
	waypoints = path_points
	wave_index = 0
	_alive = 0
	_queue.clear()
	phase = Phase.BUILD
	build_total = float(GameData.setting("first_build_time", 20.0))
	build_remaining = build_total
	build_time_changed.emit(build_remaining, build_total)


func _process(delta: float) -> void:
	if not Game.running or phase == Phase.DONE:
		return
	if phase == Phase.BUILD:
		build_remaining = maxf(0.0, build_remaining - delta)
		build_time_changed.emit(build_remaining, build_total)
		if build_remaining <= 0.0:
			_begin_wave()
		return
	_elapsed += delta
	while not _queue.is_empty() and float(_queue[0]["time"]) <= _elapsed:
		var entry: Dictionary = _queue.pop_front()
		_spawn(str(entry["type"]))
	if _queue.is_empty() and _alive <= 0:
		_finish_wave()


## Chamar a onda antes do tempo rende ouro extra (GDD §22).
func call_wave_early() -> int:
	if phase != Phase.BUILD:
		return 0
	var bonus := int(round(build_remaining * float(GameData.setting("early_call_bonus_per_second", 2))))
	if bonus > 0:
		Economy.earn(bonus)
	_begin_wave()
	return bonus


func _begin_wave() -> void:
	var data := GameData.wave(wave_index)
	if data.is_empty():
		_declare_victory()
		return
	phase = Phase.RUNNING
	_elapsed = 0.0
	_queue.clear()
	for group_variant in data.get("groups", []):
		var group: Dictionary = group_variant as Dictionary
		var start_delay := float(group.get("delay", 0.0))
		var interval := float(group.get("interval", 0.8))
		var count := int(group.get("count", 1))
		for i in count:
			_queue.append({ "type": str(group.get("type", "goblin")), "time": start_delay + float(i) * interval })
	_queue.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a["time"]) < float(b["time"]))
	wave_started.emit(wave_index + 1, GameData.wave_count(), bool(data.get("boss", false)))


func _spawn(type_id: String) -> void:
	if enemy_container == null:
		return
	var enemy := Enemy.new()
	enemy_container.add_child(enemy)
	enemy.setup(type_id, waypoints, _hp_multiplier())
	_register(enemy)


func _register(enemy: Enemy) -> void:
	enemy.killed.connect(_on_enemy_killed)
	enemy.leaked.connect(_on_enemy_leaked)
	enemy.split_spawned.connect(_register)
	_alive += 1


## Dificuldade cresce suavemente ao longo das ondas (GDD §21).
func _hp_multiplier() -> float:
	return 1.0 + float(wave_index) * 0.06


func _on_enemy_killed(enemy: Enemy) -> void:
	_alive -= 1
	Economy.earn(enemy.bounty)


func _on_enemy_leaked(enemy: Enemy) -> void:
	_alive -= 1
	Game.damage_base(enemy.leak_damage)


func _finish_wave() -> void:
	var reward := int(GameData.setting("wave_clear_bonus", 20)) + wave_index * int(GameData.setting("wave_clear_bonus_per_wave", 4))
	Economy.earn(reward)
	wave_cleared.emit(wave_index + 1, reward)
	wave_index += 1
	if wave_index >= GameData.wave_count():
		_declare_victory()
		return
	phase = Phase.BUILD
	build_total = float(GameData.setting("build_time", 15.0))
	build_remaining = build_total
	build_time_changed.emit(build_remaining, build_total)


func _declare_victory() -> void:
	phase = Phase.DONE
	all_waves_cleared.emit()
	Game.declare_victory()
