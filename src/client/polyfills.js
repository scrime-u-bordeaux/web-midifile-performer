export function setDifferencePolyfill(otherSet) {
  return new Set([...this.values()].filter(value => !otherSet.has(value)))
}
