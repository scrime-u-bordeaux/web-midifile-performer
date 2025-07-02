import fs from 'fs';
import path from 'path';

class Corpora {
  constructor(publicPath = "/") {
    // this.publicPath = publicPath;
    // this.publicPath = "/Users/josephlarralde/Projects/git-repositories/machin/truc";
  }

  build(corporaDir = path.join(__dirname, 'corpora')) {
    const corporaDirs = fs.readdirSync(corporaDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== '.git')
      .sort((d1, d2) => d1.name < d2.name);

    const walkFolder = (folder, parentFolderContents = []) => {
      const fullPath = path.join(folder.path, folder.name);
      let contents = parentFolderContents.slice(0);

      const folderContents = fs.readdirSync(fullPath, { withFileTypes: true })
        .filter(f => f.isDirectory() ||
                     [ '.mxl', '.musicxml' ].indexOf(path.extname(f.name)) !== -1)
        .sort((f1, f2) => f1.name < f2.name);

      folderContents.forEach(f => {
        if (f.isDirectory()) {
          walkFolder(f, parentFolderContents);
        } else {
          const file = {
            name: f.name,
            path: f.path,
            // path: path.relative(this.publicPath, f.path),
          }
          // we mutate here so we don't need to concatenate too many arrays and
          // we only consume the final returned array containing the whole corpus
          parentFolderContents.push(file);
        }
      });

      return parentFolderContents;
    }

    const res = {};

    for (let i = 0; i < corporaDirs.length; ++i) {
      const corpusDir = corporaDirs[i];
      const corpusContents = walkFolder(corpusDir, []);
      res[corpusDir.name] = corpusContents;
    }
    return res;
  }
};

export default Corpora;