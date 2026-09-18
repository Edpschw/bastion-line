extends Node
## Controla o ouro do jogador (GDD §22).

signal gold_changed(gold: int)

var gold: int = 0


func reset(starting_gold: int) -> void:
	gold = starting_gold
	gold_changed.emit(gold)


func can_afford(cost: int) -> bool:
	return gold >= cost


func spend(cost: int) -> bool:
	if not can_afford(cost):
		return false
	gold -= cost
	gold_changed.emit(gold)
	return true


func earn(amount: int) -> void:
	gold += amount
	gold_changed.emit(gold)
