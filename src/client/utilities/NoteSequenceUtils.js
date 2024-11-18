function convertChronologyToNoteSequence(chronology) {

  const noteSequence = []
  const setStarts = []
  const setEnds = []

  let msDate = 0;
  let boundaryCounter = 0; // keep track of set starts and ends
  const noteMap = new Map()
  // We use this map to keep a stack of note ons/off for a give note/pitch.
  // We could instead store arrays of the notes and calculate their size,
  // But this way is easier to read, so I favor it.
  const noteCountMap = new Map()

  // Incidentally : this code will unavoidably be very similar to that
  // of the AllNoteEventsAnalyzer.

  chronology.forEach(set => {
    msDate += set.dt;

    const isStartingSet = set.type === "start"
    if(isStartingSet) setStarts.push(boundaryCounter)

    const setLength = set.events.length

    set.events.forEach((note, index) => {

      const mapKey = noteMapKey(note)
      const noteCounter = noteCountMap.get(mapKey) || 0

      // In a file with no duplicate note ons, when noteMap has the mapKey,
      // it will always be because noteCounter === 1
      // (<=> we're encountering the note off for the singular stacked note on).

      // If the file *has* duplicate note ons,
      // any new note on must still be pushed,
      // regardless of how many have been stacked (or we lose notes).

      // But in all cases, a note off can only trigger a push
      // if it's the last one in a stack — i.e. : if noteCounter === 1.
      // In other words : the final on in a stack of multiples
      // will be terminated by as many offs as there were on's before it.

      const shouldPushNote = noteMap.has(mapKey) && (note.on || noteCounter === 1)

      if(shouldPushNote) {
        const timedNote = noteMap.get(mapKey)
        timedNote.endTime = msDate * 0.001
        noteSequence.push(timedNote)
      }

      if(note.on) {
        boundaryCounter++;
        const timedNote = { startTime: msDate * 0.001, ...note }
        noteMap.set(mapKey, timedNote)
        noteCountMap.set(mapKey, noteCounter+1)
      }

      else {
        if(noteCounter - 1 === 0 ) { // final note on in this stack
          noteCountMap.delete(mapKey)
          noteMap.delete(mapKey)
        }
        // Unstack note offs one by one. Every duplicate note on should have a matching amount of note offs.
        // (Else we have notes that never end...)
        else noteCountMap.set(mapKey, noteCounter - 1)
      }

      if(isStartingSet && index === setLength - 1) setEnds.push(boundaryCounter - 1)
    })
  })

  // Add the supplementary intra-set pitch order,
  // To ensure the exactitude of indices given by the MusicXML parser.

  noteSequence.sort((noteA, noteB) => {
    if(noteA.startTime !== noteB.startTime)
      return noteA.startTime - noteB.startTime

    else return noteA.pitch - noteB.pitch
  })

  noteSequence.forEach((note, index) => note.index = index)

  return {
    noteSequence: noteSequence,
    setStarts: setStarts,
    setEnds: setEnds
  }
}

function noteMapKey(nsNote) {
  return `p${nsNote.pitch}c${nsNote.channel}`
}

export {
  noteMapKey,
  convertChronologyToNoteSequence
}
