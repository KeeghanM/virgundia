import { Canvas } from '../../lib/canvas'
import { EventSystem } from '../../lib/eventSystem'
import { ServiceContainer } from '../../lib/serviceContainer'
import { StateManager } from '../../lib/stateManager'
import { Window } from '../../lib/window'
import {
  GameEvents,
  type GameConfig,
  type GameState,
  type Position,
} from './index.t'
import { Player } from './entity/player'
import { World } from './world'
import { MONSTERS, type Monster } from './dataFiles/monsters'

export class Game {
  private container: ServiceContainer
  private cellsAcross: number
  private cellsDown: number

  constructor(config: GameConfig) {
    // Initialize service container
    this.container = new ServiceContainer()

    // Setup canvas
    const gameContainer = document.querySelector(
      config.canvasSelector
    ) as HTMLDivElement
    if (!gameContainer) throw new Error('Game container not found')

    const canvas = new Canvas(gameContainer, config.width, config.height)
    this.cellsAcross = Math.floor(config.width / canvas.fontSize) + 1
    this.cellsDown = Math.floor(config.height / canvas.fontSize) + 1

    // Initialize core services
    const stateManager = new StateManager(this.createInitialState())
    const eventSystem = new EventSystem()
    const world = new World(this.container)

    // Register all services
    this.container.register('canvas', canvas)
    this.container.register('state', stateManager)
    this.container.register('events', eventSystem)
    this.container.register('world', world)
    this.container.register('player', new Player(this.container))

    // Setup event listeners and subscriptions
    this.setupEventListeners()
  }

  private createInitialState(): GameState {
    return {
      player: {
        abilities: new Set(),
        conditions: new Set(),
        energy: 100,
        health: 100,
        maxEnergy: 100,
        maxHealth: 100,
        position: { x: 0, y: 0 },
        requirements: new Set(),
        warned: false,
        xp: 0,
      },
      ui: {
        isPaused: false,
        windows: [],
      },
      world: {
        currentBiome: null,
        currentTerrain: null,
      },
    }
  }

  private setupEventListeners() {
    const events = this.container.get<EventSystem>('events')
    const state = this.container.get<StateManager>('state')

    // Handle keyboard input
    document.addEventListener('keydown', (e) => {
      if (state.getState().ui.isPaused) return
      this.handleKeyPress(e)
    })

    // Subscribe to game events
    events.on(GameEvents.PLAYER_MOVE, () => {
      this.checkForEncounters()
      this.updatePlayerWorldInfo()
      this.draw()
    })

    events.on(GameEvents.WINDOW_OPEN, (windowData) => {
      this.pause()
      new Window(windowData, this.container)
    })

    events.on(GameEvents.WINDOW_CLOSE, () => {
      this.resume()
      this.draw()
    })

    // Subscribe to state changes
    state.subscribe(() => {
      this.draw()
    })
  }

  private handleKeyPress(e: KeyboardEvent) {
    const player = this.container.get<Player>('player')
    const state = this.container.get<StateManager>('state')

    if (state.getState().ui.isPaused) return

    switch (e.key) {
      case 'ArrowLeft':
        player.move(-1, 0)
        break
      case 'ArrowRight':
        player.move(1, 0)
        break
      case 'ArrowUp':
        player.move(0, -1)
        break
      case 'ArrowDown':
        player.move(0, 1)
        break
      case 'r':
        player.rest()
        break
      case 'i':
        player.openInventory()
        break
      case 's':
        player.search()
        break
      case 'h':
        this.help()
        break
      case 'Escape':
        this.help()
        break
    }
  }

  private screenToWorld(screenX: number, screenY: number): Position {
    const state = this.container.get<StateManager>('state')
    const { position: playerPos } = state.getState().player
    const screenCenterX = Math.floor(this.cellsAcross / 2)
    const screenCenterY = Math.floor(this.cellsDown / 2)

    return {
      x: screenX - screenCenterX + playerPos.x,
      y: screenY - screenCenterY + playerPos.y,
    }
  }

  private updatePlayerWorldInfo() {
    const state = this.container.get<StateManager>('state')
    const world = this.container.get<World>('world')
    const { position } = state.getState().player

    const { terrain, biomeName } = world.getTerrain(position.x, position.y)

    state.dispatch('world', {
      currentBiome: biomeName,
      currentTerrain: terrain,
    })
  }

