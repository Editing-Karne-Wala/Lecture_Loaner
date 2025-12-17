const { spawn } = require('child_process');
const electron = require('electron');

console.log('Bootstrapping Electron...');
console.log('Original ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);

// Force unset the variable
delete process.env.ELECTRON_RUN_AS_NODE;

console.log('Cleaned ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);
console.log('Launching Electron binary:', electron);

const child = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: process.env // Pass the cleaned environment
});

child.on('close', (code) => {
    console.log(`Electron process exited with code ${code}`);
    process.exit(code);
});
