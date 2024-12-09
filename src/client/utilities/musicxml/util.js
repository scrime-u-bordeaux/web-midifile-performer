export function getChannelChangePseudoEvent(channel, delta) {
  return {
    channel: channel,
    delta: delta
  }
}

export function isArpeggiatedChordNote(xmlNote, checkChord = false) {
  return (!checkChord || !!xmlNote?.chord) && xmlNote?.notations?.find(notation => !!notation.arpeggiates)
}