  private async checkForEncounters() {
    const state = this.container.get<StateManager>('state')
    const events = this.container.get<EventSystem>('events')
    const currentState = state.getState()

    if (!currentState.world.currentTerrain) return

    const encounterChance = currentState.world.currentTerrain.difficulty / 10
    if (Math.random() > encounterChance) return

    const validMonsters: Monster[] = Object.values(MONSTERS).filter(
      (monster) =>
        monster.validBiomes.length === 0 ||
        monster.validBiomes.includes(currentState.world.currentBiome)
    )

    // Find the rarest monster's rarity value
    const highestRarity = Math.max(...validMonsters.map((m) => m.rarity))

    // Get total weight (inverted relative to highest rarity)
    const totalWeight = validMonsters.reduce(
      (sum, monster) => sum + (highestRarity - monster.rarity + 1),
      0
    )

    const roll = Math.random() * totalWeight

    // Find the monster that matches our roll
    let currentWeight = 0
    const chosenMonster =
      validMonsters.find((monster) => {
        currentWeight += highestRarity - monster.rarity + 1
        return roll < currentWeight
      }) || validMonsters[0]
    const monster = {
      abilities: chosenMonster.abilities,
      aggression: chosenMonster.aggression,
      behavior: chosenMonster.behavior,
      description: chosenMonster.description,
      intelligence: chosenMonster.intelligence,
      level: Math.round(
        Math.random() * (chosenMonster.maxLevel - chosenMonster.minLevel) +
          chosenMonster.minLevel
      ),
      lore: chosenMonster.lore,
      maxHealth: 0, // Placeholder
      name: chosenMonster.name,
      size: chosenMonster.size,
    }
    monster.maxHealth = monster.level * chosenMonster.baseHealth

    // Get the surrounding terrain
    const world = this.container.get<World>('world')
    const currentTerrain = `${currentState.player.position.x},${currentState.player.position.y}: ${currentState.world.currentBiome} ${currentState.world.currentTerrain.type}`
    const surroundingTerrain = world
      .getAdjacentTerrain(
        currentState.player.position.x,
        currentState.player.position.y,
        2
      )
      .map(
        (t) => `${t.x},${t.y}: ${t.terrain.biomeName} ${t.terrain.terrain.type}`
      )

    const encounterDescription = await this.generateAi(
      JSON.stringify({
        currentTerrain,
        monster,
        playerState: currentState.player,
        surroundingTerrain,
      })
    )

    events.emit(GameEvents.WINDOW_OPEN, {
      buttons: [{ label: 'Close' }],
      content: [encounterDescription],
      title: 'Encounter!',
    })
  }

  private draw() {
    const canvas = this.container.get<Canvas>('canvas')
    const world = this.container.get<World>('world')
    const player = this.container.get<Player>('player')

    // Clear and set background
    canvas.clear()
    canvas.bg('black')

    const screenCenterX = Math.floor(this.cellsAcross / 2)
    const screenCenterY = Math.floor(this.cellsDown / 2)

    // Draw world
    canvas.setFont(canvas.fontSize, 'ui-monospace')
    for (let screenX = 0; screenX < this.cellsAcross; screenX++) {
      for (let screenY = 0; screenY < this.cellsDown; screenY++) {
        const { x: worldX, y: worldY } = this.screenToWorld(screenX, screenY)
        const { terrain } = world.getTerrain(worldX, worldY)

        if (screenX === screenCenterX && screenY === screenCenterY) {
          continue // Skip player position
        }

        canvas.setColor(terrain.color)
        canvas.text(
          terrain.label,
          screenX * canvas.fontSize,
          screenY * canvas.fontSize
        )
      }
    }

    // Draw player
    player.draw(
      canvas,
      screenCenterX * canvas.fontSize,
      screenCenterY * canvas.fontSize
    )

    // Draw UI
    this.drawUI()
  }

  private drawUI() {
    const state = this.container.get<StateManager>('state').getState()
    const canvas = this.container.get<Canvas>('canvas')
    const player = this.container.get<Player>('player')

    const uiText = `Biome: ${state.world.currentBiome}
    Terrain: ${state.world.currentTerrain?.type}
    Energy: ${state.player.energy}/${state.player.maxEnergy}
    Health: ${state.player.health}/${state.player.maxHealth}
    Level: ${player.getLevel()} (${state.player.xp.toLocaleString()}xp)
    Conditions: ${player.showConditions()}`

    // Draw UI background
    canvas.setColor('#cfbca9')
    canvas.rect(0, 0, canvas.width, canvas.fontSize * 2)
    canvas.setColor('#5d2d00')
    canvas.rect(0, canvas.fontSize * 2, canvas.width, 4)

    // Draw UI text
    canvas.setColor('black')
    canvas.setFont(20, 'ui-monospace')
    canvas.text(uiText, canvas.fontSize, canvas.fontSize * 1.3)
  }

  private help() {
    const events = this.container.get<EventSystem>('events')

    events.emit(GameEvents.WINDOW_OPEN, {
      buttons: [{ label: 'Close' }],
      content: [
        'Arrow Keys: Movement',
        'R: Rest',
        'S: Search',
        'B: Build',
        'E: Enter/Explore',
        'I: Open Inventory',
        'P: Show Player',
        'H: Help',
        'Esc: Settings',
        '',
        'The bar along the top contains all your player stats, but for more details you can open the player pane with P. Explore the world, avoid the dangers.',
        'Be careful.',
      ],
      title: 'Help & Controls',
    })
  }

  start() {
    const state = this.container.get<StateManager>('state')
    state.dispatch('ui', { isPaused: false })
    this.updatePlayerWorldInfo()
    this.draw()
  }

  pause() {
    const state = this.container.get<StateManager>('state')
    state.dispatch('ui', { isPaused: true })
  }

  resume() {
    const state = this.container.get<StateManager>('state')
    state.dispatch('ui', { isPaused: false })
    this.draw()
  }

  async generateAi(prompt: string) {
    this.pause()
    const resp = await fetch('/api/gen', {
      body: JSON.stringify({ prompt }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const data = await resp.json()
    this.resume()
    return data.text
  }

  // Method to access the service container (useful for testing and debugging)
  getContainer() {
    return this.container
  }
}
