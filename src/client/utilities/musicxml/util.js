import {
  DEFAULT_DELTA,
  DEFAULT_TEMPO,

  MICROSECONDS_PER_MINUTE
} from './constants'

export function getTempoEvent(xmlSound, currentDelta) {
  return {
    delta: currentDelta,
    setTempo : {
      // MusicXML tempo is defined in quarter notes per minute,
      // We want it in microseconds per quarter note.
      microsecondsPerQuarter: MICROSECONDS_PER_MINUTE / parseInt(xmlSound.tempo, 10)
    }
  }
}

export function getChannelChangePseudoEvent(channel, delta) {
  return {
    channel: channel,
    delta: delta
  }
}

export function isArpeggiatedChordNote(xmlNote, checkChord = false) {
  return (!checkChord || !!xmlNote?.chord) && xmlNote?.notations?.find(notation => !!notation.arpeggiates)
}
