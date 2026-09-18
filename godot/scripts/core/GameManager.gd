extends Node
## Estado da partida: vida da base, vitória e derrota.

signal base_hp_changed(hp: int, max_hp: int)
signal game_finished(victory: bool)

var base_hp: int = 0
var max_base_hp: int = 0
var running: bool = false
var finished: bool = false
var victory: bool = false


func reset(starting_hp: int) -> void:
	max_base_hp = starting_hp
	base_hp = starting_hp
	running = true
	finished = false
	victory = false
	base_hp_changed.emit(base_hp, max_base_hp)


func damage_base(amount: int) -> void:
	if finished:
		return
	base_hp = max(0, base_hp - amount)
	base_hp_changed.emit(base_hp, max_base_hp)
	if base_hp <= 0:
		_finish(false)


func declare_victory() -> void:
	if finished:
		return
	_finish(true)


func _finish(won: bool) -> void:
	finished = true
	running = false
	victory = won
	game_finished.emit(won)
