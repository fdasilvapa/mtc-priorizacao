import { describe, expect, test } from 'bun:test'
import { collapseCost } from './cost'

describe('collapseCost', () => {
  test('rank 1 e a referencia de normalizacao e vale exatamente 1', () => {
    expect(collapseCost(1)).toBe(1)
  })

  test('cresce monotonicamente do rank 1 ao 4', () => {
    const custos = [1, 2, 3, 4].map(collapseCost)
    for (let i = 1; i < custos.length; i++) {
      expect(custos[i]).toBeGreaterThan(custos[i - 1])
    }
  })

  test('reflete os custos relativos esperados', () => {
    expect(collapseCost(2)).toBeCloseTo(1.78, 2)
    expect(collapseCost(3)).toBeCloseTo(2.76, 2)
    expect(collapseCost(4)).toBeCloseTo(7.22, 2)
  })

  test('o salto do rank 4 e o maior, por causa do alpha T5', () => {
    const salto34 = collapseCost(4) - collapseCost(3)
    const salto23 = collapseCost(3) - collapseCost(2)
    expect(salto34).toBeGreaterThan(salto23)
  })

  test('lanca RangeError para rank sem custo definido', () => {
    expect(() => collapseCost(5)).toThrow(RangeError)
    expect(() => collapseCost(0)).toThrow(RangeError)
  })
})
