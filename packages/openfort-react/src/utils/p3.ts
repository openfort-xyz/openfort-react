export const hexToP3 = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  const [, red, green, blue] = result ?? []
  if (!red || !green || !blue) return hex
  const values = {
    r: parseInt(red, 16),
    g: parseInt(green, 16),
    b: parseInt(blue, 16),
  }
  return `color(display-p3 ${values.r / 255} ${values.g / 255} ${values.b / 255})`
}
