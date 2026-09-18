class_name Projectile
extends Node2D
## Projétil simples: viaja até o alvo e aplica dano (com área opcional).

var target: Enemy
var target_position: Vector2 = Vector2.ZERO
var damage: float = 0.0
var splash: float = 0.0
var armor_pierce: float = 0.0
var speed: float = 800.0
var color: Color = Color.WHITE


func setup(from: Vector2, to_enemy: Enemy, dmg: float, splash_radius: float, pierce: float, projectile_speed: float, tint: Color) -> void:
	global_position = from
	target = to_enemy
	target_position = to_enemy.global_position if to_enemy != null else from
	damage = dmg
	splash = splash_radius
	armor_pierce = pierce
	speed = projectile_speed
	color = tint


func _process(delta: float) -> void:
	if target != null and is_instance_valid(target) and not target.dead:
		target_position = target.global_position
	var to_target := target_position - global_position
	var step := speed * delta
	if to_target.length() <= step:
		global_position = target_position
		_impact()
		return
	global_position += to_target.normalized() * step
	queue_redraw()


func _impact() -> void:
	if splash > 0.0:
		var splash_sq := splash * splash
		for node in get_tree().get_nodes_in_group("enemies"):
			var enemy := node as Enemy
			if enemy == null or enemy.dead:
				continue
			if global_position.distance_squared_to(enemy.global_position) <= splash_sq:
				enemy.take_damage(damage, armor_pierce)
	elif target != null and is_instance_valid(target) and not target.dead:
		target.take_damage(damage, armor_pierce)
	queue_free()


func _draw() -> void:
	draw_circle(Vector2.ZERO, 5.0, color)
	draw_circle(Vector2.ZERO, 2.5, color.lightened(0.6))
