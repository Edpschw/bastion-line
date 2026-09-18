class_name Enemy
extends Node2D
## Inimigo genérico. Todos os atributos vêm de data/enemies/enemies.json.

signal killed(enemy: Enemy)
signal leaked(enemy: Enemy)
## Emitido para cada filhote gerado ao morrer (ex.: Slime). Quem gerencia a onda
## precisa registrar o filhote para a contagem de inimigos vivos ficar correta.
signal split_spawned(child: Enemy)

var type_id: String = ""
var display_name: String = ""
var max_hp: float = 1.0
var hp: float = 1.0
var speed: float = 60.0
var armor: float = 0.0
var bounty: int = 0
var leak_damage: int = 1
var radius: float = 18.0
var flying: bool = false
var is_boss: bool = false
var split_data: Dictionary = {}

var waypoints: PackedVector2Array = PackedVector2Array()
var wp_index: int = 1
var distance_travelled: float = 0.0
var dead: bool = false

var _sprite: Sprite2D


func setup(enemy_type: String, path_points: PackedVector2Array, hp_multiplier: float = 1.0, start_index: int = 1) -> void:
	type_id = enemy_type
	waypoints = path_points
	wp_index = clampi(start_index, 1, maxi(1, path_points.size() - 1))

	var data: Dictionary = GameData.enemy(enemy_type)
	if data.is_empty():
		push_error("Enemy: tipo desconhecido '%s'" % enemy_type)
		queue_free()
		return

	display_name = str(data.get("name", enemy_type))
	max_hp = float(data.get("hp", 10)) * hp_multiplier
	hp = max_hp
	speed = float(data.get("speed", 60))
	armor = float(data.get("armor", 0))
	bounty = int(data.get("bounty", 0))
	leak_damage = int(data.get("leak_damage", 1))
	radius = float(data.get("radius", 18))
	flying = bool(data.get("flying", false))
	is_boss = bool(data.get("boss", false))
	split_data = data.get("split", {}) as Dictionary

	if waypoints.size() > 0:
		global_position = waypoints[mini(wp_index - 1, waypoints.size() - 1)]

	_build_sprite(data)
	add_to_group("enemies")


func _build_sprite(data: Dictionary) -> void:
	var texture_path := str(data.get("sprite", ""))
	if texture_path == "" or not ResourceLoader.exists(texture_path):
		return
	var texture: Texture2D = load(texture_path)
	if texture == null:
		return
	_sprite = Sprite2D.new()
	_sprite.texture = texture
	var target_height := float(data.get("sprite_height", 54))
	var tex_height := float(texture.get_height())
	if tex_height > 0.0:
		var factor := target_height / tex_height
		_sprite.scale = Vector2(factor, factor)
	# ancora os pés do sprite no ponto do caminho
	_sprite.offset = Vector2(0, -tex_height * 0.5 + radius * 0.4)
	_sprite.modulate = Color.html(str(data.get("tint", "#ffffff")))
	add_child(_sprite)


func _process(delta: float) -> void:
	if dead or waypoints.size() < 2:
		return
	_advance(delta)
	queue_redraw()


func _advance(delta: float) -> void:
	var step := speed * delta
	while step > 0.0 and wp_index < waypoints.size():
		var target := waypoints[wp_index]
		var to_target := target - global_position
		var dist := to_target.length()
		if dist <= step:
			global_position = target
			distance_travelled += dist
			step -= dist
			wp_index += 1
		else:
			global_position += to_target / dist * step
			distance_travelled += step
			step = 0.0
	if wp_index >= waypoints.size():
		_leak()


func take_damage(amount: float, armor_pierce: float = 0.0) -> void:
	if dead:
		return
	var effective_armor: float = armor * (1.0 - clampf(armor_pierce, 0.0, 1.0))
	var applied: float = maxf(1.0, amount - effective_armor)
	hp -= applied
	if hp <= 0.0:
		_die()


func _die() -> void:
	if dead:
		return
	dead = true
	remove_from_group("enemies")
	_spawn_split()
	killed.emit(self)
	queue_free()


func _leak() -> void:
	if dead:
		return
	dead = true
	remove_from_group("enemies")
	leaked.emit(self)
	queue_free()


## Slime se divide ao morrer (GDD §18).
func _spawn_split() -> void:
	if split_data.is_empty():
		return
	var child_type := str(split_data.get("type", ""))
	if child_type == "" or GameData.enemy(child_type).is_empty():
		return
	var count := int(split_data.get("count", 2))
	var parent_node := get_parent()
	if parent_node == null:
		return
	for i in count:
		var child := Enemy.new()
		parent_node.add_child(child)
		child.setup(child_type, waypoints, 1.0, wp_index)
		child.global_position = global_position + Vector2(randf_range(-18.0, 18.0), randf_range(-12.0, 12.0))
		child.distance_travelled = distance_travelled
		split_spawned.emit(child)


func _draw() -> void:
	if dead:
		return
	var bar_width := radius * 2.2
	var bar_height := 5.0
	var top := -radius - float(GameData.enemy(type_id).get("sprite_height", 54)) * 0.62
	var origin := Vector2(-bar_width * 0.5, top)
	draw_rect(Rect2(origin, Vector2(bar_width, bar_height)), Color(0, 0, 0, 0.55))
	var ratio := clampf(hp / max_hp, 0.0, 1.0)
	var color := Color("#6fae63")
	if ratio <= 0.25:
		color = Color("#c1503d")
	elif ratio <= 0.5:
		color = Color("#d9992f")
	draw_rect(Rect2(origin, Vector2(bar_width * ratio, bar_height)), color)
