import { paseScoreHeader as parseScoreHeader } from 'musicxml-interfaces';

export default function generateDigestXmlTitle(score) {
  const xmlHeader = parseScoreHeader(score);

  if (!(xmlHeader.credits && Array.isArray(xmlHeader.credits))) return null;
  console.log(xmlHeader.credits);

  let title = null;

  for (let i = 0; i < xmlHeader.credits.length; ++i) {
    const { creditTypes, creditWords } = xmlHeader.credits[i];
    if (Array.isArray(creditTypes) && creditTypes.includes('title')) {
      if (title === null) {
        title = creditWords[0].words;
      } else {
        title += ' ' + creditWords[0].words;
      }
    }
    if (Array.isArray(creditWords) && creditWords.length > 0) {
      if (title === null) {
        title = creditWords[0].words;
      } else {
        title += ' ' + creditWords[0].words;
      }
    }
  }
  
  return title;
}
