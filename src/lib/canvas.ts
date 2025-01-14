export class Canvas {
  active: boolean
  container: HTMLDivElement | null
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  color: string
  fontSize: number
  font: string
  width: number
  height: number

  constructor(selector: string, width: number, height: number) {
    this.active = false
    this.container = document.querySelector(selector)
    if (!this.container) {
      throw new Error('Container not found')
    }
    this.canvas = document.createElement('canvas')
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas context not found')
    }
    this.ctx = ctx

    this.container.appendChild(this.canvas)
    this.canvas.width = width
    this.canvas.height = height
    this.width = width
    this.height = height

    this.color = 'black'
    this.fontSize = 16
    this.font = `${this.fontSize}px ui-monospace`

    document.addEventListener('click', (e) => {
      if (e.target === this.canvas) {
        this.active = true
      } else {
        this.active = false
      }
    })
  }

  clear() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
  }

  bg(color?: string) {
    this.ctx.fillStyle = color ?? this.color
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
  }

  setColor(color: string) {
    this.color = color
  }
  setFont(size: number, name: string, style?: string) {
    this.font = `${size}px ${name} ${style}`
  }

  rect(x: number, y: number, width: number, height: number) {
    this.ctx.fillStyle = this.color
    this.ctx.fillRect(x, y, width, height)
  }

  text(text: string, x: number, y: number) {
    this.ctx.fillStyle = this.color
    this.ctx.font = this.font
    this.ctx.fillText(text, x, y)
  }
}
