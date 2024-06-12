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


//use the workspaces to run a dedicated command for each workspace
workspaces.forEach(workspace => {
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

          console.log(chalk.green('###### package.json exists, create a pacakge-lock.json file'))

          //read package.json file and remove internal node modules
          if ( program.intRepoPrefix != undefined) {
            const packageJson = require(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json');
            console.log(chalk.green(`\n## Rewriting (intRepoPrefix) package.json in ${program.folder}/${myWorkspace}/${subfolder}...`));
            //remove internal node modules
            if(packageJson.dependencies){
              for (const [key, value] of Object.entries(packageJson.dependencies)) {
                  if(key.includes(program.intRepoPrefix)){
                      delete packageJson.dependencies[key];
                  }
              }
              //overwrite the package.json file
              fs.writeFileSync(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json', JSON.stringify(packageJson, null, 2));
            }
          }

          if ( program.repoName != undefined) {
            const packageJson2 = require(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json');
            console.log(chalk.green(`\n## Rewriting (repoName) package.json in ${program.folder}/${myWorkspace}/${subfolder}...`));
            if(packageJson2.devDependencies){
              console.log('packageJson2.devDependencies: '+JSON.stringify(packageJson2.devDependencies));
              for (const [key, value] of Object.entries(packageJson2.devDependencies)) {
                  console.log('key: '+key+' program.repoName: '+program.repoName+' key.includes(program.repoName): '+key.includes(program.repoName));
                  if(key.includes(program.repoName)){
                      console.log('delete key: '+key);
                      delete packageJson2.devDependencies[key];
                  }
              }
              //overwrite the package.json file
              fs.writeFileSync(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json', JSON.stringify(packageJson2, null, 2));
            }
            if(packageJson2.dependencies){
              console.log('packageJson2.ddependencies: '+JSON.stringify(packageJson2.dependencies));
              for (const [key, value] of Object.entries(packageJson2.dependencies)) {
                  console.log('key: '+key+' program.repoName: '+program.repoName+' key.includes(program.repoName): '+key.includes(program.repoName));
                  if(key.includes(program.repoName)){
                      console.log('delete key: '+key);
                      delete packageJson2.dependencies[key];
                  }
              }
              //overwrite the package.json file
              fs.writeFileSync(program.folder+'/'+myWorkspace+'/'+subfolder+'/package.json', JSON.stringify(packageJson2, null, 2));
            }
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