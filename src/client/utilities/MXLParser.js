import { BlobReader, ZipReader, TextWriter } from '@zip.js/zip.js'

// This might vary based on system...bad !
// Test on Windows to see if it works !
const CONTAINER_FILENAME = 'META-INF/container.xml'

const ROOTFILE_TAG = '<rootfile'
// The rootfile tag can be or not be self-closing.
const SELF_CLOSER = '/>'
const NON_SELF_CLOSER = "</rootfile>"

export default async function getRootFileFromMxl(mxlBlob) {
  const blobReader = new BlobReader(mxlBlob)
  const zipReader = new ZipReader(blobReader)

  const zipEntries = await zipReader.getEntries()
  const containerFile = zipEntries.find(
    entry => entry.filename === CONTAINER_FILENAME
  )

  const containerFileWriter = new TextWriter()
  const containerText = await containerFile.getData(containerFileWriter)

  const rootFilePath = containerPseudoParse(containerText)
  const rootFile = zipEntries.find(
    entry => entry.filename === rootFilePath
  )
  const rootFileWriter = new TextWriter()

  return await rootFile.getData(rootFileWriter)
}

// Extracts the path of the MXL root file from container.xml.
// Admittedly, this logic is quite dirty, but it's either that or depend on an XML parser
// for this and this alone.

function containerPseudoParse(containerText) {

  const rootFileStartIndex = containerText.indexOf(ROOTFILE_TAG)
  const rootFileText = containerText.slice(rootFileStartIndex)

  // Better break these steps up, so we don't mess things up if we have another self-closing tag before ours.
  const nonSelfCloserIndex = rootFileText.indexOf(NON_SELF_CLOSER)
  const tagCloserIndex = nonSelfCloserIndex > -1 ? nonSelfCloserIndex : rootFileText.indexOf(SELF_CLOSER)
  const offsetLength = tagCloserIndex === nonSelfCloserIndex ? NON_SELF_CLOSER.length : SELF_CLOSER.length
  const closedRootFileText = rootFileText.slice(0, tagCloserIndex + offsetLength + 1)

  // closedRootFileText[0] is 'full-path=',
  // the next quote closes the full path
  // so [1] is exactly what we need.
  return closedRootFileText.split('"')[1]
}
