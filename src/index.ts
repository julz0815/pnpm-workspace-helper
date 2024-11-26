import * as fs from 'fs'
import * as path from 'path'
import chalk from 'chalk'
import program from 'commander-plus'
import { execSync }  from 'child_process';

program
    .usage('--folder <option> --intRepoPrefix <option> --repoName <option>')
    .option('--folder <folder>', 'folder path to run on')
    .option('--intRepoPrefix <prefix>', 'the prefix to idenfiy internal node modules, maybe behind a nexus')
    .option('--repoName <name>', 'the name of the repo to exclude selfreferencing modules')
    .parse(process.argv)

let missingRequiredArg = false
const printMissingArg = (details: string) => console.error(chalk.red('Missing argument:'), details)

if (!program.folder) {
    printMissingArg('--folder <folder>')
    missingRequiredArg = true
}

if (missingRequiredArg) {
    program.help()
}

//read the workspaces from the package.json
const workspaces = require(program.folder+'/package.json').workspaces;
//const workspaces = require(program.folder+'/package.json').workspaces.packages;

console.log(chalk.green(`\n## Running on ${program.folder}...`));
console.log(chalk.green(`\n## Workspaces: ${JSON.stringify(workspaces)}`));

// Read the .npmrc file and find all registry entries that start with @
const npmrc = fs.readFileSync(`${program.folder}/.npmrc`, 'utf8');
const registryEntries = npmrc.match(/^@.*registry=.*$/gm);

var registryName: string[] = [];
if (registryEntries) {
    registryEntries.forEach((entry, index) => {
        const registryUrl = entry.split(':')[0];
        console.log(chalk.green(`\n## found internal registry on .mpmrc: ${registryUrl}`));
        registryName.push(registryUrl);
    });
} else {
    console.log(chalk.red('No registry entries found in .npmrc file.'));
}


function findSubfolders(folderPath) {
    try {
        // Read the contents of the folder
        const files = fs.readdirSync(folderPath);

        // Filter out subfolders
        const subfolders = files.filter(file => {
            const fullPath = path.join(folderPath, file);
            return fs.statSync(fullPath).isDirectory();
        });

        return subfolders;
    } catch (err) {
        console.error(chalk.red(`Error reading folder: ${err.message}`));
        return [];
    }
}

function fileExists(filePath) {
    try {
        // Check if the file exists using fs.accessSync
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;
    } catch (err) {
        // An error indicates that the file doesn't exist
        return false;
    }
}

//remove internal node modules  

const workspaceList = Array.isArray(workspaces) ? workspaces : workspaces.packages;

//use the workspaces to run a dedicated command for each workspace

