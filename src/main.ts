import './style.css'
import { Game } from './game.ts'
import { Hud } from './hud.ts'
import { Input } from './input.ts'

const input = new Input()
let game!: Game
const hud = new Hud((action) => game.handle(action))
game = new Game(hud, input)

void game.start()
