extends Node2D
## Monta o mapa, liga os sistemas e trata a construção/seleção de torres.

const SLOT_RADIUS := 30.0

var waypoints: PackedVector2Array = PackedVector2Array()
var build_slots: Array[Dictionary] = []

var _enemy_layer: Node2D
var _tower_layer: Node2D
var _map_layer: Node2D
var _hud: HUD
var _waves: WaveManager

var _pending_tower_id: String = ""
var _selected_tower: Tower = null


func _ready() -> void:
	randomize()
	_build_scene_tree()
	_load_map()
	_connect_signals()
	_start_match()
	var user_args := OS.get_cmdline_user_args()
	if user_args.has("--smoke"):
		var runner := SmokeRunner.new()
		runner.main = self
		runner.rush_waves = user_args.has("--rush")
		add_child(runner)


func _build_scene_tree() -> void:
	_map_layer = Node2D.new()
	_map_layer.name = "Map"
	_map_layer.draw.connect(_draw_map)
	add_child(_map_layer)

	_tower_layer = Node2D.new()
	_tower_layer.name = "Towers"
	add_child(_tower_layer)

	_enemy_layer = Node2D.new()
	_enemy_layer.name = "Enemies"
	add_child(_enemy_layer)

	_waves = WaveManager.new()
	_waves.name = "WaveManager"
	add_child(_waves)

	_hud = HUD.new()
	_hud.name = "HUD"
	add_child(_hud)


func _load_map() -> void:
	waypoints = PackedVector2Array()
	for point_variant in GameData.map.get("path", []):
		var point: Array = point_variant as Array
		if point.size() >= 2:
			waypoints.append(Vector2(float(point[0]), float(point[1])))

	build_slots.clear()
	for slot_variant in GameData.map.get("build_slots", []):
		var slot: Array = slot_variant as Array
		if slot.size() >= 2:
			build_slots.append({ "position": Vector2(float(slot[0]), float(slot[1])), "tower": null })


func _connect_signals() -> void:
	Economy.gold_changed.connect(_on_gold_changed)
	Game.base_hp_changed.connect(_on_base_hp_changed)
	Game.game_finished.connect(_on_game_finished)

	_waves.wave_started.connect(_on_wave_started)
	_waves.wave_cleared.connect(_on_wave_cleared)
	_waves.build_time_changed.connect(_on_build_time_changed)

	_hud.tower_selected_for_build.connect(_on_build_selection)
	_hud.upgrade_requested.connect(_on_upgrade_requested)
	_hud.sell_requested.connect(_on_sell_requested)
	_hud.call_wave_requested.connect(_on_call_wave)
	_hud.restart_requested.connect(_on_restart)


func _start_match() -> void:
	for slot in build_slots:
		var tower := slot["tower"] as Tower
		if tower != null and is_instance_valid(tower):
			tower.queue_free()
		slot["tower"] = null
	for child in _enemy_layer.get_children():
		child.queue_free()

	_pending_tower_id = ""
	_selected_tower = null
	_hud.hide_tower()
	_hud.hide_result()
	_hud.clear_build_selection()

	Economy.reset(int(GameData.setting("starting_gold", 260)))
	Game.reset(int(GameData.setting("base_hp", 20)))
	_hud.set_wave(0, GameData.wave_count())
	_waves.start(_enemy_layer, waypoints)
	_map_layer.queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click == null or not click.pressed or click.button_index != MOUSE_BUTTON_LEFT:
		return
	var world_position := get_global_mouse_position()
	var slot_index := _slot_at(world_position)
	if slot_index < 0:
		_select_tower(null)
		return
	var slot := build_slots[slot_index]
	var existing := slot["tower"] as Tower
	if existing != null and is_instance_valid(existing):
		_select_tower(existing)
		return
	if _pending_tower_id != "":
		_try_build(slot_index, _pending_tower_id)


func _slot_at(world_position: Vector2) -> int:
	for i in build_slots.size():
		if build_slots[i]["position"].distance_to(world_position) <= SLOT_RADIUS:
			return i
	return -1


func _try_build(slot_index: int, tower_id: String) -> void:
	var def := GameData.tower(tower_id)
	var cost := int(def.get("cost", 0))
	if not Economy.spend(cost):
		_hud.set_status("Ouro insuficiente")
		return
	var tower := Tower.new()
	_tower_layer.add_child(tower)
	tower.setup(tower_id)
	tower.global_position = build_slots[slot_index]["position"]
	build_slots[slot_index]["tower"] = tower
	_pending_tower_id = ""
	_hud.clear_build_selection()
	_select_tower(tower)
	_map_layer.queue_redraw()