workspaceList.forEach(workspace => {
//workspaces.packages.forEach(workspace => {
    console.log(chalk.green(`\n## Running ${program.folder}/${workspace}...`));
    //remove /* from the workspace
    var myWorkspace = workspace.replace(/\/\*\*?/g,'');

    //for each subfolder run the command if the workspace holds an *
    if ( workspace.includes('/*') )  {
        
      //find subfolder in workspace
      const subfolder = findSubfolders(program.folder+'/'+myWorkspace)
      console.log(chalk.green('#### SUBFOLDER: '+JSON.stringify(subfolder)));
      subfolder.forEach(subfolder => {
        console.log(chalk.green(`#### Running ${program.folder}/${myWorkspace}/${subfolder}...`));
        //if a package.json file exists in the subfolder run the command
        if ( fileExists(`${program.folder}/${myWorkspace}/${subfolder}/package.json`) ) {

          //set the program variables

          var myPackage = `${program.folder}/${myWorkspace}/${subfolder}/package.json`
          var myLockfile = `${program.folder}/yarn.lock`
          var myWrite = `${program.folder}/${myWorkspace}/${subfolder}/yarn.lock`
          var myForce = 'true'

          //read package.json file and remove node modules marked as workspace includes
          let packageJson = require(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json');
          console.log(chalk.green(`\n## Rewriting ("workspace:") package.json in ${program.folder}/${myWorkspace}/${subfolder}...`));

          //remove all internal node modules
          console.log(chalk.green('\n## Removing all internal node modules...'));
          if(packageJson.dependencies){
            console.log(chalk.green('\n## in dependencies...'))
            for (const [key, value] of Object.entries(packageJson.dependencies)) {
                if((value as string).includes('workspace')){
                    console.log(chalk.green(`\n## Removing ${key} from ${program.folder}/${myWorkspace}/${subfolder}...`));
                    delete packageJson.dependencies[key];
                }
                for (const registry of registryName){
                  if((key as string).includes(registry)){                    
                    console.log(chalk.green(`\n## Removing internal ${key} from ${program.folder}/${myWorkspace}/${subfolder}...`));
                    delete packageJson.dependencies[key];
                  }
                }
            }
            
          }
          if(packageJson.peerDependencies){
            console.log(chalk.green('\n## in peerDependencies...'))
            for (const [key, value] of Object.entries(packageJson.peerDependencies)) {
                if((value as string).includes('workspace')){
                    console.log(chalk.green(`\n## Removing ${key} from ${program.folder}/${myWorkspace}/${subfolder}...`));
                    delete packageJson.peerDependencies[key];
                }
                for (const registry of registryName){
                  if((key as string).includes(registry)){
                    console.log(chalk.green(`\n## Removing ${key} from ${program.folder}/${myWorkspace}/${subfolder}...`));
                    delete packageJson.peerDependencies[key];
                  }
                }
            }
          }
          if(packageJson.devDependencies){
            console.log(chalk.green('\n## in devDependencies...'))
            for (const [key, value] of Object.entries(packageJson.devDependencies)) {
                if((value as string).includes('workspace')){
                    console.log(chalk.green(`\n## Removing ${key} from ${program.folder}/${myWorkspace}/${subfolder}...`));
                    delete packageJson.devDependencies[key];
                }
                for (const registry of registryName){
                  if((key as string).includes(registry)){
                    console.log(chalk.green(`\n## Removing ${key} from ${program.folder}/${myWorkspace}/${subfolder}...`));
                    delete packageJson.devDependencies[key];
                  }
                }
            }
          }

          //overwrite the package.json file
          fs.writeFileSync(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json', JSON.stringify(packageJson, null, 2));
          



          //read package.json file and remove internal node modules
          if ( program.intRepoPrefix != undefined) {
            let packageJson = require(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json');
            console.log(chalk.green(`\n## Rewriting (intRepoPrefix) package.json in ${program.folder}/${myWorkspace}/${subfolder}...`));
            //remove internal node modules
            if(packageJson.dependencies){
              for (const [key, value] of Object.entries(packageJson.dependencies)) {
                  if(key.includes(program.intRepoPrefix)){
                      delete packageJson.dependencies[key];
                  }
              }
            }
            //overwrite the package.json file
            fs.writeFileSync(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json', JSON.stringify(packageJson, null, 2));
          }

          if ( program.repoName != undefined) {
            let packageJson = require(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json');
            console.log(chalk.green(`\n## Rewriting devDependencies (repoName) package.json in ${program.folder}/${myWorkspace}/${subfolder}...`));
            if(packageJson.devDependencies){
              console.log(chalk.green('DevDependencies'))
              for (const [key, value] of Object.entries(packageJson.devDependencies)) {
                if( key.includes(program.repoName) ){
                    delete packageJson.devDependencies[key];
                }
              }
            }
            //overwrite the package.json file
            fs.writeFileSync(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json', JSON.stringify(packageJson, null, 2));
          }
          

          //run execsync npm install to create package-lock.json
          try {
            console.log(chalk.green(`\n## Running npm install --package-lock-only --workspaces=false --force in ${program.folder}/${myWorkspace}/${subfolder}...`));
            execSync(`cd ${program.folder}/${myWorkspace}/${subfolder} && npm i --package-lock-only --workspaces=false --force`, { stdio: 'inherit' });
          } catch (err) {
            console.error(chalk.red(`Error running npm install: ${err.message}`));
          }
        }
      })
    }
})