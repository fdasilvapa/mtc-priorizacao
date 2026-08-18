import { describe, expect, test } from 'bun:test'
import { stepValue } from './step-value'

describe('stepValue', () => {
  test('soma o passo', () => {
    expect(stepValue(100, 20, 0, 200)).toBe(120)
    expect(stepValue(100, -1, 0, 200)).toBe(99)
  })

  test('prende no maximo em vez de estourar', () => {
    expect(stepValue(190, 20, 0, 200)).toBe(200)
  })

  test('prende no minimo em vez de ficar negativo', () => {
    expect(stepValue(10, -20, 0, 200)).toBe(0)
  })

  test('ja no limite, o passo nao muda nada', () => {
    expect(stepValue(200, 20, 0, 200)).toBe(200)
    expect(stepValue(0, -1, 0, 200)).toBe(0)
  })

  test('valor fora da faixa e trazido para dentro', () => {
    // Defesa contra o campo digitavel: o usuario pode colar 999.
    expect(stepValue(999, 0, 0, 200)).toBe(200)
    expect(stepValue(-5, 0, 0, 200)).toBe(0)
  })

  test('valor nao numerico parte do minimo', () => {
    // O campo digitavel devolve NaN quando o usuario digita algo como "-".
    // Normalizar (passo 0) leva ao minimo — e para isso que o onBlur chama a
    // funcao. Com passo, o passo se aplica a partir do minimo.
    expect(stepValue(Number.NaN, 0, 0, 200)).toBe(0)
    expect(stepValue(Number.NaN, 20, 0, 200)).toBe(20)
  })
})