func _select_tower(tower: Tower) -> void:
	if _selected_tower != null and is_instance_valid(_selected_tower):
		_selected_tower.show_range = false
		_selected_tower.queue_redraw()
	_selected_tower = tower
	if tower == null:
		_hud.hide_tower()
		return
	tower.show_range = true
	tower.queue_redraw()
	_hud.show_tower(tower)


func _on_build_selection(tower_id: String) -> void:
	_pending_tower_id = tower_id
	if tower_id != "":
		_select_tower(null)
	_map_layer.queue_redraw()


func _on_upgrade_requested(option_id: String) -> void:
	if _selected_tower == null or not is_instance_valid(_selected_tower):
		return
	if _selected_tower.upgrade_to(option_id):
		_hud.show_tower(_selected_tower)
	else:
		_hud.set_status("Ouro insuficiente")


func _on_sell_requested() -> void:
	if _selected_tower == null or not is_instance_valid(_selected_tower):
		return
	Economy.earn(_selected_tower.sell_value())
	for slot in build_slots:
		if slot["tower"] == _selected_tower:
			slot["tower"] = null
	_selected_tower.queue_free()
	_select_tower(null)
	_map_layer.queue_redraw()


func _on_call_wave() -> void:
	var bonus := _waves.call_wave_early()
	if bonus > 0:
		_hud.set_status("Onda antecipada +%dg" % bonus)


func _on_restart() -> void:
	_start_match()


func _on_gold_changed(value: int) -> void:
	_hud.set_gold(value)
	if _selected_tower != null and is_instance_valid(_selected_tower):
		_hud.show_tower(_selected_tower)


func _on_base_hp_changed(hp: int, max_hp: int) -> void:
	_hud.set_base_hp(hp, max_hp)


func _on_wave_started(index: int, total: int, is_boss: bool) -> void:
	_hud.set_wave(index, total)
	_hud.set_status("BOSS!" if is_boss else "Onda em curso")
	_hud.set_call_enabled(false)


func _on_wave_cleared(index: int, reward: int) -> void:
	_hud.set_status("Onda %d limpa +%dg" % [index, reward])


func _on_build_time_changed(remaining: float, _total: float) -> void:
	if _waves.phase == WaveManager.Phase.BUILD:
		_hud.set_status("Construcao %ds" % int(ceil(remaining)))
		_hud.set_call_enabled(true)


func _on_game_finished(victory: bool) -> void:
	_hud.show_result(victory, _waves.wave_index + 1)
	_hud.set_call_enabled(false)


func _draw_map() -> void:
	var canvas := _map_layer
	var viewport_size := Vector2(
		float(GameData.map.get("viewport", {}).get("width", 720)),
		float(GameData.map.get("viewport", {}).get("height", 1280))
	)
	canvas.draw_rect(Rect2(Vector2.ZERO, viewport_size), Color("#26301b"))

	var path_width := float(GameData.map.get("path_width", 96))
	for i in range(waypoints.size() - 1):
		canvas.draw_line(waypoints[i], waypoints[i + 1], Color("#4a463c"), path_width)
		canvas.draw_circle(waypoints[i + 1], path_width * 0.5, Color("#4a463c"))

	var base_data: Array = GameData.map.get("base", [360, 1240]) as Array
	var base_position := Vector2(float(base_data[0]), float(base_data[1]))
	canvas.draw_circle(base_position, 46.0, Color("#7c5a22"))
	canvas.draw_arc(base_position, 46.0, 0.0, TAU, 48, Color("#d9992f"), 3.0)

	for slot in build_slots:
		var occupied := slot["tower"] != null and is_instance_valid(slot["tower"])
		if occupied:
			continue
		var highlight := _pending_tower_id != ""
		var fill := Color(1, 1, 1, 0.16) if highlight else Color(1, 1, 1, 0.07)
		canvas.draw_circle(slot["position"], SLOT_RADIUS * 0.62, fill)
		canvas.draw_arc(slot["position"], SLOT_RADIUS * 0.62, 0.0, TAU, 28, Color(1, 1, 1, 0.3 if highlight else 0.14), 2.0)
