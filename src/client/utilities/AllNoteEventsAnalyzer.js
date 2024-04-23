/*
 * allNoteEvents must be an array containing objects of the form :
 * {
 *   tickDate (integer),
 *   type ('note' || 'tempo'),
 *   on (bool),
 *   track (integer),
 *   channel (integer),
 *   noteNumber (integer),
 *   velocity (integer)
 * }
 */

class AllNoteEventsAnalyzer {
  constructor() {}

  analyze(allNoteEvents) {
    const notesBuffer = new Map();

    for (let i = 0; i < allNoteEvents.length; ++i) {
      const e = allNoteEvents[i];
      // if (e.type !== 'note') continue;

      // console.log('iterating');

      const { on, track, channel, noteNumber } = e;
      const k = JSON.stringify({ track, channel, noteNumber });

      if (on) {
        if (notesBuffer.has(k)) {
          const cnt = notesBuffer.get(k);
          notesBuffer.set(k, cnt + 1);
          console.error(`${cnt} duplicate note ons !!!!!!!!!!!!!!!!`);
        } else {
          console.log("adding note " + k);
          notesBuffer.set(k, 1);
        }
      } else {
        if (notesBuffer.has(k)) {
          const cnt = notesBuffer.get(k);
          console.log("removing note " + k);
          if (cnt === 1) {
            notesBuffer.delete(k);
          } else {
            notesBuffer.set(k, cnt - 1);
          }
        } else {
          console.error('error : orphan note off' + k);
        }
      }
    }
  }
}

export default AllNoteEventsAnalyzer;