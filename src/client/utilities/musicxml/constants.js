// Our underlying parsing library tasked with converting MusicXML to JSON always provides a dynamics value for notes.
// This means we cannot distinguish between notes that carry it or not to apply local override of dynamics from the notated value.
// Until this is fixed (an issue has been opened at https://github.com/jocelyn-stericker/musicxml-interfaces/issues/17),
// we will treat notes carrying this default value as exceptions to override.
export const DEFAULT_PROVIDED_DYNAMICS = 90

// Because of this situation, for now, these two values are never returned directly.
export const DEFAULT_ON_VELOCITY = 90 // TODO : should we use this value ?
// The default velocity is generally cited as 80 = mezzoforte,
// But the MusicXML standard cites this instead.
export const DEFAULT_OFF_VELOCITY = 0

export const DEFAULT_CHANNEL = 1 // MusicXML channels are 1-indexed
export const DEFAULT_DELTA = 0

export const BASE_MIDI_PITCH = 21
export const STEPS_PER_OCTAVE = 12
export const MICROSECONDS_PER_MINUTE = 60000000

export const TIE_START = 0
export const TIE_END = 1

export const STACCATO_FLAG = 1
export const STACCATISSIMO_FLAG = 2
export const MARCATO_FLAG = 4
export const ACCENT_FLAG = 8
export const FERMATA_FLAG = 16
export const DURATION_MASK = 3
export const VELOCITY_MASK = 12
export const FERMATA_MASK = 16

export const FERMATA_HOLD = 2

export const DEFAULT_GRACE_DURATION_DOTTED = 1 / 3
export const DEFAULT_GRACE_DURATION_NORMAL = 1 / 2

export const DYN_PREVIOUS = 0
export const DYN_SFZ = 1

// Minimum timestamp difference between two note on events,
// Under which they are considered simultaneous.
// This is not used for any actual parsing,
// Just advance determination of future notesequence indices
// To transmit info the visualizer.

export const DELTA_EPSILON = 0.0000000001

export const STEP_OFFSETS = new Map(
  [
    ["a", 0],
    ["b", 2],
    ["c", 3],
    ["d", 5],
    ["e", 7],
    ["f", 8],
    ["g", 10]
  ]
)

export const VELOCITY_MAP = new Map(
  [
    ["ppppp", 5],
    ["pppp", 10],
    ["ppp", 16],
    ["sppp", [16, DYN_PREVIOUS]],
    ["pp", 33],
    ["spp", [33, DYN_PREVIOUS]],
    ["p", 49],
    ["sp", [49, DYN_PREVIOUS]],
    ["mp", 64],
    ["mf", 80],
    ["pf", 85],
    ["f", 96],
    ["fp", [96, 49]],
    ["sf", [96, DYN_PREVIOUS]],
    ["fz", DYN_SFZ],
    ["sfz", DYN_SFZ],
    ["ff", 112],
    ["sff", [112, DYN_PREVIOUS]],
    ["fff", 120],
    ["sfff", [120, DYN_PREVIOUS]],
    ["ffff", 126],
    ["fffff", 127]
  ]
)

// DISCLAIMER : many tempo values are ranges, these ranges often overlap, and sources contradict each other on their bounds.
// I'm doing my best as a non-musician to create a scale that makes sense :
// J.H. will probably be able to calibrate it better.

export const TEMPO_MAP = new Map(
  [
    ["Larghissimo", 20],
    ["Grave", 35],
    ["Lento", 40],
    ["Largo", 50],
    ["Larghetto", 60],
    ["Adagio", 70],
    ["Adagietto", 75],
    ["Andante", 80],
    ["Tranquillo", 80],
    ["Andantino", 85],
    ["Andante moderato", 95],
    ["Moderato", 110],
    ["Allegretto", 115],
    ["Allegro moderato", 120],
    ["Allegro", 140],
    ["Molto Allegro", 155],
    ["Allegro vivace", 155],
    ["Vivace", 170],
    ["Vivacissimo", 175],
    ["Allegrissimo", 175],
    ["Presto", 190],
    ["Prestissimo", 210]
  ]
)
