const fs = require('node:fs/promises');
const path = require('node:path');
const nunjucks = require('nunjucks');

const environment = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: true,
  tags: {
    variableStart: '${{',
    variableEnd: '}}',
  },
});

function isText(buffer) {
  return !buffer.subarray(0, 8192).includes(0);
}

async function filesBelow(directory) {
  const entries = await fs.readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

async function renderDirectory({source, destination, values}) {
  await fs.rm(destination, {recursive: true, force: true});

  for (const sourceFile of await filesBelow(source)) {
    const relative = path.relative(source, sourceFile);
    const renderedRelative = environment.renderString(relative, {values});
    const destinationFile = path.join(destination, renderedRelative);
    const [content, metadata] = await Promise.all([
      fs.readFile(sourceFile),
      fs.stat(sourceFile),
    ]);
    await fs.mkdir(path.dirname(destinationFile), {recursive: true});
    await fs.writeFile(
      destinationFile,
      isText(content)
        ? environment.renderString(content.toString('utf8'), {values})
        : content,
      {mode: metadata.mode},
    );
  }

  return destination;
}

function renderComponentProfile({root, profile, destination, values}) {
  return renderDirectory({
    source: path.join(root, 'skeletons/component/implementations', profile),
    destination,
    values,
  });
}

module.exports = {renderComponentProfile, renderDirectory};
